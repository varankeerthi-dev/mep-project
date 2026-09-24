# Quotation <-> Project Interlink — PRD

**Scope:** When a quotation carries a `project_id`, (1) the quotation lands in that project's collaboration channel as a system message with a deep link, and (2) the quotation appears inside the Project module, Transactions tab, for that project.
**Status:** Approved for implementation (requested directly).
**Source:** Technical investigation against actual source + live baseline (no new architectural pattern — reuses the daily-report precedent).

---

## 0. Why this PRD exists

Quotations already store `project_id` (`record_quotation(p_project_id)`, `CreateQuotation/index.tsx` project picker), but nothing consumes it cross-module: the project channel never hears about the quotation, and ProjectDetailView Transactions shows POs/invoices/payments/materials but never quotations. This PRD wires both directions with the smallest safe change.

**Non-goals (explicitly out of scope):** edit/revision channel posts (channel spam; edits are covered by `quotation_activity_log` + History tab), status-change posts beyond created/submitted/approved, backfilling old quotations, mobile UI work (noted as follow-up per AGENTS.md rule 1), changing quotation numbering/approval semantics.

---

## 1. Verified investigation ledger

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Every project auto-gets a primary channel | Confirmed | `projects/features/collaboration/hooks.ts:51` (`useProjectChannel`: "Ensures the project's primary channel exists"); RPC `get_or_create_project_channel` (baseline, SECURITY DEFINER, membership-checked) |
| 2 | System messages with linked entities are supported | Confirmed | `MessageType` includes `'system'`; `MessageMetadata.linked_entities` (`types.ts:98-104`); `LinkedEntityChips.tsx` renders chips; `MessageList.tsx:46` filters `document` type |
| 3 | Daily reports already do exactly this | Confirmed | `link_daily_report_to_channel` (baseline): idempotency via `daily_report_channel_links`, channel resolve, system message, deterministic insert, best-effort `audit_log`. **This is the template to mirror.** |
| 4 | `send_collaboration_message` is idempotent per (channel, client_msg_id) | Confirmed | Baseline body: `IF p_client_msg_id IS NOT NULL THEN SELECT ... RETURN existing` |
| 5 | Posting requires org membership, enforced server-side | Confirmed | Baseline: `auth.uid()` null-check + `org_members EXISTS` check else `RAISE 'forbidden'`; prior live test threw `P0001: forbidden` cross-tenant (`docs/antigravity-session-*.md:46281`) |
| 6 | No 'quotation' linked-entity type exists | Confirmed | Union in `types.ts:81-96` has `task/reminder/work_order/issue/daily_report/document/rfi/boq/material/po`; `document` routes to `/documents/:id` (wrong for quotations) |
| 7 | Quotation RPCs already persist `project_id` | Confirmed | `record_quotation(p_project_id)`, `update_quotation` (`20260818*phase5*.sql`) |
| 8 | Transactions aggregate per project, no quotations | Confirmed | `useProjectDetails.ts:41-80` aggregates pos/invoices/expenses/payments by `project_id`; `ProjectDetails` type (`projects/types/index.ts:30-35`) has no quotations field |
| 9 | Migration drift warning applies | Confirmed | `apps/web/docs/COLLAB-TASK-REMINDER-AUDIT.md:48`: collab DDL not in repo migrations; `baseline_*` is source of truth; **every new schema object must ship as a repo migration file** |
| 10 | Quotation save has manual/autosave split | Confirmed | `CreateQuotation/index.tsx:handleSave(saveAndNew, isAutosave)`; channel posts must fire on manual saves only (autosave every 15s would spam) |

---

## 2. Design

### 2.1 Channel post (write path)

New SECURITY DEFINER RPC `post_quotation_channel_card(p_quotation_id UUID, p_event TEXT)`, modeled line-for-line on `link_daily_report_to_channel`:

