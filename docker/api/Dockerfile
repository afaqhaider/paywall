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
RUN pnpm add -g turbo@2.3.3
RUN turbo prune api --docker

# ---- Install: install dependencies from the pruned lockfile ----
FROM base AS installer
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm add -g turbo@2.3.3
RUN turbo run build --filter=api...

# ---- Runner: minimal runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=installer /app .
USER nestjs
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
