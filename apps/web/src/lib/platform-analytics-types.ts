/** Phase 11 "Advanced Analytics" types - mirrors
 * `apps/api/src/platform-analytics/` (`PlatformAnalyticsController`,
 * `DeveloperAnalyticsController`). These shapes were confirmed by reading
 * the actual services (`platform-analytics-aggregation.service.ts`,
 * `executive-dashboard.service.ts`, `developer-analytics.service.ts`) - not
 * guessed, since the controllers had already landed by the time this file
 * was written. */

export const ANALYTICS_METRICS = [
  "MRR",
  "ARR",
  "CHURN_RATE",
  "TRIAL_CONVERSION_RATE",
  "REVENUE",
  "REFUND_RATE",
  "CHARGEBACK_RATE",
  "CUSTOMER_LIFETIME_VALUE",
  "RETENTION_RATE",
  "GROWTH_RATE",
  "DAILY_ACTIVE_USERS",
  "MONTHLY_ACTIVE_USERS",
  "SEAT_UTILIZATION",
  "LICENSE_USAGE",
  "API_USAGE",
  "WEBHOOK_VOLUME",
  "STORAGE_USAGE",
  "FINANCIAL_SYNC_SUCCESS_RATE",
] as const;
export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

export const ANALYTICS_SCOPES = ["PLATFORM", "ORGANIZATION", "APPLICATION"] as const;
export type AnalyticsScope = (typeof ANALYTICS_SCOPES)[number];

export const ANALYTICS_PERIODS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export interface CurrencyBreakdown {
  currency: string;
  amountMinor: number;
}

/** `GET /admin/analytics/platform` response - `computeMetric()`'s return
 * value. `value` is a naive cross-currency sum for monetary metrics; use
 * `breakdown` for multi-currency deployments (see the aggregation
 * service's class doc). */
export interface MetricComputation {
  metric: AnalyticsMetric;
  scope: AnalyticsScope;
  organizationId: string | null;
  applicationId: string | null;
  period: AnalyticsPeriod;
  periodStart: string;
  periodEnd: string;
  value: number;
  breakdown?: CurrencyBreakdown[];
  metadata?: Record<string, unknown>;
}

export interface TopApplicationRevenue {
  applicationId: string;
  name: string | null;
  organizationId: string | null;
  revenueMinor: number;
}

export interface TopDeveloperRevenue {
  organizationId: string;
  name: string | null;
  slug: string | null;
  revenueMinor: number;
}

export interface TopCustomerRevenue {
  customerId: string;
  displayName: string | null;
  email: string | null;
  organizationId: string | null;
  revenueMinor: number;
}

/** `GET /admin/analytics/executive-dashboard` - `ExecutiveDashboardService.getDashboard()`. */
export interface ExecutiveDashboard {
  period: AnalyticsPeriod;
  periodStart: string;
  periodEnd: string;
  platformRevenue: { value: number; breakdown: CurrencyBreakdown[] };
  organizations: { total: number; active: number; new: number };
  applications: { total: number; active: number; new: number };
  growth: { rate: number; [key: string]: unknown };
  topApplications: TopApplicationRevenue[];
  topDevelopers: TopDeveloperRevenue[];
  topCustomers: TopCustomerRevenue[];
  financialHealth: {
    mrr: number;
    arr: number;
    mrrByCurrency: CurrencyBreakdown[];
    refundRate: number;
    chargebackRate: number;
    financialSyncSuccessRate: number;
  };
  erpAdoption: {
    totalOrganizations: number;
    connectedOrganizations: number;
    adoptionRate: number;
  };
  apiUsage: { count: number };
  infrastructureHealth: {
    database: "up" | "down";
    version: string;
    queueLength: { syncQueuePending: number; webhookDeliveryPending: number };
  };
}

export interface UsageTrendPoint {
  date: string;
  apiRequests: number;
  webhookDeliveries: number;
}

/** `GET /organizations/:organizationId/analytics` - org-wide "Developer
 * Analytics" bundle, `DeveloperAnalyticsService.getBundle()`. Distinct from
 * the per-application `analytics-types.ts` bundle used by Phase 8's
 * `/dashboard/analytics` page. */
export interface DeveloperAnalyticsBundle {
  organizationId: string;
  period: AnalyticsPeriod;
  periodStart: string;
  periodEnd: string;
  revenue: { value: number; breakdown: CurrencyBreakdown[] };
  customers: { total: number; new: number };
  subscriptions: { total: number; active: number; new: number };
  renewals: { count: number };
  trials: { started: number; converted: number; conversionRate: number };
  refunds: { count: number; amountMinor: number; refundRate: number };
  apiRequests: { count: number };
  webhookDeliveries: { total: number; byStatus: Record<string, number>; volumeInPeriod: number };
  licenses: { total: number; active: number; usageRate: number };
  devices: { total: number; dailyActive: number; monthlyActive: number };
  usageTrends: UsageTrendPoint[];
}

export function metricLabel(metric: AnalyticsMetric): string {
  return metric
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