1. `auth.uid()` null-check, else `not_authenticated`.
2. Load quotation row (`quotation_no`, `project_id`, `organisation_id`, `grand_total`) + client name (`clients.client_name`). Missing row: raise. Missing `project_id`: raise `no_project_linked` (caller gates on it; reaching here without one is a bug — fail loud in logs per ENGINEERING-RULES #13).
3. Validate `p_event IN ('created','submitted','approved')`, else raise.
4. `pg_advisory_xact_lock(hashtext('quotation-channel:' || quotation_id || event))` (race-safe, mirrors `get_or_create_project_channel` locking).
5. Idempotency: `SELECT message_id FROM quotation_channel_links WHERE quotation_id AND event`; if found, return existing message (retry/double-click safe per DATA-INTEGRITY).
6. Resolve channel via `public.get_or_create_project_channel(project_id)`.
7. **Tenant guard (beyond the daily-report template):** `quotation.organisation_id` must equal `channel.organisation_id`, else raise `org_mismatch` (a quotation for org A must never post client/pricing data into org B's channel).
8. Build content (ASCII-only) + metadata `linked_entities: [{type:'quotation', id, label: quotation_no}]`.
9. Deterministic `client_msg_id`: md5-based UUID from `('qc:' || quotation_id || ':' || event)` (the daily-report `('dr:'||...)::uuid` form is not valid-UUID-safe; format md5 hex as 8-4-4-4-12 explicitly).
10. Insert via existing `send_collaboration_message` (reuses its membership checks; its own (channel, client_msg_id) idempotency is second-layer defense).
11. Insert `quotation_channel_links` row (`UNIQUE(quotation_id, event)` as constraint-level backstop).
12. Best-effort `audit_log` insert (same `BEGIN...EXCEPTION WHEN OTHERS THEN NULL` pattern).
13. Return message row.

New table `quotation_channel_links` (mirror `daily_report_channel_links` + surrogate PK + event):
`id UUID PK`, `organisation_id UUID NOT NULL`, `quotation_id UUID NOT NULL → quotation_header(id) CASCADE`, `project_id UUID NOT NULL`, `channel_id UUID NOT NULL`, `message_id UUID NOT NULL`, `event TEXT NOT NULL`, `created_at`, `UNIQUE(quotation_id, event)`, index on `(project_id)`. RLS enabled, **no policies** (deny-by-default; all access through the DEFINER RPC — nothing in the client reads this table).

New `LinkedEntity` type `'quotation'`: extend union (`types.ts`), `ROUTES` (`/quotation/view?id=`), `COLORS` in `LinkedEntityChips.tsx`. Does not touch the `document` files-filter.

### 2.2 Frontend triggers (fire-and-forget, warn-only)

New helper `postQuotationChannelCard(quotationId, event)` in `projects/features/collaboration/api.ts` (mirrors `postTaskChannelCard`): single RPC call, throws on error; callers `.catch` to console.warn. Never blocks saves (rule: auxiliary writes must not fail business operations).

- `CreateQuotation/index.tsx` `handleSave`: after successful **manual create** (`!isAutosave && !editId`) with `formData.project_id` present → post `'created'`. Edits do not post (channel spam; edits are covered by the activity log).
- `QuotationView.tsx` `handleSubmitForApproval`: after `approvalId` created and quotation has `project_id` → post `'submitted'`.
- `QuotationView.tsx` `handleApprovalAction('APPROVED')`: on success and `project_id` present → post `'approved'`. Rejections/returns do not post.

### 2.3 Project Transactions quotations list (read-only UI)

- `useProjectDetails.ts`: 5th parallel query on `quotation_header(id, quotation_no, date, grand_total, status, client_id, client:clients(client_name))` filtered `project_id + organisation_id`, ordered newest first; returns `quotations` (only when the transactions tab family is enabled, like the others).
- `ProjectDetails` type: add `quotations: any[]`.
- `ProjectDetailView.tsx`: `const projectQuotations = projectDetails?.quotations ?? []`, pass as prop; extend `activeTransactionTab` union with `'quotations'`.
- `TransactionsTab.tsx`: add `{ id: 'quotations', label: 'Quotations', count }` sub-tab + list (number, date, client, amount, status + View button → `/quotation/view?id=`), reusing `pl-table`/`pl-empty` patterns. No financial-summary changes (quotations are offers, not spend — totals must not mix into PO/invoice math).

---

## 3. Acceptance criteria

1. Saving a NEW quotation with a project posts exactly one `system` message in that project's channel (visible on next channel open / realtime), chip deep-links to `/quotation/view?id=...`.
2. Double-click save / retry / re-run posts no duplicates (link-table hit returns existing row).
3. Saving with NO project posts nothing and errors nothing.
4. Submit-for-approval and Approve post `submitted`/`approved` once each (only on success paths).
5. Editing an existing quotation posts nothing to the channel.
6. Project Transactions shows a Quotations tab with count; rows open the quotation view; projects without quotations show the standard empty state.
7. Cross-tenant: forged `quotation_id` from another org raises (RPC-side row scoping + org-mismatch guard); verified by code inspection against the `forbidden` precedent (live cross-tenant RPC test requires staging creds — recorded as manual step).
8. Failure behavior: RPC failure surfaces as console warning only; quotation save succeeds regardless (verified by code path: no `await` on the critical path... fires after success commit point).
9. No existing behavior changes when `project_id` is absent (all hooks gated).
10. Mobile: writes are backend-driven so mobile-created quotations with projects post identically; the new Transactions sub-tab on mobile is a noted follow-up (AGENTS.md rule 1), not in this change.

---

## 4. Verification plan (per VERIFICATION.md layers)

| Layer | How (this environment: code + static DB evidence, no live write access) |
|---|---|
| Build/typecheck | `esbuild` transform on every touched file (repo's established check; `tsc` is broken repo-wide pre-existing) |
| Real workflow | Trace: create quote w/ project → RPC args resolve; submit → approve; open project channel + transactions tab (code-path walkthrough, recorded below) |
| Data integrity | Idempotency: link-table UNIQUE + advisory lock + deterministic client_msg_id (triple layer); no partial state (single RPC transaction; client writes are post-commit notifications only) |
| RLS/tenant | New table deny-by-default; RPC does auth + membership (via send_*) + explicit org-match guard; no client-supplied org/project trusted (server derives from quotation row) |
| Regression | Column/table changes are additive (new sub-tab, new union member, new query in Promise.all with independent error already thrown per-result... note: transactionsQuery throws if ANY fails — quotations failure would break POs list; mitigate: catch inside quotations fetch returning [] — decided: yes, isolate failure) |
| Failure/retry | RPC raises named errors (`not_authenticated`, `no_project_linked`, `org_mismatch`, bad event); client logs warning, save unaffected |

**Migration to run (Supabase SQL Editor):** `apps/web/supabase/migrations/20260924000002_quotation_channel_link.sql` (table + RPC in one file, following repo convention).

## 5. Open items / follow-ups

- Mobile Transactions quotations surface (AGENTS.md#1).
- Backfill: post `created` messages for historical project quotations (one-off script, optional — default: no backfill).
- `client_msg_id` determinism relies on md5 formatting; uniqueness enforced by link table regardless.

---

## Phase 2 — Approval comments + in-channel decisions (approved via grill)

**Scope:** MD/manager comments on every decision; channel-side Approve/Reject/Request Changes; PDF access from channel. Web only.

1. **Comments required on Approve/Reject/Request Changes** — shared comment dialog (QuotationView `Review` button + channel card inline expand), placeholder instruction hints. Persists via existing `approval_actions.comments`; creator reads them in the History timeline (already renders decision comments). No new storage.
2. **`QuotationCard`** (`collaboration/components/QuotationCard.tsx`, dispatched from `MessageBubble` on `linked_entities[0].type === 'quotation'`): live quotation (no/client/amount/status), View link, **View PDF** link (embed URL, new tab, browser-native), eligibility-gated Approve/Reject/Request Changes (shadcn buttons) + inline required-comment box. Falls back to label + links when the quotation is unreadable.
3. **Eligibility gate** — approval `PENDING` + viewer is not the requester + (designated reviewer match when `reviewer_id` set, else channel admin/owner). Enforced in UI **and** server-side: `processApproval` gains the reviewer check mirroring `submitReviewAction` (`reviewer_id` set and not caller → `UNAUTHORIZED`).
4. **Decision channel posts** — `rejected`/`returned` events added to `post_quotation_channel_card` allowlist (delta migration `20260924000003`); view + channel decisions both post outcome events (idempotent via existing link table).
5. **PDF** — new-tab embed viewer only; no in-channel modal viewer, no new PDF code. Caveat recorded: the browser's native toolbar always permits save/print; "view-only" means the app offers no edit/download actions.

**Acceptance:** manager opens channel → sees quotation card → previews PDF in new tab → approves with instruction comment → creator sees decision + comment in History timeline; non-reviewer/non-admin sees no buttons; double decision attempts fail safe (`INVALID_STATE` / link-table dedup).
