# Security

This is a summary of the concrete security mechanisms implemented in `apps/api`, grounded
in the actual source — not a generic checklist. See `docs/authentication.md` and
`docs/authorization.md` for the auth-specific and ownership-specific detail this doc
doesn't repeat.

## Transport and headers (`apps/api/src/main.ts`)

- `helmet()` with an explicit CSP: `default-src 'none'`, `frame-ancestors 'none'`
  (the API serves no HTML/frames of its own — a full deny-by-default policy is
  appropriate), `referrer-policy: no-referrer`, `cross-origin-resource-policy: same-site`.
- CORS is locked to a single explicit origin — `env.WEB_URL` — with `credentials: true`
  (required for the cookie-based session to work cross-origin between `web` and `api`) and
  an explicit allow-list of methods/headers (`GET, POST, PATCH, PUT, DELETE`;
  `Content-Type, X-CSRF-Token`). No wildcard origin.
- `app.set("trust proxy", 1)` — the API expects to run behind a reverse proxy in
  production, needed for `req.ip` (used for rate-limit keys and audit-log IP hashing) to
  reflect the real client IP rather than the proxy's. See `docs/deployment.md` for what
  terminates TLS in front of it (out of scope for this repo — bring your own reverse
  proxy).

## CSRF (`apps/api/src/core/csrf.middleware.ts`)

Double-submit-cookie pattern: a signed, non-`httpOnly` CSRF cookie (`esaas_csrf`) is issued
on any request; every state-changing request (anything not `GET`/`HEAD`/`OPTIONS`) must
echo the token back in the `X-CSRF-Token` header. The cookie value is `token.signature`
(HMAC-SHA256 over the token, keyed by `CSRF_SECRET`) so a client can't forge a token
without the header being independently verifiable; comparisons use `timingSafeEqual` to
avoid a timing side channel. A cross-site attacker cannot read the victim's cookie
(same-origin policy), so cannot produce a matching header value even though the cookie
itself isn't `httpOnly`. `GET /auth/csrf` is a no-op endpoint that exists purely to give
the frontend something safe to call first to obtain the cookie before its first mutating
request.

## Rate limiting (`@nestjs/throttler` + `apps/api/src/core/throttler-redis.storage.ts`)

Global default (`RATE_LIMITS.DEFAULT`: 100 req/60s) plus tighter per-endpoint overrides on
auth-sensitive routes (`packages/config/src/constants.ts`):

| Limit | Window | Applies to |
|---|---|---|
| 5 | 60s | login |
| 5 | 3600s | register |
| 5 | 3600s | forgot-password / reset-password / resend-verification / account-deletion request |
| 10 | 3600s | CSV import |
| 5 | 3600s | data export |

Backed by a custom Redis-backed `ThrottlerStorage` rather than the library's default
in-memory storage: the in-memory implementation is per-process, which would let an
attacker bypass limits simply by hitting different API instances behind a load balancer.
The Redis implementation uses a single atomic Lua script for the increment-and-check to
avoid the increment/expire race a naive `INCR` then `PEXPIRE` would have under concurrent
requests.

## Passwords and tokens

- Passwords: argon2id (`argon2.hash(raw, { type: argon2.argon2id })`,
  `apps/api/src/auth/password.util.ts`) — the memory-hard, side-channel-resistant choice,
  deliberately slow to resist brute force.
- Opaque tokens (sessions, email verification, password reset, deletion confirmation):
  32 random bytes, base64url-encoded (`generateOpaqueToken`,
  `apps/api/src/auth/token.util.ts`). Only a SHA-256 hash of the token is ever persisted —
  the raw value exists only in the cookie or the emailed link, briefly, and is never
  logged. SHA-256 (not a slow hash) is the deliberate choice here since these tokens are
  already high-entropy and random, unlike a user-chosen password.
- Login failures are constant-shape regardless of *why* they failed (unknown email vs.
  wrong password) — `AuthService.login`'s `failLogin` path is identical either way, to
  avoid leaking account existence through response differences (see
  `docs/authentication.md`).

## Cookies

- Session cookie (`esaas_session`): `httpOnly`, `secure` in production, `sameSite: "lax"`.
- CSRF cookie (`esaas_csrf`): `secure` in production, `sameSite: "lax"`, deliberately
  **not** `httpOnly` (the frontend must be able to read it to echo it back in the header —
  this is the double-submit pattern, not a bug).
- `COOKIE_DOMAIN` is optional and meant for production deployments where `web` and `api`
  live on different subdomains of the same parent domain; unset for local dev.

## Input validation

Every request body is validated by a Zod schema from `@expense-saas/validation` via
`ZodValidationPipe` (`apps/api/src/core/zod-validation.pipe.ts`) — the same schemas the
web app's forms use client-side, so validation logic isn't duplicated or allowed to drift.

## Error handling

`GlobalExceptionFilter` (`apps/api/src/core/http-exception.filter.ts`) normalizes every
thrown error to one `ApiErrorBody` shape. For anything that isn't a recognized
`HttpException`, production responses get a generic "Internal server error" with no
message or stack trace — the real error is logged server-side only. This matters for a
financial app: an unhandled exception must never leak a query fragment, a file path, or
similar internal detail to the client.

## CSV import/export hardening

- **Formula injection** (OWASP "CSV Injection"): any exported field beginning with
  `=`, `+`, `-`, `@`, tab, or carriage return is prefixed with a leading apostrophe before
  being written (`packages/config/src/csv.ts`, `sanitizeCsvField`/`escapeCsvField`) so a
  spreadsheet application (Excel/Sheets/LibreOffice) won't interpret it as a formula when
  the exported file is later opened. This is applied **only** at CSV-write time, never when
  storing or displaying the value inside the app — sanitizing on write, not on store,
  avoids permanently corrupting a legitimate value that happens to start with one of those
  characters (e.g. a transaction description like "-5% off coupon").
- **Upload limits**: `CSV_IMPORT.MAX_FILE_SIZE_BYTES` (5 MiB), `MAX_ROWS` (10,000),
  `MAX_CELL_LENGTH` (500 chars), and an allow-list of MIME types
  (`packages/config/src/constants.ts`), enforced by `apps/api/src/import/csv-file-guard.ts`
  before a file is queued for processing.

## Audit logging

Every security- and privacy-relevant action is recorded via `AuditService`
(`apps/api/src/core/audit.service.ts`) into the append-only `AuditLog` table: register,
login success/failure, logout, email verification, password reset request/completion,
session revocation, account-deletion request/confirm/cancel/purge, every financial-resource
create/update/delete, CSV import, data-export request/download, and privacy-setting
changes (full list: the `AuditAction` enum in `packages/database/prisma/schema.prisma`).
IPs and user agents are stored as SHA-256 hashes, never in plaintext; `metadata` is
documented in code as pre-sanitized-only (never passwords, tokens, or full financial
records).

## Secrets

`.env` is git-ignored (`.env.example` documents every variable with `CHANGE_ME`
placeholders and is the only `.env*` file tracked). `SESSION_COOKIE_SECRET` and
`CSRF_SECRET` are validated at boot to be at least 32 characters
(`packages/config/src/env.ts`) — generate real values with `openssl rand -hex 32`. Never
commit `.env`, and never reuse the CI-only placeholder secrets baked into
`.github/workflows/ci.yml` outside of CI.

## Ownership isolation (IDOR protection)

Covered in full in `docs/authorization.md`: every resource lookup is scoped by the
authenticated `userId`, and a mismatch returns 404, never 403 — see that document for why
and for the convention every service in this repo follows.
