# Privacy

## What's collected

Account/profile data (`User`: email, name, password hash, default currency, timezone) and
whatever financial data the user enters themselves (accounts, transactions, categories,
budgets, goals, recurring transactions) — see `docs/database.md` for the full schema. This
project never connects to real bank accounts and never stores real banking credentials
(README). Session metadata is stored as hashes, not raw values: `Session.ipHash`,
`AuditLog.ipHash`/`userAgentHash` are SHA-256 hashes, and `Session.userAgent` is stored in
the clear only for the user's own "active sessions" list (`GET /auth/sessions`), which is
inherently something the user is entitled to see about themselves.

## Usage-analytics opt-in

`User.shareUsageAnalytics` (default `false`) is an explicit opt-in toggle — nothing is
collected under it unless the user turns it on. `PATCH /users/me/privacy`
(`apps/api/src/users/`) is the only way to change it; every change is recorded as a
`PRIVACY_SETTINGS_UPDATED` audit event with the new value in `metadata`. Per the schema
comment on the column: this flag governs *anonymized product-usage analytics only* —
never financial data. The web UI toggle lives in Settings → Privacy
(`apps/web/src/app/dashboard/settings/privacy-card.tsx`).

## Data portability: CSV export

`apps/api/src/exports/` + `apps/worker/src/data-export/`. A user requests an export
(`POST` creates a `DataExportRequest`, enqueues a `generate-export` BullMQ job, returns
immediately — generation happens asynchronously in the worker). Once the worker finishes,
the request's `status` becomes `READY` and `storageKey` points at the generated file in
the MinIO "exports" bucket. Downloading (`ExportService.getDownloadUrl`) issues a
short-lived (5-minute) presigned S3 URL — the API itself never proxies the file — and is
itself ownership-scoped (`findOwnedOrThrow`, 404 if the request isn't the caller's, see
`docs/authorization.md`). An export expires 24 hours after being marked ready
(`DATA_EXPORT.EXPIRY_HOURS`); requesting a download past `expiresAt` returns 404
("This export has expired — request a new one") rather than a stale/broken link. The
worker's scheduled `export-cleanup.service.ts` job removes expired export files from
storage. Every request and every successful download is audited
(`DATA_EXPORT_REQUESTED`, `DATA_EXPORT_DOWNLOADED`).

Exported CSV fields are formula-injection-sanitized before being written — see
`docs/security.md`.

## Account deletion lifecycle

Full request → grace period → confirm-or-cancel → hard delete flow, spanning `apps/api/src/
account-deletion/` and `apps/worker/src/account-deletion/account-deletion-purge.service.ts`.
Integration-tested end to end in `apps/api/test/account-deletion.e2e-spec.ts`.

1. **Request** (`POST /account-deletion-requests`, authenticated, rate-limited on the
   password-reset bucket) — if the user already has a `PENDING` or `CONFIRMED` request,
   returns the existing one idempotently rather than creating a duplicate. Otherwise
   creates a `DeletionRequest` (`status: PENDING`) with a hashed, single-use
   `confirmationTokenHash`, and emails a confirmation link:
   `${WEB_URL}/account/confirm-deletion?token=...`. Nothing is deleted at this point.
   Audited as `ACCOUNT_DELETION_REQUESTED`.
2. **Confirm** (`POST /account-deletion-requests/confirm`, public — the link is emailed,
   so the confirming browser has no session) — validates the raw token against the hash,
   rejects (401) if not found or not `PENDING`. On success: `status → CONFIRMED`,
   `confirmedAt` set, `scheduledPurgeAt = now + GRACE_PERIOD_DAYS` (7 days,
   `packages/config/src/constants.ts`), and the token hash is cleared (single-use).
   Audited as `ACCOUNT_DELETION_CONFIRMED`. **This is the point of no return unless the
   user cancels within the grace period** — nothing is deleted yet, but the countdown has
   started.
3. **Cancel** (`DELETE /account-deletion-requests/:id`, authenticated, ownership-scoped —
   404 if the request isn't the caller's own) — allowed while `status` is `PENDING` or
   `CONFIRMED`; sets `status → CANCELLED`. Once `COMPLETED` (purged), cancellation is no
   longer possible (`400 Bad Request`) because there's nothing left to cancel. Audited as
   `ACCOUNT_DELETION_CANCELLED`.
4. **Purge** (`AccountDeletionPurgeService.sweep`, worker, hourly `@Cron`) — finds every
   `CONFIRMED` request whose `scheduledPurgeAt` has passed. For each: deletes the user's
   uploaded CSV import files and generated export files from MinIO (best-effort — a
   storage-delete failure doesn't block the user-row deletion), then in one Postgres
   transaction writes a final `ACCOUNT_DELETION_PURGED` audit row (`userId: null`,
   `targetId` = the purged user's id, so the audit trail survives with the actor
   anonymized) and hard-deletes the `User` row — which cascades through nearly every
   user-owned table per the schema's `onDelete: Cascade` relations (see `docs/database.md`
   for exactly what cascades and what's `Restrict`/`SetNull` instead).

This is a genuine hard delete, not a soft delete or anonymization-in-place — once the grace
period expires and the sweep runs, the data is gone. The 7-day grace period plus explicit
email-confirmed opt-in plus a cancel window are the safeguards against an accidental or
malicious deletion request being irreversible.

## Audit logging as a privacy control

Every privacy-relevant action (registration, login/logout, email verification, password
reset, session revocation, the full deletion lifecycle, every financial-resource mutation,
CSV import, data export request/download, privacy-settings changes) is recorded in
`AuditLog`. This serves two purposes: an incident/support trail, and — because IPs and user
agents are stored only as SHA-256 hashes, and `metadata` is documented in code as
pre-sanitized-only (never passwords, tokens, or full financial records) — a design that
tries to keep the audit trail itself from becoming a second copy of sensitive data. See
`docs/security.md` for the full mechanism and `docs/database.md` for the `AuditLog` schema
including the nullable-`userId`/`SetNull` relation that lets it outlive a purged account.
