import { randomUUID, sign as cryptoSign, X509Certificate, verify as cryptoVerify } from "crypto";
import { Injectable } from "@nestjs/common";
import { PaymentProviderType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateCheckoutResult,
  CreateCustomerResult,
  CreateProviderSubscriptionResult,
  NormalizedPaymentEvent,
  PaymentProviderAdapter,
  RefundResult,
  ResolvedAccount,
  ResolvedCredentials,
  SubscriptionRefInput,
  SyncSubscriptionResult,
  VerifyPurchaseInput,
  VerifyPurchaseResult,
} from "./payment-provider.adapter";
import { PaymentProviderUnsupportedOperationError } from "./payment-provider.adapter";

/**
 * Apple App Store Server API adapter.
 *
 * Credential keys expected in `credentials` (SCREAMING_SNAKE_CASE, following
 * the convention set by StripeAdapter's `SECRET_KEY`/`WEBHOOK_SECRET`):
 *   - PRIVATE_KEY  - the App Store Connect "In-App Purchase" ES256 private key (PEM, .p8 contents)
 *   - KEY_ID       - the key id shown in App Store Connect for that private key
 *   - ISSUER_ID    - the App Store Connect issuer id (UUID)
 *
 * The bundle identifier is NEVER read from credentials or hardcoded - it is
 * looked up from the `Application` row via Prisma. The `ResolvedAccount`
 * (`account.externalAccountId`) is expected to carry the `Application.id`
 * for the app this provider account belongs to, matching how
 * `ProviderCredentialsService.resolveAccount` populates `externalAccountId`
 * from `ProviderAccount.externalAccountId` (the org configures the provider
 * account's `externalAccountId` to be the app's id when wiring up Apple).
 * Falls back to `account.metadata.bundleIdentifier` if the lookup fails,
 * for accounts that store it directly.
 *
 * App Store purchases originate on-device via StoreKit - there is no
 * server-initiated checkout, subscription-creation, cancel, or resume API,
 * so those methods throw `PaymentProviderUnsupportedOperationError`.
 */
@Injectable()
export class AppleAdapter implements PaymentProviderAdapter {
  readonly type = PaymentProviderType.APPLE_APP_STORE;

