# Multi-stage build for the Next.js web app using Turborepo's prune workflow
# and Next.js "standalone" output. Build context MUST be the monorepo root.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# ---- Prune: extract only the subset of the monorepo needed for "web" ----
FROM base AS pruner
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY . .
RUN pnpm dlx turbo@2.3.3 prune web --docker

# ---- Install: install dependencies from the pruned lockfile ----
FROM base AS installer
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# turbo prune only copies files owned by the pruned workspaces; the shared
# root tsconfig every package's tsconfig.json extends lives outside that set.
COPY tsconfig.base.json ./tsconfig.base.json
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm dlx turbo@2.3.3 run build --filter=web...

# ---- Runner: minimal runtime image using Next.js standalone output ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=installer /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
# 127.0.0.1, not localhost: Next's standalone server binds to a single
# explicit address (see HOSTNAME in docker-compose.yml), so it only accepts
# IPv4 connections - but this image's "localhost" can resolve to the IPv6
# loopback first, making an otherwise-healthy server look unreachable.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "apps/web/server.js"]
