# Database

PostgreSQL via Prisma. Schema source of truth: `packages/database/prisma/schema.prisma`.
Shared by `apps/api` and `apps/worker` through the `@expense-saas/database` package.

No migration has been generated yet as of this writing — see `docs/deployment.md` for the
one-time `migrate:dev --name init` step required before first run.

## Conventions used throughout the schema

- **IDs**: `cuid()` string primary keys everywhere, not auto-increment integers (avoids
  leaking row counts / creation order to clients).
- **Money**: every monetary column is `BigInt` and named `*Minor` (e.g. `amountMinor`,
  `balanceMinor`) — integer minor units, never a float. See `docs/architecture.md` for why.
- **Ownership**: almost every model has a `userId String` foreign key to `User` with
  `onDelete: Cascade` — deleting a `User` row cascades through nearly the entire schema,
  which is exactly what the account-deletion purge relies on (see below and
  `docs/privacy.md`). Restrict-typed relations (`onDelete: Restrict`, e.g.
  `Transaction.account`) exist specifically where cascading would silently destroy
  financial history the service layer needs to reference or block via a business rule
  instead (e.g. `AccountsService.remove` refuses to delete an account that still has
  transactions, telling the user to archive it instead).
- **Hashing over storage**: session tokens (`Session.tokenHash`), single-use verification/
  reset/deletion-confirmation tokens (`VerificationToken.tokenHash`,
  `DeletionRequest.confirmationTokenHash`), IPs, and user agents (`AuditLog.ipHash`/
  `userAgentHash`, `Session.ipHash`) are stored as hashes, never in plaintext — the raw
  values exist only transiently (in a cookie, in an emailed link, in a request).

## Entities

### Auth foundation (Phase 2)

- **`User`** — `email` (unique), `passwordHash` (argon2id), `name`, `emailVerifiedAt`
  (null until verified), `isActive`, `defaultCurrency`, `timezone`,
  `shareUsageAnalytics` (opt-in analytics flag, see `docs/privacy.md`), `deletedAt`
  (currently unused by the deletion flow — purge is a hard delete of the row, not a soft
  delete; see below).
- **`Session`** — one row per logged-in session. `tokenHash` unique; `expiresAt`,
  `revokedAt` (logout / password-reset invalidation sets this rather than deleting the
  row, preserving an audit trail of session lifetimes).
- **`VerificationToken`** — single-use tokens for both `EMAIL_VERIFY` and
  `PASSWORD_RESET` purposes (`VerificationTokenPurpose` enum), sharing one table since
  both are "hash a random token, expire it, consume it once" with identical shape.
  `@@index([userId, purpose])`.
- **`AuditLog`** — append-only. `userId` is **nullable** (`onDelete: SetNull`) because
  pre-auth events (a failed login attempt) have no authenticated user, and because a
  purged user's audit history is deliberately kept (with `userId` nulled) rather than
  cascaded away — see `AccountDeletionPurgeService`. `action` is the `AuditAction` enum
  (30+ variants covering auth, financial-data mutation, CSV import/export, and privacy
  events). `metadata` is `Json?` and is documented (in code) as pre-sanitized-only — never
  passwords, tokens, or full financial records.
- **`DeletionRequest`** — the account-deletion state machine. `status`
  (`PENDING → CONFIRMED → COMPLETED`, or `CANCELLED` at either of the first two states).
  `confirmationTokenHash` is unique and nulled out once confirmed (single-use).
  `scheduledPurgeAt` is set on confirmation (`now + GRACE_PERIOD_DAYS`, currently 7 days —
  `packages/config/src/constants.ts`); the worker's hourly sweep purges every `CONFIRMED`
  request whose `scheduledPurgeAt` has passed. Full detail in `docs/privacy.md`.

### Core financial domain (Phase 3)

- **`Account`** (a financial account — checking, cash, card, etc., `AccountType` enum:
  `CASH`/`BANK`/`CREDIT_CARD`/`SAVINGS`/`WALLET`) — `balanceMinor` is a **cached running
  balance**, maintained transactionally by `TransactionsService` alongside every
  `Transaction` write; it is never written directly from client input. `isArchived`
  supports hiding an account without deleting its transaction history.
- **`Category`** — `userId` is **nullable**: null means a system-default category visible
  to and usable by every user but owned/editable by none of them; non-null means a user's
  own custom category. `type` is `INCOME` or `EXPENSE`.
