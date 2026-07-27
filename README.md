# SS Zentronics Platform (paywall)

A self-hosted, RevenueCat-style **subscription, licensing & entitlement
platform** for the SS Zentronics ecosystem of applications.

> **Status: Phase 3 - Application Registry.** Foundation (Phase 1), Identity
> & Authentication (Phase 2), and the Application Registry (Phase 3) are
> live. Billing, subscriptions, licensing, and the rest of the roadmap are
> intentionally **not yet implemented** - see
> [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full roadmap.

## Platform capabilities

- ✅ Authentication & user management (JWT + rotating refresh tokens, email verification, password reset, sessions)
- ✅ Organizations with role-based membership
- ✅ Application Registry (versions, environments, encrypted secrets, domains, settings, members)
- ⏳ Subscription Management - License & Entitlement Engine - Payment Providers
- ⏳ Webhooks - Developer Portal - Customer Portal - Admin Portal
- ⏳ Analytics - Public API for Mobile & Web apps

## Tech stack

| Layer           | Technology                                         |
| --------------- | -------------------------------------------------- |
| Frontend        | Next.js, React, TypeScript, TailwindCSS, shadcn/ui |
| Backend         | NestJS, TypeScript                                 |
| Database        | PostgreSQL                                         |
| ORM             | Prisma                                             |
| Auth            | JWT access tokens + rotating opaque refresh tokens |
| Package manager | pnpm                                               |
| Monorepo        | Turborepo                                          |
| Containers      | Docker, Docker Compose                             |
| Code quality    | ESLint, Prettier, Husky, lint-staged               |
| Testing         | Vitest, Playwright                                 |

**Runs 100% locally.** No Vercel, Railway, Supabase, Firebase, or other
managed cloud services. Only official Docker images (`node`, `postgres`) are
used.

## Repository layout

```
paywall/
├── apps/
│   ├── web/            Next.js frontend (landing page)
│   └── api/             NestJS backend (health endpoint, Prisma)
├── packages/
│   ├── shared/          Shared utilities & constants
│   ├── ui/               Shared shadcn/ui component library
│   └── types/            Shared TypeScript contracts
├── docker/               Dockerfiles per service
├── docs/                 Architecture & operational docs
└── .github/workflows/    CI pipeline
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health

See [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) for full setup
instructions, local (non-Docker) development, and available scripts.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Getting Started](./docs/GETTING_STARTED.md)

## License

Proprietary - all rights reserved.
