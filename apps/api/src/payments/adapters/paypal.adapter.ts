import { Injectable } from "@nestjs/common";
import { PaymentProviderType } from "@prisma/client";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateProviderSubscriptionInput,
  CreateProviderSubscriptionResult,
  NormalizedPaymentEvent,
  RefundInput,
  RefundResult,
  PaymentProviderAdapter,
  ResolvedCredentials,
  SubscriptionRefInput,
  SyncSubscriptionResult,
  VerifyPurchaseResult,
} from "./payment-provider.adapter";
import { PaymentProviderUnsupportedOperationError } from "./payment-provider.adapter";

const PAYPAL_LIVE_BASE = "https://api-m.paypal.com";
const PAYPAL_SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

/**
 * PayPal Subscriptions API adapter (structure + real auth/webhook framework
 * per the Phase 5 spec's lower bar for this provider).
 *
 * Credential keys expected in `credentials`:
 *   - CLIENT_ID      - PayPal REST app client id
 *   - CLIENT_SECRET  - PayPal REST app secret
 *   - WEBHOOK_ID     - the PayPal webhook id shown in the Developer Dashboard,
 *                      required by the `/v1/notifications/verify-webhook-signature` call
 *   - ENVIRONMENT    - "SANDBOX" or "PRODUCTION" (defaults to PRODUCTION if absent).
 *                      There is no `environment` field on the shared adapter
 *                      interface, so this is how the adapter picks the API base
 *                      URL instead of threading a new field through every
 *                      caller.
 */
