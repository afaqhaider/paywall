import type { AutomationRule, AutomationRuleExecution } from "./admin-automation-rules-types";
import type { BackgroundJob } from "./admin-jobs-types";

export const PLATFORM_EVENT_TYPES = [
  "USER_CREATED",
  "ORGANIZATION_CREATED",
  "ORGANIZATION_SUSPENDED",
  "APPLICATION_CREATED",
  "APPLICATION_ARCHIVED",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_ACTIVATED",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_CANCELLED",
  "SUBSCRIPTION_EXPIRED",
  "TRIAL_STARTED",
  "TRIAL_ENDED",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "REFUND_CREATED",
  "CHARGEBACK_CREATED",
  "INVOICE_CREATED",
  "RECEIPT_CREATED",
  "LICENSE_CREATED",
  "LICENSE_ACTIVATED",
  "LICENSE_REVOKED",
  "DEVICE_REGISTERED",
  "DEVICE_REMOVED",
  "API_KEY_CREATED",
  "WEBHOOK_CREATED",
  "WEBHOOK_DELIVERED",
  "FINANCIAL_SYNC_STARTED",
  "FINANCIAL_SYNC_SUCCEEDED",
  "FINANCIAL_SYNC_FAILED",
  "ERP_CONNECTED",
  "ERP_DISCONNECTED",
  "NOTIFICATION_REQUESTED",
] as const;
export type PlatformEventType = (typeof PLATFORM_EVENT_TYPES)[number];

export const PLATFORM_EVENT_STATUSES = ["PENDING", "DISPATCHED", "FAILED"] as const;
export type PlatformEventStatus = (typeof PLATFORM_EVENT_STATUSES)[number];

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  payload: Record<string, unknown>;
  correlationId: string | null;
  organizationId: string | null;
  applicationId: string | null;
  customerId: string | null;
  status: PlatformEventStatus;
  createdAt: string;
}

export interface PlatformEventDetail extends PlatformEvent {
  jobs: BackgroundJob[];
  automationRuleRuns: (AutomationRuleExecution & { rule: AutomationRule })[];
}

/** Badge variant helper - only "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function eventStatusVariant(
  status: PlatformEventStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "DISPATCHED":
      return "success";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}
