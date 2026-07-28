import type { ApplicationEnvironmentType } from "./applications-types";
import type { Price } from "./products-types";

export type SubscriptionStatus =
  | "INCOMPLETE"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "GRACE_PERIOD"
  | "PAUSED"
  | "CANCELED"
  | "EXPIRED"
  | "SUSPENDED";

export type SubscriptionProvider =
  | "WEB"
  | "APPLE_APP_STORE"
  | "GOOGLE_PLAY"
  | "EASYPAISA"
  | "JAZZCASH"
  | "BANK_TRANSFER"
  | "MANUAL"
  | "OTHER";

export type SubscriptionEventType =
  | "CREATED"
  | "TRIAL_STARTED"
  | "TRIAL_CONVERTED"
  | "TRIAL_CANCELED"
  | "TRIAL_EXPIRED"
  | "ACTIVATED"
  | "RENEWED"
  | "UPGRADED"
  | "DOWNGRADED"
  | "INTERVAL_CHANGED"
  | "SEATS_CHANGED"
  | "PAUSED"
  | "RESUMED"
  | "CANCEL_SCHEDULED"
  | "CANCELED"
  | "EXPIRED"
  | "SUSPENDED"
  | "REACTIVATED"
  | "PAYMENT_FAILED"
  | "GRACE_PERIOD_STARTED"
  | "PAST_DUE"
  | "SCHEDULED_CHANGE_CREATED"
  | "SCHEDULED_CHANGE_APPLIED"
  | "SCHEDULED_CHANGE_CANCELED"
  | "COUPON_APPLIED"
  | "COUPON_REMOVED";

export type SubscriptionChangeType =
  "UPGRADE" | "DOWNGRADE" | "INTERVAL_CHANGE" | "SEAT_CHANGE" | "CANCEL_AT_PERIOD_END" | "PAUSE";

export type SubscriptionChangeStatus = "PENDING" | "APPLIED" | "CANCELED";

export type TrialStatus = "ACTIVE" | "CONVERTED" | "CANCELED" | "EXPIRED";

export interface SubscriptionItem {
  id: string;
  subscriptionId: string;
  priceId: string;
  price: Price;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  customerId: string;
  productId: string;
  planId: string;
  applicationId: string;
  environmentType: ApplicationEnvironmentType;
  provider: SubscriptionProvider;
  providerSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  cancellationReason: string | null;
  gracePeriodEnd: string | null;
  quantity: number;
  metadata: Record<string, unknown> | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items?: SubscriptionItem[];
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  type: SubscriptionEventType;
  fromStatus: SubscriptionStatus | null;
  toStatus: SubscriptionStatus | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  createdById: string | null;
  createdAt: string;
}

export interface SubscriptionChange {
  id: string;
  subscriptionId: string;
  type: SubscriptionChangeType;
  status: SubscriptionChangeStatus;
  targetPlanId: string | null;
  targetPriceId: string | null;
  targetQuantity: number | null;
  effectiveAt: string;
  appliedAt: string | null;
  canceledAt: string | null;
  metadata: Record<string, unknown> | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trial {
  id: string;
  customerId: string;
  productId: string;
  planId: string;
  subscriptionId: string | null;
  startedAt: string;
  endsAt: string;
  status: TrialStatus;
  convertedAt: string | null;
  canceledAt: string | null;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "INCOMPLETE",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "GRACE_PERIOD",
  "PAUSED",
  "CANCELED",
  "EXPIRED",
  "SUSPENDED",
];

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = [
  "WEB",
  "APPLE_APP_STORE",
  "GOOGLE_PLAY",
  "EASYPAISA",
  "JAZZCASH",
  "BANK_TRANSFER",
  "MANUAL",
  "OTHER",
];

export const SUBSCRIPTION_CHANGE_TYPES: SubscriptionChangeType[] = [
  "UPGRADE",
  "DOWNGRADE",
  "INTERVAL_CHANGE",
  "SEAT_CHANGE",
  "CANCEL_AT_PERIOD_END",
  "PAUSE",
];

/** Badge variant helper - keeps status -> color mapping in one place. */
export function subscriptionStatusVariant(
  status: SubscriptionStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
    case "TRIALING":
      return "success";
    case "PAST_DUE":
    case "GRACE_PERIOD":
    case "PAUSED":
      return "outline";
    case "CANCELED":
    case "EXPIRED":
    case "SUSPENDED":
      return "destructive";
    default:
      return "default";
  }
}
