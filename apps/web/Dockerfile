# syntax=docker/dockerfile:1
#
# Multi-stage build for @expense-saas/web (Next.js standalone output), using
# `turbo prune` to extract only this app's slice of the monorepo. Build
# context MUST be the repo root:
#   docker build -f apps/web/Dockerfile -t expense-saas-web .

FROM node:22-alpine AS base

# ---- Prune: extract this workspace's package.jsons + source into out/ ----
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune @expense-saas/web --docker

# ---- Install deps and build ----
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9.15.9 turbo@^2.3.3

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# Baked in at build time — Next.js inlines NEXT_PUBLIC_* vars into the client
# bundle, so this must match the API's public URL for the target environment.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN turbo run build --filter=@expense-saas/web

# ---- Runtime ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` (apps/web/next.config.ts) traces only the files this
# app needs (including workspace packages) into .next/standalone, mirroring
# the monorepo layout. The static assets and public/ dir are excluded from
# that trace by design and must be copied in separately — see
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
