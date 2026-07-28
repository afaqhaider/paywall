import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AnalyticsMetric,
  AnalyticsPeriod,
  AnalyticsScope,
  type AnalyticsSnapshot,
  BillingInterval,
  LicenseStatus,
  PaymentRefundStatus,
  PaymentTransactionStatus,
  Prisma,
  SeatStatus,
  SubscriptionStatus,
  SyncStatus,
  TrialStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Scopes every query narrows by - both fields optional, both present
 * directly (no joins needed) on every source table this engine reads. */
export interface ScopeFilter {
  organizationId?: string;
  applicationId?: string;
}

export interface CurrencyBreakdown {
  currency: string;
  amountMinor: number;
}

interface MetricResult {
  value: number;
  breakdown?: CurrencyBreakdown[];
  metadata?: Record<string, unknown>;
}

export interface MetricComputation {
  metric: AnalyticsMetric;
  scope: AnalyticsScope;
  organizationId: string | null;
  applicationId: string | null;
  period: AnalyticsPeriod;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  breakdown?: CurrencyBreakdown[];
  metadata?: Record<string, unknown>;
}

export interface ComputeMetricParams {
  metric: AnalyticsMetric;
  scope?: AnalyticsScope;
  organizationId?: string;
  applicationId?: string;
  period?: AnalyticsPeriod;
  from?: string;
  to?: string;
}

/** Subscription statuses treated as "actively billing" for MRR/churn/growth
 * purposes - ACTIVE plus the two still-collecting-money-but-troubled
 * states, matching how `SubscriptionStatus` itself is defined (PAST_DUE/
 * GRACE_PERIOD precede CANCELED/EXPIRED, they don't replace ACTIVE). */
const BILLING_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.GRACE_PERIOD,
];

const TERMINAL_SYNC_STATUSES: SyncStatus[] = [
  SyncStatus.SUCCESS,
  SyncStatus.FAILED,
  SyncStatus.DEAD_LETTER,
];

function scopeWhere(filter: ScopeFilter): Record<string, string> {
  const where: Record<string, string> = {};
  if (filter.organizationId) where.organizationId = filter.organizationId;
  if (filter.applicationId) where.applicationId = filter.applicationId;
  return where;
}

function nonEmpty(where: Record<string, unknown>): boolean {
  return Object.keys(where).length > 0;
}

/**
 * Every recurring interval normalized to "how many times this price is
 * charged per calendar month, on average" - the same
 * days-per-month/weeks-per-month averages used anywhere else in this
 * codebase that needs a day<->month conversion. LIFETIME and CUSTOM
 * intervals contribute 0: a one-time charge is not recurring revenue, and
 * CUSTOM's cadence isn't safely inferable from `intervalCount` alone.
 */
function monthlyChargeFactor(interval: BillingInterval, intervalCount: number): number {
  const count = Math.max(intervalCount, 1);
  switch (interval) {
    case BillingInterval.DAY:
      return 30.4375 / count;
    case BillingInterval.WEEK:
      return 4.345 / count;
    case BillingInterval.MONTH:
      return 1 / count;
    case BillingInterval.QUARTER:
      return 1 / (3 * count);
    case BillingInterval.SEMIANNUAL:
      return 1 / (6 * count);
    case BillingInterval.YEAR:
      return 1 / (12 * count);
    case BillingInterval.LIFETIME:
    case BillingInterval.CUSTOM:
    default:
      return 0;
  }
}

/**
 * The Phase 11 "Advanced Analytics" metric-computation engine. Every method
 * here is a pure read against Phase 3-10 source tables (Subscription,
 * PaymentTransaction, License, AccessLog, WebhookDelivery, FinancialSync,
 * ...) - `AnalyticsSnapshot` is only ever a cache of what `computeMetric`
 * already knows how to derive live, never a second source of truth.
 *
 * Multi-currency handling: this codebase has no established
 * cross-currency-conversion convention anywhere (customer-portal and
 * admin-financial both just report each row's own `currency` as-is). Every
 * monetary metric therefore returns a `breakdown: CurrencyBreakdown[]`
 * grouped by the source rows' own currency - the single scalar `value` on
 * both the live result and the cached `AnalyticsSnapshot` row is a naive
 * sum of minor units *without* FX conversion, which is only meaningful for
 * platforms operating in a single currency. Multi-currency deployments
 * should read `breakdown` (present on the live `computeMetric` result and
 * mirrored into the cached row's `metadata.byCurrency`) instead of `value`.
 */
