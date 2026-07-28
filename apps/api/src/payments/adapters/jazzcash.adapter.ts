import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";
import { PaymentProviderType } from "@prisma/client";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateProviderSubscriptionResult,
  NormalizedPaymentEvent,
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  ResolvedCredentials,
  SubscriptionRefInput,
  SyncSubscriptionResult,
  VerifyPurchaseInput,
  VerifyPurchaseResult,
} from "./payment-provider.adapter";
import { PaymentProviderUnsupportedOperationError } from "./payment-provider.adapter";

const JAZZCASH_API_BASE = "https://payments.jazzcash.com.pk";
const JAZZCASH_CHECKOUT_URL =
  "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform";

/**
 * JazzCash merchant gateway adapter.
 *
 * LOWER FIDELITY THAN STRIPE/PAYPAL: JazzCash's merchant integration guide is
 * published behind a merchant-only developer portal, not a public REST API
 * reference, so the exact endpoint paths, field names, and response shapes
 * below are a faithful *structural* scaffold (integrity-salted HMAC-SHA256
 * request signing, `pp_` prefixed fields, redirect checkout) built from how
 * this class of Pakistani mobile-wallet gateway is commonly documented -
 * they should be confirmed against JazzCash's current merchant integration
 * guide before production use.
 *
 * Credential keys expected in `credentials`:
 *   - MERCHANT_ID     - the JazzCash merchant id (`pp_MerchantID`)
 *   - PASSWORD        - the JazzCash merchant password (`pp_Password`)
 *   - INTEGRITY_SALT  - the shared secret salt used to HMAC-SHA256-sign the
 *                        sorted, salted field string (`pp_SecureHash`) and to
 *                        verify inbound callback signatures
 *
 * JazzCash has no first-class "customer" or native recurring-subscription
 * primitive - transactions carry the payer's mobile account number
 * directly, and a "subscription" here would mean the Subscription Engine
 * re-running checkout each period, not something this adapter can do.
 */
