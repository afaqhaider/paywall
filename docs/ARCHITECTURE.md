# Architecture

## Overview

The **SS Zentronics Platform** ("paywall") is a monorepo housing every service
required to run a self-hosted RevenueCat-style subscription, licensing and
entitlement platform. This document describes the Phase 1 (foundation) state
of the system.

## Monorepo layout

```
paywall/
├── apps/
│   ├── web/     Next.js customer/admin-facing frontend
│   └── api/     NestJS backend API
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

## Planned domain modules (not implemented yet)

These are documented here to guide future package/module boundaries, but are
explicitly **out of scope** for the Phase 1 foundation:

- Authentication (Better Auth)
- User Management
- Subscription Management
- App Registry (multi-tenant app/product registration)
- Developer Portal
- Customer Portal
- Admin Portal
- License & Entitlement Engine
- Payment Providers (Stripe, Paddle, etc.)
- Webhooks (inbound/outbound)
- Analytics
- Public API for mobile & web SDKs

## Phase 1 scope

Phase 1 delivers only the foundation:

1. Monorepo tooling (Turborepo, pnpm, ESLint, Prettier, Husky, lint-staged)
2. Base NestJS API with a `/health` endpoint that verifies DB connectivity
3. Base Next.js app with a landing page rendering environment/version info
4. Prisma wired to PostgreSQL (no domain models yet)
5. Docker Compose bringing up postgres + api + web together
6. CI pipeline (lint, type-check, test, build, docker build)

No authentication, billing, or business logic exists yet by design.
