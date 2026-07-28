import { createHmac, timingSafeEqual } from "crypto";
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
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  ResolvedCredentials,
  SubscriptionRefInput,
  SyncSubscriptionResult,
  VerifyPurchaseResult,
} from "./payment-provider.adapter";
import { PaymentProviderUnsupportedOperationError } from "./payment-provider.adapter";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** Flattens a nested object into Stripe's `a[b][c]=value` form-encoding. */
function toStripeForm(input: Record<string, unknown>, prefix = ""): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          pairs.push(...toStripeForm(item as Record<string, unknown>, `${name}[${index}]`));
        } else {
          pairs.push([`${name}[${index}]`, String(item)]);
        }
      });
    } else if (typeof value === "object") {
      pairs.push(...toStripeForm(value as Record<string, unknown>, name));
    } else {
      pairs.push([name, String(value)]);
    }
  }
  return pairs;
}

interface StripeApiError {
  error?: { message?: string; type?: string };
}

async function stripeRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  secretKey: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${STRIPE_API_BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body && method !== "GET") {
    init.body = new URLSearchParams(toStripeForm(body)).toString();
  }

  const response = await fetch(url, init);
  const json = (await response.json()) as T & StripeApiError;
  if (!response.ok) {
    throw new Error(
      `Stripe API error (${response.status}): ${json.error?.message ?? "unknown error"}`,
    );
  }
  return json;
}

function requireKey(credentials: ResolvedCredentials): string {
  const secretKey = credentials.SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe provider is missing its SECRET_KEY credential");
  }
  return secretKey;
}

/**
 * Talks to Stripe's REST API directly via `fetch` (no `stripe` SDK
 * dependency, keeping the framework provider-independent by construction -
 * every other adapter follows the same "plain HTTP + this interface"
 * shape). Webhook signature verification implements Stripe's documented
 * `Stripe-Signature: t=...,v1=...` scheme by hand.
 */
