import { Injectable } from "@nestjs/common";
import { AnalyticsMetric, AnalyticsPeriod, AnalyticsScope, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAnalyticsAggregationService } from "./platform-analytics-aggregation.service";
import type { DateRangeQueryDto } from "./dto/date-range-query.dto";

interface DailyCount {
  period: Date;
  count: bigint | number;
}

interface TrendPoint {
  date: string;
  apiRequests: number;
  webhookDeliveries: number;
}

/**
 * The "Developer Analytics" bundle for one organization - every query below
 * is filtered by `organizationId` (directly, or via the one join
 * `WebhookDelivery -> WebhookEndpoint -> Application` needs), never leaking
 * another organization's rows. Read-only, same as Phase 8's
 * `AnalyticsService` this sits alongside.
 */
@Injectable()
export class DeveloperAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: PlatformAnalyticsAggregationService,
  ) {}

  async getBundle(organizationId: string, query: DateRangeQueryDto) {
    const period = query.period ?? AnalyticsPeriod.MONTHLY;
    const { periodStart, periodEnd } = this.aggregation.resolveRange(period, query.from, query.to);

    const metric = (m: AnalyticsMetric) =>
      this.aggregation.computeMetric({
        metric: m,
        scope: AnalyticsScope.ORGANIZATION,
        organizationId,
        period,
        from: periodStart.toISOString(),
        to: periodEnd.toISOString(),
      });

    const [
      revenue,
      refundRate,
      trialConversion,
      apiUsage,
      webhookVolume,
      licenseUsage,
      dau,
      mau,
      totalCustomers,
      newCustomers,
      totalSubscriptions,
      activeSubscriptions,
      newSubscriptions,
      renewalsCount,
      trialsStarted,
      trialsConverted,
      refundsAgg,
      totalLicenses,
      activeLicenses,
      totalDevices,
      webhookDeliveryTotals,
      usageTrends,
    ] = await Promise.all([
      metric(AnalyticsMetric.REVENUE),
      metric(AnalyticsMetric.REFUND_RATE),
      metric(AnalyticsMetric.TRIAL_CONVERSION_RATE),
      metric(AnalyticsMetric.API_USAGE),
      metric(AnalyticsMetric.WEBHOOK_VOLUME),
      metric(AnalyticsMetric.LICENSE_USAGE),
      metric(AnalyticsMetric.DAILY_ACTIVE_USERS),
      metric(AnalyticsMetric.MONTHLY_ACTIVE_USERS),
      this.prisma.customer.count({ where: { organizationId } }),
      this.prisma.customer.count({
        where: { organizationId, createdAt: { gte: periodStart, lt: periodEnd } },
      }),
      this.prisma.subscription.count({ where: { organizationId } }),
      this.prisma.subscription.count({ where: { organizationId, status: "ACTIVE" } }),
      this.prisma.subscription.count({
        where: { organizationId, createdAt: { gte: periodStart, lt: periodEnd } },
      }),
      this.prisma.subscriptionEvent.count({
        where: {
          type: "RENEWED",
          createdAt: { gte: periodStart, lt: periodEnd },
          subscription: { organizationId },
        },
      }),
      this.prisma.trial.count({
        where: { startedAt: { gte: periodStart, lt: periodEnd }, product: { organizationId } },
      }),
      this.prisma.trial.count({
        where: {
          startedAt: { gte: periodStart, lt: periodEnd },
          product: { organizationId },
          OR: [{ status: "CONVERTED" }, { convertedAt: { not: null } }],
        },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          status: "SUCCEEDED",
          createdAt: { gte: periodStart, lt: periodEnd },
          transaction: { customer: { organizationId } },
        },
        _sum: { amountMinor: true },
        _count: true,
      }),
      this.prisma.license.count({ where: { organizationId } }),
      this.prisma.license.count({ where: { organizationId, status: "ACTIVE" } }),
      this.prisma.deviceRegistration.count({ where: { organizationId } }),
      this.prisma.webhookDelivery.groupBy({
        by: ["status"],
        where: { webhookEndpoint: { application: { organizationId } } },
        _count: { _all: true },
      }),
      this.usageTrends(organizationId, periodStart, periodEnd),
    ]);

    return {
      organizationId,
      period,
      periodStart,
      periodEnd,
      revenue: { value: revenue.value, breakdown: revenue.breakdown ?? [] },
      customers: { total: totalCustomers, new: newCustomers },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        new: newSubscriptions,
      },
      renewals: { count: renewalsCount },
      trials: {
        started: trialsStarted,
        converted: trialsConverted,
        conversionRate: trialConversion.value,
      },
      refunds: {
        count: refundsAgg._count,
        amountMinor: refundsAgg._sum.amountMinor ?? 0,
        refundRate: refundRate.value,
      },
      apiRequests: { count: apiUsage.value },
      webhookDeliveries: {
        total: webhookDeliveryTotals.reduce((sum, row) => sum + row._count._all, 0),
        byStatus: Object.fromEntries(
          webhookDeliveryTotals.map((row) => [row.status, row._count._all]),
        ),
        volumeInPeriod: webhookVolume.value,
      },
      licenses: {
        total: totalLicenses,
        active: activeLicenses,
        usageRate: licenseUsage.value,
      },
      devices: {
        total: totalDevices,
        dailyActive: dau.value,
        monthlyActive: mau.value,
      },
      usageTrends,
    };
  }

  /** Daily API-request and webhook-delivery counts across the resolved
   * range, for the bundle's trend chart - same `date_trunc` pattern as
   * Phase 7's `AnalyticsService.apiRequests`, just organization- instead of
   * application-scoped and merged with the webhook-side counts. */
  private async usageTrends(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<TrendPoint[]> {
    const [apiRows, webhookRows] = await Promise.all([
      this.prisma.$queryRaw<DailyCount[]>(Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS period, COUNT(*)::int AS count
        FROM "access_logs"
        WHERE "organizationId" = ${organizationId}
          AND "apiKeyId" IS NOT NULL
          AND "createdAt" >= ${periodStart} AND "createdAt" < ${periodEnd}
        GROUP BY period
        ORDER BY period ASC
      `),
      this.prisma.$queryRaw<DailyCount[]>(Prisma.sql`
        SELECT date_trunc('day', wd."createdAt") AS period, COUNT(*)::int AS count
        FROM "webhook_deliveries" wd
        JOIN "webhook_endpoints" we ON we.id = wd."webhookEndpointId"
        JOIN "applications" a ON a.id = we."applicationId"
        WHERE a."organizationId" = ${organizationId}
          AND wd."createdAt" >= ${periodStart} AND wd."createdAt" < ${periodEnd}
        GROUP BY period
        ORDER BY period ASC
      `),
    ]);

    const byDate = new Map<string, TrendPoint>();
    for (const row of apiRows) {
      const date = row.period.toISOString().slice(0, 10);
      byDate.set(date, { date, apiRequests: Number(row.count), webhookDeliveries: 0 });
    }
    for (const row of webhookRows) {
      const date = row.period.toISOString().slice(0, 10);
      const existing = byDate.get(date);
      if (existing) {
        existing.webhookDeliveries = Number(row.count);
      } else {
        byDate.set(date, { date, apiRequests: 0, webhookDeliveries: Number(row.count) });
      }
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
