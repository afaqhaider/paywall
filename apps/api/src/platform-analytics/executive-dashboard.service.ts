import { Injectable } from "@nestjs/common";
import {
  AnalyticsMetric,
  AnalyticsPeriod,
  AnalyticsScope,
  Prisma,
  SyncStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { HealthService } from "../health/health.service";
import { PlatformAnalyticsAggregationService } from "./platform-analytics-aggregation.service";
import type { DateRangeQueryDto } from "./dto/date-range-query.dto";

interface RevenueByGroup {
  id: string;
  revenueMinor: bigint | number;
}

/**
 * Platform-admin-only "Executive Dashboard" - a fixed bundle of high-level
 * cross-organization signals. Every sub-metric is either delegated to
 * `PlatformAnalyticsAggregationService` (scoped PLATFORM, no org/app
 * filter) or a small standalone query here for the parts the metric engine
 * doesn't already model (top-N leaderboards, ERP adoption, infra health).
 */
@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: PlatformAnalyticsAggregationService,
    private readonly healthService: HealthService,
  ) {}

  async getDashboard(query: DateRangeQueryDto) {
    const period = query.period ?? AnalyticsPeriod.MONTHLY;
    const { periodStart, periodEnd } = this.aggregation.resolveRange(period, query.from, query.to);

    const metric = (m: AnalyticsMetric) =>
      this.aggregation.computeMetric({
        metric: m,
        scope: AnalyticsScope.PLATFORM,
        period,
        from: periodStart.toISOString(),
        to: periodEnd.toISOString(),
      });

    const [
      revenue,
      mrr,
      arr,
      growth,
      refundRate,
      chargebackRate,
      financialSyncSuccessRate,
      apiUsage,
      totalOrganizations,
      activeOrganizations,
      newOrganizations,
      totalApplications,
      activeApplications,
      newApplications,
      topApplicationRows,
      topDeveloperRows,
      topCustomerRows,
      connectedErpCount,
      infrastructureHealth,
    ] = await Promise.all([
      metric(AnalyticsMetric.REVENUE),
      metric(AnalyticsMetric.MRR),
      metric(AnalyticsMetric.ARR),
      metric(AnalyticsMetric.GROWTH_RATE),
      metric(AnalyticsMetric.REFUND_RATE),
      metric(AnalyticsMetric.CHARGEBACK_RATE),
      metric(AnalyticsMetric.FINANCIAL_SYNC_SUCCESS_RATE),
      metric(AnalyticsMetric.API_USAGE),
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: "ACTIVE" } }),
      this.prisma.organization.count({ where: { createdAt: { gte: periodStart, lt: periodEnd } } }),
      this.prisma.application.count(),
      this.prisma.application.count({ where: { status: "ACTIVE" } }),
      this.prisma.application.count({ where: { createdAt: { gte: periodStart, lt: periodEnd } } }),
      this.topApplicationsByRevenue(periodStart, periodEnd),
      this.topDevelopersByRevenue(periodStart, periodEnd),
      this.topCustomersByRevenue(periodStart, periodEnd),
      this.prisma.eRPConnection.count({ where: { status: "CONNECTED" } }),
      this.infrastructureHealth(),
    ]);

    const [topApplications, topDevelopers, topCustomers] = await Promise.all([
      this.enrichApplications(topApplicationRows),
      this.enrichOrganizations(topDeveloperRows),
      this.enrichCustomers(topCustomerRows),
    ]);

    return {
      period,
      periodStart,
      periodEnd,
      platformRevenue: { value: revenue.value, breakdown: revenue.breakdown ?? [] },
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        new: newOrganizations,
      },
      applications: { total: totalApplications, active: activeApplications, new: newApplications },
      growth: { rate: growth.value, ...growth.metadata },
      topApplications,
      topDevelopers,
      topCustomers,
      financialHealth: {
        mrr: mrr.value,
        arr: arr.value,
        mrrByCurrency: mrr.breakdown ?? [],
        refundRate: refundRate.value,
        chargebackRate: chargebackRate.value,
        financialSyncSuccessRate: financialSyncSuccessRate.value,
      },
      erpAdoption: {
        totalOrganizations,
        connectedOrganizations: connectedErpCount,
        adoptionRate: totalOrganizations > 0 ? connectedErpCount / totalOrganizations : 0,
      },
      apiUsage: { count: apiUsage.value },
      infrastructureHealth,
    };
  }

  /** Cross-organization revenue leaderboard by application - joins through
   * `Subscription.applicationId` (the field `PaymentTransaction` itself
   * lacks), so one-time transactions with no `subscriptionId` are not
   * attributable to an application and are excluded from this ranking -
   * a documented simplification, not a data leak (they're still counted in
   * `platformRevenue`). */
  private async topApplicationsByRevenue(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RevenueByGroup[]> {
    return this.prisma.$queryRaw<RevenueByGroup[]>(Prisma.sql`
      SELECT s."applicationId" AS id, SUM(pt."amountMinor")::bigint AS "revenueMinor"
      FROM "payment_transactions" pt
      JOIN "subscriptions" s ON s.id = pt."subscriptionId"
      WHERE pt.status = 'SUCCEEDED' AND pt."createdAt" >= ${periodStart} AND pt."createdAt" < ${periodEnd}
      GROUP BY s."applicationId"
      ORDER BY "revenueMinor" DESC
      LIMIT 10
    `);
  }

  private async topDevelopersByRevenue(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RevenueByGroup[]> {
    return this.prisma.$queryRaw<RevenueByGroup[]>(Prisma.sql`
      SELECT c."organizationId" AS id, SUM(pt."amountMinor")::bigint AS "revenueMinor"
      FROM "payment_transactions" pt
      JOIN "customers" c ON c.id = pt."customerId"
      WHERE pt.status = 'SUCCEEDED' AND pt."createdAt" >= ${periodStart} AND pt."createdAt" < ${periodEnd}
      GROUP BY c."organizationId"
      ORDER BY "revenueMinor" DESC
      LIMIT 10
    `);
  }

  private async topCustomersByRevenue(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RevenueByGroup[]> {
    return this.prisma.$queryRaw<RevenueByGroup[]>(Prisma.sql`
      SELECT pt."customerId" AS id, SUM(pt."amountMinor")::bigint AS "revenueMinor"
      FROM "payment_transactions" pt
      WHERE pt.status = 'SUCCEEDED' AND pt."createdAt" >= ${periodStart} AND pt."createdAt" < ${periodEnd}
      GROUP BY pt."customerId"
      ORDER BY "revenueMinor" DESC
      LIMIT 10
    `);
  }

  private async enrichApplications(rows: RevenueByGroup[]) {
    if (rows.length === 0) return [];
    const applications = await this.prisma.application.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, name: true, organizationId: true },
    });
    const byId = new Map(applications.map((a) => [a.id, a]));
    return rows.map((row) => ({
      applicationId: row.id,
      name: byId.get(row.id)?.name ?? null,
      organizationId: byId.get(row.id)?.organizationId ?? null,
      revenueMinor: Number(row.revenueMinor),
    }));
  }

  private async enrichOrganizations(rows: RevenueByGroup[]) {
    if (rows.length === 0) return [];
    const organizations = await this.prisma.organization.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, name: true, slug: true },
    });
    const byId = new Map(organizations.map((o) => [o.id, o]));
    return rows.map((row) => ({
      organizationId: row.id,
      name: byId.get(row.id)?.name ?? null,
      slug: byId.get(row.id)?.slug ?? null,
      revenueMinor: Number(row.revenueMinor),
    }));
  }

  private async enrichCustomers(rows: RevenueByGroup[]) {
    if (rows.length === 0) return [];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, displayName: true, email: true, organizationId: true },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));
    return rows.map((row) => ({
      customerId: row.id,
      displayName: byId.get(row.id)?.displayName ?? null,
      email: byId.get(row.id)?.email ?? null,
      organizationId: byId.get(row.id)?.organizationId ?? null,
      revenueMinor: Number(row.revenueMinor),
    }));
  }

  /** Same honesty standard as Phase 9's `AdminMonitoringService`: only
   * report signals backed by a real query. There is no Redis/cache layer,
   * file storage, or persisted APM data anywhere in this schema, so this
   * intentionally stays limited to DB health plus the two sweep-driven
   * queue depths that do exist. */
  private async infrastructureHealth() {
    const [health, syncQueuePending, webhookDeliveryPending] = await Promise.all([
      this.healthService.check(),
      this.prisma.syncQueue.count({
        where: { status: { in: [SyncStatus.PENDING, SyncStatus.RETRYING] } },
      }),
      this.prisma.webhookDelivery.count({ where: { status: { in: ["PENDING", "RETRYING"] } } }),
    ]);

    return {
      database: health.database,
      version: health.version,
      queueLength: { syncQueuePending, webhookDeliveryPending },
    };
  }
}
