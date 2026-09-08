# Expense SaaS

A personal finance / expense tracking SaaS, built as a production-grade portfolio project
demonstrating security-first, privacy-first full-stack engineering practices around
sensitive financial data.

> **This is a financial *tracking* application, not a bank, payment processor, or
> money-transmission service.** It never connects to real bank accounts, never moves real
> money, and never stores real banking credentials. All data used during development is
> synthetic/demo data.

**Status:** all six build phases are complete — auth, the core financial domain, budgets/
goals/recurring transactions/notifications, CSV import/export/analytics, account deletion/
privacy, and deployment/CI hardening. See [`docs/architecture.md`](docs/architecture.md) for
the full design.

## Stack

- **Web** — Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query,
  React Hook Form + Zod, Recharts
- **API** — NestJS, TypeScript, PostgreSQL, Prisma, Redis
- **Worker** — NestJS: `@nestjs/schedule` for periodic maintenance (recurring-transaction
  reminders, expired-export cleanup), BullMQ for user-triggered async jobs (CSV import,
  data export generation), an S3-compatible client for MinIO
- **Infra** — Docker Compose (Postgres, Redis, MinIO, Maildev locally), GitHub Actions CI

## Monorepo layout

```
apps/       web, api, worker
packages/   types, validation, config, database, eslint-config, tsconfig
docs/       architecture, database, security, privacy, authentication,
            authorization, testing, deployment
```

(`apps/web`'s shadcn/ui components live locally at `apps/web/src/components/ui` — there's no
separate shared `packages/ui`.)

## Getting started (development)

```bash
cp .env.example .env   # fill in local-only, non-secret placeholder values
pnpm install
docker compose up -d   # postgres, redis, minio, maildev
pnpm --filter @expense-saas/database migrate:dev --name init   # first run only
pnpm dev
```

Running the full stack in containers instead (`docker compose up -d --build` for `api`/
`worker`/`web` too) is covered in [`docs/deployment.md`](docs/deployment.md) — note that path
hasn't been executed anywhere yet (see that doc's status note) and should be smoke-tested
before relying on it.

## Testing

`pnpm test:unit` / `pnpm test:integration` (needs `docker compose up -d postgres redis`) /
`pnpm test:e2e` (needs the full stack — see `docs/testing.md`). CI runs lint, typecheck, unit
tests, integration tests, a build, a Gitleaks secret scan, a `pnpm audit`, and the E2E suite
on every push/PR — see `.github/workflows/ci.yml`.

## Security & privacy

This project treats financial data as sensitive by default: strict per-user data isolation,
no cross-user data exposure, no public profile/financial pages, argon2id password hashing,
httpOnly session cookies, CSRF protection, rate limiting, audit logging, and CSV
import/export hardening (formula-injection sanitization, size/row limits, signature checks).
Details in [`docs/security.md`](docs/security.md) and [`docs/privacy.md`](docs/privacy.md).
