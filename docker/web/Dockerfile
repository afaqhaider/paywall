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
RUN pnpm add -g turbo@2.3.3
RUN turbo prune web --docker

# ---- Install: install dependencies from the pruned lockfile ----
FROM base AS installer
WORKDIR /app
RUN corepack prepare pnpm@9.15.4 --activate
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm add -g turbo@2.3.3
RUN turbo run build --filter=web...

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
CMD ["node", "apps/web/server.js"]
