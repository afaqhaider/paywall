export type PaymentProviderType =
  | "STRIPE"
  | "APPLE_APP_STORE"
  | "GOOGLE_PLAY"
  | "PAYPAL"
  | "EASYPAISA"
  | "JAZZCASH"
  | "BANK_TRANSFER"
  | "MANUAL";

export type PaymentEnvironmentMode = "SANDBOX" | "PRODUCTION";
export type PaymentProviderStatus = "ACTIVE" | "DISABLED";

export type PaymentMethodType = "CARD" | "BANK_ACCOUNT" | "WALLET" | "MANUAL" | "OTHER";
export type PaymentMethodStatus = "ACTIVE" | "EXPIRED" | "REMOVED";

export type PaymentCheckoutSessionStatus = "OPEN" | "COMPLETE" | "EXPIRED" | "CANCELED";

export type PaymentTransactionStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "DISPUTED"
  | "CHARGEBACK";

export type PaymentAttemptStatus = "PENDING" | "SUCCEEDED" | "FAILED";

export type PaymentWebhookStatus = "RECEIVED" | "VERIFIED" | "PROCESSED" | "FAILED" | "IGNORED";

export type PaymentRefundStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export type PaymentDisputeStatus = "OPEN" | "UNDER_REVIEW" | "WON" | "LOST" | "ACCEPTED";

export type PaymentInvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";

export const PAYMENT_PROVIDER_TYPES: PaymentProviderType[] = [
  "STRIPE",
  "APPLE_APP_STORE",
  "GOOGLE_PLAY",
  "PAYPAL",
  "EASYPAISA",
  "JAZZCASH",
  "BANK_TRANSFER",
  "MANUAL",
];

export const PAYMENT_ENVIRONMENT_MODES: PaymentEnvironmentMode[] = ["SANDBOX", "PRODUCTION"];

export interface PaymentProvider {
  id: string;
  organizationId: string;
  type: PaymentProviderType;
  displayName: string;
  environment: PaymentEnvironmentMode;
  status: PaymentProviderStatus;
  config: Record<string, unknown> | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ProviderAccount {
  id: string;
  providerId: string;
  externalAccountId: string;
  label: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCredentialMetadata {
  id: string;
  providerId: string;
  key: string;
  lastFour: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string | null;
}

export interface PaymentCheckoutSession {
  id: string;
  providerId: string;
  customerId: string;
  productId: string | null;
  planId: string | null;
  priceId: string | null;
  subscriptionId: string | null;
  status: PaymentCheckoutSessionStatus;
  checkoutUrl: string;
  providerReference: string;
  successUrl: string | null;
  cancelUrl: string | null;
  metadata: Record<string, unknown> | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttempt {
  id: string;
  transactionId: string;
  attemptNumber: number;
  status: PaymentAttemptStatus;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export interface PaymentRefund {
  id: string;
  transactionId: string;
  amountMinor: number;
  currency: string;
  reason: string | null;
  status: PaymentRefundStatus;
  providerRefundId: string | null;
  metadata: Record<string, unknown> | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDispute {
  id: string;
  transactionId: string;
  providerDisputeId: string;
  amountMinor: number;
  currency: string;
  reason: string | null;
  status: PaymentDisputeStatus;
  evidenceDueBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  transaction?: PaymentTransaction;
}

export interface PaymentTransaction {
  id: string;
  providerId: string;
  customerId: string;
  subscriptionId: string | null;
  paymentMethodId: string | null;
  checkoutSessionId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentTransactionStatus;
  providerTransactionId: string | null;
  providerReference: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  attempts?: PaymentAttempt[];
  refunds?: PaymentRefund[];
  disputes?: PaymentDispute[];
}

export interface PaymentInvoice {
  id: string;
  providerId: string;
  customerId: string;
  subscriptionId: string | null;
  providerInvoiceId: string | null;
  amountDueMinor: number;
  amountPaidMinor: number;
  currency: string;
  status: PaymentInvoiceStatus;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWebhook {
  id: string;
  providerId: string;
  externalEventId: string;
  eventType: string;
  normalizedType: string | null;
  signatureValid: boolean;
  status: PaymentWebhookStatus;
  error: string | null;
  relatedTransactionId: string | null;
  relatedSubscriptionId: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface PaymentMethod {
  id: string;
  paymentCustomerId: string;
  providerId: string;
  type: PaymentMethodType;
  externalPaymentMethodId: string;
  brand: string | null;
  last4: string | null;
  expiresAt: string | null;
  status: PaymentMethodStatus;
  isDefault: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
}

/** Badge variant helper - keeps status -> color mapping in one place. Only
 * "default" | "success" | "destructive" | "outline" exist in @paywall/ui. */
export function transactionStatusVariant(
  status: PaymentTransactionStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "SUCCEEDED":
    case "CAPTURED":
      return "success";
    case "PENDING":
    case "AUTHORIZED":
      return "default";
    case "FAILED":
    case "CANCELED":
    case "DISPUTED":
    case "CHARGEBACK":
      return "destructive";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "outline";
    default:
      return "default";
  }
}

export function webhookStatusVariant(
  status: PaymentWebhookStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "PROCESSED":
    case "VERIFIED":
      return "success";
    case "FAILED":
      return "destructive";
    case "IGNORED":
      return "outline";
    default:
      return "default";
  }
}

export function disputeStatusVariant(
  status: PaymentDisputeStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "WON":
      return "success";
    case "LOST":
      return "destructive";
    case "ACCEPTED":
      return "outline";
    default:
      return "default";
  }
}

export function invoiceStatusVariant(
  status: PaymentInvoiceStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "success";
    case "VOID":
    case "UNCOLLECTIBLE":
      return "destructive";
    case "OPEN":
      return "outline";
    default:
      return "default";
  }
}
