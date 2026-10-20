# Alpha Clean Start: isolated bootstrap

This directory is a **separate Supabase CLI project**. Run the CLI from here only after the new empty project is authorized. It is not a reset path for the existing Quadriamo project. No historic users, rows, credentials, jobs, or subscriptions are imported.

The five ordered migrations create only the Alpha base, CAS v2, its quotas and pruning contract, private avatar storage policies, and the signed Data API gate. They require Supabase-managed `auth` and `storage` schemas, PostgreSQL 17, `pgcrypto`, and `pg_cron`. The base migration refuses an occupied project. The later migrations refuse missing prerequisites and, where relevant, existing Alpha objects. A failed preflight calls for a new empty project or investigation; never clear an occupied project to make the migration pass.

| Migration | Purpose | Source |
| --- | --- | --- |
| `20261020000100_alpha_base.sql` | Read-only current document, personal profile trigger and read-only Free subscription view | New Alpha source |
| `20261020000200_revisioned_sync.sql` | Revisioned CAS core | Byte-identical copy of `../migrations/0030_revisioned_sync.sql` |
| `20261020000300_alpha_clean_start_sync_limits.sql` | Protected-from-birth accounts, document/quota checks, compact receipts and retention | Byte-identical copy of `../migrations/0031_alpha_clean_start_sync_limits.sql` |
| `20261020000400_avatars.sql` | Private `avatars` bucket and per-account policies | Byte-identical copy of `../migrations/0017_avatars.sql` |
| `20261020000500_alpha_data_api_gate.sql` | Signed direct-API admission, HTTP counters, hourly maintenance | New Alpha source |

The historical `0001`–`0029` sequence is deliberately excluded: it contains legacy onboarding, admin, push, telemetry, shared-budget, billing and external-service behavior. No Edge Function is required by this Alpha slice. The public profile and subscription interfaces remain available to the current client; subscriptions start empty, and Alpha does not grant Pro.

The gateway key table is deliberately empty after migration. The Data API must fail closed until a new key is installed through the private operator runbook and the separate frontend gateway holds the same key. The key belongs only in the Supabase secret table and the server-side Pages Function setting; the frontend receives only the new project's publishable key. `auth.enable_signup=false` and `auth.email.enable_signup=false` are part of this profile; new accounts are created by a trusted administrator invite, followed by email confirmation and password choice. Cloud Auth settings, SMTP, allowed redirects, RLS/ACLs, the pre-request hook and the scheduled job require target verification before traffic.

After private key installation, `verify_ready.sql` is a read-only fail-closed check of schema, RLS, grants, protected accounts, key presence, Data API hook, maintenance job, avatars and absence of Pro grants. It was run successfully against the isolated local stack. Auth service settings and actual ingress behavior need separate HTTP tests; this SQL check cannot prove them.

Build the frontend with `npm run build:alpha` using the reviewed variables in `.env.alpha.example`; this produces `dist-alpha/` with root `BASE_PATH` and a service worker scoped only to the separate origin. The build refuses a production-looking/local mismatch or a private Supabase key. The existing GitHub Pages build and `main` deployment pipeline are independent. The Pages Function under `functions/api/rest/` mediates the approved Data API routes; direct Supabase REST writes are rejected by the database hook without its short-lived signature.

Database document, operation and growth limits are distinct from HTTP ingress limits. The gateway charges each admitted request before parsing or forwarding. Malformed unauthenticated traffic can still reach Supabase's public endpoint before PostgreSQL runs; this cannot be claimed as blocked by the frontend gateway. Auth and Storage have separate controls. Cloud provider policies, billing limits, alerting, email deliverability, and a restore rehearsal on the authorized target are release gates.
