# Changelog

All notable changes to this SDK are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## 0.1.0 — Unreleased

Initial version. Covers all 5 planned phases:

- **Core client** — `PaywallSDK`, API-key auth, typed `SdkApiError`/`SdkConfigError`.
- **Checkout & catalog** — `listPlans`, `createIntent`, `getIntent`, `completeIntent`. Not currently backed by this repo's `apps/api` — the checkout-intent feature lives only in the `marketplace` fork; these methods 404 here until/unless that changes.
- **Entitlements & licensing** — `entitlements.check/getUsage/incrementUsage/decrementUsage`, `licenseKeys.validate`, `devices.register`. Required adding new API-key-authenticated backend routes (`/public/runtime/**`, `/public/devices`) that didn't previously exist — see `apps/api/src/entitlements/public-runtime.controller.ts` and `apps/api/src/devices/public-devices.controller.ts`.
- **Webhooks** — `constructWebhookEvent` (HMAC-SHA256 verification, matching `apps/api/src/webhooks/webhook-dispatch.service.ts`'s signing scheme exactly).
- **Packaging & DX** — this package, README quickstart, CHANGELOG, test suite (14 tests covering the HTTP client and webhook verification).

Not published to npm yet — see README's "External requirements" section.
