import { Injectable } from "@nestjs/common";
import { JobStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

const DEAD_LETTER_DEGRADED_THRESHOLD = 20;
const PENDING_BACKLOG_DEGRADED_THRESHOLD = 500;

@Injectable()
export class QueueHealthProvider implements HealthProvider {
  readonly name = "queue";

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const [pending, deadLetter, pausedQueues] = await Promise.all([
        this.prisma.backgroundJob.count({
          where: { status: { in: [JobStatus.PENDING, JobStatus.SCHEDULED, JobStatus.RETRYING] } },
        }),
        this.prisma.backgroundJob.count({ where: { status: JobStatus.DEAD_LETTER } }),
        this.prisma.queueControl.count({ where: { paused: true } }),
      ]);

      const details = { pending, deadLetter, pausedQueues };
      if (
        deadLetter > DEAD_LETTER_DEGRADED_THRESHOLD ||
        pending > PENDING_BACKLOG_DEGRADED_THRESHOLD
      ) {
        return {
          name: this.name,
          status: "DEGRADED",
          message: "Large backlog or dead-letter accumulation",
          checkedAt: new Date().toISOString(),
          details,
        };
      }

      return { name: this.name, status: "HEALTHY", checkedAt: new Date().toISOString(), details };
    });
  }
}
