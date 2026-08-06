# Architecture

## Overview

The **SS Zentronics Platform** ("paywall") is a monorepo housing every
service required to run a self-hosted RevenueCat-style subscription,
licensing and entitlement platform, plus the portals built on top of it
(developer, customer, platform-admin, marketplace).

This document reflects the state as of commit `d714246` ("Centralize all
secrets/config into one file per app"): **Phases 1 through 11 are
implemented.** There is no active "not yet implemented" roadmap phase in
progress — see [Current status](#current-status) for the honest list of
what's genuinely still open.

A note on history: after Phase 11 landed, a follow-on effort added GitHub
OAuth login, a commission ledger, an ERP posting integration, a manual
payout flow, and an embeddable checkout widget directly on top of this
repo (commits `06bb07b`..`bbda93a`, labeled "Checkpoint 1"–"Checkpoint 8").
That work was later **reverted out of this repo** in `3b3fdfc` because it
now lives in its own repo, `afaqhaider/marketplace`. The revert is clean:
none of that code exists in the working tree at `d714246`. The
`marketplace` module that *does* still exist here (`apps/api/src/marketplace/`,
web routes under `/marketplace`) is unrelated - it's the Phase 11
listings/taxonomy/storefront module, not the reverted commission/payout
work.

## Monorepo layout

```
paywall/
├── apps/
│   ├── web/     Next.js frontend - marketing site + 4 portals (see below)
│   └── api/     NestJS backend API (~70 domain modules)
├── packages/
│   ├── shared/  Framework-agnostic shared utilities & constants
│   ├── ui/      Shared shadcn/ui-based React component library
│   └── types/   Shared TypeScript contracts between web and api
├── docker/      Dockerfiles for each deployable service
├── docs/        Architecture & operational documentation
└── .github/     CI workflows
```

## Why these choices

- **Turborepo + pnpm workspaces**: incremental, cached builds across apps and
  packages; a single lockfile and dependency graph for the whole platform.
- **NestJS**: opinionated, modular, dependency-injected framework well suited
  to a large domain (auth, billing, webhooks, entitlements, admin, automation)
  split into ~70 well-bounded modules under `apps/api/src/`.
- **Prisma**: type-safe database access and first-class migration tooling
  against PostgreSQL. The schema (`apps/api/prisma/schema.prisma`) now spans
  ~110 models.
- **Next.js (App Router)**: a single frontend codebase serving the marketing
  site, developer portal, customer portal, and admin portal as route groups.
- **PostgreSQL**: the platform's system of record. Relational integrity is
  important for billing/entitlement correctness.
- **Docker Compose**: the entire stack (db, api, web) must boot with a single
  command on a developer machine with zero cloud dependencies.

## The four frontend surfaces

`apps/web/src/app` is organized into one public site and three portals,
all served from the same Next.js app:

| Route          | Audience                              | Covers                                                                                   |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/`            | Public                                 | Marketing landing page                                                                    |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/invitations` | Public | Auth flows, invitation acceptance |
| `/dashboard`   | Developers / org members               | Manage your own apps: products, plans, subscriptions, customers, coupons, licenses, entitlements, features, payments, payment providers, webhooks, API keys, devices, trials, usage, disputes, refunds, invoices, transactions, checkout sessions, white-label, OAuth apps, analytics, API docs |
| `/portal`      | End customers of apps on the platform  | Self-service: subscriptions, licenses, invoices, receipts, transactions, usage, devices, notifications, organizations, security, settings |
| `/admin`       | SS Zentronics platform staff           | Org/app/customer lifecycle, subscriptions, licenses, financial integrations & ERP status, fraud center, monitoring, audit center, reports, job queues/workers, automation rules, notifications, announcements, events, executive dashboard, platform intelligence, settings |
| `/marketplace` | Public                                 | Browse listings & categories for apps published on the platform                          |

## Domain modules (`apps/api/src`)

Grouped by the phase that introduced them (see [Phase history](#phase-history)
below for details):

- **Foundation/Identity**: `health`, `auth`, `users`, `profile`, `organizations`, `audit`, `two-factor`, `mail`, `prisma`, `config`
- **Application Registry**: `applications`
- **Catalog & billing**: `products`, `features`, `customers`, `coupons`, `subscriptions`, `trials`, `usage`
- **Payments**: `payments` (providers, checkout sessions, transactions, refunds, disputes, invoices, receipts)
- **Entitlements & licensing**: `entitlements`, `licenses`, `seats`, `usage-limits`, `api-keys`, `devices`
- **Developer Portal**: `developer-profile`, `invitations`, `environment-variables`, `allowed-origins`, `oauth`, `webhooks`, `analytics`, `sdk-config`
- **Financial integration & Customer Portal**: `financial-integration`, `erp-connector`, `financial-events`, `customer-portal`, `notifications`
- **Platform Administration**: `platform-admin` + `admin-organizations`, `admin-applications`, `admin-customers`, `admin-support`, `admin-directory`, `admin-audit`, `admin-reports`, `admin-subscriptions`, `admin-licenses`, `admin-financial`, `admin-monitoring`, `admin-fraud`, `admin-config`, `admin-shared`
- **Platform Automation**: `background-jobs`, `platform-events`, `scheduler`, `automation`, `notifications-engine`, `system-health`
- **Marketplace, Analytics & Platform Intelligence**: `marketplace`, `white-label`, `platform-search`, `reports`, `reviews`, `platform-analytics`

## Data model

`apps/api/prisma/schema.prisma` is the single source of truth. Roughly:

- **Identity/org**: `User`, `Session`, `PasswordResetToken`, `Organization`, `OrganizationMember`, `AuditLog`, `TwoFactorCredential`
- **Application Registry**: `Application`, `ApplicationVersion`, `ApplicationEnvironment`, `ApplicationSecret`, `ApplicationDomain`, `ApplicationSetting`, `ApplicationMember`
- **Catalog**: `Product`, `Plan`, `Price`, `Feature`, `PlanFeature`, `EntitlementDefinition`
- **Billing**: `Customer`, `Subscription`, `SubscriptionItem`, `SubscriptionEvent`, `SubscriptionChange`, `ProrationRecord`, `Trial`, `Coupon`, `PromotionCode`, `SubscriptionCoupon`, `UsageRecord`
- **Entitlements/licensing**: `EntitlementGrant`, `EntitlementGrantEvent`, `FeatureAccess`, `License`, `LicenseAssignment`, `LicenseKey`, `Seat`, `SeatAssignment`, `UsageLimit`, `UsageCounter`, `APIClient`, `APIKey`, `APIKeyScope`, `DeviceRegistration`, `AccessLog`
- **Payments**: `PaymentProvider`, `ProviderCredential`, `ProviderAccount`, `PaymentCustomer`, `PaymentMethod`, `PaymentCheckoutSession`, `PaymentTransaction`, `PaymentAttempt`, `PaymentWebhook`, `PaymentRefund`, `PaymentDispute`, `PaymentInvoice`, `PaymentReceipt`
- **Developer Portal**: `DeveloperProfile`, `DeveloperInvitation`, `EnvironmentVariable`, `AllowedOrigin`, `OAuthApplication`, `OAuthCredential`, `RedirectURI`, `CallbackURL`, `WebhookEndpoint`, `WebhookSecret`, `WebhookDelivery`, `WebhookRetry`
- **Financial integration**: `FinancialIntegration`, `ERPConnection`, `ERPCompany`, `ERPConfiguration`, `ERPPermission`, `FinancialEvent`, `SyncQueue`, `FinancialSync`, `SyncHistory`, `SyncError`
- **Platform admin**: `PlatformAdmin`, `ImpersonationSession`, `PlatformSetting`, `FeatureFlag`, `MessageTemplate`, `PlatformAnnouncement`
- **Automation**: `PlatformEvent`, `BackgroundJob`, `JobHistoryEntry`, `AutomationRule`, `AutomationRuleExecution`, `NotificationTemplate`, `PlatformNotification`, `NotificationDelivery`, `QueueControl`, `Notification`
- **Marketplace/analytics**: `Listing`, `MarketplaceCategory`, `ListingCategory`, `MarketplaceTag`, `ListingTag`, `ListingMedia`, `ListingChangelog`, `ListingInvite`, `Review`, `ReviewReply`, `ReviewReport`, `AnalyticsSnapshot`, `ReportRequest`, `WhiteLabelConfig`

## Phase history

### Phase 1 - Foundation

1. Monorepo tooling (Turborepo, pnpm, ESLint, Prettier, Husky, lint-staged)
2. Base NestJS API with a `/health` endpoint that verifies DB connectivity
3. Base Next.js app with a landing page rendering environment/version info
4. Prisma wired to PostgreSQL (no domain models yet)
5. Docker Compose bringing up postgres + api + web together
6. CI pipeline (lint, type-check, test, build, docker build)

### Phase 2 - Identity & Authentication

1. JWT access tokens (15 min) + opaque, hashed, rotating refresh tokens with
   reuse detection (a replayed rotated-out token revokes the whole session)
2. Email verification, forgot/reset/change password (email delivery is
   console-logged - no external provider, by design, to stay 100% local)
3. Organizations with role-based membership (OWNER > ADMINISTRATOR >
   DEVELOPER/MANAGER > MEMBER > VIEWER), last-owner protection
4. Audit logging, security middleware (Helmet, rate limiting, CORS,
   double-submit CSRF cookies, strong password policy, global validation)

### Phase 3 - Application Registry

1. `apps/api/src/applications/` - the single source of truth for every
   application in the ecosystem: `Application`, `ApplicationVersion`,
   `ApplicationEnvironment`, `ApplicationSecret`, `ApplicationDomain`,
   `ApplicationSetting`, `ApplicationMember`
2. Per-application roles (OWNER > ADMINISTRATOR > DEVELOPER > TESTER/SUPPORT
   > VIEWER), with an org OWNER/ADMINISTRATOR always retaining override
   access, and a strict cross-organization isolation guarantee
3. Secrets encrypted at rest (AES-256-GCM) - plaintext never persisted, never
   returned by any endpoint
4. Web pages under `/dashboard/apps` covering the full registry surface

### Phase 4 - Subscription Engine

Products, plans, prices, features, customers, subscriptions (with items,
events, changes, proration), coupons/promotion codes, trials, usage records.

### Phase 5 - Payment Provider Framework

A provider-agnostic payments abstraction (`PaymentProvider`,
`ProviderCredential`, `ProviderAccount`) supporting Stripe, Apple App Store,
Google Play, PayPal, Easypaisa, JazzCash, bank transfer, and manual
recording, plus checkout sessions, transactions, webhooks, refunds,
disputes, invoices, and receipts.

### Phase 6 - License & Entitlement Engine

Entitlement resolution engine (`entitlements`), license & license-key
management with seats (`licenses`, `seats`), per-feature usage limits
(`usage-limits`), API key issuance (`api-keys`), and device registration
(`devices`) - plus the `/dashboard` admin UI for all of it.

### Phase 7 - Developer Portal

Developer profile, invitations, environment variable config, allowed CORS
origins, OAuth application registration, outbound webhooks (delivery engine
+ history), analytics, SDK config, OpenAPI docs, and Google Sign-In.

### Phase 8 - Financial Integration & Customer Portal

ERP connectivity (`erp-connector`, LedGix), financial event sync engine
(`financial-events`), the `/portal` Customer Portal (self-service
subscriptions/licenses/invoices/usage/devices), TOTP 2FA, and notifications.

### Phase 9 - Platform Administration & Operations Center

The `/admin` console and its ~14 backend modules: org/app/customer
lifecycle management, subscription & license admin, financial ops,
monitoring, fraud detection, config, support tools, audit center, and
platform reports.

### Phase 10 - Platform Automation, Events & Background Services

Background job processing, a platform event bus, a scheduler, automation
rules (+ execution history), a notifications engine, and system health
monitoring.

### Phase 11 - Marketplace, Analytics & Platform Intelligence

Public marketplace (`Listing`, categories, tags, media, changelog, invites),
reviews (+ replies/reports), white-label configuration, platform search,
platform-wide analytics and reporting.

### Post-Phase-11

- `06bb07b`..`bbda93a` ("Checkpoint 1"-"Checkpoint 8"): GitHub OAuth login,
  commission ledger schema + split calculator, LedGix multi-line postings,
  manual payout flow + commission rule admin API, an embeddable checkout
  widget, an API contract doc, and an e2e spec for the marketing checkout
  handoff. **Reverted in `3b3fdfc`** — this now lives in `afaqhaider/marketplace`,
  a separate repo, not here.
- `6917225` "Reconcile live Paywall deployment fixes" - ops/deployment
  script fixes, kept.
- `d714246` "Centralize all secrets/config into one file per app" - every
  secret/env value now routes through exactly two files,
  `apps/api/src/config/secrets.ts` and `apps/web/src/lib/env.ts`. See
  [`docs/SECRETS.md`](./SECRETS.md).

## Current status

What's still genuinely open, as opposed to "phases not yet started":

- **Real transactional email delivery.** `MailService` logs to stdout only
  (`apps/api/src/mail/mail.service.ts`) - by design, to keep the platform
  runnable with zero cloud dependencies locally. Swap in a real SMTP/provider
  client before shipping to real users.
- **Firebase / Secret Manager.** Wired as a provisioning stub only - no
  Firebase project exists yet. See [`docs/SECRETS.md`](./SECRETS.md).
- **Live payment provider credentials.** The provider framework (Phase 5)
  models Stripe/Apple/Google/PayPal/Easypaisa/JazzCash/bank
  transfer/manual generically; going live with any one of them means
  supplying real `ProviderCredential` values per application/environment.
- **The commission ledger / payout / checkout-widget marketplace
  experiment** now lives entirely in `afaqhaider/marketplace`, not here -
  see [Post-Phase-11](#post-phase-11) above.
