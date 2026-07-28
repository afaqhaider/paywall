import { Injectable } from "@nestjs/common";
import { ERPConnectionStatus, SyncStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

@Injectable()
export class ErpHealthProvider implements HealthProvider {
  readonly name = "erp";

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const [connections, failedSyncs, deadLetterSyncs] = await Promise.all([
        this.prisma.eRPConnection.groupBy({ by: ["status"], _count: true }),
        this.prisma.financialSync.count({ where: { status: SyncStatus.FAILED } }),
        this.prisma.financialSync.count({ where: { status: SyncStatus.DEAD_LETTER } }),
      ]);

      const failedConnections = connections
        .filter((c) => c.status === ERPConnectionStatus.FAILED)
        .reduce((sum, c) => sum + c._count, 0);

      const details = {
        connectionsByStatus: Object.fromEntries(connections.map((c) => [c.status, c._count])),
        failedSyncs,
        deadLetterSyncs,
      };

      if (deadLetterSyncs > 0 || failedConnections > 0) {
        return {
          name: this.name,
          status: "DEGRADED",
          message: "One or more ERP connections or syncs are in a failed state",
          checkedAt: new Date().toISOString(),
          details,
        };
      }

      return { name: this.name, status: "HEALTHY", checkedAt: new Date().toISOString(), details };
    });
  }
}
