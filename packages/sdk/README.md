# @sscodeaxis/paywall-sdk

Server-side SDK for integrating checkout, entitlements, licensing, and webhooks against the SSCodeAxis API. Node.js only (uses the built-in `fetch` on Node 18+, and Node's `crypto` module for webhook verification) — this is meant to run in your backend, never in a browser, since it's authenticated with a secret API key.

> **Before this can talk to a real deployment**, see [External requirements](#external-requirements) below — a couple of values are placeholders until you fill them in.

## Install

```bash
npm install @sscodeaxis/paywall-sdk
```

(Not yet published — see External requirements.)

## Quickstart

```ts
import { PaywallSDK } from "@sscodeaxis/paywall-sdk";

const sdk = new PaywallSDK({
  apiKey: process.env.PLATFORM_API_KEY!, // Dashboard -> API Keys
  baseUrl: process.env.PLATFORM_API_URL!, // e.g. https://api.yourdomain.com
});
```

### Checkout

> **Not available against this repo's API.** `sdk.checkout.*` wraps the embeddable-checkout-widget routes (`/public/plans`, `/checkout-intents`), which exist in the `marketplace` fork but were deliberately kept out of this repo's `apps/api`. These methods will 404 here — included below for completeness / in case this repo's API gains the feature later, or you point `baseUrl` at a `marketplace` deployment instead.

```ts
// 1. On your backend, start a checkout for a customer:
const { id: intentId } = await sdk.checkout.createIntent({
  customerEmail: "customer@example.com",
  planId: "...",
  priceId: "...",
  successUrl: "https://yourapp.com/thanks",
  cancelUrl: "https://yourapp.com/cancelled",
});

// 2. Redirect the customer to your hosted checkout page with `intentId`.
//    On that page (customer's browser — no API key needed there):
const { intent, providers } = await sdk.checkout.getIntent(intentId);
// ...render `providers` for the customer to pick one, then:
const session = await sdk.checkout.completeIntent(intentId, providers[0].id);
```

```ts
// List your active plans/prices:
const plans = await sdk.checkout.listPlans();
```

### Entitlements & usage

```ts
const { allowed } = await sdk.entitlements.check("advanced-reports");
if (!allowed) throw new Error("Not entitled to this feature");

const usage = await sdk.entitlements.getUsage("api-calls");
console.log(`${usage.used}/${usage.limit ?? "unlimited"}`);

await sdk.entitlements.incrementUsage("api-calls"); // throws SdkApiError (403) if over limit
await sdk.entitlements.decrementUsage("api-calls"); // e.g. on a refund/undo
```

### License keys

```ts
const result = await sdk.licenseKeys.validate(userEnteredKey);
if (result.valid) {
  console.log(result.licenseId, result.status, result.expiresAt);
} else {
  console.log("Invalid:", result.reason); // "not_found" | "inactive" | "expired" | "activation_limit_reached"
}
```

### Devices

```ts
const device = await sdk.devices.register({
  deviceId: "stable-client-generated-id",
  platform: "DESKTOP", // "IOS" | "ANDROID" | "WEB" | "DESKTOP" | "OTHER"
  licenseId: license?.licenseId,
});
```

### Webhooks

```ts
import { constructWebhookEvent } from "@sscodeaxis/paywall-sdk";

// Express example — you MUST use the raw body, not an already-JSON-parsed one:
app.post("/webhooks/platform", express.raw({ type: "application/json" }), (req, res) => {
  const event = constructWebhookEvent(
    req.body.toString("utf8"),
    {
      signature: req.header("X-Webhook-Signature"),
      eventType: req.header("X-Webhook-Event"),
      deliveryId: req.header("X-Webhook-Delivery-Id"),
    },
    process.env.PLATFORM_WEBHOOK_SECRET!, // from your webhook endpoint's settings in the dashboard
  );

  switch (event.eventType) {
    case "subscription.updated":
      // handle event.payload
      break;
  }

  res.sendStatus(200);
});
```

`constructWebhookEvent` throws `SdkConfigError` if the signature is missing, malformed, or doesn't match — by design, so a handler can't accidentally process an unverified payload.

## Error handling

Every method throws:

- `SdkApiError` — a non-2xx API response. Has `.status` (HTTP status) and `.body` (parsed JSON error body, when present) so you can branch on specific cases (401 = bad/revoked key, 403 = e.g. usage limit exceeded, 404 = unknown key).
- `SdkConfigError` — client-side misuse (missing config, bad webhook signature). Never thrown for an API response.

```ts
import { SdkApiError } from "@sscodeaxis/paywall-sdk";

try {
  await sdk.entitlements.incrementUsage("api-calls");
} catch (err) {
  if (err instanceof SdkApiError && err.status === 403) {
    // over limit — prompt to upgrade
  }
  throw err;
}
```

## External requirements

Everything this SDK needs that isn't already decided — filled in with placeholders in the code/docs above, listed here so nothing gets missed before going live. See the chat summary this was built from for the full list and context.