  private static readonly API_BASE = "https://api.storekit.itunes.apple.com";

  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(): Promise<CreateCustomerResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createCustomer");
  }

  async createCheckout(): Promise<CreateCheckoutResult> {
    // Apple purchases happen on-device via StoreKit's purchase sheet - there is
    // no server-initiated hosted checkout URL to generate.
    throw new PaymentProviderUnsupportedOperationError(this.type, "createCheckout");
  }

  async createSubscription(): Promise<CreateProviderSubscriptionResult> {
    throw new PaymentProviderUnsupportedOperationError(this.type, "createSubscription");
  }

  async cancelSubscription(): Promise<void> {
    // Apple subscriptions are managed by the user in Settings > Apple ID >
    // Subscriptions (or via the App Store). There is no server API for a
    // merchant to cancel a subscriber's auto-renewal on their behalf.
    throw new PaymentProviderUnsupportedOperationError(this.type, "cancelSubscription");
  }

  async resumeSubscription(): Promise<void> {
    // Same restriction as cancelSubscription - resubscribing/resuming
    // auto-renewal is entirely a user action inside Apple's own UI.
    throw new PaymentProviderUnsupportedOperationError(this.type, "resumeSubscription");
  }

  async refund(): Promise<RefundResult> {
    // Apple does not expose a real-time, server-initiated refund API. Refunds
    // go through the customer contacting Apple Support (or, for the merchant
    // side, the "Send Consumption Information" API which only supplies
    // context Apple's own refund-decision system uses - it does not itself
    // trigger a refund). Throw rather than fake success.
    throw new PaymentProviderUnsupportedOperationError(this.type, "refund");
  }

  async syncSubscription(input: SubscriptionRefInput): Promise<SyncSubscriptionResult> {
    const bundleId = await this.resolveBundleId(input.account);
    const token = await this.signServerApiJwt(input.credentials, bundleId);
    const response = await fetch(
      `${AppleAdapter.API_BASE}/inApps/v1/subscriptions/${encodeURIComponent(input.externalSubscriptionId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await response.json().catch(() => ({}))) as {
      data?: Array<{
        lastTransactions?: Array<{ status?: number; signedTransactionInfo?: string }>;
      }>;
    };
    if (!response.ok) {
      throw new Error(`Apple App Store Server API error (${response.status})`);
    }

    const lastTransaction = json.data?.[0]?.lastTransactions?.[0];
    // Apple subscription status codes: 1=active, 2=expired, 3=billing retry
    // (past due), 4=billing grace period, 5=revoked.
    const statusMap: Record<number, SyncSubscriptionResult["status"]> = {
      1: "ACTIVE",
      2: "EXPIRED",
      3: "PAST_DUE",
      4: "ACTIVE",
      5: "CANCELED",
    };
    const decoded = lastTransaction?.signedTransactionInfo
      ? decodeJwsPayload<{ expiresDate?: number }>(lastTransaction.signedTransactionInfo)
      : undefined;

    return {
      status:
        (lastTransaction?.status !== undefined ? statusMap[lastTransaction.status] : undefined) ??
        "UNKNOWN",
      currentPeriodEnd: decoded?.expiresDate ? new Date(decoded.expiresDate) : undefined,
      raw: json,
    };
  }

  async verifyPurchase(input: VerifyPurchaseInput): Promise<VerifyPurchaseResult> {
    const bundleId = await this.resolveBundleId(input.account);
    const token = await this.signServerApiJwt(input.credentials, bundleId);

    // `token` here is the transaction id (per `VerifyPurchaseInput.token` doc
    // comment: "Apple: base64 receipt or JWS transaction"). We use the
    // Transaction Info endpoint, which is the simplest single-transaction
    // verification call in the App Store Server API. (The alternative -
    // `/inApps/v1/history/{originalTransactionId}` - returns the whole
    // transaction history and would work equally well if a full history is
    // ever needed instead of a single lookup.)
    const response = await fetch(
      `${AppleAdapter.API_BASE}/inApps/v1/transactions/${encodeURIComponent(input.token)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const json = (await response.json().catch(() => ({}))) as { signedTransactionInfo?: string };
    if (!response.ok) {
      return { valid: false, raw: json };
    }

    const transaction = json.signedTransactionInfo
      ? decodeJwsPayload<{
          transactionId?: string;
          originalTransactionId?: string;
          expiresDate?: number;
        }>(json.signedTransactionInfo)
      : undefined;

    return {
      valid: Boolean(transaction),
      externalTransactionId: transaction?.transactionId,
      externalSubscriptionId: transaction?.originalTransactionId,
      expiresAt: transaction?.expiresDate ? new Date(transaction.expiresDate) : undefined,
      raw: json,
    };
  }

  /**
   * Structural verification of an App Store Server Notifications V2 JWS.
   * Full production verification must:
   *   1. Parse the `x5c` certificate chain out of the JWS protected header.
   *   2. Verify the chain up to Apple's published root CA (fetch/pin Apple's
   *      root G3 certificate) using `crypto.X509Certificate`.
   *   3. Verify the JWS signature itself against the leaf certificate's
   *      public key with `crypto.verify`.
   * Step 2 (root-of-trust pinning against Apple's actual CA bundle) is the
   * gap here - we verify the signature cryptographically against the leaf
   * cert embedded in the payload, but we do not confirm that leaf cert
   * chains to Apple's root, so a forged chain would currently pass. This
   * should be hardened with Apple's root CA bundle before production use.
   */
  verifyWebhook(rawBody: Buffer): boolean {
    try {
      const { signedPayload } = JSON.parse(rawBody.toString("utf8")) as { signedPayload?: string };
      if (!signedPayload) return false;

      const [headerB64, payloadB64, signatureB64] = signedPayload.split(".");
      if (!headerB64 || !payloadB64 || !signatureB64) return false;

      const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as {
        alg?: string;
        x5c?: string[];
      };
      const leafCertPem = header.x5c?.[0];
      if (!leafCertPem || header.alg !== "ES256") return false;

      const cert = new X509Certificate(
        `-----BEGIN CERTIFICATE-----\n${leafCertPem}\n-----END CERTIFICATE-----`,
      );
      const signingInput = `${headerB64}.${payloadB64}`;
      const derSignature = ieeeP1363ToDer(base64UrlDecode(signatureB64));
      return cryptoVerify("sha256", Buffer.from(signingInput), cert.publicKey, derSignature);
    } catch {
      return false;
    }
  }

  normalizeWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent[] {
    const { signedPayload } = JSON.parse(rawBody.toString("utf8")) as { signedPayload?: string };
    if (!signedPayload)
      return [{ type: "UNKNOWN", externalEventId: randomUUID(), occurredAt: new Date(), raw: {} }];

    const notification = decodeJwsPayload<{
      notificationType?: string;
      notificationUUID?: string;
      data?: { signedTransactionInfo?: string; signedRenewalInfo?: string };
    }>(signedPayload);

    const transaction = notification.data?.signedTransactionInfo
      ? decodeJwsPayload<{
          transactionId?: string;
          originalTransactionId?: string;
          purchaseDate?: number;
          expiresDate?: number;
          price?: number;
          currency?: string;
        }>(notification.data.signedTransactionInfo)
      : undefined;

    const base = {
      externalEventId: notification.notificationUUID ?? randomUUID(),
      externalSubscriptionId: transaction?.originalTransactionId,
      externalTransactionId: transaction?.transactionId,
      amountMinor: transaction?.price,
      currency: transaction?.currency,
      occurredAt: transaction?.purchaseDate ? new Date(transaction.purchaseDate) : new Date(),
      raw: notification,
    };

    const typeMap: Record<string, NormalizedPaymentEvent["type"]> = {
      SUBSCRIBED: "SUBSCRIPTION_CREATED",
      DID_RENEW: "SUBSCRIPTION_RENEWED",
      EXPIRED: "SUBSCRIPTION_EXPIRED",
      DID_CHANGE_RENEWAL_STATUS: "SUBSCRIPTION_PAST_DUE",
      DID_FAIL_TO_RENEW: "PAYMENT_FAILED",
      GRACE_PERIOD_EXPIRED: "SUBSCRIPTION_EXPIRED",
      REFUND: "REFUND_COMPLETED",
      REVOKE: "SUBSCRIPTION_CANCELED",
      DID_CHANGE_RENEWAL_PREF: "SUBSCRIPTION_RENEWED",
    };

    return [{ ...base, type: typeMap[notification.notificationType ?? ""] ?? "UNKNOWN" }];
  }

  /** Resolves the app's bundle identifier from the `Application` row - never hardcoded. */
  private async resolveBundleId(account: ResolvedAccount | null): Promise<string> {
    if (account?.externalAccountId) {
      const application = await this.prisma.application.findUnique({
        where: { id: account.externalAccountId },
      });
      if (application?.bundleIdentifier) {
        return application.bundleIdentifier;
      }
    }
    const fallback = account?.metadata?.bundleIdentifier;
    if (typeof fallback === "string" && fallback.length > 0) {
      return fallback;
    }
    throw new Error("Unable to resolve Apple bundle identifier for this provider account");
  }

  /**
   * Signs an App Store Server API JWT (ES256) per Apple's documented claims
   * (iss, iat, exp, aud="appstoreconnect-v1", bid).
   *
   * NOTE: ES256 signing here uses `crypto.sign("sha256", data, { key,
   * dsaEncoding: "ieee-p1363" })`, which is the correct approach for a raw
   * EC private key in Node, but the exact claim set / header fields should
   * be verified against Apple's current App Store Server API documentation
   * before production use.
   */
  private async signServerApiJwt(
    credentials: ResolvedCredentials,
    bundleId: string,
  ): Promise<string> {
    const privateKey = credentials.PRIVATE_KEY;
    const keyId = credentials.KEY_ID;
    const issuerId = credentials.ISSUER_ID;
    if (!privateKey || !keyId || !issuerId) {
      throw new Error("Apple provider is missing PRIVATE_KEY/KEY_ID/ISSUER_ID credentials");
    }

    const header = { alg: "ES256", kid: keyId, typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 60 * 20,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    };

    const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
    const signature = cryptoSign("sha256", Buffer.from(signingInput), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    });
    return `${signingInput}.${base64UrlEncode(signature)}`;
  }
}

