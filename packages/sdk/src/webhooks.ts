import { createHmac, timingSafeEqual } from "node:crypto";
import { SdkConfigError } from "./errors";

const SIGNATURE_HEADER_PREFIX = "sha256=";

export interface WebhookEvent<T = unknown> {
  eventType: string;
  deliveryId: string;
  payload: T;
}

/**
 * Verifies and parses an inbound webhook from the platform. Mirrors
 * `apps/api/src/webhooks/webhook-dispatch.service.ts`'s `attemptDelivery`:
 * the platform signs `HMAC-SHA256(secret, rawBody).hex()`, sends it as
 * `X-Webhook-Signature: sha256=<hex>`, plus `X-Webhook-Event` and
 * `X-Webhook-Delivery-Id` headers alongside the raw JSON body.
 *
 * `rawBody` MUST be the exact, unmodified request body bytes/text - not a
 * value re-serialized after `JSON.parse`, since the signature is computed
 * over the exact bytes the platform sent and any whitespace/key-order
 * difference from re-stringifying breaks verification. Get this from your
 * framework's raw-body middleware (e.g. Express: `express.raw()` on this
 * route, not `express.json()`), not from an already-parsed request body.
 *
 * Throws `SdkConfigError` if the signature is missing/malformed or doesn't
 * match - this is a hard failure by design (same as Stripe's
 * `constructEvent`), not a boolean return, so a webhook handler can't
 * accidentally process an unverified payload by forgetting to check a
 * return value.
 */
export function constructWebhookEvent<T = unknown>(
  rawBody: string,
  headers: {
    signature: string | undefined | null;
    eventType: string | undefined | null;
    deliveryId: string | undefined | null;
  },
  secret: string,
): WebhookEvent<T> {
  if (!headers.signature) {
    throw new SdkConfigError("Missing X-Webhook-Signature header");
  }
  if (!headers.signature.startsWith(SIGNATURE_HEADER_PREFIX)) {
    throw new SdkConfigError(`Unrecognized signature header format: "${headers.signature}"`);
  }
  if (!headers.eventType) {
    throw new SdkConfigError("Missing X-Webhook-Event header");
  }
  if (!headers.deliveryId) {
    throw new SdkConfigError("Missing X-Webhook-Delivery-Id header");
  }

  const provided = headers.signature.slice(SIGNATURE_HEADER_PREFIX.length);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureValid =
    providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

  if (!signatureValid) {
    throw new SdkConfigError("Webhook signature verification failed");
  }

  let payload: T;
  try {
    payload = JSON.parse(rawBody) as T;
  } catch {
    throw new SdkConfigError("Webhook body is not valid JSON");
  }

  return { eventType: headers.eventType, deliveryId: headers.deliveryId, payload };
}
