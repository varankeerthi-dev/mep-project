# COMMUNICATION LOG — Production Audit Report

> **⚠ CORRECTED 2026-09-16 — see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`.**
> Read against the live project, the P0s here are wrong: `client_communication` carries a single `ALL` policy `user_can_access_org(organisation_id)` (**not** `USING (true)`); `client_communication_entries` and `notifications` **do not exist** in production at all; there is no communication view, and no `security_invoker` gap in one. The module still fails, for a different and runtime-proven reason: the routed `/client-lookup` page inserts into `client_communication_entries` and `notifications`, both of which return **404 `PGRST205`** to the app's own anon key. Treat this report's database findings as superseded; its code-level observations remain useful.

**Standard:** `MODULE_REFERENCE_PATTERN.md` (audit-only mode, §36).
**Date:** 2026-09-16
**Scope:** Client communication log — web page, mobile screens, storage, SLA/escalation, entries/threading.
**Evidence basis:** repository only — **superseded**: the live database was subsequently read (see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`). Every database finding below states the repository evidence; where production may differ, that is called out explicitly and a verification query is provided in the rollup report.

---

## Executive Status

```text
FAIL
```

Two P0 cross-tenant exposures and a notification table with no RLS are unmitigated in every artefact available in the repository, and the runtime "log call and route" flow is broken against the only schema definition that exists in the repo.

---

## Module Inventory

| Area | Findings |
|---|---|
| Pages | `pages/ClientCommunication.tsx` (3,154 lines — shell + list + filters + create/edit + threading + attachments + site-visit creation + issue creation), `pages/ClientLookup.tsx` (second writer), `pages/ClientList.tsx` (history read) |
| Components | none dedicated; UI is inline inside the page |
| Hooks | none dedicated; 10 `useQuery` + 4 `useMutation` defined inline in the page |
| Database tables | `client_communication`, `client_communication_entries`, `notifications` (SLA), storage bucket `communication-attachments`, legacy bucket `client-communication` |
| Views / RPCs | `view_client_communication_threads`, `get_next_entry_sequence()`, `set_entry_user_name()`, `update_parent_entry_count()`, `get_client_active_thread_today()`, `escalate_urgent_communications()` (+ `cron.schedule`) |
| Integrations | `site_visits` (auto-create), `issues` (auto-create), `clients` / `purchase_vendors` / `subcontractors` / `leads`, `approvals`-adjacent `notifications` |
| Exports | none |
| Mobile | `apps/mobile/src/screens/ClientCommunication.tsx` (1,806 lines), `apps/mobile/src/screens/ClientLookup.tsx` (also writes) |
| Repository migrations | **zero.** `grep -rn "client_communication" apps/web/supabase/migrations` returns nothing. Schema lives only in ad-hoc scripts: `apps/web/sql/client_communication*.sql`, `apps/web/src/database-communication-{assignee,sla,storage,tier2}.sql` |

---

## P0 Findings

### P0-1 — `client_communication` has no tenant boundary in the database

`apps/web/sql/client_communication_fixed.sql:34-39`

```sql
CREATE POLICY "Enable all access for authenticated users"
  ON client_communication
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- A single `FOR ALL` policy with `USING(true) / WITH CHECK(true)`.
- RLS is enabled, so the table is *not* open to `anon`, but **every authenticated user of every organisation can SELECT, INSERT, UPDATE and DELETE every row**.
- No repository migration supersedes this policy (the placeholder migrations that would have carried it — `20240101000111_communication_subject_followup.sql` — are 0 bytes).
- The organisation filter exists only in `ClientCommunication.tsx` (`.eq('organisation_id', organisation?.id)`), which Rule 1 explicitly rejects as the tenant boundary.

**Impact:** cross-tenant read and write of client call logs, including client names, briefs, next actions and assignees.
**Required first step:** confirm in production (`select policyname, cmd, qual, withcheck from pg_policies where tablename = 'client_communication';`) before concluding — but nothing in the repository closes it.

### P0-2 — `client_communication_entries` child table is unprotected and has no `organisation_id`

`apps/web/sql/client_communication_entries.sql:84-89`

```sql
ALTER TABLE client_communication_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users"
  ON client_communication_entries FOR ALL
  USING (auth.role() = 'authenticated');