@Injectable()
export class PlatformAnalyticsAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  async computeMetric(params: ComputeMetricParams): Promise<MetricComputation> {
    const scope = params.scope ?? AnalyticsScope.PLATFORM;

    if (scope === AnalyticsScope.ORGANIZATION && !params.organizationId) {
      throw new BadRequestException("organizationId is required when scope is ORGANIZATION");
    }
    if (scope === AnalyticsScope.APPLICATION && !params.applicationId) {
      throw new BadRequestException("applicationId is required when scope is APPLICATION");
    }

    const period = params.period ?? AnalyticsPeriod.MONTHLY;
    const { periodStart, periodEnd } = this.resolveRange(period, params.from, params.to);

    const filter: ScopeFilter = {
      organizationId: scope === AnalyticsScope.PLATFORM ? undefined : params.organizationId,
      applicationId: scope === AnalyticsScope.APPLICATION ? params.applicationId : undefined,
    };

    const result = await this.dispatch(params.metric, filter, periodStart, periodEnd);

    return {
      metric: params.metric,
      scope,
      organizationId: filter.organizationId ?? null,
      applicationId: filter.applicationId ?? null,
      period,
      periodStart,
      periodEnd,
      value: result.value,
      breakdown: result.breakdown,
      metadata: result.metadata,
    };
  }

  /**
   * Computes the metric live and upserts it into `AnalyticsSnapshot`,
   * idempotent on the table's own unique constraint. Callable on demand;
   * wiring a Phase 10 scheduled job to call this periodically for the
   * common (metric, scope) combinations is a natural follow-up and
   * explicitly out of scope here.
   */
  async computeAndCache(
    metric: AnalyticsMetric,
    scope: AnalyticsScope,
    organizationId: string | null,
    applicationId: string | null,
    period: AnalyticsPeriod,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AnalyticsSnapshot> {
    const filter: ScopeFilter = {
      organizationId: organizationId ?? undefined,
      applicationId: applicationId ?? undefined,
    };

    const result = await this.dispatch(metric, filter, periodStart, periodEnd);
    const metadata = (result.breakdown
      ? { ...(result.metadata ?? {}), byCurrency: result.breakdown }
      : result.metadata) as unknown as Prisma.InputJsonValue | undefined;

    // `upsert()` can't target this table's compound unique constraint
    // directly - Prisma's generated compound-key type requires non-null
    // `organizationId`/`applicationId`, which breaks for PLATFORM-scope
    // rows where both are genuinely null. `findFirst` + `create`/`update`
    // is the standard workaround for a unique index with nullable columns.
    const existing = await this.prisma.analyticsSnapshot.findFirst({
      where: { metric, scope, organizationId, applicationId, period, periodStart },
    });

    if (existing) {
      return this.prisma.analyticsSnapshot.update({
        where: { id: existing.id },
        data: { periodEnd, value: result.value, metadata, computedAt: new Date() },
      });
    }

    return this.prisma.analyticsSnapshot.create({
      data: {
        metric,
        scope,
        organizationId: organizationId ?? undefined,
        applicationId: applicationId ?? undefined,
        period,
        periodStart,
        periodEnd,
        value: result.value,
        metadata,
      },
    });
  }

  /** Exposed so `DeveloperAnalyticsService`/`ExecutiveDashboardService` can
   * compose several metrics against the same resolved date range without
   * each re-parsing `from`/`to`. */
  resolveRange(
    period: AnalyticsPeriod,
    from?: string,
    to?: string,
  ): { periodStart: Date; periodEnd: Date } {
    const periodEnd = to ? new Date(to) : new Date();
    if (from) {
      return { periodStart: new Date(from), periodEnd };
    }
    const periodStart = new Date(periodEnd);
    switch (period) {
      case AnalyticsPeriod.DAILY:
        periodStart.setUTCDate(periodStart.getUTCDate() - 1);
        break;
      case AnalyticsPeriod.WEEKLY:
        periodStart.setUTCDate(periodStart.getUTCDate() - 7);
        break;
      case AnalyticsPeriod.MONTHLY:
      default:
        periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
        break;
    }
    return { periodStart, periodEnd };
  }

  private async dispatch(
    metric: AnalyticsMetric,
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    switch (metric) {
      case AnalyticsMetric.MRR:
        return this.computeMRR(filter);
      case AnalyticsMetric.ARR: {
        const mrr = await this.computeMRR(filter);
        return {
          value: mrr.value * 12,
          breakdown: mrr.breakdown?.map((b) => ({
            ...b,
            amountMinor: Math.round(b.amountMinor * 12),
          })),
        };
      }
      case AnalyticsMetric.CHURN_RATE:
        return this.computeChurnRate(filter, periodStart, periodEnd);
      case AnalyticsMetric.TRIAL_CONVERSION_RATE:
        return this.computeTrialConversionRate(filter, periodStart, periodEnd);
      case AnalyticsMetric.REVENUE:
        return this.computeRevenue(filter, periodStart, periodEnd);
      case AnalyticsMetric.REFUND_RATE:
        return this.computeRefundRate(filter, periodStart, periodEnd);
      case AnalyticsMetric.CHARGEBACK_RATE:
        return this.computeChargebackRate(filter, periodStart, periodEnd);
      case AnalyticsMetric.CUSTOMER_LIFETIME_VALUE:
        return this.computeCustomerLifetimeValue(filter);
      case AnalyticsMetric.RETENTION_RATE:
        return this.computeRetentionRate(filter, periodStart, periodEnd);
      case AnalyticsMetric.GROWTH_RATE:
        return this.computeGrowthRate(filter, periodStart, periodEnd);
      case AnalyticsMetric.DAILY_ACTIVE_USERS:
        return this.computeActiveUsers(filter, periodEnd, 1);
      case AnalyticsMetric.MONTHLY_ACTIVE_USERS:
        return this.computeActiveUsers(filter, periodEnd, 30);
      case AnalyticsMetric.SEAT_UTILIZATION:
        return this.computeSeatUtilization(filter);
      case AnalyticsMetric.LICENSE_USAGE:
        return this.computeLicenseUsage(filter);
      case AnalyticsMetric.API_USAGE:
        return this.computeApiUsage(filter, periodStart, periodEnd);
      case AnalyticsMetric.WEBHOOK_VOLUME:
        return this.computeWebhookVolume(filter, periodStart, periodEnd);
      case AnalyticsMetric.STORAGE_USAGE:
        return this.computeStorageUsage(filter, periodStart, periodEnd);
      case AnalyticsMetric.FINANCIAL_SYNC_SUCCESS_RATE:
        return this.computeFinancialSyncSuccessRate(filter, periodStart, periodEnd);
      default:
        throw new BadRequestException(`Unsupported metric: ${String(metric)}`);
    }
  }

  // ---- MRR / ARR ---------------------------------------------------------

  async computeMRR(filter: ScopeFilter): Promise<MetricResult> {
    const items = await this.prisma.subscriptionItem.findMany({
      where: {
        subscription: {
          status: { in: BILLING_STATUSES },
          ...scopeWhere(filter),
        },
      },
      select: {
        quantity: true,
        price: {
          select: { amountMinor: true, currency: true, interval: true, intervalCount: true },
        },
      },
    });

    const byCurrency = new Map<string, number>();
    for (const item of items) {
      const factor = monthlyChargeFactor(item.price.interval, item.price.intervalCount);
      const monthly = item.quantity * item.price.amountMinor * factor;
      byCurrency.set(item.price.currency, (byCurrency.get(item.price.currency) ?? 0) + monthly);
    }

    const breakdown = [...byCurrency.entries()].map(([currency, amountMinor]) => ({
      currency,
      amountMinor: Math.round(amountMinor),
    }));
    const value = breakdown.reduce((sum, b) => sum + b.amountMinor, 0);
    return { value, breakdown };
  }

  // ---- Churn / trial conversion ------------------------------------------

  private async computeChurnRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const where = scopeWhere(filter);

    const [activeAtStart, canceledInPeriod] = await Promise.all([
      this.prisma.subscription.count({
        where: {
          ...where,
          createdAt: { lte: periodStart },
          status: { not: SubscriptionStatus.INCOMPLETE },
          OR: [{ canceledAt: null }, { canceledAt: { gt: periodStart } }],
        },
      }),
      this.prisma.subscription.count({
        where: {
          ...where,
          OR: [
            { canceledAt: { gte: periodStart, lt: periodEnd } },
            {
              status: SubscriptionStatus.EXPIRED,
              canceledAt: null,
              updatedAt: { gte: periodStart, lt: periodEnd },
            },
          ],
        },
      }),
    ]);

    const value = activeAtStart > 0 ? canceledInPeriod / activeAtStart : 0;
    return { value, metadata: { activeAtStart, canceledInPeriod } };
  }

  private async computeTrialConversionRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const productWhere = scopeWhere(filter);
    const product = nonEmpty(productWhere) ? productWhere : undefined;

    const [started, converted] = await Promise.all([
      this.prisma.trial.count({
        where: { startedAt: { gte: periodStart, lt: periodEnd }, product },
      }),
      this.prisma.trial.count({
        where: {
          startedAt: { gte: periodStart, lt: periodEnd },
          product,
          OR: [{ status: TrialStatus.CONVERTED }, { convertedAt: { not: null } }],
        },
      }),
    ]);

    const value = started > 0 ? converted / started : 0;
    return { value, metadata: { started, converted } };
  }

  // ---- Revenue / refunds / chargebacks ------------------------------------

  private async computeRevenue(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const customerWhere = scopeWhere(filter);
    const rows = await this.prisma.paymentTransaction.groupBy({
      by: ["currency"],
      where: {
        status: PaymentTransactionStatus.SUCCEEDED,
        createdAt: { gte: periodStart, lt: periodEnd },
        customer: nonEmpty(customerWhere) ? customerWhere : undefined,
      },
      _sum: { amountMinor: true },
    });

    const breakdown = rows.map((row) => ({
      currency: row.currency,
      amountMinor: row._sum.amountMinor ?? 0,
    }));
    const value = breakdown.reduce((sum, b) => sum + b.amountMinor, 0);
    return { value, breakdown };
  }

  private async computeRefundRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const customerWhere = scopeWhere(filter);
    const [refundAgg, revenue] = await Promise.all([
      this.prisma.paymentRefund.aggregate({
        where: {
          status: PaymentRefundStatus.SUCCEEDED,
          createdAt: { gte: periodStart, lt: periodEnd },
          transaction: { customer: nonEmpty(customerWhere) ? customerWhere : undefined },
        },
        _sum: { amountMinor: true },
      }),
      this.computeRevenue(filter, periodStart, periodEnd),
    ]);

    const refundedMinor = refundAgg._sum.amountMinor ?? 0;
    const grossRevenueMinor = revenue.value;
    const value = grossRevenueMinor > 0 ? refundedMinor / grossRevenueMinor : 0;
    return { value, metadata: { refundedMinor, grossRevenueMinor } };
  }

  private async computeChargebackRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const customerWhere = scopeWhere(filter);
    const customerFilter = nonEmpty(customerWhere) ? customerWhere : undefined;

    const [chargebacks, transactions] = await Promise.all([
      this.prisma.paymentDispute.count({
        where: {
          createdAt: { gte: periodStart, lt: periodEnd },
          transaction: { customer: customerFilter },
        },
      }),
      this.prisma.paymentTransaction.count({
        where: { createdAt: { gte: periodStart, lt: periodEnd }, customer: customerFilter },
      }),
    ]);

    const value = transactions > 0 ? chargebacks / transactions : 0;
    return { value, metadata: { chargebacks, transactions } };
  }

  // ---- Customer lifetime value / retention / growth -----------------------

  /** Simple approximation, explicitly not a cohort-based LTV model: total
   * lifetime (all-time, not period-bound) succeeded-transaction revenue
   * divided by the count of distinct paying customers in scope. Mixes
   * currencies the same way `computeRevenue`'s scalar `value` does. */
  private async computeCustomerLifetimeValue(filter: ScopeFilter): Promise<MetricResult> {
    const customerWhere = scopeWhere(filter);
    const where = {
      status: PaymentTransactionStatus.SUCCEEDED,
      customer: nonEmpty(customerWhere) ? customerWhere : undefined,
    };

    const [revenueAgg, distinctCustomers] = await Promise.all([
      this.prisma.paymentTransaction.aggregate({ where, _sum: { amountMinor: true } }),
      this.prisma.paymentTransaction.findMany({
        where,
        distinct: ["customerId"],
        select: { customerId: true },
      }),
    ]);

    const totalRevenueMinor = revenueAgg._sum.amountMinor ?? 0;
    const distinctPayingCustomers = distinctCustomers.length;
    const value = distinctPayingCustomers > 0 ? totalRevenueMinor / distinctPayingCustomers : 0;
    return { value, metadata: { totalRevenueMinor, distinctPayingCustomers } };
  }

  /** "Active" = has at least one subscription in a billing status as of
   * that instant (created on/before it, not yet canceled as of it). Both
   * snapshots are taken with the same definition so the ratio is
   * consistent even though it's an approximation of true logo retention. */
  private async computeRetentionRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const where = scopeWhere(filter);

    const activeCustomerIdsAt = async (asOf: Date): Promise<Set<string>> => {
      const rows = await this.prisma.subscription.findMany({
        where: {
          ...where,
          createdAt: { lte: asOf },
          status: { not: SubscriptionStatus.INCOMPLETE },
          OR: [{ canceledAt: null }, { canceledAt: { gt: asOf } }],
        },
        distinct: ["customerId"],
        select: { customerId: true },
      });
      return new Set(rows.map((r) => r.customerId));
    };

    const [startSet, endSet] = await Promise.all([
      activeCustomerIdsAt(periodStart),
      activeCustomerIdsAt(periodEnd),
    ]);

    let retained = 0;
    for (const customerId of startSet) {
      if (endSet.has(customerId)) retained += 1;
    }

    const value = startSet.size > 0 ? retained / startSet.size : 0;
    return {
      value,
      metadata: { activeAtStart: startSet.size, activeAtEnd: endSet.size, retained },
    };
  }

  /** PLATFORM scope (no org/app filter) measures new-organization growth;
   * ORGANIZATION/APPLICATION scope measures new-subscription growth within
   * that tenant - "growth of what" is ambiguous at the platform level
   * (new orgs is the more meaningful platform-wide signal) but unambiguous
   * once scoped to a single tenant. */
  private async computeGrowthRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const spanMs = periodEnd.getTime() - periodStart.getTime();
    const prevStart = new Date(periodStart.getTime() - spanMs);
    const prevEnd = periodStart;
    const isPlatformWide = !filter.organizationId && !filter.applicationId;

    const countNew = async (from: Date, to: Date): Promise<number> => {
      if (isPlatformWide) {
        return this.prisma.organization.count({ where: { createdAt: { gte: from, lt: to } } });
      }
      return this.prisma.subscription.count({
        where: { ...scopeWhere(filter), createdAt: { gte: from, lt: to } },
      });
    };

    const [current, previous] = await Promise.all([
      countNew(periodStart, periodEnd),
      countNew(prevStart, prevEnd),
    ]);

    const value = previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;
    return {
      value,
      metadata: {
        current,
        previous,
        basis: isPlatformWide ? "new_organizations" : "new_subscriptions",
      },
    };
  }

  // ---- Active users (DAU/MAU) ---------------------------------------------

  /** No org/app-scoped login-activity table exists (`Session` tracks
   * `userId` only, with no organization/application link) - `lastSeenAt` on
   * `DeviceRegistration` is used as a documented proxy for "was active",
   * the same approach the phase brief suggested. */
  private async computeActiveUsers(
    filter: ScopeFilter,
    referenceDate: Date,
    windowDays: number,
  ): Promise<MetricResult> {
    const since = new Date(referenceDate.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.deviceRegistration.findMany({
      where: {
        lastSeenAt: { gte: since, lte: referenceDate },
        ...scopeWhere(filter),
      },
      distinct: ["deviceId"],
      select: { deviceId: true },
    });

    return {
      value: rows.length,
      metadata: { windowDays, proxy: "device_registration_last_seen" },
    };
  }

  // ---- Seats / licenses ----------------------------------------------------

  private async computeSeatUtilization(filter: ScopeFilter): Promise<MetricResult> {
    const licenses = await this.prisma.license.findMany({
      where: scopeWhere(filter),
      select: { seatLimit: true, seats: { select: { status: true } } },
    });

    let totalSeatLimit = 0;
    let assignedSeats = 0;
    for (const license of licenses) {
      totalSeatLimit += license.seatLimit ?? 0;
      assignedSeats += license.seats.filter((seat) => seat.status === SeatStatus.ASSIGNED).length;
    }

    const value = totalSeatLimit > 0 ? assignedSeats / totalSeatLimit : 0;
    return { value, metadata: { assignedSeats, totalSeatLimit } };
  }

  private async computeLicenseUsage(filter: ScopeFilter): Promise<MetricResult> {
    const where = scopeWhere(filter);
    const [active, total] = await Promise.all([
      this.prisma.license.count({ where: { ...where, status: LicenseStatus.ACTIVE } }),
      this.prisma.license.count({ where }),
    ]);

    const value = total > 0 ? active / total : 0;
    return { value, metadata: { active, total } };
  }

  // ---- API usage / webhook volume / storage / financial sync ---------------

  /** Reuses the same `AccessLog` rows Phase 7's `AnalyticsService.apiRequests`
   * already reads (see `src/analytics/analytics.service.ts`) rather than a
   * second request-count table - `apiKeyId IS NOT NULL` is what
   * distinguishes an authenticated API call from other access-log rows. */
  private async computeApiUsage(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const count = await this.prisma.accessLog.count({
      where: {
        apiKeyId: { not: null },
        createdAt: { gte: periodStart, lt: periodEnd },
        ...scopeWhere(filter),
      },
    });

    return { value: count, metadata: { proxy: "access_log_api_key_requests" } };
  }

  private async computeWebhookVolume(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const webhookEndpointWhere: Prisma.WebhookEndpointWhereInput = {
      ...(filter.applicationId ? { applicationId: filter.applicationId } : {}),
      ...(filter.organizationId ? { application: { organizationId: filter.organizationId } } : {}),
    };

    const count = await this.prisma.webhookDelivery.count({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        webhookEndpoint:
          Object.keys(webhookEndpointWhere).length > 0 ? webhookEndpointWhere : undefined,
      },
    });

    return { value: count };
  }

  /** There is no object-storage backend anywhere in this schema (see the
   * Phase 11 schema header comment) - `ReportRequest.resultData` is the
   * only `Bytes` column that exists, so summed byte length of report
   * output in range is used as a documented storage-usage proxy. Only
   * `organizationId` narrows `ReportRequest` (it has no `applicationId`). */
  private async computeStorageUsage(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const rows = await this.prisma.$queryRaw<{ totalBytes: bigint | null }[]>(Prisma.sql`
      SELECT SUM(OCTET_LENGTH("resultData"))::bigint AS "totalBytes"
      FROM "report_requests"
      WHERE "createdAt" >= ${periodStart} AND "createdAt" < ${periodEnd}
      ${filter.organizationId ? Prisma.sql`AND "organizationId" = ${filter.organizationId}` : Prisma.empty}
    `);

    const totalBytes = Number(rows[0]?.totalBytes ?? 0n);
    return { value: totalBytes, metadata: { unit: "bytes", proxy: "report_request_result_data" } };
  }

  /** Denominator is terminal syncs only (SUCCESS/FAILED/DEAD_LETTER) -
   * PENDING/PROCESSING/RETRYING rows are still in flight and would
   * understate the success rate if counted as failures. */
  private async computeFinancialSyncSuccessRate(
    filter: ScopeFilter,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<MetricResult> {
    const where: Prisma.FinancialSyncWhereInput = {
      createdAt: { gte: periodStart, lt: periodEnd },
      status: { in: TERMINAL_SYNC_STATUSES },
      ...(filter.organizationId
        ? { financialEvent: { organizationId: filter.organizationId } }
        : {}),
    };

    const [success, total] = await Promise.all([
      this.prisma.financialSync.count({ where: { ...where, status: SyncStatus.SUCCESS } }),
      this.prisma.financialSync.count({ where }),
    ]);

    const value = total > 0 ? success / total : 0;
    return { value, metadata: { success, total } };
  }
}
