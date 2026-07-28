import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

@Injectable()
export class DatabaseHealthProvider implements HealthProvider {
  readonly name = "database";

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const startedAt = Date.now();
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return {
          name: this.name,
          status: "HEALTHY",
          checkedAt: new Date().toISOString(),
          details: { latencyMs: Date.now() - startedAt },
        };
      } catch (error) {
        return {
          name: this.name,
          status: "DOWN",
          message: error instanceof Error ? error.message : "Database query failed",
          checkedAt: new Date().toISOString(),
        };
      }
    });
  }
}