```

- The table has no `organisation_id`; the only link to a tenant is `parent_communication_id`.
- The policy does not correlate to the parent at all, so §9 (child record security) is violated: any authenticated user can read, edit and delete entries belonging to another tenant's communication.
- `view_client_communication_threads` (same file, line 92) is created **without `security_invoker = true`**. In PostgreSQL a view executes with the privileges of its owner, so in Supabase the view additionally bypasses the base-table RLS and returns threads across tenants.
- `get_client_active_thread_today()` is a plain `plpgsql` function (no `SECURITY DEFINER`, no tenant check) exposed as an RPC; the frontend does not currently call it, but it is callable.

### P0-3 — `notifications` table is never protected

`apps/web/src/database-communication-sla.sql:4-14` creates `notifications` (user, org, title, body, link, read). Across the entire repository **no file enables RLS on `notifications`** (`grep` over `apps/web/supabase/migrations`, `apps/web/src/*.sql`, `apps/web/sql` — only `ALTER TABLE notifications ADD COLUMN` in `database-work-instruction.sql`).

**Impact:** with RLS disabled, PostgREST's `authenticated` grant exposes every row: all users can read other tenants' notification titles/bodies (which carry client names and escalation text) and can insert/delete notifications for arbitrary `user_id`s.

---

## P1 Findings

### P1-1 — Module schema is absent from migration history

No applied migration creates or alters `client_communication`, `client_communication_entries` or `notifications`. The SQL-editor scripts are internally inconsistent: `client_communication.sql` (RLS `auth.role() = 'authenticated'`) and `client_communication_fixed.sql` (RLS `USING(true)`) are two different definitions of the same table, and neither is referenced by a migration or a setup doc in `apps/web/docs`.

### P1-2 — Referenced columns exist in no schema file

The frontend and the SLA function use columns that **no repository SQL defines** on `client_communication`: `organisation_id`, `party_type`, `vendor_id`, `subcontractor_id`, `lead_id`, `follow_up_date`, `subject`, `is_resolved`, `referred_to_partner_id`, `contacted_contact_id`, `logged_by_role`, `project_id`.

Evidence: `ClientCommunication.tsx:490-580, 640-712`; `ClientLookup.tsx:374-396`; `database-communication-sla.sql:30-42`. The only non-empty additions in the repo are `assigned_to` (`database-communication-assignee.sql`), `parent_communication_id`, `attachments` (`database-communication-tier2.sql`) and `linked_type`/`linked_id` (`sql/client_communication_linked_items.sql`).

Consequence: the module either works only because of untracked SQL-editor changes, or it fails at runtime with `PGRST204`/`42703`. Both are production risks; the first is the migration-integrity finding, the second is untested code.

### P1-3 — Quick Lookup "log call and route" violates the entries CHECK constraint

`apps/web/src/pages/ClientLookup.tsx:401-408` (and the mobile twin) insert:

```ts
.from('client_communication_entries')
.insert({ parent_communication_id: commData.id, entry_type: 'Briefing', brief: `...`, entered_by: user?.id })
```

`client_communication_entries.entry_type` is constrained to `('call','email','whatsapp','meeting','note','sms')` (`sql/client_communication_entries.sql:15`). `'Briefing'` violates it, so the insert raises `23514` — **after** the parent `client_communication` row has already been committed (line 374). The user sees a failed action; the communication row exists anyway (and is duplicated on retry). `entry_sequence` is also omitted, relying on `DEFAULT 1`, which collides with the `UNIQUE(parent_communication_id, entry_sequence)` constraint on a second entry for the same parent.

### P1-4 — Create flow is a non-atomic multi-step sequence with no idempotency

`ClientCommunication.tsx:617-712` performs, in order:

```text
optional site_visits INSERT  →  client_communication INSERT  →  issues INSERT (createIssue)
   →  N storage.upload() calls  →  client_communication UPDATE(attachments)
```

Each step can fail independently and there is no transaction and no idempotency key:

- communication saved, issue creation fails → user retries → duplicate communication;
- uploads fail halfway (`throw uploadErr`) → communication exists without attachments, user sees an error;
- `attachmentFiles` are uploaded inside the same mutation, so a single bad file discards the whole action in the UI while leaving the row.

§19 requires this to be a server-side transaction/RPC.

### P1-5 — Reply threading validates the parent without a tenant filter

`ClientCommunication.tsx:624-644` loads the intended parent with `.from('client_communication').select(...).eq('id', data.parent_communication_id).single()` and compares party ids **in the browser**. With P0-1 in place this allows a reply to be attached to another tenant's record. Cycle prevention is client-side (`checkCycle`) plus a DB trigger that only blocks self-parenting (`database-communication-tier2.sql`), so longer A→B→A chains are only prevented by the browser.

---

## P2 Findings

1. **Unbounded queries with `SELECT *`** — `.select('*, client:..., vendor:..., subcontractor:..., lead:...')` with no `.limit()` on three list queries (`ClientCommunication.tsx:490-580`). §15/§27: full-table scans, large payloads, over-exposed columns.
2. **Attachment URLs expire** — signed URLs are generated with a 7-day TTL and stored permanently in `attachments` JSONB (line ~700). Attachments silently break after 7 days; §30 stale-data risk.
3. **Upload path collisions** — `${organisation_id}/${commId}/${file.name}` with `upsert: false`; re-uploading a file with the same name always fails.
4. **Error surface inconsistency** — `alert('Failed to save communication: ...')` for create errors, `console.error` elsewhere; no retry path (§26).
5. **Cache identity** — `['party-communication-history', type, id]` omits `organisation?.id` (§12). UUID uniqueness makes the practical leak small, but the key is not tenant-aware while the sibling keys are.
6. **Duplicate/drifted `useQuery` shapes** — `all-follow-ups` and the main list select the same columns with different key names; both filter `status` in a case-insensitive `in()` list (`'Open','In Progress','open','in_progress'`) because the write path normalises in the browser rather than in the DB.
7. **No DB-side validation of status/priority** — the write path maps `open→Open`, `urgent→Urgent` etc. in `dbData`; there are no CHECK constraints, so any other client can store arbitrary status strings.
8. **Non-idempotent storage policies** — `database-communication-storage.sql` creates three `storage.objects` policies without `DROP POLICY IF EXISTS` (fails on re-run), has no UPDATE policy, and the competing bucket `client-communication` created in `sql/client_communication.sql` has no object policies at all.
9. **`cron.schedule` hard dependency** — `database-communication-sla.sql` calls `cron.schedule('escalate-urgent-comms', '*/15 * * * *', ...)`; it fails unless `pg_cron` is installed, and it is not idempotent (duplicate job name on re-run). `escalate_urgent_communications()` is `SECURITY INVOKER`, so when it is called from a user session the notification inserts it performs **for other users** are subject to RLS on `notifications`; it has no authorization guard of its own.

