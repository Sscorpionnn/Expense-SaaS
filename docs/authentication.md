# Authentication

Session-cookie-based auth (not JWT). Implementation: `apps/api/src/auth/` (`AuthService`,
`AuthController`, `SessionAuthGuard`, `token.util.ts`, `password.util.ts`).

## Registration → verification → login

1. **`POST /auth/register`** (public, rate-limited: 5/hour) — creates a `User` row with an
   argon2id `passwordHash` (`packages/config`'s validation schema enforces password
   requirements client- and server-side). A unique-constraint violation on `email` (Prisma
   error code `P2002`) is mapped to a `409 Conflict`. On success, a 24-hour email
   verification token is generated, hashed, stored (`VerificationToken`,
   `purpose: EMAIL_VERIFY`), and the raw token is emailed as a link:
   `${WEB_URL}/verify-email?token=...`. A `REGISTER` audit event is recorded. The account
   is **not yet usable for login-gated features that require a verified email** — check
   the relevant controller for whether a given endpoint requires `emailVerifiedAt`.
2. **`POST /auth/verify-email`** (public) — takes the raw token, hashes it, looks it up by
   `VerificationToken.tokenHash`. Rejected (401) if not found, wrong purpose, already
   consumed, or expired. On success, in one transaction: marks the token `consumedAt` and
   sets `User.emailVerifiedAt`. Records `EMAIL_VERIFIED`.
3. **`POST /auth/resend-verification`** (public, rate-limited via the password-reset
   bucket) — looks up the user by email; if found and not yet verified, issues a new
   verification email. **Always returns success regardless of outcome** — this is
   deliberate enumeration-resistance: the response can't be used to determine whether an
   email address has an account.
4. **`POST /auth/login`** (public, rate-limited: 5/min) — looks up the user by email,
   rejects (401 "Invalid email or password") if the user doesn't exist, is inactive, is
   soft-deleted, or the password doesn't verify. **The failure path is identical in shape
   in every one of those cases** (`AuthService.login`'s `failLogin` helper) specifically so
   a timing or response-shape difference can't be used to enumerate registered emails.
   Every failure (including "user doesn't exist") is still recorded as a `LOGIN_FAILURE`
   audit event, with the attempted email stored only as a SHA-256 hash. On success, a new
   opaque session token is generated, its hash stored in a new `Session` row with an
   `expiresAt` of `now + SESSION_TTL_HOURS` (default 720h = 30 days), and the raw token is
   set as the `esaas_session` `httpOnly` cookie. Note: **login does not require a verified
   email** — verification and login are independent; a registered-but-unverified user can
   still log in.

## Session validation

`SessionAuthGuard` (applied globally except where `@Public()` opts a route out) reads the
`esaas_session` cookie, calls `AuthService.validateSession`, and 401s if there's no valid
session. Validation is cache-first: a Redis key (`session:<tokenHash>`) is checked before
falling back to a Postgres lookup by `Session.tokenHash`; on a DB hit the Redis entry is
repopulated with a TTL matching the session's remaining lifetime. A session is invalid if
its `Session` row doesn't exist, is `revokedAt`-set, or is past `expiresAt`.

`GET /auth/me` returns the current user's profile; `GET /auth/sessions` lists the caller's
active (non-revoked, non-expired) sessions with an `isCurrent` flag; `DELETE
/auth/sessions/:id` revokes one — scoped by `userId`, a no-op if the session isn't the
caller's own (see `docs/authorization.md`).

## Logout

`POST /auth/logout` marks the current session `revokedAt`, deletes its Redis cache entry,
clears the cookie, and records a `LOGOUT` audit event.

## Password reset

1. **`POST /auth/forgot-password`** (public, rate-limited) — same enumeration-resistant
   pattern as resend-verification: always returns success; only actually sends an email
   (a 1-hour `VerificationToken` with `purpose: PASSWORD_RESET`) if the account exists,
   is active, and isn't soft-deleted.
2. **`POST /auth/reset-password`** (public, rate-limited) — validates the token the same
   way as email verification (right purpose, not consumed, not expired), then in one
   transaction: consumes the token, updates `passwordHash`, and **revokes every existing
   session for that user** (`Session.updateMany({ revokedAt: null } → { revokedAt: now }
   )`). Forcing full re-login after a password reset is a deliberate precaution — the
   credential may have been reset because it leaked, so any session established under the
   old credential shouldn't be trusted to continue.

## Relevant environment variables

`SESSION_COOKIE_SECRET`, `CSRF_SECRET` (both ≥32 chars, validated at boot —
`packages/config/src/env.ts`), `SESSION_TTL_HOURS` (default 720), `COOKIE_DOMAIN`
(optional, for cross-subdomain deployments), `THROTTLE_TTL_SECONDS`/`THROTTLE_LIMIT`
(the global rate-limit default; auth-specific endpoints have their own tighter,
hardcoded limits — see `docs/security.md`).

CSRF protection (a separate, cookie-independent mechanism layered on top of the session
cookie for every state-changing request) is covered in `docs/security.md`.
