# Architecture

## Overview

The **SSCodeAxis** ("paywall") is a monorepo housing every service
required to run a self-hosted RevenueCat-style subscription, licensing and
entitlement platform. This document reflects the state through Phase 3
(Application Registry) - Phase 1 (foundation), Phase 2 (Identity &
Authentication), and Phase 3 are all implemented; billing, licensing, and the
rest of the roadmap below are not.

## Monorepo layout

```
paywall/
├── apps/
│   ├── web/     Next.js customer/admin-facing frontend
│   └── api/     NestJS backend API
├── packages/
│   ├── shared/  Framework-agnostic shared utilities & constants
│   ├── ui/      Shared shadcn/ui-based React component library
│   ├── types/   Shared TypeScript contracts between web and api
│   └── sdk/     Server-side SDK for third-party integrators (see docs/SDK.md)
├── docker/      Dockerfiles for each deployable service
├── docs/        Architecture & operational documentation
└── .github/     CI workflows
```

The developer-embed front is `packages/sdk` (published as `@sscodeaxis/paywall-sdk`) - see [`docs/SDK.md`](./SDK.md) for what it covers, what backend surface it's built on, and what it can't do in this repo (checkout - kept exclusive to the `marketplace` fork).

## Why these choices

- **Turborepo + pnpm workspaces**: incremental, cached builds across apps and
  packages; a single lockfile and dependency graph for the whole platform.
- **NestJS**: opinionated, modular, dependency-injected framework well suited
  to a growing domain (auth, billing, webhooks, entitlements) that will
  eventually be split into well-bounded modules (and, later, services).
- **Prisma**: type-safe database access and first-class migration tooling
  against PostgreSQL.
- **Next.js (App Router)**: a single frontend codebase capable of serving the
  marketing site, customer portal, developer portal and admin portal as
  route groups as the platform grows.
- **PostgreSQL**: the platform's system of record. Relational integrity is
  important for billing/entitlement correctness.
- **Docker Compose**: the entire stack (db, api, web) must boot with a single
  command on a developer machine with zero cloud dependencies.

## Remaining domain modules (not implemented yet)

Explicitly **out of scope** through Phase 3:

- Subscription Management
- Developer Portal, Customer Portal, Admin Portal
- License & Entitlement Engine
- Payment Providers (Stripe, Paddle, etc.)
- Webhooks (inbound/outbound)
- Analytics
- Public API for mobile & web SDKs

## Phase 1 scope - Foundation

1. Monorepo tooling (Turborepo, pnpm, ESLint, Prettier, Husky, lint-staged)
2. Base NestJS API with a `/health` endpoint that verifies DB connectivity
3. Base Next.js app with a landing page rendering environment/version info
4. Prisma wired to PostgreSQL (no domain models yet)
5. Docker Compose bringing up postgres + api + web together
6. CI pipeline (lint, type-check, test, build, docker build)

## Phase 2 scope - Identity & Authentication

1. JWT access tokens (15 min) + opaque, hashed, rotating refresh tokens with
   reuse detection (a replayed rotated-out token revokes the whole session)
2. Email verification, forgot/reset/change password (email delivery is
   console-logged - no external provider, by design, to stay 100% local)
3. Organizations with role-based membership (OWNER > ADMINISTRATOR >
   DEVELOPER/MANAGER > MEMBER > VIEWER), last-owner protection
4. Audit logging, security middleware (Helmet, rate limiting, CORS,
   double-submit CSRF cookies, strong password policy, global validation)

## Phase 3 scope - Application Registry

1. `apps/api/src/applications/` - the single source of truth for every
   application in the ecosystem: `Application`, `ApplicationVersion`,
   `ApplicationEnvironment`, `ApplicationSecret`, `ApplicationDomain`,
   `ApplicationSetting`, `ApplicationMember`
2. Per-application roles (OWNER > ADMINISTRATOR > DEVELOPER > TESTER/SUPPORT
   > VIEWER), with an org OWNER/ADMINISTRATOR always retaining override
   > access, and a strict cross-organization isolation guarantee
3. Secrets encrypted at rest (AES-256-GCM) - plaintext never persisted, never
   returned by any endpoint
4. 9 web pages under `/dashboard/apps` covering the full registry surface