---

## Database & Security

| Check | Result |
|---|---|
| Tenancy model declared | No — table is implicitly tenant-owned via `organisation_id`, never documented or FK-enforced in repo |
| `organisation_id` FK / NOT NULL | Not present in any repository definition |
| RLS enabled | Yes for `client_communication` and `client_communication_entries`; **No** for `notifications` |
| Policy matrix | `client_communication`: ALL via `USING(true)`. `entries`: ALL via `auth.role()='authenticated'`. `notifications`: none |
| `WITH CHECK` present | Yes, but tautological (`true`) |
| Child-table boundary | Absent |
| View security | `view_client_communication_threads` is security-definer by default (no `security_invoker`) |
| Auth mechanism | Not used by this module (`user_can_access_org` is never referenced) |
| Storage isolation | Correct org-prefix checks for the `communication-attachments` bucket (good), but non-idempotent and missing UPDATE |

---

## Query & Cache

| Check | Result |
|---|---|
| Query keys tenant-scoped | Mostly yes (`['clients', org]`, `['client-communications', filters, org]`, `['all-follow-ups', org]`, `['users', org]`); `party-communication-history` not |
| `staleTime` / `gcTime` | 5–30 min staleTime, defaults for gcTime; acceptable |
| Invalidation after mutation | Correct (invalidates list, follow-ups, history) |
| Polling | None found |
| Projection | `SELECT *` + nested joins everywhere |
| Organisation switching | Query keys change with org, but the client-side cache is cleared only by invalidation; switching tenants while a mutation is in flight can still write `organisation_id` captured from the render closure (`dbData.organisation_id = organisation?.id`) |