- **`Transaction`** — the core ledger row. `type` is `INCOME`/`EXPENSE`/`TRANSFER`.
  `categoryId` is required for `INCOME`/`EXPENSE`, null for `TRANSFER`; `transferAccountId`
  is the mirror — null except on `TRANSFER`, pointing at the destination `Account` (a
  transfer is modeled as one row with both a source `accountId` and a destination
  `transferAccountId`, not two paired rows). `amountMinor` is always positive; see
  `docs/architecture.md`. Indexed on `[userId, occurredAt]` (list/filter by date range),
  `accountId`, and `categoryId`.

### Budgets, goals, recurring transactions, notifications (Phase 4)

- **`Budget`** + **`BudgetPeriod`** — a `Budget` is the user's ongoing configuration
  (`periodType`: `MONTHLY` rolling from an anchor `startDate`, or `CUSTOM` with an explicit
  `endDate`); `categoryId` null means an overall budget across every expense category.
  Each `BudgetPeriod` is a **snapshot**: `amountMinor` is copied from the parent `Budget`
  at period-creation time so editing the budget later doesn't rewrite history for past
  periods, and `spentMinor` is refreshed from live `Transaction` data on read rather than
  kept eagerly in sync on every transaction write. `@@unique([budgetId, periodStart])`
  prevents duplicate periods.
- **`FinancialGoal`** — `targetAmountMinor`/`currentAmountMinor` tracked directly on the
  goal (contributions are recorded against the goal itself, not derived from a linked
  account's real transaction history). `linkedAccountId` is optional and purely
  informational (`onDelete: SetNull` — deleting the linked account doesn't delete the
  goal). `status`: `ACTIVE`/`COMPLETED`/`PAUSED`/`CANCELLED`.
- **`RecurringTransaction`** — `INCOME`/`EXPENSE` only (no recurring transfers).
  `frequency` (`DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY`) + `interval` (every N periods).
  `nextOccurrenceAt` is what the worker's sweep reads to decide when to send a reminder;
  `lastReminderSentAt` prevents duplicate reminders. Indexed on
  `[isActive, nextOccurrenceAt]` for the sweep's query.
- **`Notification`** — `type` (`RECURRING_REMINDER`/`BUDGET_THRESHOLD`/`GOAL_DEADLINE`/
  `EXPORT_READY`/`SECURITY_ALERT`), `isRead`, free-form `metadata Json?`. Indexed on
  `[userId, isRead]`.

### CSV import/export, analytics (Phase 5)

- **`CsvImportJob`** — one job per uploaded file, always scoped to a single `accountId`
  (mirrors how real bank/card CSV exports work — one file per account). `fileKey` is the
  object key in the MinIO "imports" bucket for the raw upload. `errors` is
  `{ row: number, message: string }[]` — never raw file content. `status`:
  `PENDING`/`PROCESSING`/`COMPLETED`/`FAILED`.
- **`DataExportRequest`** — `storageKey` (set once the worker generates the file),
  `expiresAt` (24h, `DATA_EXPORT.EXPIRY_HOURS`), `downloadedAt`. `status`:
  `PENDING`/`PROCESSING`/`READY`/`EXPIRED`/`FAILED`. Analytics itself
  (`apps/api/src/analytics`) is computed on demand from `Transaction`/`Account`/`Category`
  rather than a separate persisted model.

## Deletion model: hard delete, not soft delete

Despite `User.deletedAt` existing as a column, the actual account-deletion flow is a hard
delete: `AccountDeletionPurgeService.purgeUser` calls `prisma.user.delete({ where: { id:
userId } })` inside a transaction (alongside writing a final `ACCOUNT_DELETION_PURGED`
audit row with `userId: null`). Because essentially every user-owned table cascades on
`User` deletion, this one `delete` call removes the user's accounts, categories,
transactions, budgets, goals, recurring transactions, notifications, sessions,
verification tokens, and deletion requests in one statement — the schema's cascade graph
*is* the deletion implementation. The only two additions the purge service makes are
deleting the associated files out of MinIO (import/export objects, which Postgres has no
knowledge of) before the transaction, and preserving the audit trail via `AuditLog`'s
`SetNull` relation. See `docs/privacy.md` for the full lifecycle including the grace
period and cancellation window.
