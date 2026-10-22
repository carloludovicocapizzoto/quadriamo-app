# Revisioned synchronization: Clean Start Alpha

The current client requires protocol 2 and `qsync_write_v2(text, uuid, text)`. Migration `0031_alpha_clean_start_sync_limits.sql` is a candidate for a **new, empty Alpha backend**, after the reviewed `0030` base. It refuses existing Auth users, documents, heads, history or receipts, rechecks emptiness under locks, and refuses reapplication. Never delete data to make its preflight pass.

The target is a separate frontend/PWA origin and new invited accounts. Preserve the previous environment and backups for recovery: there is no automatic account or financial-data migration. SQL does not create infrastructure, configure invitations, publish the frontend or authorize release. The historical protocol-1 procedure below remains for comparison and must not be applied as the current client release plan.

## Current release gates

`Deploy` publishes pushes to `main` automatically; merging does not install RPCs. Keep this PR as Draft until the coordinated backend, frontend and installed-PWA procedure is approved.

1. Approve the new backend/origin, invitation-only Auth configuration, platform support, capacity parameters and operational responsibility. Inspect the actual baseline: historical migrations can configure external services/jobs and must not be replayed blindly on a remote project.
2. Preserve old environments, backups, Storage bytes, configuration and local drafts. Rehearse restore into another database, including explicit reviewed ACL restoration and post-restore verification; restored rows alone do not prove safe function grants.
3. On the authorized empty target, install the reviewed base, run `supabase/checks/0031_alpha_preflight.sql`, apply `0031` once as `postgres`, then run `0031_alpha_verify.sql`. Investigate any failed precondition instead of removing existing state.
4. Test real Auth/JWTs, RLS, provisioning, RPCs, concurrent CAS, quotas, replay, pruning and backup/restore. New Auth users receive protected protocol-2 heads in the Auth insert transaction; manual admission/activation is not needed. Invitation restrictions are a separate Auth configuration gate.
5. Configure and test an ingress request-body limit and throttling before opening invitations. SQL rejects oversized input before JSONB parsing/hashing but cannot prevent the HTTP server from receiving it. Returned-row limits are not request-body limits.
6. Publish the compatible build on the approved separate origin only after backend verification. Test offline startup, logout/isolation, rejection/export UI, cooldown and old-PWA coexistence. Keep the stable frontend on its preserved backend.
7. Expand only after reviewing growth, conflicts, rejections, pending-write age, maintenance and recovery. A later merge or deploy requires its own approval.

## Protocol-2 capacity candidates

The owner comes only from `auth.uid()`. API roles cannot write `user_data` directly; private tables/helpers remain unexposed. The RPC serializes each account's writes, checks its immutable receipt and expected revision, and updates the current document, revision hash and compact ACK atomically. No unconditional-upsert fallback exists. The old `qsync_write` remains in the source and rejects these protected accounts.

Initial laboratory parameters require approval before cloud use:

| Control | Candidate |
| --- | --- |
| Current document | 1 MiB, checked on serialized input and canonical JSONB |
| New attempts per account | 200 per UTC day; conflicts and committed validation rejections count |
| New request bytes | 32 MiB per UTC day; the crossing attempt is counted and rejected |
| Structural bounds | depth 20, 50,000 nodes, 16 KiB strings, 256-byte keys, 10,000 transactions, 2,000 items per settings collection |
| Receipts | at least 90 days plus 5-minute clock-skew grace, and the latest 1,000 operations |
| Revision hashes | at least 90 days and the latest 1,000 revisions |

Receipted replays return the original ACK without consuming new-attempt quota. Reusing a UUID with a different expected revision or serialized document fails. Receipts contain a SHA-256 request hash and compact response. History contains revision metadata and a document hash. Neither contains a full document backup; local recovery copies and separate backups remain necessary.

RPC rejection envelopes may arrive with transport HTTP 200 and `status: rejected`, `code`, `httpStatus`, `details`. Clients must inspect the envelope and never treat transport success as a write ACK. Oversized input is counted but rejected without hashing, parsing or receipting it. Transient rate-limit denials have no permanent receipt, allowing the same immutable pending operation to retry after cooldown. Pending financial data remains exportable.

## Pruning and late replay

Operations use UUIDv7 timestamps. A retained receipt wins over its age. The additional five-minute retention grace matches the allowed future-clock tolerance: an accepted UUID whose receipt is removed is outside its supported new-operation window. An unreceipted expired UUID returns `QSYNC_RECEIPT_EXPIRED` without changing the financial document.

The client then rereads the authenticated remote document, archives the old pending candidate and any newer local draft, and reconciles both conservatively. A paused/incompatible backend preserves the outbox. Incompatible changes or a rolled-back revision require an explicit whole-document choice. A compatible new candidate uses a fresh UUID and verified current revision; the expired UUID is not resent blindly. Remote convergence is displayed separately from a new write acknowledgment.

Pruning requires both age and minimum-count conditions. Writes and nonmutating rejection paths trigger bounded-frequency account pruning. `qsync_prune_expired` is a service-role-only RPC for maintenance of inactive accounts; an approved schedule must be configured separately. Table autovacuum settings support space reuse. `0031_alpha_monitor.sql` reports aggregate logical/physical growth without financial payloads or account identifiers. Laboratory storage, WAL, billing and latency do not predict production consumption.

On incidents, keep protection enabled, pause affected writes and preserve reads/export. Restore into a separate database and reconcile changes after the backup. Never reopen blind writes, downgrade envelopes, clear device storage, restore old auth tokens or overwrite newer documents with an old dump. Personal push, full cloud reset/purge and physical-device certification remain separate work; financial rules, recurring events and Pro entitlements are unchanged.

## Historical 0030 pilot procedure — protocol 1, preserved reference

The following describes the previous client and preserved environments. `0031` must not be applied to their historical accounts. The current client does not downgrade to protocol 1.

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