---

## Frontend Architecture

`pages/ClientCommunication.tsx` is 3,154 lines and combines: page shell, filter state, 10 data queries, 4 mutations, form state for two modals, threading validation, attachment upload, a `site_visits` write path, an `issues` write path, PDF/whatsapp helpers and a party-history drawer. This is the §24 anti-pattern (UI + data + business logic + multi-workflow + cross-module side effects). Refactor by responsibility: `communication-data.ts` (queries/mutations), `use-communication-form.ts`, `CommunicationRow.tsx`, `CommunicationDetailDrawer.tsx`, `attachments.ts`, and remove the cross-module side effects behind explicit services.

`pages/ClientLookup.tsx` duplicates the create path (including entries + notifications) instead of calling one API module.

---

## Business Integrity

| Workflow | Finding |
|---|---|
| Log communication | Non-atomic, no idempotency (P1-4) |
| Reply / thread | Client-side tenant validation, weak cycle guard (P1-5) |
| Mark resolved / reopen | Browser-side status normalisation, no DB constraint |
| Attach files | Partial-write risk, 7-day expiring URLs |
| Escalate urgent (SLA) | Depends on an unavailable extension and unrepresented columns; no authorization guard |
| Quick Lookup log-and-route | Fails on `entry_type='Briefing'` (P1-3) |

---

## Migration Integrity

| Production object | Repository migration | Ad-hoc SQL |
|---|---|---|
| `client_communication` | none (placeholder `20240101000111` is 0 bytes) | 4 conflicting scripts |
| `client_communication_entries` | none | `sql/client_communication_entries.sql` |
| `notifications` | none | `src/database-communication-sla.sql` |
| Storage buckets/policies | none | 2 scripts |

Repository migration history does **not** represent this module's database evolution.

---

## Runtime Verification

| Test | Result |
|---|---|
| Load | NOT VERIFIED |
| Search | NOT VERIFIED |
| Filter | NOT VERIFIED |
| Create | NOT VERIFIED |
| Edit | NOT VERIFIED |
| Primary workflow (log call → follow-up) | NOT VERIFIED |
| Delete | NOT VERIFIED |
| Export | N/A |
| Organisation switch | NOT VERIFIED |

No credentials or test tenants were available in this environment. Recommended mandatory first pass (see rollup report): two test tenants, the §33 matrix on `client_communication` and `client_communication_entries`.

---

## Build Verification

```text
TypeScript:  NOT RUN (full `tsc --noEmit` exceeded 10 minutes in this environment; no changes were made to this module)
Lint:        NOT RUN
Web build:   NOT RUN
Tests:       N/A — the module has no tests
Mobile build: NOT RUN
Capacitor sync: NOT RUN
```

---

## Remaining Issues

**Blocking**

- P0-1, P0-2, P0-3 (tenant boundary absent / unverifiable in production).
- P1-3 (primary quick-action flow throws against the only known schema).

**Non-blocking**

- P1-1, P1-2, P1-4, P1-5; all P2/P3 items.

---

## Final Status

```text
FAIL
```

Cross-tenant exposure is possible through three separate objects and one primary workflow is broken against the repository schema. This module cannot be considered production-verified until the tenant boundaries are enforced in the database and the schema is represented by applied migrations.

---

## Suggested Remediation Order (for the follow-up "audit and fix" pass — not performed here)

1. Establish the true schema from production and write **one** forward migration for `client_communication` + `client_communication_entries` (+ `notifications` RLS), then delete/retire the conflicting ad-hoc scripts.
2. Replace every policy with `user_can_access_org(organisation_id)` (or the app's canonical helper) with an explicit `TO authenticated` grant; add `organisation_id` to the entries table and enforce `entry_organisation = parent_organisation` via trigger or composite FK; recreate the view with `security_invoker = true`.
3. Move the create path (site visit + communication + issue + attachments) into one RPC with an idempotency key; add `CHECK` constraints for `entry_type`/`status`/`priority`.
4. Split the page by responsibility and extract a single `client-communication` data module used by both web pages and mobile.
