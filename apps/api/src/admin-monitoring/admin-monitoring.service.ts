import { Injectable } from "@nestjs/common";
import { PaymentTransactionStatus, SyncStatus, WebhookDeliveryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { HealthService } from "../health/health.service";

const HOURS_24_MS = 24 * 60 * 60 * 1000;

/** Two known in-process sweeps that exist today (Phase 7's webhook dispatch,
 * Phase 8's financial sync) - a static description, not a live timer
 * introspection (`setInterval` handles aren't queryable for "is it still
 * running"/"when does it next fire"). */
const BACKGROUND_JOBS = [
  { name: "webhook-dispatch-sweep", intervalMs: 30_000 },
  { name: "financial-sync-sweep", intervalMs: 30_000 },
];

function unavailable(reason: string) {
  return { available: false as const, reason };
}

/**
 * Platform operations overview. Every field is backed by a real query
 * against something that actually exists in this codebase, or an honest
 * `{ available: false, reason }` where it genuinely doesn't - there is no
 * Redis/cache layer, no file storage system, and no persisted
 * request-timing/APM data anywhere in this schema, so those three fields are
 * always `unavailable`. `workerStatus` and `backgroundJobs` describe the
 * real dispatch mechanism (in-process `setInterval` sweeps, not a worker
 * pool) rather than fabricating one.
 */
@Injectable()
export class AdminMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: HealthService,
  ) {}

  async overview() {
    const since24h = new Date(Date.now() - HOURS_24_MS);

    const [
      apiRequests,
      webhookDeliveryGroups,
      erpSyncGroups,
      paymentProcessingGroups,
      syncQueuePending,
      webhookDeliveryPending,
      health,
    ] = await Promise.all([
      this.prisma.accessLog.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.webhookDelivery.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.financialSync.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.paymentTransaction.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since24h } },
        _count: { _all: true },
      }),
      this.prisma.syncQueue.count({
        where: { status: { in: [SyncStatus.PENDING, SyncStatus.RETRYING] } },
      }),
      this.prisma.webhookDelivery.count({
        where: { status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.RETRYING] } },
      }),
      this.healthService.check(),
    ]);

    return {
      apiRequests: { last24h: apiRequests },
      webhookDeliveries: countsByKey(webhookDeliveryGroups, Object.values(WebhookDeliveryStatus)),
      erpSynchronizations: countsByKey(erpSyncGroups, Object.values(SyncStatus)),
      paymentProcessing: {
        last24h: countsByKey(paymentProcessingGroups, Object.values(PaymentTransactionStatus)),
      },
      queueLength: {
        syncQueuePending,
        webhookDeliveryPending,
      },
      workerStatus: {
        type: "in-process-interval",
        note: "sync/webhook dispatch run via setInterval within the API process, not a dedicated worker pool",
      },
      databaseStatus: {
        status: health.database,
        version: health.version,
        timestamp: health.timestamp,
      },
      cacheStatus: unavailable("no caching layer is configured in this platform"),
      storageUsage: unavailable("no file storage system exists in this platform"),
      backgroundJobs: { jobs: BACKGROUND_JOBS },
      responseTimeTracking: unavailable(
        "no request-timing telemetry is persisted; pino access logs exist but aren't aggregated",
      ),
    };
  }
}

interface GroupByCountRow {
  status: string;
  _count: { _all: number };
}

function countsByKey<K extends string>(
  rows: GroupByCountRow[],
  keys: readonly K[],
): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as K] = row._count._all;
    }
  }
  return counts;
}
