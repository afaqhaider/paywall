import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { JobStatus, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobProcessorRegistryService } from "./job-processor-registry.service";
import { computeNextRun } from "./schedule.util";

const SWEEP_INTERVAL_MS = 10_000;
const SWEEP_BATCH_SIZE = 20;
const MAX_BACKOFF_MINUTES = 60;

/**
 * The Background Worker: polls for due jobs (respecting per-queue pause,
 * priority order, and delayed/scheduled `runAt`), dispatches each to its
 * registered processor, and records the outcome - success, retry-with-
 * backoff, or dead-letter once `maxAttempts` is exhausted. Recurring jobs
 * (`cron` set) get their next occurrence re-enqueued on success. Mirrors
 * the exact polling-sweep shape `SyncEngineService`/`WebhookDispatchService`
 * already use in earlier phases, generalized into one reusable engine so
 * every Phase 10 feature (automation rules, scheduled tasks, notification
 * delivery) shares one worker rather than each rolling its own.
 */
@Injectable()
export class JobWorkerService implements OnModuleInit {
  private readonly logger = new Logger(JobWorkerService.name);
  private sweepHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: JobProcessorRegistryService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    this.sweepHandle = setInterval(() => {
      this.processDue().catch((error: unknown) => {
        this.logger.error("Job worker sweep failed", error instanceof Error ? error.stack : error);
      });
    }, SWEEP_INTERVAL_MS);
    this.sweepHandle.unref?.();
  }

  async processDue(): Promise<void> {
    const pausedQueues = await this.prisma.queueControl.findMany({
      where: { paused: true },
      select: { queueName: true },
    });
    const pausedNames = pausedQueues.map((q) => q.queueName);
    const now = new Date();

    const due = await this.prisma.backgroundJob.findMany({
      where: {
        status: { in: [JobStatus.PENDING, JobStatus.SCHEDULED, JobStatus.RETRYING] },
        queueName: pausedNames.length ? { notIn: pausedNames } : undefined,
        OR: [{ runAt: null }, { runAt: { lte: now } }],
        AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }],
      },
      select: { id: true },
      // JobPriority is declared LOW < NORMAL < HIGH < CRITICAL - Postgres
      // native enums compare by declaration order, so `desc` here really
      // does mean "most urgent first".
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: SWEEP_BATCH_SIZE,
    });

    for (const { id } of due) {
      await this.attempt(id).catch((error: unknown) => {
        this.logger.error(
          `Job attempt failed for ${id}`,
          error instanceof Error ? error.stack : error,
        );
      });
    }
  }

  /** Safe to call directly (e.g. right after a manual retry) or from the sweep. */
  async attempt(jobId: string): Promise<void> {
    const job = await this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === JobStatus.CANCELLED) {
      return;
    }

    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING },
    });

    const attemptNumber = job.attemptCount + 1;
    const startedAt = Date.now();
    const processor = this.registry.resolve(job.type);

    try {
      if (!processor) {
        throw new Error(`No job processor registered for type "${job.type}"`);
      }
      await processor(job.payload, job);
      const durationMs = Date.now() - startedAt;

      await this.prisma.$transaction([
        this.prisma.backgroundJob.update({
          where: { id: jobId },
          data: { status: JobStatus.SUCCESS, attemptCount: attemptNumber, completedAt: new Date() },
        }),
        this.prisma.jobHistoryEntry.create({
          data: { backgroundJobId: jobId, attemptNumber, status: JobStatus.SUCCESS, durationMs },
        }),
      ]);

      if (job.sourceEventId) {
        await this.prisma.platformEvent
          .update({ where: { id: job.sourceEventId }, data: { status: "DISPATCHED" } })
          .catch(() => undefined);
      }

      if (job.cron) {
        const nextRunAt = computeNextRun(job.cron, new Date());
        await this.prisma.backgroundJob.create({
          data: {
            type: job.type,
            payload: job.payload as Prisma.InputJsonValue,
            priority: job.priority,
            queueName: job.queueName,
            cron: job.cron,
            runAt: nextRunAt,
            maxAttempts: job.maxAttempts,
            correlationId: job.correlationId,
            status: JobStatus.SCHEDULED,
          },
        });
      }
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = attemptNumber >= job.maxAttempts;
      const finalStatus = exhausted ? JobStatus.DEAD_LETTER : JobStatus.RETRYING;
      const nextAttemptAt = exhausted ? null : this.computeBackoff(attemptNumber);

      await this.prisma.$transaction([
        this.prisma.backgroundJob.update({
          where: { id: jobId },
          data: { status: finalStatus, attemptCount: attemptNumber, nextAttemptAt, error: message },
        }),
        this.prisma.jobHistoryEntry.create({
          data: {
            backgroundJobId: jobId,
            attemptNumber,
            status: finalStatus,
            error: message,
            durationMs,
          },
        }),
      ]);

      if (job.sourceEventId && exhausted) {
        await this.prisma.platformEvent
          .update({ where: { id: job.sourceEventId }, data: { status: "FAILED" } })
          .catch(() => undefined);
      }
    }
  }

  private computeBackoff(attemptNumber: number): Date {
    const backoffMinutes = Math.min(2 ** attemptNumber, MAX_BACKOFF_MINUTES);
    return new Date(Date.now() + backoffMinutes * 60_000);
  }
}
