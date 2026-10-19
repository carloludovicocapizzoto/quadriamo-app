# Revisioned synchronization: deployment requirements

Migration `supabase/migrations/0030_revisioned_sync.sql` and the client must be released in a coordinated sequence. The migration has no external HTTP calls, scheduled jobs, billing changes or financial-document conversion. Applying it is an operator action; merging code does not apply SQL.

## Before merging the client

The existing `Deploy` workflow publishes every push to `main`. A merge therefore publishes the client automatically. Complete the approved database and PWA transition first, or agree a deployment hold with the repository owner. A frontend-only deployment cannot synchronize without `qsync_read`, `qsync_activate` and `qsync_write`; it preserves local changes and offers recovery instead of using the old unconditional upsert.

Use an independent staging backend with synthetic users. Development configuration may point at the existing backend: inspect and override it explicitly before running tests. Do not run every historical migration against a live project as a deployment shortcut; some configure external services and jobs.

1. Inventory the actual database roles, policies, triggers, privileged routines, Edge Functions and other writers. `supabase/checks/0030_preflight.sql` provides a read-only starting point, not a complete external-writer audit. Confirm that `qsync_private` is not an exposed API schema and that the existing owner policies remain restrictive.
2. Record a consistent backup and verify its checksum and restore in another database. Preserve local drafts before updating devices. SQL backups cover object metadata, not avatar or attachment bytes; back up those files and the required configuration separately.
3. Review and apply `0030_revisioned_sync.sql` once as the approved `postgres` owner. It refuses unexpected ownership, disabled RLS or existing protocol objects. It runs in one transaction, waits at most five seconds for a lock, and leaves all owners unprotected and not admitted. If it fails, inspect and retry the entire transaction; do not delete objects to force a rerun.
4. Run `supabase/checks/0030_verify.sql` and real authenticated staging tests. Compare existing documents with the backup. Verify both an unchanged legacy client and the new build.
5. Deploy the pilot client separately while the stable frontend remains available. On the shared frontend, users not admitted to the pilot can read and export, but the new client will not synchronize writes. Do not distribute it globally without an agreed transition for these users.
6. Admit only the agreed accounts, then let each user explicitly activate from the compatible client. Admission alone does not protect the account or block old clients. After activation, old unconditional writes fail even if the request claims to be a new client.
7. Expand only after reviewing conflicts, pending writes, recovery, storage growth and installed-PWA updates. Give users a clear update/export path. Accounts still in legacy mode remain subject to the old write protocol.

Admission is a privileged SQL action against a verified user UUID. For example, with a reviewed `pilot_user_id` psql variable:

```sql
begin;
insert into qsync_private.heads(user_id, activation_allowed)
select id,true from auth.users where id=:'pilot_user_id'::uuid
on conflict(user_id) do update set activation_allowed=true;
commit;
```

Check that exactly the intended account was affected. Application roles cannot admit themselves. Removing admission does not undo protection. Pausing writes uses `paused=true` while keeping `protected=true`; never reopen the legacy writer as a rollback.

## Recovery and capacity

Local data, verified base, outbox and recovery copies share one atomic account envelope. Do not downgrade the cache format, clear storage or restore old auth tokens to fix an update. A local logout preserves archives and does not revoke remote sessions without valid server access.

On an incident, stop expanding the pilot, pause affected writes, preserve read/export and investigate current revisions and operation receipts. Restore backups into a separate database and reconcile changes made after the backup. Do not restore an old document over newer acknowledged edits. A database disaster that reuses revisions requires explicit recovery review.

History and receipts currently retain full documents. No retention cleanup or automatic quota eviction is included. Measure size, growth, conflict/retry rates, lock latency and pending-write age before agreeing limits. Expiring receipts without a compatible idempotency protocol can turn a retry into another write.

## Notifications and platforms

Personal push remains suspended. Updating the frontend does not stop existing server senders or cancel pushes already queued. Plan their suspension and the old-worker transition separately before production; local Chromium tests do not certify provider delivery or notifications on physical Android/iOS devices. Existing installed clients must retain their archives throughout the transition.

Full cloud reset and permanent purge are separate protocol work and are not implemented here. Existing account deletion is distinct. Financial rules, recurring events and Pro entitlements are unchanged.

Database security references: [security-definer functions](https://www.postgresql.org/docs/17/sql-createfunction.html), [row security and privileged roles](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