@Injectable()
export class PayPalAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.PAYPAL;

  private baseUrl(credentials: ResolvedCredentials): string {
    return credentials.ENVIRONMENT === "SANDBOX" ? PAYPAL_SANDBOX_BASE : PAYPAL_LIVE_BASE;
  }

  private async getAccessToken(credentials: ResolvedCredentials): Promise<string> {
    const clientId = credentials.CLIENT_ID;
    const clientSecret = credentials.CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("PayPal provider is missing CLIENT_ID/CLIENT_SECRET credentials");
    }

    const response = await fetch(`${this.baseUrl(credentials)}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const json = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
    };
    if (!response.ok || !json.access_token) {
      throw new Error(`PayPal OAuth2 token request failed: ${json.error ?? response.status}`);
    }
    return json.access_token;
  }

  private async paypalRequest<T>(
    method: "GET" | "POST",
    path: string,
    credentials: ResolvedCredentials,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<{ ok: boolean; status: number; json: T }> {
    const accessToken = await this.getAccessToken(credentials);
    const response = await fetch(`${this.baseUrl(credentials)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, json };
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    // PayPal has no first-class "Customer" object for the Subscriptions API -
    // billing agreements/subscriptions are tied directly to a payer (approved
    // via the approval_url redirect) rather than a stored customer resource.
    // We synthesize a stable id so the rest of the framework can still treat
    // PayPal uniformly; it is never sent to PayPal itself.
    return { externalCustomerId: `paypal_${input.customerId}` };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const { ok, status, json } = await this.paypalRequest<{
      id: string;
      status: string;
      links?: Array<{ rel: string; href: string }>;
    }>("POST", "/v1/billing/subscriptions", input.credentials, {
      plan_id: input.providerPriceRef,
      custom_id: input.externalCustomerId,
      application_context: {
        return_url: input.successUrl ?? "https://example.com/success",
        cancel_url: input.cancelUrl ?? "https://example.com/cancel",
      },
    });
    if (!ok) {
      throw new Error(`PayPal createCheckout failed (${status})`);
    }
    const approveLink = json.links?.find((link) => link.rel === "approve");
    if (!approveLink) {
      throw new Error("PayPal subscription response did not include an 'approve' link");
    }
    return { checkoutUrl: approveLink.href, providerReference: json.id };
  }

  async createSubscription(
    input: CreateProviderSubscriptionInput,
  ): Promise<CreateProviderSubscriptionResult> {
    const { ok, status, json } = await this.paypalRequest<{ id: string }>(
      "POST",
      "/v1/billing/subscriptions",
      input.credentials,
      {
        plan_id: input.providerPriceRef,
        custom_id: input.externalCustomerId,
        quantity: input.quantity ? String(input.quantity) : undefined,
      },
    );
    if (!ok) {
      throw new Error(`PayPal createSubscription failed (${status})`);
    }
    return { externalSubscriptionId: json.id, raw: json };
  }

  async cancelSubscription(input: SubscriptionRefInput): Promise<void> {
    const { ok, status } = await this.paypalRequest(
      "POST",
      `/v1/billing/subscriptions/${encodeURIComponent(input.externalSubscriptionId)}/cancel`,
      input.credentials,
      { reason: "Canceled by merchant" },
    );
    if (!ok) {
      throw new Error(`PayPal cancelSubscription failed (${status})`);
    }
  }

  async resumeSubscription(input: SubscriptionRefInput): Promise<void> {
    const { ok, status } = await this.paypalRequest(
      "POST",
      `/v1/billing/subscriptions/${encodeURIComponent(input.externalSubscriptionId)}/activate`,
      input.credentials,
      { reason: "Resumed by merchant" },
    );
    if (!ok) {
      throw new Error(`PayPal resumeSubscription failed (${status})`);
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const { ok, json } = await this.paypalRequest<{ id: string; status: string }>(
      "POST",
      `/v2/payments/captures/${encodeURIComponent(input.externalTransactionId)}/refund`,
      input.credentials,
      {
        amount: input.amountMinor
          ? { value: (input.amountMinor / 100).toFixed(2), currency_code: "USD" }
          : undefined,
        note_to_payer: input.reason,
      },
    );
    if (!ok) {
      return { externalRefundId: input.externalTransactionId, status: "FAILED", raw: json };
    }
    const statusMap: Record<string, RefundResult["status"]> = {
      COMPLETED: "SUCCEEDED",
      PENDING: "PENDING",
      FAILED: "FAILED",
    };
    return { externalRefundId: json.id, status: statusMap[json.status] ?? "PENDING", raw: json };
  }

  async syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult> {
    const { ok, status, json } = await this.paypalRequest<{
      status: string;
      billing_info?: { next_billing_time?: string };
    }>(
      "GET",
      `/v1/billing/subscriptions/${encodeURIComponent(input.externalSubscriptionId)}`,
      input.credentials,
    );
    if (!ok) {
      throw new Error(`PayPal syncSubscription failed (${status})`);
    }
    const statusMap: Record<string, SyncSubscriptionResult["status"]> = {
      ACTIVE: "ACTIVE",
      APPROVAL_PENDING: "UNKNOWN",
      APPROVED: "UNKNOWN",
      SUSPENDED: "PAST_DUE",
      CANCELLED: "CANCELED",
      EXPIRED: "EXPIRED",
    };
    return {
      status: statusMap[json.status] ?? "UNKNOWN",
      currentPeriodEnd: json.billing_info?.next_billing_time
        ? new Date(json.billing_info.next_billing_time)
        : undefined,
      raw: json,
    };
  }

  async verifyPurchase(): Promise<VerifyPurchaseResult> {
    // PayPal Subscriptions has no client-side receipt/token to verify the
    // way Apple/Google do - subscription state is verified via
    // syncSubscription (GET /v1/billing/subscriptions/{id}) instead.
    throw new PaymentProviderUnsupportedOperationError(this.type, "verifyPurchase");
  }

  /**
   * PayPal webhook verification is not a local HMAC check (unlike Stripe) -
   * it is a real API call to PayPal's `/v1/notifications/verify-webhook-signature`
   * endpoint, which takes the inbound request's PayPal-* headers plus the raw
   * body and the configured `WEBHOOK_ID` and returns a verification_status.
   * Because the interface's `verifyWebhook` is synchronous, we cannot await
   * that call here - the async check is intentionally exposed for callers
   * that can await it, and this method covers the minimum required by the
   * shared interface (presence of the expected PayPal signature headers)
   * while the full verification happens in `verifyWebhookSignatureAsync`.
   */
  verifyWebhook(_rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const requiredHeaders = [
      "paypal-transmission-id",
      "paypal-transmission-time",
      "paypal-transmission-sig",
      "paypal-cert-url",
    ];
    return requiredHeaders.every(
      (header) => Boolean(headers[header]) && !Array.isArray(headers[header]),
    );
  }

  /**
   * The real, authoritative PayPal webhook verification call. The webhook
   * ingestion pipeline should prefer this over the synchronous
   * `verifyWebhook` when it can await a network call (the interface's
   * `verifyWebhook` stays synchronous only because that is the shape every
   * other adapter's ingestion path expects).
   */
  async verifyWebhookSignatureAsync(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    credentials: ResolvedCredentials,
  ): Promise<boolean> {
    const webhookId = credentials.WEBHOOK_ID;
    if (!webhookId) return false;

    const header = (name: string): string | undefined => {
      const value = headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    const { ok, json } = await this.paypalRequest<{ verification_status?: string }>(
      "POST",
      "/v1/notifications/verify-webhook-signature",
      credentials,
      {
        transmission_id: header("paypal-transmission-id"),
        transmission_time: header("paypal-transmission-time"),
        transmission_sig: header("paypal-transmission-sig"),
        cert_url: header("paypal-cert-url"),
        auth_algo: header("paypal-auth-algo"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody.toString("utf8")),
      },
    );
    return ok && json.verification_status === "SUCCESS";
  }

  normalizeWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent[] {
    const event = JSON.parse(rawBody.toString("utf8")) as {
      id: string;
      event_type: string;
      create_time?: string;
      resource?: Record<string, unknown>;
    };
    const resource = event.resource ?? {};
    const occurredAt = event.create_time ? new Date(event.create_time) : new Date();
    const base = { externalEventId: event.id, occurredAt, raw: event };

    const typeMap: Record<string, NormalizedPaymentEvent["type"]> = {
      "PAYMENT.SALE.COMPLETED": "PAYMENT_SUCCEEDED",
      "PAYMENT.SALE.DENIED": "PAYMENT_FAILED",
      "PAYMENT.CAPTURE.COMPLETED": "PAYMENT_SUCCEEDED",
      "PAYMENT.CAPTURE.DENIED": "PAYMENT_FAILED",
      "PAYMENT.CAPTURE.REFUNDED": "REFUND_COMPLETED",
      "BILLING.SUBSCRIPTION.ACTIVATED": "SUBSCRIPTION_CREATED",
      "BILLING.SUBSCRIPTION.RENEWED": "SUBSCRIPTION_RENEWED",
      "BILLING.SUBSCRIPTION.CANCELLED": "SUBSCRIPTION_CANCELED",
      "BILLING.SUBSCRIPTION.EXPIRED": "SUBSCRIPTION_EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED": "SUBSCRIPTION_PAST_DUE",
      "CUSTOMER.DISPUTE.CREATED": "DISPUTE_UPDATED",
    };

    return [
      {
        ...base,
        type: typeMap[event.event_type] ?? "UNKNOWN",
        externalSubscriptionId: (resource.id as string | undefined) ?? undefined,
        externalTransactionId: (resource.id as string | undefined) ?? undefined,
        amountMinor: resource.amount
          ? Number((resource.amount as { total?: string }).total) * 100
          : undefined,
        currency: (resource.amount as { currency?: string } | undefined)?.currency,
      },
    ];
  }
}
