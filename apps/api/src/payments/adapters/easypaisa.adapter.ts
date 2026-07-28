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

const EASYPAISA_API_BASE = "https://easypay.easypaisa.com.pk";
const EASYPAISA_CHECKOUT_URL = "https://easypay.easypaisa.com.pk/easypay/Index.jsf";

/**
 * Easypaisa (Telenor Microfinance Bank) merchant gateway adapter.
 *
 * LOWER FIDELITY THAN STRIPE/PAYPAL: Easypaisa's merchant integration guide
 * is published behind a merchant-only developer portal, not a public REST
 * API reference, so the exact endpoint paths, field names, and response
 * shapes below are a faithful *structural* scaffold (HMAC-signed
 * request/response, merchant id + store id pattern, redirect checkout) built
 * from how this class of Pakistani mobile-wallet gateway is commonly
 * documented - they should be confirmed against Easypaisa's current
 * merchant integration guide before production use.
 *
 * Credential keys expected in `credentials`:
 *   - MERCHANT_ID  - the Easypaisa merchant/store id
 *   - HASH_KEY     - the shared secret used to HMAC-SHA256-sign requests and
 *                     verify inbound callback signatures
 *
 * Easypaisa has no first-class "customer" or native recurring-subscription
 * primitive - transactions carry the payer's mobile account number
 * directly, and a "subscription" here would mean the Subscription Engine
 * re-running checkout each period, not something this adapter can do.
 */
@Injectable()
export class EasypaisaAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.EASYPAISA;

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    return { externalCustomerId: `easypaisa_${input.customerId}` };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const merchantId = requireCredential(input.credentials, "MERCHANT_ID");
    const orderRefNum = `EP-${Date.now()}-${randomUUID().slice(0, 8)}`;

    const fields: Record<string, string> = {
      storeId: merchantId,
      orderRefNum,
      amount: (input.amountMinor / 100).toFixed(2),
      postBackURL: input.successUrl ?? "https://example.com/success",
      autoRedirect: "1",
    };
    const signature = signFields(fields, input.credentials);

    const query = new URLSearchParams({ ...fields, hash: signature }).toString();
    return {
      checkoutUrl: `${EASYPAISA_CHECKOUT_URL}?${query}`,
      providerReference: orderRefNum,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async createSubscription(): Promise<CreateProviderSubscriptionResult> {
    // Easypaisa has no native recurring-subscription primitive - recurring
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
    const fields: Record<string, string> = {
      storeId: merchantId,
      orderRefNum: input.externalTransactionId,
      ...(input.amountMinor ? { amount: (input.amountMinor / 100).toFixed(2) } : {}),
    };
    const signature = signFields(fields, input.credentials);

    const response = await fetch(`${EASYPAISA_API_BASE}/easypay-service/rest/v4/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, hash: signature }),
    });
    const json = (await response.json().catch(() => ({}))) as {
      responseCode?: string;
      refundId?: string;
    };
    return {
      externalRefundId: json.refundId ?? input.externalTransactionId,
      status: json.responseCode === "0000" ? "SUCCEEDED" : "FAILED",
      raw: json,
    };
  }

  async syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult> {
    const result = await this.inquireStatus(input.externalSubscriptionId, input.credentials);
    return {
      status: result.responseCode === "0000" ? "ACTIVE" : "UNKNOWN",
      raw: result,
    };
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifyPurchaseResult> {
    const result = await this.inquireStatus(input.token, input.credentials);
    return {
      valid: result.responseCode === "0000",
      externalTransactionId: input.token,
      raw: result,
    };
  }

  /** Signed status-inquiry POST call, matching the same structural pattern as refund/checkout. */
  private async inquireStatus(
    orderRefNum: string,
    credentials: ResolvedCredentials,
  ): Promise<{ responseCode?: string; [key: string]: unknown }> {
    const merchantId = requireCredential(credentials, "MERCHANT_ID");
    const fields: Record<string, string> = { storeId: merchantId, orderRefNum };
    const signature = signFields(fields, credentials);

    const response = await fetch(`${EASYPAISA_API_BASE}/easypay-service/rest/v4/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, hash: signature }),
    });
    return (await response.json().catch(() => ({}))) as { responseCode?: string };
  }

  verifyWebhook(
    rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
    credentials: ResolvedCredentials,
  ): boolean {
    const hashKey = credentials.HASH_KEY;
    if (!hashKey) return false;

    let callback: Record<string, unknown>;
    try {
      callback = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      return false;
    }

    const providedSignature = callback.hash as string | undefined;
    if (!providedSignature) return false;

    const { hash: _omit, ...fields } = callback;
    const expectedSignature = signFields(fields as Record<string, string>, credentials);

    const expected = Buffer.from(expectedSignature, "hex");
    const provided = Buffer.from(providedSignature, "hex");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  normalizeWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent[] {
    const callback = JSON.parse(rawBody.toString("utf8")) as {
      orderRefNum?: string;
      transactionId?: string;
      responseCode?: string; // "0000" = success in this class of gateway
      amount?: string;
      transactionDateTime?: string;
    };

    return [
      {
        type: callback.responseCode === "0000" ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED",
        externalEventId: callback.transactionId ?? callback.orderRefNum ?? randomUUID(),
        externalTransactionId: callback.transactionId ?? callback.orderRefNum,
        amountMinor: callback.amount ? Math.round(Number(callback.amount) * 100) : undefined,
        occurredAt: callback.transactionDateTime
          ? new Date(callback.transactionDateTime)
          : new Date(),
        raw: callback,
      },
    ];
  }
}

function requireCredential(credentials: ResolvedCredentials, key: string): string {
  const value = credentials[key];
  if (!value) {
    throw new Error(`Easypaisa provider is missing its ${key} credential`);
  }
  return value;
}

/** HMAC-SHA256 over a canonical (key-sorted) concatenation of the request fields, as these gateways commonly document. */
function signFields(fields: Record<string, string>, credentials: ResolvedCredentials): string {
  const hashKey = requireCredential(credentials, "HASH_KEY");
  const canonical = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("&");
  return createHmac("sha256", hashKey).update(canonical).digest("hex");
}
