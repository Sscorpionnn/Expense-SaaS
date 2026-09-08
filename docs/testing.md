# Testing

## Unit vs. integration split

`apps/api` uses a two-`project` Jest config (`apps/api/jest.config.cjs`, both on the
`ts-jest` preset — a real `tsc` transform, unlike the `tsx`/esbuild dev-mode transpiler; see
`docs/architecture.md` for why that distinction matters in this repo):

- **`unit`** — `src/**/*.spec.ts`, colocated with the code under test (e.g.
  `apps/api/src/auth/password.util.spec.ts`, `apps/api/src/transactions/
  balance-delta.util.spec.ts`, `apps/api/src/budgets/budget-period.util.spec.ts`,
  `packages/config/src/csv.spec.ts`, `packages/config/src/currency.spec.ts`). These target
  pure functions and small units — no database, no network — and run fast, everywhere,
  with no infra dependency.
- **`integration`** — `test/**/*.e2e-spec.ts` (e.g.
  `apps/api/test/account-deletion.e2e-spec.ts`). These boot a real NestJS application via
  `@nestjs/testing`'s `Test.createTestingModule({ imports: [AppModule] })` and exercise it
  end to end over HTTP with `supertest`, against a **real Postgres and Redis** — the only
  thing that's swapped out is `MailerService`, overridden with an in-memory
  `FakeMailerService` (`apps/api/test/setup.ts`) so tests don't need a real SMTP server and
  can extract verification/reset/confirmation tokens directly from the "sent" email body
  rather than parsing rendered HTML.

Run: `pnpm test:unit` / `pnpm test:integration` at the repo root (routes through Turbo,
which builds workspace dependencies first — see `docs/architecture.md` on why not to bypass
Turbo here). Integration tests additionally require `docker compose up -d postgres redis`
and `DATABASE_URL`/`REDIS_URL` pointed at them, plus a generated Prisma migration applied
(`pnpm --filter @expense-saas/database exec prisma migrate deploy`) — see
`docs/deployment.md` for the one-time migration-generation step, since no migration is
committed to the repo yet.

## Why integration tests hit a real database instead of mocking Prisma

The test setup (`apps/api/test/setup.ts`) boots the actual `AppModule` with its actual
`PrismaService` and `REDIS_CLIENT` provider — nothing about the database or cache layer is
mocked, only the outbound-email side effect is. This means an integration test exercises
the real Prisma query shape, the real cascade/`onDelete` behavior defined in the schema,
and the real Redis-backed session-cache and rate-limit logic, not a stand-in that could
silently diverge from what production actually does. `resetDatabase` (in the same file)
wipes every table in FK-safe order between tests for isolation, rather than relying on
per-test transactions or a mock reset.

Test isolation per test: `beforeEach` calls `resetDatabase(prisma)`, `redis.flushdb()`, and
clears the fake mailer's sent-email list, so each test starts from a clean, real, empty
database rather than fixture data or a mocked repository.

## Test helpers (`apps/api/test/setup.ts`)

- `createTestApp()` — boots the app with `FakeMailerService` swapped in, returns handles to
  `app`, `prisma`, `redis`, `mailer`, `env`.
- `FakeMailerService.lastTokenFor(email)` — extracts the raw single-use token
  (verification/reset/deletion-confirmation) from the most recent email sent to an address,
  by regex-matching `token=...` out of the email body — this is how integration tests drive
  a full register → verify → login flow without a real inbox.
- `registerAndLogin(app, mailer, emailPrefix)` — the standard fixture for "give me an
  authenticated `supertest` agent" in a test; returns an `agent` (cookie jar preserved
  across requests), a `csrfToken` to attach as the `X-CSRF-Token` header on mutating
  requests (see `docs/security.md`), and the generated `email`.
- `setCookieHeaders(res)` — normalizes `supertest`'s `set-cookie` header, which may come
  back as a single string or an array depending on how many cookies were set.

## Other test surfaces

- `apps/worker` has its own `unit`-style Jest project for its pure-function utilities (e.g.
  `apps/worker/src/recurring/next-occurrence.util.spec.ts`,
  `apps/worker/src/csv-import/csv-row.util.spec.ts`).
- An end-to-end Playwright suite exercises the full stack through the actual `web` UI
  against a running `api` — the core user journey (register → verify → log in → create an
  account and a transaction → see it reflected on the dashboard → create a budget → export
  data) plus a regression test for the IDOR-protection convention described in
  `docs/authorization.md`. See the CI workflow for how it's wired up and run.

## CI (`.github/workflows/ci.yml`)

Runs on push to `main` and on every pull request, with same-branch runs cancelled via a
concurrency group. Jobs: `install` → `lint`, `typecheck`, `unit-tests`, `integration-tests`
(spins up Postgres and Redis as GitHub Actions service containers, plus a plain
`docker run` for MinIO since its image has no default `CMD` and can't be used as a
`services:` container directly, applies `prisma migrate deploy`, then runs
`pnpm test:integration`), and `build`, each parallelized off the same `install` step with
its own checkout/setup so jobs don't share filesystem state. Further stages
(secret/dependency scanning, the Playwright E2E suite) run alongside these — see the
workflow file itself for their exact composition, since it evolves independently of this
document.

## Local reproduction

```bash
docker compose up -d postgres redis   # add minio too if exercising import/export paths
pnpm --filter @expense-saas/database exec prisma migrate deploy
pnpm test:unit
pnpm test:integration
```
