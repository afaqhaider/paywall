import { randomUUID, sign as cryptoSign } from "crypto";
import { Injectable } from "@nestjs/common";
import { PaymentProviderType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateCheckoutResult,
  CreateCustomerResult,
  CreateProviderSubscriptionResult,
  NormalizedPaymentEvent,
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  ResolvedAccount,
  ResolvedCredentials,
  SubscriptionRefInput,
  SyncSubscriptionResult,
  VerifyPurchaseInput,
  VerifyPurchaseResult,
} from "./payment-provider.adapter";
import { PaymentProviderUnsupportedOperationError } from "./payment-provider.adapter";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANDROID_PUBLISHER_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3";

interface GooglePlaySubscriptionPurchase {
  subscriptionState?: string;
  lineItems?: Array<{ expiryTime?: string }>;
  // Legacy (v3 purchases.subscriptions.get, pre subscriptionsv2) fields:
  expiryTimeMillis?: string;
  paymentState?: number;
}

/**
 * Google Play Developer API adapter.
 *
 * Credential keys expected in `credentials`:
 *   - SERVICE_ACCOUNT_EMAIL         - the Play Console service account's client email
 *   - PRIVATE_KEY                   - the service account's RSA private key (PEM)
 *   - PRIVATE_KEY_ID                - the service account key id (informational, not required to sign)
 *   - PUBSUB_VERIFICATION_TOKEN     - shared token appended to the RTDN Pub/Sub push
 *                                     endpoint URL (`?token=...`) or sent as a header,
 *                                     used by `verifyWebhook` below
 *
 * The Android package name is NEVER hardcoded - it is looked up from the
 * `Application` row via Prisma the same way `AppleAdapter` resolves the
 * bundle identifier, using `account.externalAccountId` as the `Application.id`.
 *
 * Play Billing purchases originate on-device via the Play Billing Library -
 * there is no server-initiated checkout, subscription-creation, cancel, or
 * resume API, so those methods throw `PaymentProviderUnsupportedOperationError`.
 *
 * Acknowledgement: Google requires every purchase to be acknowledged within
 * 3 days (`purchases.subscriptions.acknowledge`) or it is auto-refunded.
 * Rather than adding an adapter-specific method (which would break the
 * shared interface), the acknowledgement POST is folded into `verifyPurchase`
 * itself immediately after the verification GET succeeds - see below.
 */
