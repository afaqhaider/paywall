import { Injectable, Logger } from "@nestjs/common";
import type { HealthStatus, ServiceStatus } from "@paywall/types";
import { PLATFORM_VERSION } from "@paywall/shared";
import type { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const database = await this.checkDatabase();

    return {
      status: database === "up" ? "ok" : "error",
      database,
      version: process.env.PLATFORM_VERSION ?? PLATFORM_VERSION,
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "up";
    } catch (error) {
      this.logger.error("Database health check failed", error);
      return "down";
    }
  }
}
