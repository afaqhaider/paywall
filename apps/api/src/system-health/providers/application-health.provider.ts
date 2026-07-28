import { Injectable } from "@nestjs/common";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

const MEMORY_DEGRADED_THRESHOLD_BYTES = 1_500 * 1024 * 1024; // 1.5GB heap used

@Injectable()
export class ApplicationHealthProvider implements HealthProvider {
  readonly name = "application";

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const memory = process.memoryUsage();
      const details = {
        uptimeSeconds: Math.round(process.uptime()),
        heapUsedBytes: memory.heapUsed,
        rssBytes: memory.rss,
        nodeVersion: process.version,
      };

      if (memory.heapUsed > MEMORY_DEGRADED_THRESHOLD_BYTES) {
        return {
          name: this.name,
          status: "DEGRADED",
          message: "Heap usage is unusually high",
          checkedAt: new Date().toISOString(),
          details,
        };
      }

      return Promise.resolve({
        name: this.name,
        status: "HEALTHY",
        checkedAt: new Date().toISOString(),
        details,
      });
    });
  }
}
