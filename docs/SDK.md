# SDK

`packages/sdk` (published as `sszentronics-sdk`) is the server-side client library for integrating entitlements, licensing, devices, and webhooks against this platform's API. It's how the "developer front" embeds the platform rather than hand-rolling HTTP calls.

Full usage docs, a quickstart, and error-handling guidance live in [`packages/sdk/README.md`](../packages/sdk/README.md) — this page is the pointer from the rest of the docs set, not a duplicate.

## What it covers

| Area                 | SDK surface                | Backed by                                                                  |
| -------------------- | -------------------------- | -------------------------------------------------------------------------- |
| Entitlements & usage | `sdk.entitlements.*`       | `apps/api/src/entitlements/public-runtime.controller.ts` (new — see below) |
| License keys         | `sdk.licenseKeys.validate` | same controller                                                            |
| Devices              | `sdk.devices.register`     | `apps/api/src/devices/public-devices.controller.ts` (new — see below)      |
| Webhooks             | `constructWebhookEvent`    | `apps/api/src/webhooks/webhook-dispatch.service.ts`'s signing scheme       |
| Checkout             | `sdk.checkout.*`           | **Not available in this repo** — see below                                 |

## Checkout is not available here

`sdk.checkout.*` wraps `/public/plans` and `/checkout-intents` — the embeddable-checkout-widget flow. That feature was built during this platform's merge-plan work and then **deliberately reverted out of this repo**, kept exclusive to the separate `marketplace` fork. This repo's `apps/api` has no `public-catalog.controller.ts` or `public-checkout-intents.controller.ts`, so `sdk.checkout.*` methods will 404 against this API. The SDK ships the module anyway since the package is meant to work against either deployment — point `baseUrl` at a `marketplace` instance if you need checkout.

## New backend surface this required

`RuntimeAuthorizationService` (`apps/api/src/entitlements/runtime-authorization.service.ts`) was already built as, in its own words, "the runtime SDK surface" — but before this SDK existed, it was only reachable from `EntitlementRuntimeController`, which is dashboard-JWT + org-role gated (a human inspecting their own org's entitlements), not usable by an integrating app's own backend at runtime.

Two new `@Public() @UseGuards(ApiKeyGuard)` controllers close that gap, both thin wrappers around already-existing, already-correct service logic:

- **`public-runtime.controller.ts`** (`/public/runtime/**`) — entitlement check/usage/increment/decrement, license-key validation. `organizationId`/`applicationId` always come from the resolved API key's own scope, never from request input.
- **`public-devices.controller.ts`** (`/public/devices`) — device registration, reusing `DevicesService.register` unchanged. Audited under a new `ApiKeySystemActorService` (`apps/api/src/common/services/`) so API-key-triggered writes are distinguishable in audit history from payment-webhook-triggered ones.

## Status

Not yet published to npm. See [`packages/sdk/README.md`](../packages/sdk/README.md#external-requirements) for the specific blockers (package name/npm org, a stable public API domain, publish CI) before that can happen.
