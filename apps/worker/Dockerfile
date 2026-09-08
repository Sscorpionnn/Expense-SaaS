# syntax=docker/dockerfile:1
#
# Multi-stage build for @expense-saas/worker, using `turbo prune` to extract
# only this app's slice of the monorepo. Build context MUST be the repo root:
#   docker build -f apps/worker/Dockerfile -t expense-saas-worker .

FROM node:22-alpine AS base

# ---- Prune: extract this workspace's package.jsons + source into out/ ----
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune @expense-saas/worker --docker

# ---- Install deps and build (needs devDependencies + prisma CLI) ----
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@9.15.9 turbo@^2.3.3

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@expense-saas/worker

RUN pnpm prune --prod --no-optional

# ---- Runtime ----
FROM base AS runner
RUN apk add --no-cache openssl dumb-init
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /app .

USER worker
ENV NODE_ENV=production
# No HTTP port — this process only runs scheduled/queue jobs.
CMD ["dumb-init", "node", "apps/worker/dist/main.js"]