function base64UrlEncode(input: string | Buffer): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

/** Decodes (without verifying) the payload segment of a JWS - used for App Store Server payloads, whose signature is checked separately in `verifyWebhook`. */
function decodeJwsPayload<T>(jws: string): T {
  const [, payloadB64] = jws.split(".");
  return JSON.parse(base64UrlDecode(payloadB64 ?? "").toString("utf8")) as T;
}

/** Converts an IEEE P1363 (r||s) ECDSA signature to DER, as required by `crypto.verify` for X509Certificate public keys. */
function ieeeP1363ToDer(signature: Buffer): Buffer {
  const half = signature.length / 2;
  const r = trimLeadingZeros(signature.subarray(0, half));
  const s = trimLeadingZeros(signature.subarray(half));
  const rEncoded = encodeDerInteger(r);
  const sEncoded = encodeDerInteger(s);
  const body = Buffer.concat([rEncoded, sEncoded]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

function trimLeadingZeros(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i++;
  return buf.subarray(i);
}

function encodeDerInteger(value: Buffer): Buffer {
  const needsPad = (value[0] ?? 0) & 0x80 ? 1 : 0;
  const padded = needsPad ? Buffer.concat([Buffer.from([0x00]), value]) : value;
  return Buffer.concat([Buffer.from([0x02, padded.length]), padded]);
}
