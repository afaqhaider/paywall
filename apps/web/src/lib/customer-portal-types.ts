import type { DevicePlatform, DeviceStatus } from "./devices-types";
import type { Plan, Price, Product } from "./products-types";
import type {
  SubscriptionChangeStatus,
  SubscriptionChangeType,
  SubscriptionProvider,
  SubscriptionStatus,
} from "./subscriptions-types";

/** One row of `GET /customer-portal/me/customers` - the relationship between
 * the logged-in user and a Customer record they can act on behalf of (they
 * may have bought subscriptions from more than one org/app). */
export interface CustomerRelationship {
  customerId: string;
  organizationId: string;
  organizationName: string;
  applicationId: string;
  applicationName: string;
  displayName: string | null;
  type: string;
}

export interface CustomerDashboardSummary {
  activeSubscriptionCount: number;
  nextRenewalDate: string | null;
  licenseCount: number;
  deviceCount: number;
  unreadNotificationCount: number;
}

export interface CustomerSubscriptionItem {
  id: string;
  subscriptionId: string;
  priceId: string;
  price: Price;
  quantity: number;
}

/** Portal-facing subscription shape - unlike the staff `Subscription` type,
 * the API embeds `plan`/`product` directly so the portal doesn't need
 * separate lookups. */
export interface CustomerSubscription {
  id: string;
  customerId: string;
  organizationId: string;
  applicationId: string;
  productId: string;
  planId: string;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  cancellationReason: string | null;
  gracePeriodEnd: string | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  plan: Plan;
  product: Product;
  items: CustomerSubscriptionItem[];
}

export interface CustomerSubscriptionChange {
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
  createdAt: string;
}

/** Same underlying `DeviceRegistration` the staff dashboard uses, extended
 * with the new nullable `name` field the customer-api agent added so
 * customers can label their own devices. */
export interface CustomerDeviceRegistration {
  id: string;
  applicationId: string;
  deviceId: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  name: string | null;
  appVersion: string | null;
  osVersion: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Invoices/receipts/transactions are intentionally loose ("dual-mode" per
 * the customer-api contract) - render whatever fields are present rather
 * than assuming a fixed shape, since the exact fields depend on whether the
 * event came through the internal ledger or the ERP sync pipeline.
 */
export interface CustomerInvoice {
  id: string;
  status?: string;
  amountDueMinor?: number;
  amountPaidMinor?: number;
  currency?: string;
  invoiceNumber?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface InvoiceDownloadResult {
  url?: string;
  message?: string;
}

/** Same rationale as `customerTransactionStatusVariant` - the invoice status
 * vocabulary from a dual-mode (internal ledger vs. ERP-synced) response
 * isn't guaranteed to match the staff-facing `PaymentInvoiceStatus` enum. */
export function customerInvoiceStatusVariant(
  status: string | undefined,
): "default" | "success" | "destructive" | "outline" {
  switch ((status ?? "").toUpperCase()) {
    case "PAID":
      return "success";
    case "VOID":
    case "UNCOLLECTIBLE":
      return "destructive";
    case "OPEN":
    case "DRAFT":
      return "outline";
    default:
      return "default";
  }
}

export interface CustomerReceipt {
  id: string;
  receiptNumber?: string | null;
  amountMinor?: number;
  currency?: string;
  issuedAt?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CustomerTransaction {
  id: string;
  status?: string;
  amountMinor?: number;
  currency?: string;
  refunds?: unknown[];
  disputes?: unknown[];
  syncStatus?: string | null;
  erpReferenceNumber?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

/** Maps the "success/pending/failed/refund/chargeback/credit" family of
 * transaction statuses the customer portal is asked to badge - broader than
 * the staff-facing `PaymentTransactionStatus` enum since ERP-synced rows may
 * surface different vocabulary. Case-insensitive, falls back to "default". */
export function customerTransactionStatusVariant(
  status: string | undefined,
): "default" | "success" | "destructive" | "outline" {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESS":
    case "SUCCEEDED":
    case "CAPTURED":
    case "CREDIT":
      return "success";
    case "PENDING":
    case "AUTHORIZED":
      return "outline";
    case "FAILED":
    case "CANCELED":
    case "CHARGEBACK":
      return "destructive";
    case "REFUND":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "outline";
    default:
      return "default";
  }
}

export interface CustomerUsageSnapshot {
  entitlementKey: string;
  entitlementName?: string | null;
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

export interface CustomerNotification {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  read?: boolean;
  readAt?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export interface CustomerSecuritySession {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
}

export interface CustomerSecurityActivity {
  action: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface CustomerSecurityInfo {
  twoFactorEnabled: boolean;
  sessions: CustomerSecuritySession[];
  recentActivity: CustomerSecurityActivity[];
}

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUrl: string;
}

export interface TwoFactorVerifyResult {
  recoveryCodes: string[];
}

/** Mirrors the fields the existing staff `/profile` route exposes - the
 * customer-portal settings route is documented as "profile-shaped". */
export interface CustomerSettings {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string;
  language: string;
  country: string | null;
  phone: string | null;
}
