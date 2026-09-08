# Architecture

## Monorepo layout

This is a pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) orchestrated by
Turborepo (`turbo.json`).

```
apps/
  api/      NestJS HTTP API — all business logic, the only thing that talks to Postgres
            and Redis directly on behalf of a user request.
  worker/   NestJS application context (no HTTP listener) — scheduled jobs (@nestjs/schedule)
            and queue-driven jobs (BullMQ) that run against the same Postgres/Redis/MinIO.
  web/      Next.js 16 App Router frontend. Talks to the API over HTTP with cookie-based
            auth; never touches Postgres/Redis/MinIO directly.
packages/
  types/        Shared TypeScript types/DTOs used by both api and web.
  validation/   Shared Zod schemas (registration, login, transactions, etc.) — the same
                schema validates on the API (server-side) and can drive client-side forms.
  config/       Shared constants and environment schema: rate limits, session/CSRF cookie
                names, CSV import/export limits, currency minor-unit tables, the server env
                Zod schema (`packages/config/src/env.ts`).
  database/     The Prisma schema (`prisma/schema.prisma`) and generated client, shared by
                api and worker.
  ui/           Shared UI primitives for the web app.
  eslint-config/, tsconfig/   Shared lint/TS config presets.
```

## How the three apps relate

- **web → api**: server components and client components call the API over HTTP.
  Server-side calls (e.g. `apps/web/src/lib/server-api.ts`, used for session-gated SSR)
  use the internal `API_URL`; browser-side calls use `NEXT_PUBLIC_API_URL`, which must be
  reachable from the user's browser (so it differs from `API_URL` in any deployment where
  the API isn't on `localhost`, e.g. behind Docker Compose's internal network — see
  `docs/deployment.md`). Auth is a `httpOnly` session cookie plus a double-submit CSRF
  cookie/header pair (`docs/authentication.md`).
- **api ↔ Postgres/Redis/MinIO**: Postgres via Prisma, Redis for session-token caching and
  distributed rate-limit counters (`apps/api/src/core/throttler-redis.storage.ts`), MinIO
  (S3-compatible) for CSV import uploads and generated data-export files.
- **worker ↔ Postgres/Redis/MinIO**: same infra, no HTTP surface. Runs:
  - `@nestjs/schedule` `@Cron` jobs: recurring-transaction reminders
    (`apps/worker/src/recurring/recurring-sweep.service.ts`), expired-export cleanup
    (`apps/worker/src/data-export/export-cleanup.service.ts`), and the account-deletion
    purge sweep (`apps/worker/src/account-deletion/account-deletion-purge.service.ts`,
    hourly).
  - BullMQ queue consumers for user-triggered async jobs: CSV import processing
    (`apps/worker/src/csv-import/csv-import.processor.ts`) and data-export generation
    (`apps/worker/src/data-export/data-export.processor.ts`) — the API enqueues a job and
    returns immediately; the worker does the actual (potentially slow) work.

## Two real bugs baked into project conventions

These aren't generic advice — they're conventions this codebase adopted after hitting the
actual bug, and diverging from them will reintroduce it.

### `@Inject(ClassName)` on every NestJS constructor parameter

`tsx watch` (used for the `dev` script in `apps/api` and `apps/worker`) transpiles via
esbuild. esbuild's `emitDecoratorMetadata` support silently corrupts NestJS's
`design:paramtypes` reflection for an **entire constructor** when any one parameter relies
on implicit type-based injection while another is `@Inject(token)`-decorated with an
interface-only type. This does not affect `ts-jest` (a real `tsc` transform) or the
production `tsc` build — only `tsx watch`, i.e. only local dev. It broke dependency
injection at runtime with zero compile or type errors, and affected pre-existing code, not
just new additions.

Convention: every constructor parameter in every NestJS provider/controller in this repo
uses explicit `@Inject(ClassName)`, even for concrete-class dependencies that would
normally resolve fine by implicit type reflection. When adding a new module, boot-check it
under `tsx` (`pnpm dev`) in addition to typecheck/lint/tests — this class of bug is
invisible to all of those.

### Shared packages ship compiled `dist/`, not raw `.ts`

`packages/{config,types,validation,database}` originally pointed `main`/`types` at raw
`.ts` source files. That only works for bundler-aware consumers (`tsx`, `ts-jest`,
Next.js's own bundler) — it silently breaks for anything that resolves Node module
semantics directly, such as `node dist/main.js` (the actual production entry point for
`apps/api`/`apps/worker`) or `tsc` project references. This was a real, previously
undetected production bug: `pnpm build` succeeded, but the built output couldn't actually
boot.

Fix, now the standing convention: every shared package has a `tsconfig.build.json` and a
`build` script (`tsc -p tsconfig.build.json`, and `packages/database`'s build additionally
runs `prisma generate` first), builds to `dist/` as CommonJS, and points `main`/`types`/
`exports` at `dist/`. `packages/tsconfig/library.json` is the shared preset for this.
Turbo's `build` task has `dependsOn: ["^build"]`, so `turbo run build --filter=<app>`
always builds dependency packages first — never invoke an individual package's build/test
script standalone before its dependencies have built; prefer root-level `pnpm build` /
`pnpm typecheck` / `pnpm test:unit`, which route through Turbo's dependency graph.

## Request/response shape conventions

- All monetary amounts are stored and passed as integer minor units (e.g. cents) — see
  `packages/config/src/currency.ts` for currency-aware minor-unit digit counts (JPY has 0,
  BHD has 3, most currencies have 2) and `formatMinorUnits`/`parseToMinorUnits` for
  converting to/from a decimal string at the edges. A `Transaction.amountMinor` is always a
  positive integer; direction comes from `Transaction.type` (`INCOME`/`EXPENSE`/
  `TRANSFER`), never from the sign, so it can't be spoofed by a negative client value.
- Errors are normalized to a single `ApiErrorBody` shape by
  `apps/api/src/core/http-exception.filter.ts`. In production, an unrecognized
  (non-`HttpException`) error never leaks its message or stack to the client — only a
  generic "Internal server error", with the real error logged server-side.
- Validation is Zod-based end to end (`packages/validation`), enforced on the API via
  `ZodValidationPipe` (`apps/api/src/core/zod-validation.pipe.ts`).

See `docs/database.md`, `docs/security.md`, `docs/authentication.md`,
`docs/authorization.md` for the domains those names suggest, `docs/testing.md` for how this
is verified, and `docs/deployment.md` for running it.
