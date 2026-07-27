# Multi-stage build for the NestJS API using Turborepo's prune workflow.
# Build context MUST be the monorepo root.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable

# ---- Prune: extract only the subset of the monorepo needed for "api" ----
FROM base AS pruner
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY . .
RUN pnpm dlx turbo@2.3.3 prune api --docker

# ---- Install + build: install every dependency (incl. devDependencies) and compile ----
FROM base AS installer
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY --from=pruner /app/out/json/ .
# The pruned "json" layer has package.json files only, but api's postinstall
# (`prisma generate`) needs the schema to already be present - copy it in
# ahead of the full source so `pnpm install` succeeds and stays cache-friendly
# (the schema rarely changes as often as application source).
COPY --from=pruner /app/out/full/apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# turbo prune only copies files owned by the pruned workspaces; the shared
# root tsconfig every package's tsconfig.json extends lives outside that set.
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm dlx turbo@2.3.3 run build --filter=api...

# ---- Migrator: applies Prisma migrations against DATABASE_URL, then exits ----
# Kept separate from the runtime image so the `prisma` CLI and its
# devDependency footprint never ship in the long-running production container.
FROM installer AS migrator
WORKDIR /app/apps/api
ENTRYPOINT ["pnpm", "exec", "prisma"]
CMD ["migrate", "deploy"]

# ---- Prod deps: a dependency-only install so devDependencies never enter
# the runtime image (nest CLI, prisma CLI, swc, typescript, vitest, ...) ----
FROM base AS prod-deps
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/full/apps/api/prisma ./apps/api/prisma
RUN pnpm install --prod --frozen-lockfile
COPY --from=pruner /app/out/full/ .

# ---- Runner: minimal runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=prod-deps /app .
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/packages/shared/dist ./packages/shared/dist
COPY --from=installer /app/packages/types/dist ./packages/types/dist
USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
