# Authorization

## No role/permission system

This is a single-role consumer application — every authenticated user has the same
capabilities over their own data, and there is no admin role, no team/organization
concept, and no resource sharing between users. `AuditAction`, the Prisma schema, and
every controller in `apps/api/src` were checked for this doc, and none of them reference a
role or permission model — so "authorization" here means exactly one thing: **making sure
a user can only ever read or write their own data.**

## Ownership scoping: the pattern

Every resource that belongs to a user (`Account`, `Category` when user-owned, `Transaction`,
`Budget`, `BudgetPeriod`, `FinancialGoal`, `RecurringTransaction`, `Notification`,
`CsvImportJob`, `DataExportRequest`, `Session`, `DeletionRequest`) is looked up **scoped by
`userId` in the query itself**, not fetched by id and then checked afterward. The
established idiom, seen consistently across services (e.g.
`apps/api/src/accounts/accounts.service.ts`):

```ts
async findOneOrThrow(userId: string, id: string) {
  const account = await this.prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw new NotFoundException("Account not found");
  return account;
}
```

If the `id` exists but belongs to a different user, this query returns nothing — exactly
the same result as the `id` not existing at all. The same pattern appears in
`AuthService.revokeSession` (returns silently, no-op, if the session isn't the caller's),
`ExportService.findOwnedOrThrow`, and `AccountDeletionService.cancel`.

## 404, never 403, on a cross-tenant access attempt

This is deliberate and consistent: a request for another user's resource — whether by a
guessed/enumerated id or a stale id from a previous session — gets a plain `404 Not Found`,
identical in shape to the resource never having existed. It never gets a `403 Forbidden`,
and it never returns the other user's data.

**Why 404 and not 403**: a `403` confirms the resource *exists* and merely tells the
requester they can't touch it — which is itself information leakage. It tells an attacker
"that id is valid, keep trying to find a way in," and lets them enumerate which ids are
real by watching for 403 vs. 404. A `404` gives an attacker nothing to distinguish "this id
belongs to someone else" from "this id was never valid." This is the standard IDOR
(Insecure Direct Object Reference) mitigation, and it's applied uniformly rather than
selectively — the account-deletion feature (`AccountDeletionController.cancel` →
`AccountDeletionService.cancel`) established this convention explicitly and it's followed
by every other resource controller.

## What enforces this

There is no separate authorization guard/decorator layer for ownership (unlike
authentication, which does have `SessionAuthGuard`) — ownership scoping is a **service-layer
convention**, enforced by always including `userId` in the `where` clause of every
lookup/update/delete, never by fetching a row first and comparing `row.userId === userId`
afterward (which would be one accidental omission away from an IDOR). When adding a new
resource type, follow the existing `findOneOrThrow(userId, id)` idiom rather than inventing
a new pattern.

`SessionAuthGuard` (see `docs/authentication.md`) is what establishes `request.user.id` in
the first place — every non-`@Public()` route requires a valid session before any
ownership check is even relevant. `@CurrentUser()` (`apps/api/src/auth/
current-user.decorator.ts`) is the standard way a controller pulls the authenticated
`userId` to pass down into a service call — always from the validated session, never from
a client-supplied field in the request body.

## System-shared data is the one exception

`Category.userId` can be `null`, meaning a system-default category (see
`docs/database.md`) visible to and usable by every user for read/attach purposes, but
owned/editable by none of them. This isn't a gap in the ownership model — it's a distinct,
intentional case: shared read access to non-sensitive reference data, with no write access
for anyone via the normal category endpoints.
