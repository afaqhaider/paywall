import type { Subscription, SubscriptionStatus } from "./subscriptions-types";

export interface AdminSubscriptionListItem extends Subscription {
  organizationName?: string;
  customerEmail?: string | null;
}

export const ADMIN_SUBSCRIPTION_STATUS_FILTERS: (SubscriptionStatus | "")[] = [
  "",
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
