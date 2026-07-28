export type AnalyticsRange = "daily" | "monthly";

export interface ApiRequestPoint {
  period: string;
  count: number;
}

export interface AuthRequestPoint {
  period: string;
  allowed: number;
  denied: number;
}

export interface WebhookStats {
  totalDeliveries: number;
  successCount: number;
  failureCount: number;
  successRatePercent: number;
}

export interface BusinessMetrics {
  subscriptionCount: number;
  activeSubscriptionCount: number;
  activeCustomerCount: number;
  activeLicenseCount: number;
}
