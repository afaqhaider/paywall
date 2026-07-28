import { Injectable } from "@nestjs/common";
import { JobStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

/** The worker sweeps every 10s (`JobWorkerService.SWEEP_INTERVAL_MS`) - if
 * nothing has completed in 5x that window while jobs are due, the worker
 * loop itself may be stuck rather than just idle. */
const STALL_WINDOW_MS = 50_000;

@Injectable()
export class WorkerHealthProvider implements HealthProvider {
  readonly name = "worker";

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const [dueCount, recentlyProcessed] = await Promise.all([
        this.prisma.backgroundJob.count({
          where: {
            status: { in: [JobStatus.PENDING, JobStatus.RETRYING] },
            OR: [{ runAt: null }, { runAt: { lte: new Date() } }],
          },
        }),
        this.prisma.jobHistoryEntry.count({
          where: { createdAt: { gte: new Date(Date.now() - STALL_WINDOW_MS) } },
        }),
      ]);

      if (dueCount > 0 && recentlyProcessed === 0) {
        return {
          name: this.name,
          status: "DEGRADED",
          message:
            "Jobs are due but none have been processed recently - worker sweep may be stalled",
          checkedAt: new Date().toISOString(),
          details: { dueCount, recentlyProcessed },
        };
      }

      return {
        name: this.name,
        status: "HEALTHY",
        checkedAt: new Date().toISOString(),
        details: { dueCount, recentlyProcessed },
      };
    });
  }
}
