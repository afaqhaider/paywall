# SS Zentronics Platform (paywall)

A self-hosted, RevenueCat-style **subscription, licensing & entitlement
platform** for the SS Zentronics ecosystem of applications — with a
Developer Portal, Customer Portal, Platform Admin console, and public
Marketplace all built on top of it.

> **Status: Phases 1–11 implemented.** Foundation, Identity & Auth, the
> Application Registry, the Subscription Engine, Payment Providers, the
> License & Entitlement Engine, the Developer Portal, Financial
> Integration & Customer Portal, Platform Administration, Platform
> Automation, and Marketplace/Analytics/Platform Intelligence are all
> live. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the
> phase-by-phase history and what's genuinely still open.
>
> Note: a later, separate effort (GitHub OAuth login, a commission ledger,
> manual payouts, and an embeddable checkout widget) was built directly on
> top of Phase 11 and then **reverted out of this repo** — that work now
> lives in its own repo, `afaqhaider/marketplace`. It is not part of this
> codebase; don't be surprised if you see it referenced in old commit
> messages here.

## Platform capabilities

- ✅ **Auth & identity** — JWT access tokens + rotating refresh tokens,
  email verification, password reset, sessions, TOTP 2FA, Google Sign-In
- ✅ **Organizations** — role-based membership (OWNER → VIEWER), audit log
- ✅ **Application Registry** — apps, versions, environments, encrypted
  secrets, domains, settings, per-app members/roles
- ✅ **Catalog & billing** — products, plans, prices, features, customers,
  subscriptions, coupons/promo codes, trials, usage records
- ✅ **Payments** — multi-provider framework (Stripe, Apple App Store,
  Google Play, PayPal, Easypaisa, JazzCash, bank transfer, manual),
  checkout sessions, transactions, refunds, disputes, invoices, receipts
- ✅ **Entitlements & licensing** — entitlement resolution engine, license
  keys, seats, per-feature usage limits, API keys, device registration
- ✅ **Developer Portal** — developer profile, invitations, env vars,
  allowed origins, OAuth apps, outbound webhooks, analytics, SDK/API docs
- ✅ **Financial integration** — ERP connector (LedGix), financial event
  sync engine
- ✅ **Customer Portal** (`/portal`) — self-service subscriptions,
  licenses, invoices, receipts, transactions, usage, devices, security
- ✅ **Platform Administration** (`/admin`) — org/app/customer lifecycle,
  subscriptions, licenses, financial ops, fraud center, monitoring, audit
  center, reports, support tools, system config
- ✅ **Platform Automation** — background jobs, scheduler, automation
  rules, platform events, notifications engine, system health
- ✅ **Marketplace & analytics** (`/marketplace`) — public listings,
  categories/tags, reviews, white-label config, platform search, platform
  analytics & reporting
- ⏳ Real transactional email delivery (currently console-logged only, by
  design — see [`apps/api/src/mail/mail.service.ts`](./apps/api/src/mail/mail.service.ts))

## Tech stack

| Layer           | Technology                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| Frontend        | Next.js, React, TypeScript, TailwindCSS, shadcn/ui                         |
| Backend         | NestJS, TypeScript                                                         |
| Database        | PostgreSQL                                                                 |
| ORM             | Prisma                                                                     |
| Auth            | JWT access tokens + rotating opaque refresh tokens, Google OAuth, TOTP 2FA |
| Package manager | pnpm                                                                       |
| Monorepo        | Turborepo                                                                  |
| Containers      | Docker, Docker Compose                                                     |
| Code quality    | ESLint, Prettier, Husky, lint-staged                                       |
| Testing         | Vitest, Playwright                                                         |

**Runs 100% locally.** No Vercel, Railway, Supabase, Firebase, or other
managed cloud services are required to run it. Only official Docker
images (`node`, `postgres`) are used. (Firebase is an optional,
not-yet-provisioned deploy-time secret manager stub — see
[`docs/SECRETS.md`](./docs/SECRETS.md).)

## Repository layout

```
paywall/
├── apps/
│   ├── web/              Next.js frontend - four portals:
│   │                       /            marketing landing page
│   │                       /dashboard   Developer Portal (manage your apps)
│   │                       /portal      Customer Portal (end-user self-service)
│   │                       /admin       Platform Admin console
│   │                       /marketplace Public marketplace/storefront
│   └── api/               NestJS backend (~70 domain modules, Prisma/Postgres)
├── packages/
│   ├── shared/            Shared utilities & constants
│   ├── ui/                 Shared shadcn/ui component library
│   └── types/              Shared TypeScript contracts
├── docker/                 Dockerfiles per service
├── docs/                   Architecture & operational docs
└── .github/workflows/      CI pipeline
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health

See [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) for full setup
instructions, local (non-Docker) development, how to get your first
Platform Admin account, and available scripts.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — phase-by-phase history, domain
  module map, data model, frontend portal structure
- [Getting Started](./docs/GETTING_STARTED.md)
- [Runtime API (`/v1/*`)](./docs/RUNTIME_API.md) — the SDK-facing contract
- [Secrets & config](./docs/SECRETS.md)

## License

Proprietary - all rights reserved.
