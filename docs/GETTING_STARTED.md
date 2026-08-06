# Getting Started

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable` will provide the pinned version automatically)
- Docker & Docker Compose v2

No cloud accounts, API keys, or external services are required. Everything
described below runs entirely on your machine.

## 1. Clone & configure environment

```bash
cp .env.example .env
```

Adjust values in `.env` if needed (default values work out of the box).

## 2. Run everything with Docker Compose (recommended)

```bash
docker compose up --build
```

This builds and starts three containers:

| Service  | URL                   | Purpose                                    |
| -------- | --------------------- | -------------------------------------------- |
| postgres | localhost:5432        | PostgreSQL database                         |
| api      | http://localhost:4000 | NestJS API (`/health`)                      |
| web      | http://localhost:3000 | Next.js frontend - marketing site + Developer Portal (`/dashboard`), Customer Portal (`/portal`), Admin console (`/admin`), Marketplace (`/marketplace`). See [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md#the-four-frontend-surfaces). |

Stop the stack with `docker compose down` (add `-v` to also remove the
database volume).

## 3. Local development without Docker (optional)

```bash
pnpm install
docker compose up -d postgres   # only the database in a container
pnpm --filter api exec prisma migrate dev
pnpm dev                        # runs turbo dev across web + api
```

## Useful scripts (run from repo root)

```bash
pnpm dev           # start web + api in watch mode
pnpm build         # build all apps/packages
pnpm lint          # lint all workspaces
pnpm type-check    # TypeScript project-wide check
pnpm test          # unit tests (Vitest) across workspaces
pnpm test:e2e      # Playwright e2e tests (apps/web)
pnpm format        # format the repo with Prettier
```

## Verifying the stack is healthy

1. `curl http://localhost:4000/health` → `{"status":"ok","database":"up",...}`
2. Open `http://localhost:3000` → the marketing landing page shows API
   status = Online and Database status = Connected.
3. Sign up at `http://localhost:3000/register` - this lands you in the
   Developer Portal (`/dashboard`), where you create or join your first
   organization.

## Getting into the Admin console (`/admin`)

The first `PlatformAdmin` can't be created through the app (the HTTP route
that grants admin access itself requires an existing admin). Bootstrap one
with the provided script, after registering the account normally:

```bash
export DATABASE_URL="postgresql://paywall:paywall_dev_password@localhost:5432/paywall?schema=public"
pnpm --filter api exec tsx scripts/grant-super-admin.ts <your-email>
```

This is safe to re-run for the same email. Every subsequent admin
grant/revoke should go through the normal, audited `/admin` UI instead.
