# Deployment

## Status: written, not yet executed anywhere

The Dockerfiles (`apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`)
and the app services in `docker-compose.yml` (`migrate`, `api`, `worker`, `web`, alongside
the pre-existing `postgres`/`redis`/`minio`/`maildev` infra services) have been written
following documented best practice for this stack, but **have not been built or run in any
sandbox** — the development environment this project was built in has no Docker daemon
available. Before relying on them, run `docker compose build` and `docker compose up` on a
machine with Docker and confirm the whole stack actually comes up and serves traffic; treat
that as an outstanding verification step, not an assumption.

## What's provided vs. what isn't

This repo provides the three application containers (`api`, `worker`, `web`) and a
docker-compose file wiring them to Postgres, Redis, MinIO, and Maildev for local/
self-hosted use. It does **not** provide TLS termination or a reverse proxy — every port
in `docker-compose.yml` is bound to `127.0.0.1` only, deliberately not exposed publicly.
Putting this behind a public domain with HTTPS (Caddy, nginx, or Traefik in front of `web`
and `api`) is the deployer's responsibility and out of scope here.

## Build approach

Each Dockerfile is a multi-stage build using `turbo prune <package> --docker` to extract
just that app's slice of the pnpm/Turborepo monorepo (its own source plus the workspace
packages it actually depends on — `@expense-saas/config`, `@expense-saas/database`, etc.,
per `docs/architecture.md`), so an image doesn't need the full monorepo checked out to
build. `apps/api` and `apps/worker` build to a `slim` stage (`pnpm prune --prod` after the
Turbo build) before the final runtime `FROM node:22-alpine`; `apps/api`'s intermediate
`builder` stage — which still has devDependencies, including the `prisma` CLI — is reused
directly by docker-compose's `migrate` one-off service to run `prisma migrate deploy`,
since the `prisma` CLI is a devDependency and wouldn't otherwise exist in the pruned
runtime image. `apps/web` builds with Next.js's `output: "standalone"`
(`apps/web/next.config.ts`, with `outputFileTracingRoot` pointed at the monorepo root since
it lives inside a workspace) and copies only the traced `.next/standalone` output plus
`.next/static` and `public/` into the runtime image — see the Next.js docs on output file
tracing for why static assets and `public/` need to be copied in manually.

All three runtime images run as a non-root user and use `dumb-init` as PID 1 (`api`,
`worker`) for correct signal handling.

## One-time setup before first run

1. **Generate the initial Prisma migration** — no `packages/database/prisma/migrations/`
   directory exists in the repo yet. Run once, locally, against a running Postgres:
   ```bash
   docker compose up -d postgres
   pnpm --filter @expense-saas/database migrate:dev --name init
   ```
   Commit the generated migration. `docker-compose.yml`'s `migrate` service (and CI's
   integration-test job) applies migrations with `prisma migrate deploy`, which requires
   at least one migration to already exist — it does not generate one.
2. **Copy and fill in `.env`**:
   ```bash
   cp .env.example .env
   ```
   `SESSION_COOKIE_SECRET` and `CSRF_SECRET` must each be a real random value at least 32
   characters (`openssl rand -hex 32`) — the API fails to boot otherwise
   (`packages/config/src/env.ts`). Every other `CHANGE_ME` placeholder in `.env.example`
   (`POSTGRES_USER`/`PASSWORD`, `MINIO_ROOT_USER`/`PASSWORD`, `S3_ACCESS_KEY_ID`/
   `SECRET_ACCESS_KEY`) should be a real value too before anything beyond local dev.

## Running the full stack

```bash
docker compose up -d --build
```

This builds and starts, in dependency order: `postgres`, `redis`, `minio`, `maildev` (infra)
→ `migrate` (applies pending Prisma migrations, then exits — `api`/`worker` wait for it to
finish successfully via `depends_on: condition: service_completed_successfully`) → `api`,
`worker`, `web`.

Ports (all bound to `127.0.0.1`, override via the corresponding `.env` var):

| Service | Default port | Env var |
|---|---|---|
| web | 3000 | `WEB_PORT` |
| api | 4000 | `API_PORT` |
| postgres | 5432 | `POSTGRES_PORT` |
| redis | 6379 | `REDIS_PORT` |
| minio (S3 API / console) | 9000 / 9001 | `MINIO_PORT` / `MINIO_CONSOLE_PORT` |
| maildev (web UI) | 1080 | `MAILDEV_WEB_PORT` |

## Two distinct API URLs for `web`

`web`'s runtime environment sets **two** different values for where the API lives, and
this distinction is deliberate, not redundant:

- `NEXT_PUBLIC_API_URL` — baked into the browser bundle at **build time** (`docker-compose.yml`
  passes it as a build `arg`). This is what the user's own browser calls, so it must be a
  URL reachable from *outside* the Docker network (e.g. `http://localhost:4000` for local
  use, or a public API domain in a real deployment).
- `API_URL` — a **runtime** environment variable read only by server-side code
  (`apps/web/src/lib/server-api.ts`, used for SSR session checks) via the internal Docker
  network hostname `http://api:4000`. Server-side fetches happen inside the Docker network,
  so they should use the internal service name rather than round-tripping out to the
  public URL.

If you change how the stack is networked (e.g. deploying `api` and `web` on different
hosts rather than one docker-compose stack), both of these need to be reconsidered
independently — they are not required to be the same value, and normally won't be.

## Environment variables

Full reference: `.env.example` at the repo root. Categories: app URLs (`WEB_URL`,
`API_URL`, `NEXT_PUBLIC_API_URL`), Postgres (`POSTGRES_*`, `DATABASE_URL`), Redis
(`REDIS_*`), MinIO/S3 (`MINIO_*`, `S3_*`), SMTP (`SMTP_*`, Maildev locally), auth/session
(`SESSION_COOKIE_SECRET`, `CSRF_SECRET`, `SESSION_TTL_HOURS`, `COOKIE_DOMAIN`), and rate
limiting (`THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT`). The full server-side schema (with
validation rules) is `packages/config/src/env.ts` — both `api` and `worker` fail fast at
boot if a required variable is missing or malformed, so a misconfigured deployment fails
loudly at startup rather than partway through a request.

## What isn't handled by this repo

- TLS/reverse proxy (see above).
- Database backups/point-in-time recovery for the `pgdata` volume.
- Object storage lifecycle beyond what the app itself manages (export-file expiry cleanup
  is handled by the worker; account-purge storage cleanup is handled by the deletion purge
  sweep — see `docs/privacy.md`; a self-hosted MinIO's own backup/replication is not).
- Horizontal scaling guidance for `api`/`worker` beyond what's already true of the code
  (session/rate-limit state lives in Redis specifically so multiple `api` instances behind
  a load balancer stay consistent — see `docs/security.md`).