@Injectable()
export class JazzCashAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.JAZZCASH;

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return { externalCustomerId: `jazzcash_${input.customerId}` };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const merchantId = requireCredential(input.credentials, "MERCHANT_ID");
    const password = requireCredential(input.credentials, "PASSWORD");
    const txnRefNum = `T${Date.now()}`;
    const txnDateTime = formatJazzCashDateTime(new Date());

    const fields: Record<string, string> = {
      pp_Version: "1.1",
      pp_TxnType: "MWALLET",
      pp_MerchantID: merchantId,
      pp_Password: password,
      pp_TxnRefNo: txnRefNum,
      pp_Amount: String(input.amountMinor),
      pp_TxnCurrency: input.currency,
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: input.priceId,
      pp_Description: `Subscription checkout ${input.priceId}`,
      pp_ReturnURL: input.successUrl ?? "https://example.com/success",
    };
    const secureHash = signFields(fields, input.credentials);

    const query = new URLSearchParams({ ...fields, pp_SecureHash: secureHash }).toString();
    return {
      checkoutUrl: `${JAZZCASH_CHECKOUT_URL}?${query}`,
      providerReference: txnRefNum,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async createSubscription(): Promise<CreateProviderSubscriptionResult> {
    // JazzCash has no native recurring-subscription primitive - recurring
    // payment here would mean re-running checkout each billing period, which
    // is a Subscription Engine renewal concern, not something this adapter
    // can perform server-side.
    throw new PaymentProviderUnsupportedOperationError(this.type, "createSubscription");
  }

  async cancelSubscription(): Promise<void> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "cancelSubscription");
  }

  async resumeSubscription(): Promise<void> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "resumeSubscription");
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const merchantId = requireCredential(input.credentials, "MERCHANT_ID");
    const password = requireCredential(input.credentials, "PASSWORD");
    const fields: Record<string, string> = {
      pp_MerchantID: merchantId,
      pp_Password: password,
      pp_TxnRefNo: input.externalTransactionId,
      ...(input.amountMinor ? { pp_Amount: String(input.amountMinor) } : {}),
    };
    const secureHash = signFields(fields, input.credentials);

    const response = await fetch(`${JAZZCASH_API_BASE}/ApplicationAPI/API/2.0/Purchase/Refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, pp_SecureHash: secureHash }),
    });
    const json = (await response.json().catch(() => ({}))) as {
      pp_ResponseCode?: string;
      pp_RetreivalReferenceNo?: string;
    };
    return {
      externalRefundId: json.pp_RetreivalReferenceNo ?? input.externalTransactionId,
      status: json.pp_ResponseCode === "000" ? "SUCCEEDED" : "FAILED",
      raw: json,
    };
  }

  async syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult> {
    const result = await this.inquireStatus(input.externalSubscriptionId, input.credentials);
    return {
      status: result.pp_ResponseCode === "000" ? "ACTIVE" : "UNKNOWN",
      raw: result,
    };
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifyPurchaseResult> {
    const result = await this.inquireStatus(input.token, input.credentials);
    return {
      valid: result.pp_ResponseCode === "000",
      externalTransactionId: input.token,
      raw: result,
    };
  }

  /** Signed status-inquiry POST call, matching the same structural pattern as refund/checkout. */
  private async inquireStatus(
    txnRefNum: string,
    credentials: ResolvedCredentials,
  ): Promise<{ pp_ResponseCode?: string; [key: string]: unknown }> {
    const merchantId = requireCredential(credentials, "MERCHANT_ID");
    const password = requireCredential(credentials, "PASSWORD");
    const fields: Record<string, string> = {
      pp_MerchantID: merchantId,
      pp_Password: password,
      pp_TxnRefNo: txnRefNum,
    };
    const secureHash = signFields(fields, credentials);

    const response = await fetch(`${JAZZCASH_API_BASE}/ApplicationAPI/API/2.0/Purchase/Inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, pp_SecureHash: secureHash }),
    });
    return (await response.json().catch(() => ({}))) as { pp_ResponseCode?: string };
  }

  verifyWebhook(
    rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
    credentials: ResolvedCredentials,
  ): boolean {
    const integritySalt = credentials.INTEGRITY_SALT;
    if (!integritySalt) return false;

    let callback: Record<string, unknown>;
    try {
      callback = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      return false;
    }

    const providedSignature = callback.pp_SecureHash as string | undefined;
    if (!providedSignature) return false;

    const { pp_SecureHash: _omit, ...fields } = callback;
    const expectedSignature = signFields(fields as Record<string, string>, credentials);

    const expected = Buffer.from(expectedSignature, "hex");
    const provided = Buffer.from(providedSignature, "hex");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  normalizeWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent[] {
    const callback = JSON.parse(rawBody.toString("utf8")) as {
      pp_TxnRefNo?: string;
      pp_RetreivalReferenceNo?: string;
      pp_ResponseCode?: string; // "000" = success for JazzCash
      pp_Amount?: string;
      pp_TxnDateTime?: string;
    };

    return [
      {
        type: callback.pp_ResponseCode === "000" ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED",
        externalEventId: callback.pp_RetreivalReferenceNo ?? callback.pp_TxnRefNo ?? randomUUID(),
        externalTransactionId: callback.pp_RetreivalReferenceNo ?? callback.pp_TxnRefNo,
        amountMinor: callback.pp_Amount ? Number(callback.pp_Amount) : undefined,
        occurredAt: callback.pp_TxnDateTime
          ? parseJazzCashDateTime(callback.pp_TxnDateTime)
          : new Date(),
        raw: callback,
      },
    ];
  }
}

function requireCredential(credentials: ResolvedCredentials, key: string): string {
  const value = credentials[key];
  if (!value) {
    throw new Error(`JazzCash provider is missing its ${key} credential`);
  }
  return value;
}

/** HMAC-SHA256 over the sorted, `&`-joined field values, keyed by the integrity salt (JazzCash's documented `pp_SecureHash` recipe, hand-implemented here). */
function signFields(fields: Record<string, string>, credentials: ResolvedCredentials): string {
  const integritySalt = requireCredential(credentials, "INTEGRITY_SALT");
  const canonical = Object.keys(fields)
    .filter((key) => fields[key] !== undefined && fields[key] !== "")
    .sort()
    .map((key) => fields[key])
    .join("&");
  return createHmac("sha256", integritySalt).update(canonical).digest("hex");
}

function formatJazzCashDateTime(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(
    date.getSeconds(),
  )}`;
}

function parseJazzCashDateTime(value: string): Date {
  // Expected format: yyyyMMddHHmmss
  if (!/^\d{14}$/.test(value)) return new Date();
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  return new Date(year, month, day, hour, minute, second);
}
