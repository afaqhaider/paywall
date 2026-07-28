import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, type JobPriority, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";

export interface EnqueueOptions {
  priority?: JobPriority;
  queueName?: string;
  runAt?: Date;
  cron?: string;
  maxAttempts?: number;
  correlationId?: string;
  sourceEventId?: string;
}

const CANCELLABLE_STATUSES: JobStatus[] = [
  JobStatus.PENDING,
  JobStatus.SCHEDULED,
  JobStatus.RETRYING,
];
const RETRYABLE_STATUSES: JobStatus[] = [JobStatus.FAILED, JobStatus.DEAD_LETTER];

/**
 * The Background Worker framework's queue-facing half: enqueue (queued/
 * immediate/delayed/recurring/priority), cancel, retry, and admin
 * queue pause/resume. `JobWorkerService` is the other half - it drains
 * what this enqueues.
 */
@Injectable()
export class BackgroundJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async enqueue(type: string, payload: Prisma.InputJsonValue, options: EnqueueOptions = {}) {
    const isScheduled = Boolean(options.runAt && options.runAt.getTime() > Date.now());
    return this.prisma.backgroundJob.create({
      data: {
        type,
        payload,
        priority: options.priority,
        queueName: options.queueName ?? "default",
        runAt: options.runAt,
        cron: options.cron,
        maxAttempts: options.maxAttempts,
        correlationId: options.correlationId,
        sourceEventId: options.sourceEventId,
        status: isScheduled ? JobStatus.SCHEDULED : JobStatus.PENDING,
      },
    });
  }

  async list(query: { queueName?: string; status?: JobStatus; type?: string; take?: number }) {
    return this.prisma.backgroundJob.findMany({
      where: {
        queueName: query.queueName,
        status: query.status,
        type: query.type,
      },
      orderBy: { createdAt: "desc" },
      take: query.take ?? 50,
    });
  }

  async getOne(jobId: string) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
      include: { history: { orderBy: { attemptNumber: "asc" } } },
    });
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return job;
  }

  async cancel(jobId: string, userId: string, meta: RequestMeta) {
    const job = await this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    if (!CANCELLABLE_STATUSES.includes(job.status)) {
      throw new BadRequestException(
        `Only pending/scheduled/retrying jobs can be cancelled (current: ${job.status})`,
      );
    }

    const updated = await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED, cancelledAt: new Date() },
    });

    await this.auditService.record({
      action: "BACKGROUND_JOB_CANCELLED",
      userId,
      metadata: { jobId, type: job.type },
      ...meta,
    });

    return updated;
  }

  async retry(jobId: string, userId: string, meta: RequestMeta) {
    const job = await this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    if (!RETRYABLE_STATUSES.includes(job.status)) {
      throw new BadRequestException(
        `Only failed/dead-lettered jobs can be retried (current: ${job.status})`,
      );
    }

    const updated = await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PENDING, nextAttemptAt: new Date(), error: null },
    });

    await this.auditService.record({
      action: "BACKGROUND_JOB_RETRIED",
      userId,
      metadata: { jobId, type: job.type },
      ...meta,
    });

    return updated;
  }

  async listQueues() {
    const [names, controls] = await Promise.all([
      this.prisma.backgroundJob.findMany({ distinct: ["queueName"], select: { queueName: true } }),
      this.prisma.queueControl.findMany(),
    ]);
    const controlByName = new Map(controls.map((c) => [c.queueName, c]));
    const allNames = new Set([
      ...names.map((n) => n.queueName),
      ...controls.map((c) => c.queueName),
      "default",
    ]);

    return Promise.all(
      Array.from(allNames).map(async (queueName) => {
        const counts = await this.prisma.backgroundJob.groupBy({
          by: ["status"],
          where: { queueName },
          _count: true,
        });
        return {
          queueName,
          paused: controlByName.get(queueName)?.paused ?? false,
          counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
        };
      }),
    );
  }

  async pauseQueue(queueName: string, userId: string, meta: RequestMeta) {
    const control = await this.prisma.queueControl.upsert({
      where: { queueName },
      create: { queueName, paused: true, pausedAt: new Date(), pausedById: userId },
      update: { paused: true, pausedAt: new Date(), pausedById: userId },
    });

    await this.auditService.record({
      action: "QUEUE_PAUSED",
      userId,
      metadata: { queueName },
      ...meta,
    });
    return control;
  }

  async resumeQueue(queueName: string, userId: string, meta: RequestMeta) {
    const control = await this.prisma.queueControl.upsert({
      where: { queueName },
      create: { queueName, paused: false },
      update: { paused: false, pausedAt: null, pausedById: null },
    });

    await this.auditService.record({
      action: "QUEUE_RESUMED",
      userId,
      metadata: { queueName },
      ...meta,
    });
    return control;
  }
}