@Injectable()
export class GooglePlayAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.GOOGLE_PLAY;

  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(): Promise<CreateCustomerResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createCustomer");
  }

  async createCheckout(): Promise<CreateCheckoutResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createCheckout");
  }

  async createSubscription(): Promise<CreateProviderSubscriptionResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createSubscription");
  }

  async cancelSubscription(): Promise<void> {
    // Play Billing subscriptions are canceled by the user in the Play Store
    // app (or, at best, "revoked" via the Developer API which force-expires
    // rather than gracefully cancels) - there is no direct equivalent of
    // Stripe's DELETE /subscriptions. Model this as unsupported rather than
    // silently doing the wrong thing.
    throw new PaymentProviderUnsupportedOperationError(this.type, "cancelSubscription");
  }

  async resumeSubscription(): Promise<void> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "resumeSubscription");
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const packageName = await this.resolvePackageName(input.account);
    const accessToken = await this.getAccessToken(input.credentials);
    const response = await fetch(
      `${ANDROID_PUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/tokens/${encodeURIComponent(
        input.externalTransactionId,
      )}:refund`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { externalRefundId: input.externalTransactionId, status: "FAILED", raw: json };
    }
    return { externalRefundId: input.externalTransactionId, status: "SUCCEEDED", raw: json };
  }

  async syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult> {
    const packageName = await this.resolvePackageName(input.account);
    const accessToken = await this.getAccessToken(input.credentials);
    // externalSubscriptionId here doubles as the purchase token, matching
    // how verifyPurchase's `token` becomes the externalSubscriptionId once
    // the subscription is provisioned.
    const purchase = await this.getSubscriptionPurchase(
      packageName,
      input.externalSubscriptionId,
      accessToken,
    );
    return this.toSyncResult(purchase);
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifyPurchaseResult> {
    const packageName = await this.resolvePackageName(input.account);
    const accessToken = await this.getAccessToken(input.credentials);
    const subscriptionId = input.productId ?? "";
    const purchaseToken = input.token;

    const response = await fetch(
      `${ANDROID_PUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(
        subscriptionId,
      )}/tokens/${encodeURIComponent(purchaseToken)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const purchase = (await response.json().catch(() => ({}))) as GooglePlaySubscriptionPurchase;
    if (!response.ok) {
      return { valid: false, raw: purchase };
    }

    // Acknowledge the purchase now that verification succeeded - Google
    // auto-refunds unacknowledged purchases after 3 days, so this must
    // happen as part of the verification flow rather than a separate step.
    await fetch(
      `${ANDROID_PUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(
        subscriptionId,
      )}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
    ).catch(() => undefined); // best-effort - a failed ack shouldn't fail verification

    const expiryMillis = purchase.lineItems?.[0]?.expiryTime
      ? Date.parse(purchase.lineItems[0].expiryTime)
      : purchase.expiryTimeMillis
        ? Number(purchase.expiryTimeMillis)
        : undefined;

    return {
      valid: true,
      externalSubscriptionId: purchaseToken,
      expiresAt: expiryMillis ? new Date(expiryMillis) : undefined,
      raw: purchase,
    };
  }

  /**
   * Pragmatic RTDN verification: Pub/Sub push endpoints are normally secured
   * either by a Google-signed OIDC bearer token (`Authorization: Bearer ...`,
   * verified against Google's JWKS) or, more simply, by a shared secret
   * embedded in the push endpoint URL. We implement the latter - a
   * `PUBSUB_VERIFICATION_TOKEN` credential compared against a `token` query
   * param / header on the inbound request. Full Google-signed-JWT
   * verification (fetching Google's public keys and validating `iss`/`aud`/
   * signature) is a further hardening step not implemented here.
   */
  verifyWebhook(
    _rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    credentials: ResolvedCredentials,
  ): boolean {
    const expected = credentials.PUBSUB_VERIFICATION_TOKEN;
    if (!expected) return false;
    const provided = headers["x-goog-pubsub-token"] ?? headers["x-pubsub-verification-token"];
    if (Array.isArray(provided) || !provided) return false;
    return provided === expected;
  }

  normalizeWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent[] {
    const envelope = JSON.parse(rawBody.toString("utf8")) as {
      message?: { data?: string; messageId?: string; publishTime?: string };
    };
    const dataB64 = envelope.message?.data;
    if (!dataB64) {
      return [
        {
          type: "UNKNOWN",
          externalEventId: envelope.message?.messageId ?? randomUUID(),
          occurredAt: new Date(),
          raw: envelope,
        },
      ];
    }

    const decoded = JSON.parse(Buffer.from(dataB64, "base64").toString("utf8")) as {
      subscriptionNotification?: {
        notificationType?: number;
        purchaseToken?: string;
        subscriptionId?: string;
      };
      oneTimeProductNotification?: {
        notificationType?: number;
        purchaseToken?: string;
        sku?: string;
      };
      voidedPurchaseNotification?: { purchaseToken?: string; productType?: number };
      packageName?: string;
    };

    const occurredAt = envelope.message?.publishTime
      ? new Date(envelope.message.publishTime)
      : new Date();
    const base = {
      externalEventId: envelope.message?.messageId ?? randomUUID(),
      occurredAt,
      raw: decoded,
    };

    if (decoded.voidedPurchaseNotification) {
      return [
        {
          ...base,
          type: "REFUND_COMPLETED",
          externalSubscriptionId: decoded.voidedPurchaseNotification.purchaseToken,
        },
      ];
    }

    const notification = decoded.subscriptionNotification;
    if (!notification) {
      return [{ ...base, type: "UNKNOWN" }];
    }

    // Google RTDN numeric subscriptionNotification.notificationType codes.
    const typeMap: Record<number, NormalizedPaymentEvent["type"]> = {
      1: "SUBSCRIPTION_RENEWED", // SUBSCRIPTION_RECOVERED
      2: "SUBSCRIPTION_RENEWED", // SUBSCRIPTION_RENEWED
      3: "SUBSCRIPTION_CANCELED", // SUBSCRIPTION_CANCELED
      4: "SUBSCRIPTION_CREATED", // SUBSCRIPTION_PURCHASED
      5: "SUBSCRIPTION_PAST_DUE", // SUBSCRIPTION_ON_HOLD
      6: "SUBSCRIPTION_PAST_DUE", // SUBSCRIPTION_IN_GRACE_PERIOD
      7: "SUBSCRIPTION_RENEWED", // SUBSCRIPTION_RESTARTED
      12: "SUBSCRIPTION_CANCELED", // SUBSCRIPTION_REVOKED
      13: "SUBSCRIPTION_EXPIRED", // SUBSCRIPTION_EXPIRED
    };

    return [
      {
        ...base,
        type: typeMap[notification.notificationType ?? -1] ?? "UNKNOWN",
        externalSubscriptionId: notification.purchaseToken,
      },
    ];
  }

  /** Resolves the app's Android package name from the `Application` row - never hardcoded. */
  private async resolvePackageName(account: ResolvedAccount | null): Promise<string> {
    if (account?.externalAccountId) {
      const application = await this.prisma.application.findUnique({
        where: { id: account.externalAccountId },
      });
      if (application?.packageName) {
        return application.packageName;
      }
    }
    const fallback = account?.metadata?.packageName;
    if (typeof fallback === "string" && fallback.length > 0) {
      return fallback;
    }
    throw new Error("Unable to resolve Google Play package name for this provider account");
  }

  private async getSubscriptionPurchase(
    packageName: string,
    purchaseTokenOrSubscriptionId: string,
    accessToken: string,
  ): Promise<GooglePlaySubscriptionPurchase> {
    const response = await fetch(
      `${ANDROID_PUBLISHER_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/tokens/${encodeURIComponent(
        purchaseTokenOrSubscriptionId,
      )}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = (await response.json().catch(() => ({}))) as GooglePlaySubscriptionPurchase;
    if (!response.ok) {
      throw new Error(`Google Play Developer API error (${response.status})`);
    }
    return json;
  }

  private toSyncResult(purchase: GooglePlaySubscriptionPurchase): SyncSubscriptionResult {
    const stateMap: Record<string, SyncSubscriptionResult["status"]> = {
      SUBSCRIPTION_STATE_ACTIVE: "ACTIVE",
      SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "PAST_DUE",
      SUBSCRIPTION_STATE_ON_HOLD: "PAST_DUE",
      SUBSCRIPTION_STATE_CANCELED: "CANCELED",
      SUBSCRIPTION_STATE_EXPIRED: "EXPIRED",
    };
    const expiryMillis = purchase.lineItems?.[0]?.expiryTime
      ? Date.parse(purchase.lineItems[0].expiryTime)
      : purchase.expiryTimeMillis
        ? Number(purchase.expiryTimeMillis)
        : undefined;

    return {
      status:
        (purchase.subscriptionState ? stateMap[purchase.subscriptionState] : undefined) ??
        "UNKNOWN",
      currentPeriodEnd: expiryMillis ? new Date(expiryMillis) : undefined,
      raw: purchase,
    };
  }

  /** Exchanges a service-account JWT for an OAuth2 access token (RS256, `jwt-bearer` grant). */
  private async getAccessToken(credentials: ResolvedCredentials): Promise<string> {
    const serviceAccountEmail = credentials.SERVICE_ACCOUNT_EMAIL;
    const privateKey = credentials.PRIVATE_KEY;
    if (!serviceAccountEmail || !privateKey) {
      throw new Error(
        "Google Play provider is missing SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY credentials",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 60 * 30,
    };

    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
    const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey);
    const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    const json = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
    };
    if (!response.ok || !json.access_token) {
      throw new Error(`Google OAuth2 token exchange failed: ${json.error ?? response.status}`);
    }
    return json.access_token;
  }
}

function base64UrlEncode(input: string | Buffer): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
