# syntax=docker/dockerfile:1
#
# Multi-stage build for @expense-saas/api, using `turbo prune` to extract only
# this app's slice of the monorepo. Build context MUST be the repo root, e.g.:
#   docker build -f apps/api/Dockerfile -t expense-saas-api .

FROM node:22-alpine AS base

# ---- Prune: extract this workspace's package.jsons + source into out/ ----
FROM base AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2.3.3
COPY . .
RUN turbo prune @expense-saas/api --docker

# ---- Install deps and build (needs devDependencies + prisma CLI) ----
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@9.15.9 turbo@^2.3.3

# Install dependencies first (better layer caching across source changes).
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Bring in the real source and build @expense-saas/api and everything it
# depends on (turbo.json's "build" task has dependsOn: ["^build"], which also
# runs `prisma generate` via @expense-saas/database's own build script).
COPY --from=pruner /app/out/full/ .
RUN turbo run build --filter=@expense-saas/api

# `builder` (above) still has devDependencies, including the `prisma` CLI —
# docker-compose's one-off `migrate` service targets this stage directly to
# run `prisma migrate deploy`. `slim` is what the runtime image is built
# from; it strips devDependencies now that dist/ and the generated Prisma
# client exist.
FROM builder AS slim
RUN pnpm prune --prod --no-optional

# ---- Runtime ----
FROM base AS runner
RUN apk add --no-cache openssl dumb-init
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 expressjs

COPY --from=slim --chown=expressjs:nodejs /app .

USER expressjs
ENV NODE_ENV=production
EXPOSE 4000
CMD ["dumb-init", "node", "apps/api/dist/main.js"]
