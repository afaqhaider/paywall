import type { PaymentProviderType } from "@prisma/client";

/**
 * Decrypted, provider-specific credential bag (e.g. `{ SECRET_KEY, WEBHOOK_SECRET }`
 * for Stripe, `{ SHARED_SECRET_KEY }` for Apple/Easypaisa/JazzCash). Keys are
 * whatever that adapter documents - resolved via `ProviderCredentialsService`
 * and never persisted outside `ProviderCredential` (encrypted at rest).
 */
export type ResolvedCredentials = Record<string, string>;

/** Non-secret identity for the connected account (Stripe account id, Apple bundle id, ...). */
export interface ResolvedAccount {
  externalAccountId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCustomerInput {
  customerId: string;
  email?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

export interface CreateCustomerResult {
  externalCustomerId: string;
  raw?: unknown;
}

export interface CreateCheckoutInput {
  externalCustomerId?: string;
  priceId: string;
  providerPriceRef?: string;
  amountMinor: number;
  currency: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerReference: string;
  expiresAt?: Date;
}

export interface CreateProviderSubscriptionInput {
  externalCustomerId: string;
  providerPriceRef: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

export interface CreateProviderSubscriptionResult {
  externalSubscriptionId: string;
  raw?: unknown;
}

export interface SubscriptionRefInput {
  externalSubscriptionId: string;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

export interface RefundInput {
  externalTransactionId: string;
  amountMinor?: number; // omitted = full refund
  reason?: string;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

export interface RefundResult {
  externalRefundId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  raw?: unknown;
}

export interface VerifyPurchaseInput {
  /** Apple: base64 receipt or JWS transaction; Google: purchase token. */
  token: string;
  productId?: string;
  credentials: ResolvedCredentials;
  account: ResolvedAccount | null;
}

export interface VerifyPurchaseResult {
  valid: boolean;
  externalTransactionId?: string;
  externalSubscriptionId?: string;
  expiresAt?: Date;
  raw?: unknown;
}

export interface SyncSubscriptionResult {
  status: "ACTIVE" | "CANCELED" | "EXPIRED" | "PAST_DUE" | "UNKNOWN";
  currentPeriodEnd?: Date;
  raw?: unknown;
}

/** One normalized platform event produced from a raw provider webhook payload. */
export interface NormalizedPaymentEvent {
  type:
    | "PAYMENT_SUCCEEDED"
    | "PAYMENT_FAILED"
    | "PAYMENT_PENDING"
    | "SUBSCRIPTION_CREATED"
    | "SUBSCRIPTION_RENEWED"
    | "SUBSCRIPTION_CANCELED"
    | "SUBSCRIPTION_EXPIRED"
    | "SUBSCRIPTION_PAST_DUE"
    | "REFUND_CREATED"
    | "REFUND_COMPLETED"
    | "CHARGEBACK_CREATED"
    | "DISPUTE_UPDATED"
    | "UNKNOWN";
  externalEventId: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  externalTransactionId?: string;
  amountMinor?: number;
  currency?: string;
  /** Only set on `DISPUTE_UPDATED` - the dispute's new resolution, when the provider's payload carries one. `WON` means the merchant kept the funds (a chargeback reversal); `LOST` means the chargeback stands. */
  disputeStatus?: "WON" | "LOST" | "UNDER_REVIEW";
  occurredAt: Date;
  raw: unknown;
}

/**
 * The one interface every payment provider implements. The Subscription
 * Engine and the webhook pipeline only ever talk to this interface -
 * they never import a provider-specific SDK or type. Adding a new
 * provider means writing one new class that implements this interface and
 * registering it in `PAYMENT_PROVIDER_ADAPTERS` (payments.module.ts);
 * nothing else in the framework changes.
 *
 * Not every provider supports every operation (e.g. Apple/Google don't
 * accept server-initiated subscription creation - purchases originate on
 * the device). Adapters that don't support an operation throw
 * `PaymentProviderUnsupportedOperationError` rather than omitting the
 * method, so the interface stays uniform for callers.
 */
export interface PaymentProviderAdapter {
  readonly type: PaymentProviderType;

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  createSubscription(
    input: CreateProviderSubscriptionInput,
  ): Promise<CreateProviderSubscriptionResult>;
  cancelSubscription(input: SubscriptionRefInput): Promise<void>;
  resumeSubscription(input: SubscriptionRefInput): Promise<void>;
  refund(input: RefundInput): Promise<RefundResult>;
  syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult>;
  verifyPurchase(input: VerifyPurchaseInput): Promise<VerifyPurchaseResult>;

  /** Verifies the inbound webhook's signature/authenticity. Must not throw for a merely-unrecognized event - only for a bad signature. */
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    credentials: ResolvedCredentials,
  ): boolean;

  /** Converts a verified raw webhook payload into one or more normalized platform events. */
  normalizeWebhookEvent(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedPaymentEvent[];
}

export class PaymentProviderUnsupportedOperationError extends Error {
  constructor(providerType: PaymentProviderType, operation: string) {
    super(`${providerType} does not support ${operation}`);
  }
}