@Injectable()
export class StripeAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.STRIPE;

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const secretKey = requireKey(input.credentials);
    const customer = await stripeRequest<{ id: string }>("POST", "/customers", secretKey, {
      email: input.email,
      name: input.name,
      metadata: { ...input.metadata, platformCustomerId: input.customerId } as Record<
        string,
        unknown
      >,
    });
    return { externalCustomerId: customer.id, raw: customer };
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const secretKey = requireKey(input.credentials);
    const session = await stripeRequest<{ id: string; url: string; expires_at: number }>(
      "POST",
      "/checkout/sessions",
      secretKey,
      {
        mode: "subscription",
        customer: input.externalCustomerId,
        success_url: input.successUrl ?? "https://example.com/success",
        cancel_url: input.cancelUrl ?? "https://example.com/cancel",
        line_items: [{ price: input.providerPriceRef, quantity: 1 }],
        metadata: input.metadata as Record<string, unknown>,
      },
    );
    return {
      checkoutUrl: session.url,
      providerReference: session.id,
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  async createSubscription(
    input: CreateProviderSubscriptionInput,
  ): Promise<CreateProviderSubscriptionResult> {
    const secretKey = requireKey(input.credentials);
    const subscription = await stripeRequest<{ id: string }>("POST", "/subscriptions", secretKey, {
      customer: input.externalCustomerId,
      items: [{ price: input.providerPriceRef, quantity: input.quantity ?? 1 }],
      metadata: input.metadata as Record<string, unknown>,
    });
    return { externalSubscriptionId: subscription.id, raw: subscription };
  }

  async cancelSubscription(input: SubscriptionRefInput): Promise<void> {
    const secretKey = requireKey(input.credentials);
    await stripeRequest("DELETE", `/subscriptions/${input.externalSubscriptionId}`, secretKey);
  }

  async resumeSubscription(input: SubscriptionRefInput): Promise<void> {
    const secretKey = requireKey(input.credentials);
    await stripeRequest("POST", `/subscriptions/${input.externalSubscriptionId}`, secretKey, {
      cancel_at_period_end: false,
    });
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const secretKey = requireKey(input.credentials);
    const refund = await stripeRequest<{ id: string; status: string }>(
      "POST",
      "/refunds",
      secretKey,
      {
        payment_intent: input.externalTransactionId,
        amount: input.amountMinor,
        reason: input.reason,
      },
    );
    return {
      externalRefundId: refund.id,
      status:
        refund.status === "succeeded"
          ? "SUCCEEDED"
          : refund.status === "failed"
            ? "FAILED"
            : "PENDING",
      raw: refund,
    };
  }

  async syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult> {
    const secretKey = requireKey(input.credentials);
    const subscription = await stripeRequest<{ status: string; current_period_end: number }>(
      "GET",
      `/subscriptions/${input.externalSubscriptionId}`,
      secretKey,
    );
    const statusMap: Record<string, SyncSubscriptionResult["status"]> = {
      active: "ACTIVE",
      trialing: "ACTIVE",
      past_due: "PAST_DUE",
      canceled: "CANCELED",
      unpaid: "PAST_DUE",
      incomplete_expired: "EXPIRED",
    };
    return {
      status: statusMap[subscription.status] ?? "UNKNOWN",
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      raw: subscription,
    };
  }

  async verifyPurchase(): Promise<VerifyPurchaseResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "verifyPurchase");
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    credentials: ResolvedCredentials,
  ): boolean {
    const webhookSecret = credentials.WEBHOOK_SECRET;
    const signatureHeader = headers["stripe-signature"];
    if (!webhookSecret || !signatureHeader || Array.isArray(signatureHeader)) {
      return false;
    }

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => part.split("=") as [string, string]),
    );
    const timestamp = parts.t;
    const providedSignature = parts.v1;
    if (!timestamp || !providedSignature) {
      return false;
    }

    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const provided = Buffer.from(providedSignature, "hex");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  normalizeWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent[] {
    const event = JSON.parse(rawBody.toString("utf8")) as {
      id: string;
      type: string;
      created: number;
      data: { object: Record<string, unknown> };
    };
    const object = event.data.object;
    const occurredAt = new Date(event.created * 1000);
    const base = { externalEventId: event.id, occurredAt, raw: event };

    switch (event.type) {
      case "checkout.session.completed":
      case "invoice.paid":
      case "payment_intent.succeeded":
        return [
          {
            ...base,
            type: "PAYMENT_SUCCEEDED",
            externalCustomerId: object.customer as string | undefined,
            externalSubscriptionId: object.subscription as string | undefined,
            externalTransactionId: (object.payment_intent ?? object.id) as string | undefined,
            amountMinor: (object.amount_paid ?? object.amount) as number | undefined,
            currency: object.currency as string | undefined,
          },
        ];
      case "invoice.payment_failed":
      case "payment_intent.payment_failed":
        return [
          {
            ...base,
            type: "PAYMENT_FAILED",
            externalCustomerId: object.customer as string | undefined,
            externalSubscriptionId: object.subscription as string | undefined,
          },
        ];
      case "customer.subscription.updated":
        return [
          {
            ...base,
            type: "SUBSCRIPTION_RENEWED",
            externalCustomerId: object.customer as string | undefined,
            externalSubscriptionId: object.id as string | undefined,
          },
        ];
      case "customer.subscription.deleted":
        return [
          {
            ...base,
            type: "SUBSCRIPTION_CANCELED",
            externalCustomerId: object.customer as string | undefined,
            externalSubscriptionId: object.id as string | undefined,
          },
        ];
      case "charge.refunded":
        return [
          {
            ...base,
            type: "REFUND_COMPLETED",
            externalTransactionId: object.payment_intent as string | undefined,
            amountMinor: object.amount_refunded as number | undefined,
            currency: object.currency as string | undefined,
          },
        ];
      case "charge.dispute.created":
        return [
          {
            ...base,
            type: "CHARGEBACK_CREATED",
            externalTransactionId: object.payment_intent as string | undefined,
            amountMinor: object.amount as number | undefined,
            currency: object.currency as string | undefined,
          },
        ];
      default:
        return [{ ...base, type: "UNKNOWN" }];
    }
  }
}
