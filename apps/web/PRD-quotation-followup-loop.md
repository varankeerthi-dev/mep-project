# PRD — Quotation Follow-up Loop (single-path communication → status → revision → notification)

**Status:** Draft v3.3 for review (supersedes v3.2, v3.1, v3, v2.1, v2 and v1 of 2026-10-15)
**Date:** 2026-10-19
**Owner:** Product (Origin-ERP)
**Scope:** `apps/web` quotation lifecycle, Follow-up Center, notifications, quotation history
**Related:** `PRD.md`, `PRD - multiparty.md`, `MANAGER_ALERTS_SETUP.md`

---

## 0. What changed in v3

v2.1's structure held; the six internal-logic fixes (S1–S6) stand, with S1 amended. But code probes on 2026-10-16 showed that several load-bearing claims in §1, §4, §5, §6, §7 and §10 were wrong. v3 rewrites those sections around what the code actually does.

**Verification status.** Findings marked *probed* were established by reading the repo in a verification session on 2026-10-16 (file:line cited). **Nothing has been checked against the deployed database yet.** The repo cannot reproduce the deployed schema (F31), so Phase 0 starts with the read-only catalog queries in Appendix A before any migration is written.

| # | Correction | Effect | Section |
|---|---|---|---|
| C1 | Approving a revision does **nothing**: `triggerPostApprovalActions` has no `quotation_revisions` case; the one function that writes it is dead code (F18, F20) | The revision loop's first transition must be built, not reused | §6, §11 |
| C2 | The live revision-status CHECK already has `in_progress`, `completed`, `rejected` (unused) (F21) | Reuse the existing vocabulary; only `superseded` is new. v2's `applied`/`reissued` withdrawn | §6.1, §10 |
| C3 | `quotation_header.revised_from_id` exists (F22) | Versioning is the cheap option; in-place edit is the novel one. **Adopted (confirm)** | §6, §15 |
| C4 | Edit saves delete and re-insert every `quotation_items` row; an approved quote cannot be edited by the save RPC (F27) | In-place "apply revision" is impossible after approval; versioning plus "no revisions on terminal quotes" removes the deadlock | §5.1, §6.2, §9 |
| C5 | `quotation_items` has no `line_no` or `item_code`; row ids die on every save (F14, F27) | Snapshot is mandatory and keyed differently | §6.4, §10 |
| C6 | Permission keys are dot-separated; no `quotations.approve` exists in the DB catalog or the V1 grant whitelist; the guard v2 reused checks `edit`, which a later migration renamed to `update` (F23) | No "approve holder" role to route to; authorise check must be re-verified | §5.3, §6.3, §7.1 |
| C7 | The revision owner columns are both written as the clicking user (F24) | v2's "handler = `current_owner_id`" always resolved to the actor and emptied the recipient set | §7.1 |
| C8 | Internal rejection of a quote writes `Rejected`; "returned" writes `Under Negotiation`, a value in none of the vocabularies; the reject path swallows errors (F25) | `Rejected` is ambiguous in production today; `Under Negotiation` joins the offender report | §4.1, §4.4 |
| C9 | `fn_prevent_posted_quotation_mutation` never protected status (F26) | v2's §9 claim withdrawn; nothing today stops a status rewrite on an approved quote | §4.4, §9 |
| C10 | `PENDING_APPROVAL` is written only at two submit-for-approval points and only above an approval threshold; nothing chains `Sent → PENDING_APPROVAL → Approved` (F28) | `won` has two document outcomes; product decision required | §4.3, §15 |
| C11 | The real stage graph differs from v2's diagram (F29) | §4.2 now defers to the real edges | §4.2 |
| C12 | The captured baseline shows a `follow_up_status` CHECK of 5 of 9 values and an `event_type` CHECK without `quotation_status_changed` (F30); the baseline predates the remediation migration | Likely already fixed, so F30 may be stale; verified first, not assumed | §1, §11, App. A |
| C13 | `win_loss_reason_id` and `win_loss_notes` already exist (F13) | `loss_reason_id` dropped; reuse | §5.2, §10 |
| C14 | Key sub-DDL files are 0-byte or missing from `supabase/migrations` (F31); `next_action_label` is reported NOT NULL, which working code contradicts | P0-3 is substantive; the RPC populates the column only if Phase 0 shows it is required | §1, §5.3 |

### v3.1 additions (from the review of v3)

| # | Problem found in v3 | Fix | Section |
|---|---|---|---|
| D1 | Renaming `PENDING_APPROVAL` is not a "one-time grep": its readers include the Approve-button condition and the Follow-up Center's `status IN (…)` list, so a backfill alone makes quotations unapprovable and invisible (F32) | The rename ships atomically with every reader; acceptance criterion added | §4.1, §11, §12, §15 Q5 |
| D2 | Approver ids are matched against `employees.id`, but the bell reads `auth.uid()` — the default recipient set could be keyed on an id nobody can see | The id mapping is a Phase 0 gate for Phase 3; Q9 reframed | §6.3, §7.1, §15 Q9, App. A |
| D3 | A `Superseded` original keeps its tracking row and stays in the Follow-up list beside its replacement | Original's tracking marked terminal / list excludes `Superseded`; Phase 3 deliverable | §6.2, §11 |
| D4 | Branch A could create a second approval request if the user already pressed Submit for approval | Reuse an open request | §5.3, §9 |
| D5 | `Approved → Converted` was presented as live; no code writes `Converted` | Marked reserved; nothing built | §4.1 |
| D6 | F30 (5-value `follow_up_status` CHECK) was pre-loaded as a live defect; the baseline it comes from is pre-remediation | Recalibrated: probably already fixed, unconfirmed until Appendix A | §0 C12, §1 F30, §14 |
| D7 | `follow_up_activity_log` already has `metadata JSONB`, `actor_name` and nullable `actor_id` | Four proposed columns reduced to one (`dedupe_key`) | §5.3, §10 |
| D8 | `next_action_label` NOT NULL is contradicted by working code (`recordQuotationReminder` omits it) | Free Phase 0 test; RPC populates it only if required | §1 F31, §5.3, §10 |
| D9 | Appendix A did not cover Phase 0's own list | Six queries added | App. A |

### v3.2 additions (from the second review of v3)

| # | Problem found in v3.1 | Fix | Section |
|---|---|---|---|
| E1 | A `Pending Approval` quotation is still editable: `update_quotation` raises only for `approved`/`converted`, so under branch A the salesperson could rewrite line rates while an approver decides (F33) | Edits blocked while `Pending Approval`; edge-case row and acceptance criterion added; needs live confirmation | §4.4, §5.4, §9, §11, §12 |
| E2 | The duplicate-approval guard in §5.3 step 8 could never fire: the revision row is created in the same step | Guard stays at quotation level (step 7); step 8 reworded | §5.3 |
| E3 | F10 was labelled "carried" and "write-only"; a read path exists in `subcontractorService.ts`, but no component calls it | Reframed as write-only at the UI; Phase 3 may reuse the existing RPCs after the shape decision | §1 F10, §7.3 |
| E4 | P0-2 is already answered by a hardening migration in the repo | Restated as stale per repo, live confirmation pending; the real hazard is a hand-run script, now on the Phase 0 repair list | §1 P0-2, §11, §14 |
| E5 | §9 still said "pick one source" for approver contacts, contradicting D2 | Replaced with the concrete `employees.id` → `auth.uid()` obligation | §9 |
| E6 | Phase 0 said "four" catalog queries; Appendix A has ten | Corrected | §1 P0-3, §11 |
| E7 | `metadata` is `NOT NULL DEFAULT '{}'`, so step 10's `notify_error` write could clobber step 9's `{from,to}` diff | Merge pattern specified: `metadata = metadata \|\| jsonb_build_object(…)`, never assignment | §5.3, §10, §12 |

Items E1 and E4 rest on repo reading only and still need confirmation against the deployed database, which is what Phase 0 is for.

### v3.3 additions (from the review of v3.2)

E1–E7 were implemented as described; F33 was confirmed as a real finding and E3's "no component calls it" was re-verified independently. Four further problems, none of which changes the architecture.

| # | Problem found in v3.2 | Fix | Section |
|---|---|---|---|
| G1 | §7 designs a **third** notification store while the repo already has two. `approval_notifications` is written from ≥13 sites and already has `getUnreadNotifications` / `markNotificationAsRead`, which no component calls — the same dead-read story as F10, and its name appears nowhere in this PRD | Recorded as a decision (§15 Q11) before Phase 3: canonical bell reads one store, the other is migrated or retired | §1 F34, §7.1, §7.3, §10, §15 |
| G2 | Q9 is not an open question: `getContact` already resolves approvers as `employees.id = <auth uid>` and returns `null` silently on mismatch, so approval contacts fail quietly **today**. The schema proves the column naming is untrustworthy in both directions | Q9 reframed from "prove a mapping exists" to "measure the mismatch rate live"; query added to App. A; `createNotification` added to the swallowed-error family | §6.3, §7.1, §15 Q9, App. A |
| G3 | F33's fix as written can silently no-op: the live token is `PENDING_APPROVAL` (F28), so `LOWER(status) = 'pending approval'` never matches, and the guard is dead if Q5 lands on "keep the token" or the rename slips — the F32 failure mode reapplied | The edit guard keys on an **open approval request**, not on a status literal; if the string check is kept it must list both spellings | §4.4, §5.4, §9, §12 AC17d |
| G4 | Phase 1b removes a capability users have today (editing a quote that is pending approval) but the rollout text only speaks of the trigger's audit window, so it lands as "I can't save my quotation" | Named error + release note; offender report extended to size the blast radius in Phase 0 | §11, §14 |

Items G1–G3 are repo-reading and internal-logic findings; G3 in particular is why the guard must not be keyed on a status literal, whichever way Q5 goes.

Unchanged from v2.1: the six fixes S1–S6 (S1 amended by C8/C10); the v2 review items R1–R14 except where a row above supersedes them.

### v3.4 additions (live-database reconciliation + three product decisions)

Two sources changed this round. First, the repo contains a **live-schema capture taken 2026-09-16 from project `rujqejtisqermjyqqgoj`** (`supabase/remediation/`, `PHASE-0-DRIFT-CLASSIFICATION.md`, which states it supersedes repo-derived claims for database facts) — so several claims this PRD filed as "true in repo, unconfirmed live" are now settled, in both directions. Second, the owner answered **Q1, Q2 and Q11** on 2026-10-19; all three map onto machinery that already exists, which removes most of the schema work §10 predicted.

| # | Finding (verified against the live capture, not the repo) | Consequence | Section |
|---|---|---|---|
| H1 | **`notifications` does not exist in the deployed database.** 415 tables live; the only notification stores are `approval_notifications` and `warranty_notifications`. None of `get_notifications` / `create_notification` / `mark_notification_read` / `escalate_urgent_communications()` appears among the 427 live functions | F10/F34's "three incompatible shapes" was a repo artefact. Q11 is now "create the canonical table" — which is what the owner chose. The subcontractor bell RPCs and the escalation writer are **not broken live, they are absent** | §1 F34, §7.2, §7.3, §10, §15 Q11 |
| H2 | `approval_notifications` has **four policies: 2× INSERT (org-scoped) + 2× SELECT (`user_id = auth.uid()`), and no UPDATE policy** | Its own `markNotificationAsRead` cannot write `read_at` today — silently, under RLS. Any canonical shape must ship an UPDATE policy for the recipient, or the bell can never be cleared | §7.3, §12 AC14 |
| H3 | The vocabulary migration is **not applied live**: `follow_up_status` CHECK = the original five values, `event_type` CHECK = six values with no `quotation_status_changed`, `tab_source` CHECK = `quotation/podc/invoice/activity` only | Every new stage and event type in §4.2/§5.3 is rejected by production as it stands. The vocabulary migration is a hard **predecessor** of the Phase 1 RPC, not a companion | §4.2, §10, §11 |
| H4 | `quotation_header` has **zero CHECK constraints live**, but it already carries `approval_status`, `approval_requested_at`, `approval_completed_at`, `revised_from_id`, `revision_no`, `revision_history`, `idempotency_key`, `sent_at`, `email_sent_at` | The document-state guard is a greenfield add (H4a) — and the versioning and approval-outcome columns §10 budgeted new migrations for **already exist** (H4b). Rejection can be recorded without touching `status` at all | §4.1, §6.2, §10 |
| H5 | `approval_workflows.approver_id` FKs to **`user_profiles(user_id)`** live, and the routed settings screen (`components/ApprovalSettings.tsx:1050`) writes a `user_id`. `approvals/settings-api.ts:380` writes `approval_approvers.id` into that column instead, inside a `try/catch` that only `console.error`s | Q9's id space is **settled: `user_profiles.user_id`**, no mapping table needed. The mismatched writer is real but unreachable — `pages/ApprovalSettings.tsx` (its only caller) is imported nowhere; routes resolve to `components/ApprovalSettings` (`App.tsx:684`, `SettingsV2Page.tsx:310`). It belongs on the cleanup list, not the critical path | §6.3, §15 Q9 |
| H6 | **Threshold approval already exists and is already wired** into all three quotation save paths (`CreateQuotation/index.tsx:2198`, `useQuotationMutations.ts:398`, `QuotationView.tsx:829`) via `checkApprovalNeeded` (`integration.ts:864-924`): `approval_settings.QUOTATION = 'true'` is the on/off, `approval_workflows.min_amount/max_amount` are the tiers, and **enabled-with-no-workflow-rows means approve-everything** (`:904`). `approval_settings` has `UNIQUE (organisation_id, setting_key)` live | Q1 needs no new schema and no new surface: the owner's "all, or threshold, in Settings → Approval → Quotation" is expressible in the existing key set. **Correction found while building:** the Quotation tab already renders the full control set — Enable Gate, single/multi tier modes, per-tier min and max — and `handleSave` deletes the org's existing tier rows before re-inserting them (`components/ApprovalSettings.tsx:974-978`, then `:1039-1073`), so no field had to be added there and stale tiers cannot accumulate. What was missing is only the safety defect: the whole check is browser-side and `catch`es to `{ needed: false }` (`:920-922`) — **it fails open**, so any error silently saves a quotation with no approval | §4.3, §11, §12 AC12 |
| H7 | Internal rejection writes **`status: 'Rejected'` into `quotation_header`** (`approvals/api.ts:869`), while every other document type's rejection writes only `approval_status` (`:876`, `:879`). `'Rejected'` is not in `QUOTATION_FOLLOW_UP_STATUSES`, and the follow-up query filters `.in('status', …)` (`follow-up/api.ts:121`) | This directly contradicts the owner's Q2 answer, and the failure mode is a **quotation vanishing from the Follow-up Center** when a manager rejects it. The return path does the same thing with `'Under Negotiation'` (`:832`). `markSourceDocumentAsRejected` also swallows its error (`:882-884`) unlike its sibling's documented fail-closed rule (`:859-863`) | §4.1, §5.4, §15 Q2, §12 AC13 |
| H8 | `follow-up/api.ts:656-666` writes `tab_source` values `'quotations'/'invoices'/'leads'` and `event_type: 'escalation'`, none of which the live CHECKs (H3) allow, and `.catch(() => {})` at `:671` discards the failure | Kanban priority changes never reach the activity log and nothing reports it. A third member of the swallowed-audit-write family (with F31, F34) | §8, §10 |

**Product decisions recorded 2026-10-19 (owner).**
- **Q1 → threshold-driven, configured per-organisation under Settings → Approval → Quotation**, with "approval on every quotation" as that same control set to no threshold. Implementation is H6: extend the existing `approval_settings` key set and the Quotation tab; do **not** introduce a parallel config table. Because the check is a security control, moving it server-side and failing **closed** is part of this feature, not a separate ticket.
- **Q2 → an internal rejection does not change the client-facing document.** The approval outcome goes in `approval_status` (exists live, H4); the quotation stays in the pipeline and in the Follow-up Center. Removes `status: 'Rejected'` from `markSourceDocumentAsRejected` and re-considers the `status: 'Under Negotiation'` write in `markSourceDocumentAsReturned` under Q3. **Read together with §4.1, not literally:** "does not change" means *not marked Rejected* — the document goes back to the state the client last saw, which is the `Pending Approval → Sent (internal reject / return)` edge in §4.1 and item 12 of §12. Leaving `status` untouched was implemented first and is wrong: the header would sit on `PENDING_APPROVAL` after the request closed, so the Approve button stays enabled and `change_quotation_stage` raises `QUOTATION_UNDER_APPROVAL` on every later attempt (see the §0 note for 2026-10-19).
- **Q11 → a proper new canonical `notifications` table**, created in production (H1: it does not exist), with a shape the bell can read and clear: recipient in `auth.uid()` space, `type/message/title/body/link/read_at`, and RLS that permits the recipient to SELECT and to UPDATE `read_at` (H2 is the cautionary tale). `approval_notifications` keeps its existing rows; new quotation events go to the canonical store. Migration or retirement of the old store is a Phase 3 decision, not a Phase 1 blocker.

**Ask A is waived by the owner**, so the capture is the working truth. It is a month old and records function **names only, no bodies**. Mitigation adopted: the first migration of each phase opens with pre-flight assertions (column present, constraint absent, table missing) that abort loudly rather than proceeding on a stale assumption, and the still- unanswered App. A queries (approver mismatch rate, `quotations` permission grants, live status distribution) are re-listed in §11 as "run at migration time, not before".

**Phase 1a landed, first two items (2026-10-19).**
- **Q2/H7 — rejection semantics.** `markSourceDocumentAsRejected` (`approvals/api.ts:878`) no longer writes `status: 'Rejected'` for quotations; the branch writes `status: 'Sent'` (the §4.1 `Pending Approval → Sent` edge) plus `approval_status: 'Rejected'` and `approval_completed_at`, and its `catch` rethrows instead of swallowing. `processApproval`'s `REJECTED` branch now mirrors `RETURNED`: if the source-document write fails, the approvals row is reverted and the call returns `TRANSITION_FAILED`. `purchase_orders` and `invoices` keep their existing `status: 'Rejected'` writes deliberately — out of scope. **Corrected the same day it landed:** the first version of this fix wrote `approval_status` only and left `status` on `PENDING_APPROVAL`. That is a dead-end state, not a neutral one — the Approve button stays enabled because it keys on the pending token, and `change_quotation_stage` refuses every later stage change with `QUOTATION_UNDER_APPROVAL`, so an internally rejected quotation can never be followed up again. Q2 means "not marked Rejected", not "status untouched" (see the Q2 bullet above). `markSourceDocumentAsReturned` still writes `status: 'Under Negotiation'` (Q3 open), which the new audit trigger will report as `target_outside_vocabulary`. Covered by two tests in `approvals/quotationApprovalFlow.test.ts`.
- **Q1/H6 — the gate moved server-side.** New migration `20261019000001_quotation_approval_requirement_rpc.sql` creates `public.quotation_approval_requirement(p_quotation_id uuid) → jsonb`, which reads amount and organisation from `quotation_header` (not from the caller), checks `user_can_access_org()` because it is `SECURITY DEFINER`, and **raises on every unknown** instead of answering "no approval needed". It is DEFINER rather than INVOKER for a live-schema reason: `approval_settings` and `approval_workflows` are readable by `user_organisations` members while `quotation_header` is readable by `org_members` members, so an INVOKER version would read zero settings rows for the latter and fail open — the exact bug being removed. `createQuotationApproval` calls it and its `totalAmount` parameter is gone, so all three call sites changed. Decision reasons returned are `GATE_DISABLED` / `ABOVE_THRESHOLD` / `BELOW_THRESHOLD` / `GATE_ENABLED_WITHOUT_WORKFLOWS` / `GATE_NOT_CONFIGURED`; the semantics of the old check are preserved except that errors now abort. Covered by four tests in `approvals/quotationApprovalGate.test.ts`.
- **Deployment order is load-bearing:** the migration must be applied **before** this client ships. With the RPC absent, `supabase.rpc` errors, the gate throws, and "Submit for approval" fails with `Could not find the function` — correct fail-closed behaviour, but it means the feature is unusable until the migration runs. Neither this migration nor any other in the phase has been applied; applying it is the owner's call.
- `checkApprovalNeeded` still serves the other 18 document types unchanged and still fails open. Migrating those is not part of this feature.

**Phase 1a landed, second block (2026-10-19, later the same day).**
- **F2/F3 — the stage moved server-side.** New migration `20261019000003_change_quotation_stage_rpc.sql` creates `public.change_quotation_stage(p_quotation_id, p_expected_stage, p_next_stage, p_reason, p_dedupe_key)` plus three SQL helpers (`quotation_stage_is_legal`, `quotation_document_status_for_stage`, `quotation_stage_label`) that are the transcription of `TRANSITION_GRAPH` / `TRANSITION_META.dbStatus` / `mapQuotationStatus`. It authorises the tenant via `user_can_access_org`, **requires a reason** (`STAGE_REASON_REQUIRED`, ≥3 chars), compare-and-sets the expected stage (`STAGE_CONFLICT`, with the last actor named in the HINT), refuses while an approval is in flight (`QUOTATION_UNDER_APPROVAL`, both `pending_approval` spellings), rejects illegal edges (`STAGE_NOT_ALLOWED`), projects `quotation_header.status`, and writes **one** idempotent audit row. Repeating a `dedupe_key` returns the original row with `replayed = true` instead of a second row.
  `upsertQuotationResponse` is deleted; `follow-up/api.ts` now exports `changeQuotationStage()`. **Behaviour change to record:** the old path wrote two rows (`quotation_status_changed` + `quotation_response_logged`); the RPC writes one, so the Activity tab loses the second entry per stage change. F31 is closed as a side effect — the tracking insert now sets `next_action_label`.
  `p_expected_stage` may be NULL for callers that never read a stage (the quotation document view); the graph, tenant check, approval guard and audit row still apply. This is deliberately not a bypass of the graph, only of optimistic concurrency.
- **The reason step is in the row menu.** `quotation-followup-row.tsx` "Update Status" is now two stages: pick the transition → enter a reason (textarea, per-transition quick-pick chips, ⌘/Ctrl+Enter to submit, Confirm disabled below 3 chars). `reason` is threaded through `QuotationTab` → `FollowUpCentre` → `useLogQuotationResponse`, which holds one `dedupeKey` per in-flight `(quotation, from, to)` triple. The optimistic row is aged with `detectEffectiveStatus` so the client and the RPC agree on the starting stage.
- **H8 fixed.** `updateFollowUpPriority` logged with the plural `tab_source` (`'quotations'`) and `event_type 'escalation'`, both rejected by the CHECK, and the rejection was swallowed by `.catch(() => {})`. It now logs `followup_priority_changed` with the canonical singular `tab_source` and reports the failure.
- **H3 confirmed live, and it bites today.** Re-reading the capture for the constraint text: `follow_up_quotation_tracking_follow_up_status_check` = `sent, under_review, in_negotiation, pending, lost_to_competitor`, so `approved`, `on_hold` and `cancelled` are **not storable** — choosing Approved / On Hold / Cancelled in the row menu fails at the tracking insert on production right now (`event_type` likewise has no `quotation_status_changed`, so the audit row would fail too). `20261019000002_followup_vocabulary_and_stage_dedupe.sql` is written as a converging superset (fixed constraint names, value list ⊇ both the capture and the September migration text) so it is correct whether or not `20260916121500_remediation_followup_vocabulary.sql` ever ran. **Containment now verified against the capture rather than assumed:** live `event_type` holds 6 values, `tab_source` 4, `follow_up_status` 5, each a strict subset of the new lists, so re-adding the constraints cannot fail row validation. It also means eight event types the app writes today (`invoice_edited`, `invoice_finalized`, `procurement_reminder_sent`, `po_created`, `po_expected_updated`, `po_supplier_call_logged`, `followup_reassigned`, `approval_status_changed`) are being rejected by production, and the call sites that were checked swallow it (`approvals/api.ts:511`, the Kanban priority handler) — the same defect class as H8, wider than the Kanban board. **Order matters: 2 before 3**, because 3 asserts `dedupe_key` exists.
- **F7 partially closed.** New `src/lib/followup/quotation-status.ts` is the single home for the `quotation_header.status` vocabulary: `QUOTATION_DOCUMENT_STATUSES`, `QUOTATION_FOLLOW_UP_STATUSES` (the exact current filter list, no behaviour change), `normalizeQuotationDocumentStatus()` (case/spacing/underscore tolerant, so `PENDING_APPROVAL`, `Pending Approval` and `' Approved'` all resolve), `isQuotationApprovalInFlight()` (now used by the Approve button gate, `QuotationView.tsx:2266`), and `stageFromDocumentStatus()` — `mapQuotationStatus`'s chain moved verbatim. Four tests in `quotation-status.test.ts`. The colour maps in `QuotationList.tsx` / `QuotationView.tsx` still carry their own key lists and still mix document and approval statuses (`'Approved (Sent)'`, `'Returned/Query'`); they are presentation, so they were left alone rather than widened.
- **Crash found and fixed while hardening the menu (F5-adjacent, new).** `TRANSITION_GRAPH.cancelled = ['sent']` (`quotation-workflow.ts:14`, committed) names a target that is not in `QuotationResponseOption` and has no `TRANSITION_META` entry, so `getAvailableTransitions('cancelled')` returned an option whose meta was `undefined` — opening **Update Status on a Cancelled quotation dereferenced `meta.icon` and threw during render**, taking the page with it. TypeScript already said so (`TS2322` at `:14`) and the repo carries ~786 baseline errors, so nobody saw it. Fixed by making the revival edge first-class: `'sent'` added to the response union, `TRANSITION_META.sent` = "Back to Sent — re-send to the client", and quick-pick reasons. The SQL graph already sanctioned `cancelled → sent` and the projection maps it to document status `Sent`, so client and server now agree. Fixing that one error then exposed a second in the same declaration: `TRANSITION_GRAPH` is typed `Record<QuotationFollowUpStatus, QuotationResponseOption[]>` but never had a `lost_to_competitor` key (`TS2741`), which the first error had masked — added as `lost_to_competitor: []` beside `approved: []`, behaviour-neutral because `getAvailableTransitions` already defaulted a missing key to `[]`. The exhaustiveness check is what found both. **This decides one "revival edges" item from §15 by accident of a crash — if the intent was *not* to let users revive a cancelled quotation, delete `cancelled: ['sent']` from the graph and the `sent` meta; the union entry is harmless.**
- **The audit-only document trigger is in (`20261019000004`, §4.4 / §11 first half).** A `BEFORE UPDATE` trigger on `quotation_header` fires only when `OLD.status IS DISTINCT FROM NEW.status`, normalises both sides (`PENDING_APPROVAL` and `Pending Approval` collapse to one key, so the undecided Q5 rename cannot make the window blind — G3's failure mode avoided), checks the §4.1 edge list — including the system-only `→ Expired` / `→ Superseded` edges — and writes one `quotation_status_transition_audited` row with raw from/to, normalised keys, `legal`, a reason (`target_null`, `origin_null`, `*_outside_vocabulary`, `edge_not_allowed`) and `actor_kind` (`rpc` = the sanctioned RPC's own projection, `system` = no session behind the write, which is §4.4's definition and needs no extra GUC, `interactive` = a signed-in user). **It never raises**: the whole body is inside a savepoint `EXCEPTION WHEN OTHERS` that emits a NOTICE, because a failed audit insert must not abort a quotation save. `change_quotation_stage` now sets `app.allow_quotation_status_mutation = 'true'` (transaction-local) before its header write so its own projections are attributed to the RPC instead of counted as rogue browser writes. The rows deliberately share `follow_up_activity_log` (RLS and org scoping come free), and both user-facing readers exclude the event type — `fetchFollowUpActivity` in `src/follow-up/api.ts` and `src/hooks/use-item-history.ts` — so instrumentation never appears in the history a salesperson reads. Two `security_invoker` views read the window: `quotation_status_transition_audit` (detail) and `quotation_status_transition_reject_report` (grouped by transition × reason × actor kind, which is the Phase 1b go/no-go query). **Two findings this surfaces by construction:** (1) the RPC still projects `in_negotiation → 'Under Negotiation'`, a value §4.1 retires, so the window's largest `target_outside_vocabulary` bucket will be `actor_kind='rpc'` — **Phase 1b must change `quotation_document_status_for_stage` in the same migration as the CHECK or the sanctioned RPC becomes the first illegal writer**; (2) `Draft → Pending Approval` is deliberately *absent* from the edge list because §4.1 leaves integration.ts's origin state unconfirmed — if the window shows it, that is the confirmation. It also needs a new `event_type` value, so **002 was edited again: the order is 2 → 3 → 4, and 002 and 003 must both be re-applied** (both are idempotent: 002 re-adds constraints, 003 is `CREATE OR REPLACE`). **That edit had not actually happened** — when the owner ran the chain on 2026-10-31, 004's pre-flight aborted with `missing: event_type value quotation_status_transition_audited`, and the reason was that the value appeared once in 002, in the *header comment that described the intended edit*, and not in the constraint array. Without the fix the observation trigger's own inserts would have been rejected by the CHECK and swallowed by its `EXCEPTION WHEN OTHERS` handler, so the window would have looked permanently clean. Now added (002's `event_type` list is 18 values). Two lessons, both kept deliberately: a migration's stated intent is not its content — assert against the artifact; and the pre-flight chain caught at apply time a defect that no amount of reading the file's own prose would have. No pre-existing trigger on `quotation_header` audits status (only `trg_prevent_posted_quotation_mutation` and the RBAC insert/update guards), so these rows are not duplicates.
- **Type-level exhaustiveness produced three finds in one pass.** (1) `TRANSITION_GRAPH` is declared `Record<QuotationFollowUpStatus, QuotationResponseOption[]>` but never had a `lost_to_competitor` key (`TS2741`, masked by the `TS2322` above) — added as `lost_to_competitor: []`, behaviour-neutral because `getAvailableTransitions` already defaulted a missing key to `[]`. (2) `getActivityEventLabel` covered 8 of the event types in `ActivityEventType` (`TS2740`), so the drawer showed raw tokens (`po_created`, `followup_reassigned`) for the other eight — precisely the ones §0 shows production was rejecting until `20261019000002`. All nine labels added. (3) That then exposed the last mismatch of this class: `approvals/api.ts` writes `event_type 'approval_status_changed'`, the SQL CHECK has accepted it since 002, and **only the TypeScript union omitted it** — added (`types/followup.ts:81`). One error class, three surfaces, and the fix that makes it recur less often is the total `Record<>` declaration rather than a runtime default.
- **The edit lock under approval is written (`20261019000005`, F33 / G3 / G4) and not applied.** `public.quotation_open_approval(uuid, uuid)` is now the single definition of "an approval request is open on this quotation", and `update_quotation` calls it after taking the header row lock and before any write, raising `QUOTATION_UNDER_APPROVAL` with the request level and, where the workflow names one, the current approver — resolved `approver_id → user_profiles.full_name`, i.e. through the FK H5 proved, and **not** through `employees.id`, the mapping `getContact` still gets wrong. **The predicate reads `public.approvals`, not `quotation_header.status`, for a second reason beyond G3's token-spelling point:** the submit flow writes that column from the browser *after* creating the request row and discards its own write failures (`approvals/api.ts:670,841,923` never check the result), so a header whose status never moved passes a status-string guard while its request is wide open. `SECURITY DEFINER` with the tenant checked first, for the same live-schema reason as `20261019000001` — as INVOKER, a policy on `approvals` would read zero rows and answer "nothing open", which is the fail-open bug this phase removes. Client side: the message is classified by the new pure `quotationApprovalLockMessage()` (`quotation-status.ts`, 3 tests) so the code prefix never reaches a user, `useQuotationMutations` toasts it as "Locked while under approval", and a new `ApprovalLockBanner` in the editor asks the RPC on open, so the lock is visible before the first failed Save rather than discovered by pressing it. Nothing in the client ever deletes an `approvals` row (the only `.delete()` calls in the module are on `approval_approvers` and `approval_workflows` settings rows), so the request cannot be escaped by deleting it — the exits are the engine's own status transitions. **Three findings this produced, none of them in the PRD before:** (1) only `status = 'PENDING'` counts as open, and that is a decision, not an oversight — both live decision paths refuse to act on anything but PENDING (`api.ts:307`, `workflow-engine.ts:42`) and the one function that would accept `HOLD`, `executeApprovalGateDecision` (`approvalGateEngine.ts:415`), has no call site, so a `HOLD` or `FORWARDED` request can only be resubmitted; blocking those states freezes the document with no way for any approver to close the request, which is the unreachable-state bug just fixed on the reject path. The gap this leaves is real: while a request sits in `HOLD`/`FORWARDED` the quotation is editable again and `approvals.amount` keeps the figure captured at submission, so an approval can still be decided against stale numbers. Raised as **Q12**. (2) `CREATE OR REPLACE FUNCTION` does not replace a function whose argument list differs, it adds an overload — and the 2026-09-16 capture lists `update_quotation` with **16** parameters while `20261006000001` defines **25** and both call sites send 25 (`src/api.ts:677-703`, `useQuotationMutations.ts:222-248`). Had this migration assumed one shape, a deploy on the other shape would leave two overloads, PostgREST would pick by argument list, and the guarded one might never run: G3's no-op again through a different door. The pre-flight therefore aborts unless exactly one overload with the expected 25-type signature exists, and a post-check re-reads `pg_proc.prosrc` to prove the installed body actually calls the lock. Nothing is dropped. (3) `update_quotation` has **four** call sites, not the two §5.4 implies — `src/api.ts:677` (25 params), `useQuotationMutations.ts:222` and `:301` (25 each), and `CreateQuotation/index.tsx:2063`, an older full-page save path that sends **18** (no `p_status`, `p_negotiation_mode`, `p_extra_discount_*`, `p_round_off*`, `p_include_erection_charges`) and carries its **own copy** of the save-error classifier (`:2244`, duplicating `useQuotationMutations.ts:441`). The editor has two parallel save implementations, so any client-side version of this lock would have had to be written twice and would still miss whatever the next copy is; the server-side guard cannot be missed, which is G3's argument settled by construction rather than by preference. Both classifiers now route `QUOTATION_UNDER_APPROVAL` through `quotationApprovalLockMessage()`. (4) the capture shows `anon_exec = true` on `update_quotation` (Supabase default privileges; 218 of 427 live DEFINER functions carry `search_path=public`), so the migration also revokes `anon` EXECUTE and pins `search_path = public, pg_temp` — defence in depth, since the body already raises when `auth.uid()` IS NULL. Body transcribed verbatim from `20261006000001` and diff-verified (nothing removed, only the guard added); `record_quotation` is insert-only plus idempotent replay, so it needs no lock.
- **The status CHECK is written (`20261019000006`) and not applied** — the first constraint `quotation_header.status` has ever had (F3/P0-4: live holds zero CHECKs on the table, so any string at all is a valid quotation status). It is a **converging superset**, the same containment pattern as `20261019000002`: accepted = 004's canonical keys (read from the deployed function and asserted, never copied into this file) + the keys reachable application code still writes + every key observed in the deployed data, reported and admitted rather than rewritten. Widening cannot invalidate an existing row, so the ALTER either succeeds or aborts — it never reclassifies a document and never loses one. Normalisation is delegated to `public.quotation_document_status_key`, which makes the constraint and the observation trigger *the same predicate* (they cannot drift, and both spellings of the pending token pass while Q5 is undecided) at the price of the table now depending on that function — a `pg_dump` restore writes tables before functions and fails until the helpers exist. That trade was taken deliberately: re-typing the normaliser into the CHECK would let the constraint and the trigger disagree while both still looked authoritative. Pre-flight aborts on a missing helper, a non-IMMUTABLE normaliser, or any movement in 004's canonical set; the post-check reads `pg_get_constraintdef` and proves validated-CHECK + NULL arm + the 11 expected keys; and a third block lifts the **stored** definition into a throwaway table and inserts 13 samples, so what is tested is the predicate Postgres will actually apply (including any offender §1 admitted), not this file's opinion — a reject-case the constraint accepts is tolerated only when the value is already stored. **Two new findings, both from enumerating the writers instead of the vocabulary:** (1) **`Partially Converted` is written into `quotation_header` by invoices** (`useSaveInvoice.ts:285`, every partial convert-to-invoice). §4.1 never enumerates it, so 004 has no edge with it on either side — once enforcement is on, every partial conversion is rejected; nothing can *leave* it, because the graph's ELSE arm returns no edges for a non-canonical origin (the same dead-end class the Q2 reject path was caught in); and it is absent from `QUOTATION_FOLLOW_UP_STATUSES`, so a quote leaves the Follow-up Center the moment it happens. Admitted here so billing keeps working. Raised as **Q13**. (2) **`Returned`** (`approvalGateEngine.ts:606`) is deliberately **not** admitted: its only route is `executeApprovalGateDecision` (:415), which has no call site — dead code does not get to shape the vocabulary, and the test block proves the constraint rejects it. If the gate engine is ever wired up, its Return action fails at the database; retire the writer or decide it with Q13. `Superseded` is admitted ahead of **Q4** so versioning needs no schema change, though nothing writes it yet. **This corrects the first finding in the 004 bullet:** the CHECK does *not* make the sanctioned RPC an illegal writer, because `Under Negotiation` is admitted. What survives is narrower and now load-bearing — 004's own canonical/edge graph still rejects it, so **the enforcement flip is no longer decision-free**: it must either change `quotation_document_status_for_stage` in the same migration or admit the retired keys into the graph, which is Q3. The flip therefore stays unwritten, and additionally cannot be assessed until the owner applies 002–005 so the reject report has any rows in it. Deployment order is now **002 → 003 → 004 → 005 → 006**; 006 ships no client code, and a rejected status surfaces as an ordinary "Save failed" (Postgres 23514) because the CHECK carries no message of its own — the client vocabulary in `quotation-status.ts` is the mirror to keep in step. New reader for the tightening round: `quotation_header_status_inventory` (status, normalised key, canonical flag, row count, first created, last written; `security_invoker`, `anon` revoked) — rows and recency, not distinct values, decide what is safe to delete from the list.
- **Still unguarded.** `QuotationView.tsx:694` Cancel — routed only once the **`approved` → `cancelled` edge is decided** (the graph makes `approved` terminal, so routing it as-is would block a cancellation users can perform today; that is a product decision, not a refactor). `QuotationList.tsx:856` `handleBulkStatusUpdate` is **dead code** — it has no call site (the bulk bar only prints and deletes), so it can be deleted rather than routed. `QuotationList.tsx:1037` Mark as Sent writes a document-only Draft→Sent edge with no stage, so it belongs to the document-status trigger, not this RPC. The approvals write-back (`approvals/api.ts:659,830`) is untouched apart from the reject fix.
- **Side finding, out of scope but live:** the invoices branch of `triggerPostApprovalActions` (`approvals/api.ts:667`) writes `status: ' APPROVED'` — with a leading space — so an approved invoice never matches any status comparison downstream. The quotations branch beside it (`:670`) writes `status: 'Approved'` with no `organisation_id` filter. Same class as F33.

---

## 1. Problem

A salesperson creates a sales quotation, it lands in the Follow-up Center, they talk to the client, and they log that call. Today that log **cannot do anything**: it is a note in a table. To move the quotation forward the user must leave the drawer and use a separate "Update Status" control; to ask for a price change they must use a third control ("Revise") that invents its own communication record. The cycle the team actually runs — *quote → call → client feedback → the quote changes or dies* — has no single place where it happens.

Two of the three legs exist and are disconnected. The third (the revision leg) is worse than disconnected: its approval step currently does not write anything (F20).

### Current-state findings

Evidence cited as file:line. *probed* = read in the repo on 2026-10-16; *carried* = from v1, not re-checked; *corrected* = v1/v2 text was wrong and is replaced.

| # | Finding | Evidence | State |
|---|---|---|---|
| F1 | The log-communication drawer inserts `client_communication` **only**. It never changes quotation status and never flags a revision. | `src/components/follow-up/item-history-drawer.tsx:282-285` | carried |
| F2 | Status change is a separate path: row "Update Status" → `useLogQuotationResponse` → `upsertQuotationResponse`, which upserts `follow_up_quotation_tracking`, updates `quotation_header.status`, and writes two activity rows. | `src/follow-up/api.ts:352-419` | carried |
| F3 | The transition guard is **client-side only**. | `src/follow-up/api.ts:359` | carried |
| F4 | `quotation_header.status` is free text — `VARCHAR(50) DEFAULT 'Draft'`, no CHECK in the repo. (Deployed constraint unverified.) | `src/database-quotation.sql:27` | carried |
| F5 | Four writers bypass the state machine. | `QuotationView.tsx:694`, `QuotationList.tsx:856`, `QuotationList.tsx:1037`, `approvals/api.ts:659,830` | carried |
| F6 | The stage→status projection is **lossy**: `under_review`, `pending`, `on_hold` all map to `Sent`; `lost_to_competitor` → `Rejected`; `in_negotiation` → `'Under Negotiation'`, a sixth header value that F6 originally missed. | `src/lib/followup/quotation-workflow.ts:22,38,54,62` | corrected |
| F7 | Four competing status vocabularies with mixed casing. | `src/types/followup.ts:26-44`, `QuotationView.tsx:40-51,67-76`, `QuotationList.tsx:36-37` | carried |
| F8 | A revision workflow exists: `initiateQuotationRevision` inserts `quotation_revisions` (`pending_approval`) plus its own `client_communication` row (real `communication_id` FK), and creates an approval request with `reference_type: 'quotation_revisions'`. | `src/lib/quotation-workflow.ts:25-113` (approval at `:87-93`) | probed |
| F9 | `original_owner_id` is written and **never read**. `current_owner_id` has three live readers (renders the owner, gates the reassign button on MD/manager/owner, feeds `reassignRevisionTask`). | `ClientCommunication.tsx:3277,3280,3352` | corrected |
| F10 | `notifications` has a read path in code but **nothing renders it**: `subcontractorService.ts:423,434,449` call `get_notifications`, `create_notification` and `mark_notification_read`, and no component calls those service functions — write-only at the UI, not at the code. Those RPCs read the 0918 shape (`type/message/is_read`), while `ClientLookup.tsx:414` and `escalate_urgent_communications()` write the 0916 shape (`title/body/link`). Three migrations declare incompatible shapes; the later two are silent `IF NOT EXISTS` no-ops. Whether `escalate_urgent_communications()` (writes `body`/`link`) or the subcontractor bell RPCs (read `type`/`message`/`is_read`) are broken in production depends on the live shape. **`notifications` is not the only store — see F34.** | `20260916123000_remediation_missing_404_tables.sql:33`, `20260918000300_subcontractor_notifications.sql:4`, `database-communication-sla.sql:4`, `subcontractorService.ts:423,434,449`, `ClientLookup.tsx:414` | corrected |
| F11 | `follow_up_log_activity` is a good `SECURITY DEFINER` audit primitive, **but `quotation_status_changed` is in the `event_type` CHECK only in the migration, not in the captured live schema** (F30). The app writes that row *after* the tracking upsert and header update have committed, so if the migration is unapplied, every status change keeps the change and silently drops the audit row. | `database-follow-up-centre.sql:229-271`, `follow-up/api.ts:377-396`, `baseline_constraints.json:2787-2790` | corrected |
| F12 | The drawer has no outcome field, no line-item reference, and no assignee/attachment. | `item-history-drawer.tsx:32-38,366-429` | carried |
| F13 | No client-response disposition values exist. Org-scoped `win_loss_reasons` exists (category ∈ win/loss/disqualify), reusable as-is for quotations; `follow_up_quotation_tracking` already has `win_loss_reason_id` (FK) and `win_loss_notes`; **nothing writes them today**. | `src/components/leads/win-loss-modal.tsx:56` | corrected |
| F14 | `quotation_items` has **no `line_no` and no `item_code`**. Ordering is `display_order`; `item_code` lives on `materials` behind the `item_id` FK. Other fields: `qty, rate, base_rate_snapshot, final_rate_snapshot, discount_percent, discount_amount, tax_percent, variant_id, is_override`. No serial column. | `database-quotation.sql:45-62`, `fix-quotation-items.sql:5-14` | corrected |
| F15 | Drawer resolves `client_id` by **string-matching the client name**. | `item-history-drawer.tsx:233-240` | carried |
| F16 | `follow_up_activity_log.reference_id` is an unconstrained UUID. | `database-follow-up-centre.sql:16-36` | carried |
| F17 | History tab synthesises lifecycle milestones because creation/status changes "are never logged anywhere". | `QuotationView.tsx:440-547`, `use-item-history.ts:158-167` | carried |
| F18 | **v1/v2 were wrong.** Approvals does *not* write back to `quotation_revisions`. `triggerPostApprovalActions` handles only `purchase_orders, work_orders, invoices, quotations, payment_requests, purchase_payments, subcontractor_payments, expense_entries`; a revision approval falls through and updates nothing. The only code that sets `quotation_revisions.status='approved'` is `synchronizeSourceDocumentApproved`, reached only via `executeApprovalGateDecision`, which has no callers in `src`. | `approvals/api.ts:641-678`, `approvalGateEngine.ts:571-578` | corrected |
| F19 | Realtime exists only for `manager_alerts` and `approvals`. | `ManagerAlerts.tsx:58-82`, `Approvals.tsx:269-290` | carried |
| F20 | The revision loop's first transition never fires (F18). The actor+action+reason+timestamp pattern in approvals is real, but it is not wired to revisions. | as F18 | probed |
| F21 | The live `quotation_revisions.status` CHECK is exactly `('pending_approval','approved','in_progress','completed','rejected')`. `in_progress`, `completed`, `rejected` have no writer anywhere in the repo. | repo DDL (deployed constraint unverified) | probed |
| F22 | `quotation_header.revised_from_id` is a real self-FK, `ON DELETE SET NULL`, present in the captured live schema, and written at quotation creation. | `baseline_constraints.json:7677` | probed |
| F23 | Permission keys are dot-separated (`quotations.approve`). The frontend catalog has `approve`; the DB catalog seeds no `approve` action; the V1 grant whitelist is `('read','create','edit','delete','print','export')`; legacy `.approve` grants are grandfathered and the role editor cannot add one. Separately, `20260928000006_rbac_v1_action_key_alignment.sql:10-16` renamed `edit`→`update` and deleted every `action_key='edit'` row, while `_role_has_perm` matches exactly with no alias — so the `require_permission(org,'quotations','edit')` guard v2 told the RPC to reuse is **possibly dead**. | `permission-catalog.ts:22-32`, `20260928000003:83-122`, `20260928000004:40-48` | probed |
| F24 | `initiateQuotationRevision` sets both `original_owner_id` and `current_owner_id` to `salespersonId`, which defaults to whoever clicked; three of four call sites pass nothing. | `quotation-workflow.ts:41-45,78` | probed |
| F25 | An internal rejection on `reference_type='quotations'` writes `status:'Rejected'` and `approval_status:'Rejected'`, and **swallows failures** (`console.error`, no rethrow) unlike approve/return which are fail-closed. A RETURNED decision writes `status:'Under Negotiation'`, which is in none of the four vocabularies, not in §4.1, and not in `QUOTATION_FOLLOW_UP_STATUSES`. | `approvals/api.ts:867-885`, `:830-833` | probed |
| F26 | `fn_prevent_posted_quotation_mutation` guards only `quotation_header` DELETE and five financial columns on UPDATE. `status` is not protected, and it never sees `client_communication` or `follow_up_quotation_tracking`. Nothing today stops a status rewrite on an Approved quotation. | `20260817000005:262-291` | probed |
| F27 | `update_quotation` raises if `LOWER(status) IN ('approved','converted')`. The Follow-up Center's status path writes header `'Approved'` directly. So any quote marked approved from the drawer is permanently uneditable. Every save also runs `DELETE FROM quotation_items WHERE quotation_id=…` then re-INSERTs; the incoming `id` is never read; this holds in all four `CREATE OR REPLACE` sites; the edit flow calls the RPC **twice** per save. | `20260928000000_quotation_atomic_save.sql:72-74,81-129`, `20260818000003:239`, `20260923000000:61`, `20261006000001:77-97`, `useQuotationMutations.ts:222,300`, `quotation-workflow.ts:46`, `follow-up/api.ts:391` | probed |
| F28 | `PENDING_APPROVAL` is written at exactly two places, both submit-for-approval: `approvals/integration.ts:256-263` and an optimistic cache-only write at `QuotationView.tsx:823-826`. It is conditional: `checkApprovalNeeded('QUOTATION', totalAmount)` returns early without touching status when the org's threshold says no approval is needed (`integration.ts:237-240`). The follow-up path writes `'Approved'` directly from `'Sent'`. `PENDING_APPROVAL` is not in `TRANSITION_GRAPH`, `TRANSITION_META`, or the `followup.ts:26-44` unions. | as cited | probed |
| F29 | The real `TRANSITION_GRAPH` (`quotation-workflow.ts:7-16`): `sent` has **no** edge to `expired`; `approved: []` is fully terminal; `expired` revives to `under_review / in_negotiation / pending / cancelled`; `cancelled → sent` revives. `isTerminalStatus` (`:90-93`) omits `expired` while `CLOSED_STATUSES` (`:153-158`) includes it. | as cited | probed |
| F30 | **Live `follow_up_status` CHECK allows only** `sent, under_review, in_negotiation, pending, lost_to_competitor` — it rejects `approved`, `on_hold`, `cancelled`, `expired`. **This is the pre-remediation baseline capture**, so it shows what was true at capture, not necessarily now. `20260916121500_remediation_followup_vocabulary.sql` presumably fixes this and the `event_type` list, and the likeliest answer is that it was applied and this finding is stale. Appendix A settles it either way; it is not to be treated as a live defect until then. | `baseline_constraints.json:2943` | probed |
| F31 | The repo cannot produce the deployed shape: the migrations that added `win_loss_reason_id`/`win_loss_notes` (`20240101000068`, `20240101000093`) are 0-byte files; the DDL for `quotation_revisions` and `follow_up_quotation_tracking` is not under `supabase/migrations` at all; `next_action_label` is reported NOT NULL live and is absent from the repo script — **but `recordQuotationReminder` upserts the table without setting it (`follow-up/api.ts:434`)**, so either the column is nullable/defaulted or reminder upserts already fail in production. That is a free Phase 0 test that needs no schema dump. | as cited | probed |
| F32 | Readers of the literal `'PENDING_APPROVAL'`: `canApprove = quotation?.status === 'PENDING_APPROVAL'` (renders the Approve button), the list's `LIST_TAB_STATUS.Pending`, badge colours, and — critically — membership in `QUOTATION_FOLLOW_UP_STATUSES`, which feeds `.in('status', …)` for the Follow-up Center. A backfill without updating these makes quotations vanish from the Follow-up Center and hides the Approve button. Separately, `QuotationList.tsx:33,36` do not contain the token today, so its filter chips cannot select it and `getStatusColor` silently renders Draft colours. | `QuotationView.tsx:2260,2461,74,46,96`, `follow-up/api.ts:42,121`, `QuotationList.tsx:33,36,56-57` | probed |
| F33 | `update_quotation` raises only when `LOWER(status) IN ('approved','converted')`. `Pending Approval` is not blocked, so under §4.3 branch A a salesperson can rewrite line rates while an approver is deciding, and the approver approves a paper that no longer matches the screen. Neither §4.1 nor §9 classified `Pending Approval` as non-editable. | `20260928000000_quotation_atomic_save.sql:72` | probed (live confirmation pending) |
| F34 | **A second, parallel notification store exists and this PRD ignored it.** `approval_notifications` is written from `approvals/api.ts:626`, `approvals/notifications.ts:87,348,362,377`, `approvals/workflow-engine.ts:208,282,381,405,424` and `approvals/siteReportApproval.ts:102`. It already models the bell's two operations — `getUnreadNotifications` (`approvals/notifications.ts:323`, `select … .eq('user_id', userId).is('read_at', null)`) and `markNotificationAsRead` (`:345`) — and **no component calls either**; the only external use of the service is `sendReturnNotification` (`api.ts:463`). So it is write-mostly for the same reason F10 is, not a working alternative to it. `createNotification` (`:73-98`) is a further swallowed-error writer (`console.error`, no rethrow), the same family as F25. | as cited | probed |

### Blocking prerequisites (owned separately, **started now in parallel**)

- **P0-1 — CONFIRMED and urgent.** `new Resend(import.meta.env.VITE_RESEND_API_KEY || 're_…')` at module scope in `src/utils/emailService.ts:1-3`, imported by `Auth.tsx:9` and reachable through the lazy chunk at `App.tsx:76-80`. Because the fallback is a literal, Vite inlines it whether or not the env var is set; nothing under `api/` uses Resend. **The key is public.** Rotating it is a Resend-dashboard action that needs the account owner, and it must not wait for this feature. Approval email/SMS paths remain `console.log` stubs (`approvals/notifications.ts:123,141,249,314`), so outbound email cannot be promised until sending moves server-side.
- **P0-2 — `quotation_header` RLS was reported as permissive `USING(true)`** (`database-quotation.sql:36-38`). **Stale per the repo:** `20260817000005_quotation_proforma_subcontractor_hardening.sql:392-401` drops `Enable all access` and `quotation_header_all_access` and creates `quotation_header_org_policy` with `USING`/`WITH CHECK (user_can_access_org(organisation_id))`. Confirm the live `pg_policies` (Appendix A); this is repo reading only. The hazard that remains is `database-quotation.sql:36-38`, a hand-run script that would re-create the permissive policy if anyone runs it; it goes on the Phase 0 repo-repair list (F31).
- **P0-3 — Deployed schema is the source of truth, not the repo** (F31). Dump the deployed definitions of `quotation_header`, `quotation_items`, `quotation_revisions`, `client_communication`, `follow_up_quotation_tracking`, `follow_up_activity_log`, `quotation_activity_log`, `notifications` and `approval_notifications` (F34), plus row counts and the fourteen catalog queries in Appendix A.
- **P0-4 — Is the vocabulary migration applied?** (F30) A read-only check, not a known defect: **if** `20260916121500_remediation_followup_vocabulary.sql` has not been applied, four of the nine UI stage options are rejected by the database and every status change silently drops its audit row, independent of this feature. The baseline that suggests this predates the remediation, so the likelier outcome is that it was applied and F30 is stale. It is still run first because the answer decides whether anything in Phase 1 is on a working foundation.

---

## 2. Goals

1. **One path.** A single drawer interaction records the call, moves the sales stage, and (optionally) raises a revision — in one atomic write.
2. **Server-enforced lifecycle.** Illegal transitions are rejected by the database, not by a React component.
3. **The right person finds out.** A revision request notifies whoever must *act* on it, never the actor, and never nobody (§7.1).
4. **The loop closes.** A revision request has a defined outcome end to end: approved → new version drafted → re-issued, or rejected, with the requester told (§6). This requires building the approval write-back, which does not exist (F20).
5. **Honest history.** The History tab shows who changed what, when, from what to what.
6. **Vocabulary convergence.** One source of truth per field; the four lists in F7 are generated.

## 3. Non-goals

- Client-facing quotation portal, or any client-authenticated surface.
- Outbound WhatsApp/email **sending** from the drawer. The `wa.me` builder stays user-clicked (`whatsapp-builder.ts:77-93`).
- Replacing the approvals engine or changing its UI. This feature adds a narrow write-back (§5.4); the approvals flow itself is untouched.
- Multi-currency, discount-approval thresholds, pricing rules.
- Notification **preferences/muting**.
- Rewriting `ApprovalNotificationService` itself. Q11 may retire or migrate the `approval_notifications` **table** (F34), which is a data-level change; the service is left in place until nothing reads the old store, and this PRD does not reuse its create path (§7.1).
- A generic org-wide audit framework. `audit_log` is untouched; this feature writes to `follow_up_activity_log` and `quotation_activity_log` only.
- Adding a new permission action (`quotations.approve`) to the DB catalog. Approver routing uses the existing approval configuration (§6.3).

---

## 4. The model (decision: two fields, distinct meaning)

`quotation_header.status` and `follow_up_quotation_tracking.follow_up_status` are **different facts** and must stop being derived from each other by a lossy map.

### 4.1 Document state — `quotation_header.status`

What the paper is. Legal/financial meaning.

Values: `Draft · Sent · Pending Approval · Approved · Converted · Rejected · Cancelled · Expired · Superseded`

- **`Superseded` is new** (§6, versioning). It is the only added document value.
- **`Pending Approval`:** recommendation is to normalise the legacy `PENDING_APPROVAL` token now (decision, §15 Q5). The CHECK migration plus a backfill is the cheapest moment; keeping it means a permanent display-map exception. **The rename is not a one-time grep (F32):** the Approve button, the Follow-up Center's `status IN (…)` list, the list tabs and the badge colours all read the literal. It therefore ships as one change — backfill plus every reader — or not at all; a backfill alone makes quotations unapprovable and invisible in the Follow-up Center.
- **`Under Negotiation` is retired.** It is written today by the `in_negotiation` projection and by an approvals "returned" decision (F6, F25) and is in none of the canonical sets. It joins the offender report (§4.4) and is backfilled to `Sent`: the stage field carries negotiation state, the document does not.
- **`Partially Converted` is in no set at all and is written by invoices** (`useSaveInvoice.ts:285`), found while enumerating writers for the CHECK migration. It has no edge in the graph below — so a document in it has no legal next status — and it is excluded from the Follow-up Center's status list, so the row vanishes when it happens. It is neither a new value being adopted nor a retired one being backfilled: it is an undecided one (§15 Q13). `20261019000006` admits it, along with `Under Negotiation`, so enforcement of the vocabulary cannot break billing or the sanctioned RPC on the day it lands.

**Meaning of `Rejected`.** In this model `Rejected` means *the client declined* (lost). Today it is also what an **internal** approval rejection writes (F25), which makes it ambiguous in production data. Decision required (§15 Q2); recommendation: internal rejection returns the document to `Sent` with `approval_status = 'Rejected'` and the reason logged; `Rejected` is reserved for client-lost.

**Document edges** (there is no server graph for the document today; the writers in F5 and F28 are the de facto graph). The proposed legal edges, to be reconciled against every observed writer during Phase 0:

```
Draft → Sent
Draft → Cancelled
Sent  → Pending Approval      (submit-for-approval; origin state of integration.ts:256-263 to be confirmed — may also leave Draft)
Sent  → Approved              (only when no internal approval is required, F28)
Sent  → Rejected              (client lost)
Sent  → Cancelled
Sent  → Expired               (system actor only, §4.4)
Sent  → Superseded            (new version re-issued, §6)
Pending Approval → Approved
Pending Approval → Sent       (internal reject / return)
Pending Approval → Cancelled
Pending Approval → Expired    (system actor)
Approved → Converted          (reserved: no code writes `Converted` today — it exists only as a colour/filter key and in the `update_quotation` immutability guard, `20260928000000:72-74`; keep the value and the edge, build nothing for it here)
Terminal: Converted · Rejected · Superseded.  Approved is terminal except → Converted.
```

Open (§15 Q8): whether `Expired → Sent` and `Cancelled → Sent` revival, which the *stage* graph allows (F29), should also exist for the document.

### 4.2 Sales stage — `follow_up_status`

Where the deal is. Owned by the salesperson, changed by the log.

Values: the existing nine from `src/types/followup.ts:26-35` (`sent, under_review, in_negotiation, pending, on_hold, approved, lost_to_competitor, cancelled, expired`). No new values. `under_review` is the "under discussion" state; it exists as a stage and was simply never visible on the document, which is correct.

**Edges are the real `TRANSITION_GRAPH` (`quotation-workflow.ts:7-16`), transcribed verbatim during implementation.** v2's diagram is withdrawn because it contradicted that graph. Facts that matter for this PRD:

- `approved` is **terminal** (`approved: []`).
- `sent` has **no** edge to `expired`; yet date-driven expiry sets `Expired` on `Sent` quotes (F29, `database-lifecycle-statuses.sql:16,29`). The system-actor edge `* → expired` in §4.4 is therefore an **addition to** the real graph, not a transcription, and is flagged as such.
- `expired` revives to `under_review / in_negotiation / pending / cancelled`; `cancelled → sent` revives. Whether to keep these is §15 Q8.
- `isTerminalStatus` omits `expired` while `CLOSED_STATUSES` includes it: one definition, from the graph.

**Display label.** Stage `approved` is shown as **"Client accepted"**. It means the *client* said yes. It does not mean the document is internally approved.

### 4.3 Projection rules (the only legal stage→document writes)

| Stage change | Document effect |
|---|---|
| `→ approved` (client accepted) | **Two branches (decision, §15 Q1).** If `checkApprovalNeeded('QUOTATION', totalAmount)` says approval is required → `Pending Approval` and an approval request via the existing path; on approval → `Approved`; on internal rejection → `Sent`, stage back to `in_negotiation`, requester notified. If approval is not required → `Approved` directly. The stage and document are deliberately out of step while approval is pending. |
| `→ lost_to_competitor` | `status = 'Rejected'`; reason via `win_loss_reason_id` required (§5.2) |
| `→ cancelled` | `status = 'Cancelled'` |
| `→ expired` | `status = 'Expired'` |
| `→ under_review · in_negotiation · pending · on_hold` | **none** — document remains `Sent` |

Removing the collapse of `under_review/pending/on_hold` (and the `Under Negotiation` write for `in_negotiation`) into header values is the point of §4.

### 4.4 Enforcement

- Add `CHECK (status = ANY(...))` on `quotation_header.status` after backfilling any value outside the set. **Offender report, run first, must include `Under Negotiation`** and every value the F5 writers can produce. Report; do not silently coerce.
- Add `BEFORE UPDATE` trigger `trg_quotation_status_transition` rejecting transitions not in §4.1, with an escape hatch for the `SECURITY DEFINER` RPCs. **Corrected against the live catalog, not the earlier citation:** the hatch is `PERFORM set_config('app.allow_quotation_status_mutation', 'true', true)` read back as `current_setting(…, true) = 'true'` — the convention the **19 live financial guards** use (`app.allow_financial_mutation`, `app.allow_invoice_mutation`, `app.allow_posted_*_creation`). `rbac_v1_module_guards.sql` has **no** GUC at all (it only calls `require_permission`), so it was never the pattern to copy. One caveat to keep in view when enforcement ships: a custom `app.*` GUC is settable by any session that can execute SQL, so the flag is an *advisory* marker, not an authorisation boundary — the boundary stays the RPC's own tenant/permission checks plus RLS. It is unforgeable in practice through PostgREST only because a client cannot combine `set_config(...)` and an `UPDATE` in one transaction through the API; a service-role key can, and that role already bypasses RLS anyway.
- **The trigger is the only thing that protects status on terminal documents.** `fn_prevent_posted_quotation_mutation` does not (F26); v2's claim that it blocks mutation of Approved quotes was never true. Enforcement of "no stage/status/revision on `Approved`/`Converted`" therefore lives in this trigger and in the RPCs, not in the old guard.
- **A quotation under approval is not editable (F33).** `update_quotation` blocks only `approved`/`converted`, so while an approver decides, line rates could be rewritten underneath them. The save RPC (or the status trigger, for line and value columns) must reject those edits; an approver's return or reject (§4.1) is what reopens the quote.
  **Key the guard on an open approval request, not on the status string (G3).** The live token is `PENDING_APPROVAL` (F28), so `LOWER(status) = 'pending approval'` never matches: a string-based check is dead the moment Q5 lands on "keep the token", or if the rename and the guard ship out of step — the F32 failure mode reapplied, and silent. Preferred predicate: no edit while a pending request exists for this quotation (`reference_type IN ('quotations','quotation_revisions') AND reference_id = …`), which also covers a pending revision and survives whatever §15 Q5 decides. If a status check is kept as well, it must list **both** `pending approval` and `PENDING_APPROVAL`. Needs live confirmation.
- **System actors are first-class.** Date-driven expiry and any cron get explicit edges (`* → Expired` under `app.actor='system'`), logged with `actor_id IS NULL` and `actor_name = 'System'` (both already exist on `follow_up_activity_log`). These edges are additions (§4.2).
- **Rollout in two steps** (§11): audit-only trigger first, enforcement after a clean observation window.
- Server graph is the single definition; `canTransition` becomes a UI hint only. The stage graph is transcribed from `TRANSITION_GRAPH`; the document graph is new and built from the observed writers.

---

## 5. Functional spec

### 5.1 The drawer becomes the cycle

`ItemHistoryDrawer`, quotation context only. New controls (`item-history-drawer.tsx:366-429`):

1. **Outcome** — **required for every quotation log**, regardless of `call_category`. Fixed enum, §5.2.
2. **Move stage to** — optional stepper, defaults to the projection suggested by outcome; illegal options hidden, not disabled.
3. **Revision scope** — shown only for outcomes `revision_requested`, `price_objection`, `discount_requested`. Required three-way choice with **no default**:
   - **Specific lines** — multi-select of the quotation's lines, shown as *display order · item code · rate*. The item code requires a join from `quotation_items.item_id` to `materials` that the drawer does not do today (F14). Each line carries a `request_kind` ∈ `price · qty · spec · discount` and a note.
   - **Whole document** — one free-text note.
   - **Log only, no revision**.
   Save is disabled until one is chosen.
4. **Assign revision to** — optional select, shown only when scope is not "log only". Blank means route to approvers (§7.1). **The default is never the actor** (F24).
5. **Loss reason** — shown and required only for outcome `lost`; options from the org's `win_loss_reasons` (category `loss`).
6. **Notify** — read-only chip row showing recipients **resolved by the server** (§5.3 preview), so what the user sees is what the fan-out uses.

Existing fields (`Subject`, `Brief`, `Next Action`, `follow_up_date`, `Priority`, `status`) unchanged. Attachment and general assignee stay out of scope (F12).

**Terminal documents (`Approved` / `Converted`, and `Rejected`, `Cancelled`, `Expired`, `Superseded`).** The user can still **log a call** (delivery, payment and scope questions are legitimate), with outcome limited to `general_update` and `callback_scheduled`. The **Move stage** stepper, revision scope, assignee and loss reason are **hidden, not shown-then-ignored**, and neither outcome carries a stage effect. **Revisions are never raised on a terminal quotation** (F27: the save RPC cannot edit an approved quote, so a revision could not be applied; the versioning model in §6 starts from an open quote).

One submit → one RPC (§5.3) → success toast → drawer closes → row reflects new stage via React Query invalidation on `['follow-up', …]` (`use-followup-data.ts:28-110`).

### 5.2 Outcome enum (decision: fixed in code + DB)

Shipped as a `CHECK` on `client_communication.outcome` plus a TS const:

| Value | Label | Default stage (open quotes) | Projection |
|---|---|---|---|
| `price_objection` | Price objection | `in_negotiation` | revision per §5.1 scope |
| `revision_requested` | Revision requested | `under_review` | revision per §5.1 scope |
| `discount_requested` | Discount requested | `in_negotiation` | revision per §5.1 scope |
| `callback_scheduled` | Callback scheduled | `pending` | none |
| `site_visit_needed` | Site visit needed | `pending` | none |
| `general_update` | General update | *(no change)* | none |
| `won` | Won | `approved` ("Client accepted") | §4.3 two-branch |
| `lost` | Lost | `lost_to_competitor` | → `Rejected`; reason required |
| `unresponsive` | Unresponsive | `on_hold` | none |

"Default stage" applies to **open** quotations only; on terminal documents only `general_update` and `callback_scheduled` are offered and neither moves a stage.

**Loss reason (C13).** `lost` writes the existing `follow_up_quotation_tracking.win_loss_reason_id` (FK to org-scoped `win_loss_reasons`) and `win_loss_notes`. No new column. "Lost on price" and "lost to competitor" are distinguishable through the reason, not the stage. Nothing writes these columns today, so this is first use; Phase 0 confirms the deployed FK and that the reasons are populated for the orgs in use.

Adding an outcome value = one migration. Org-configurable outcomes remain deferred.

### 5.3 `log_quotation_communication` RPC

`SECURITY DEFINER`, `search_path = ''`, owner-checked, mirroring `follow_up_log_activity`'s conventions. Signature (shape, not SQL):

```
log_quotation_communication(
  p_quotation_id    uuid,
  p_expected_stage  text,     -- compare-and-set; NULL only if no tracking row yet
  p_comm            jsonb,    -- call_category, call_type, subject, call_brief, next_action,
                              -- follow_up_date, priority, status, dedupe_key
  p_outcome         text,     -- required
  p_next_stage      text,     -- optional
  p_revision_scope  text,     -- 'lines' | 'document' | 'none'; required for revision outcomes
  p_line_requests   jsonb,    -- [{quotation_item_id, material_item_id, item_code,
                              --   display_order, rate, qty, request_kind, note}]
  p_document_note   text,
  p_handler_id      uuid,     -- optional; NULL → route to approvers; never the actor
  p_win_loss_reason_id uuid,  -- required when outcome = 'lost'
  p_win_loss_notes  text
) RETURNS jsonb
-- {communication_id, revision_id?, activity_ids[], notified_user_ids[], stage, document_status, replayed}
```

Single transaction, in order:

1. **Authorise.** `user_can_access_org(organisation_id)` and the **update** permission on `quotations`. **v2 said `edit`; a later migration renamed `edit`→`update` and deleted the `edit` rows, and `_role_has_perm` matches exactly (F23), so the old predicate may reject everyone or no one.** Verify with a live query before building on it; use whichever action key actually has grants.
2. **Replay check.** If `dedupe_key` exists, return the original result with `replayed = true`; write nothing.
3. **Resolve client** from `quotation_header.client_id`, never by name (F15). No `client_id` → named error.
4. **Compare-and-set** on `p_expected_stage`; mismatch raises `STAGE_CONFLICT` with the current stage and last actor.
5. **Validate shape.** Revision outcomes require a scope; `lines` requires a non-empty `p_line_requests`; `lost` requires `p_win_loss_reason_id`. On terminal documents reject any `p_next_stage`, revision scope other than `none`, or outcome other than `general_update`/`callback_scheduled` — **the communication itself is still logged**.
6. **Insert** `client_communication` with `outcome`, `linked_type='quotation'`, `linked_id`, `call_regarding='quotation'`, `entered_by = auth.uid()`.
7. **Transition stage and project document status** (skipped on terminal documents). Validate against the server graph; upsert `follow_up_quotation_tracking`, **populating `next_action_label` unless Phase 0 shows it is nullable or defaulted (reported NOT NULL, yet existing reminder upserts omit it — F31)**; apply §4.3 via the escape hatch. On `won` branch A, raise the approval request **only if none is open** for the quotation; if the user already pressed Submit for approval, reuse the open request (otherwise `createQuotationApproval` writes a second approvals row).
8. **Revision.** If scope is `lines` or `document`, insert `quotation_revisions` with `status='pending_approval'`, `communication_id` from step 6, `original_owner_id` = the quotation's creator, `current_owner_id` = `p_handler_id` (or NULL when routed to approvers — **not the actor**), `requested_stage`, and `line_requests` with the snapshot (§6.4). **This inverts F8's flow:** the revision attaches to the log the human wrote; it does not fabricate one. Raises the approval request for the revision through the existing creation path. A brand-new revision row cannot already have one, so the duplicate-approval guard is the quotation-level check in step 7, not here.
9. **Activity.** `quotation_response_logged` and `quotation_status_changed` rows with `{from,to}` stored in the existing `metadata` JSONB column. **If the live `event_type` CHECK lacks `quotation_status_changed` (F30), the RPC fails loudly instead of committing without its audit row** — which is also why P0-4 comes first.
10. **Notify, isolated.** Fan-out runs in its own `BEGIN … EXCEPTION WHEN OTHERS` sub-block (savepoint). On error, steps 6–9 commit; the error is recorded on the activity row (`metadata.notify_error`, merged into `metadata`, never assigned over it — §10) and raised as a `WARNING`.

**Idempotency.** `client_communication.dedupe_key` has a unique index; the client generates the key once per drawer open, not per click.

**Preview.** A read-only `preview_quotation_notification(p_quotation_id, p_outcome, p_next_stage, p_handler_id)` returns the recipients the fan-out would use, using the same resolver function (§7.1).

### 5.4 Retire the duplicate paths

- Row "Update Status" menu → dedicated **`change_quotation_stage`** RPC. It performs steps 1, 2, 4, 7 and 9–10 above, requires a reason, and **writes no `client_communication` row**. The dedupe key is stored on the activity row (`follow_up_activity_log.dedupe_key`, unique); a replay returns the original result with `replayed = true` and writes no second row or notification.
- The four unguarded writers (F5) route through the RPCs or are blocked by the trigger. `QuotationView.tsx:694` (Cancel) and `QuotationList.tsx:856` (bulk) are the two that can currently corrupt state.
- **Approvals write-back — additive RPC, approvals UI untouched (§3).** The browser-side write-back (`approvals/api.ts:659,830,867-885`) cannot use the escape hatch. A `SECURITY DEFINER` write-back RPC wraps the same writes with the same inputs and:
  - **makes the reject path fail-closed** (today it swallows errors, F25);
  - writes the agreed internal-rejection and return outcomes of §4.1 rather than `Rejected` / `Under Negotiation`;
  - **adds the missing `quotation_revisions` case** (§6.1), which is a new behaviour, not a refactor.
  It gates **enforcement (Phase 1b)** and the revision lifecycle (Phase 3); it does **not** gate Phase 2. Fallback if the RPC proves invasive: an explicit, narrowly scoped trigger edge for the transitions approvals performs, at the cost of letting any authenticated writer take those edges.
- `TRANSITION_META`'s snake→Title map is deleted once projection rules live in SQL.
- **The save RPC blocks edits while a quotation is under approval** (F33, §4.4), shipped with the Phase 1b enforcement. This is the one change to the existing save path in this PRD, and it is what makes branch A safe. Per G3, the predicate is "an open approval request exists for this quotation", **not** a status literal — a `LOWER(status) = 'pending approval'` check cannot match the `PENDING_APPROVAL` token that is live today (F28) and would ship as a no-op.

---

## 6. Revision lifecycle (closes the loop)

v1/v2 assumed the approval engine already wrote revisions back. It does not (F18, F20). The cycle is *quote → call → client feedback → the quote changes or dies*; this section defines "the quote changes" on top of what exists and what must be built.

### 6.1 States — the existing vocabulary plus one

The live CHECK is `pending_approval, approved, in_progress, completed, rejected` (F21). v2's invented `applied` and `reissued` are withdrawn.

| State | Meaning | Written by |
|---|---|---|
| `pending_approval` | requested, awaiting approver | RPC step 8 (exists) |
| `approved` | approver accepted the revision | **new** `quotation_revisions` case in the approvals write-back RPC |
| `in_progress` | new quotation version drafted (the "applied" step) | "Start revision" action |
| `completed` | the new version has been sent to the client (the "re-issued" step) | new version `Draft → Sent` |
| `rejected` | approver declined; requester told with the reason | approvals write-back RPC |
| `superseded` | **new value.** Quote won/lost/cancelled/expired while the revision was open | trigger / RPC |

`rejected` and `in_progress`/`completed` have no writer today; Phase 3 adds them. A migration adds only `superseded` — and only if the deployed constraint matches F21 (Phase 0).

### 6.2 Mechanism: versioning, not in-place edit (decision C3, confirm in §15 Q4)

`quotation_header.revised_from_id` already exists (F22). In-place edit is the novel option and is also impossible after approval (F27) and destroys line ids on every save. So:

1. A revision is raised only on an **open** quotation (§5.1).
2. When the revision is `approved`, a **"Start revision"** action creates a new `Draft` quotation header via the existing creation path, copying lines, with `revised_from_id` = original. Revision → `in_progress`.
3. The user edits the new draft and **sends** it (`Draft → Sent`). At that moment: the new row carries the follow-up tracking (stage, assignee, follow_up_date) forward, the original row becomes `Superseded`, and the revision becomes `completed`. **`follow_up_quotation_tracking` is `UNIQUE (organisation_id, quotation_id)` and `Superseded` has no equivalent among the nine stages, so the original's tracking row would stay in the Follow-up list beside its replacement. The original's tracking row is therefore marked terminal, or the Follow-up query excludes `status = 'Superseded'`** — and that is a Phase 3 deliverable, not a Phase 0 note. This *is* the re-issue to the client; no separate "mark as re-issued" capture is needed (answers v2 §15 Q7).
4. Until step 3 completes the original row stays `Sent` and live: the client may still be holding it.

| Moment | Document `status` | Stage | Creator's queue | Notifies |
|---|---|---|---|---|
| Revision requested | original stays `Sent` | per outcome | **"revision pending"** marker | handler (§7.1) |
| Revision approved | `Sent` | unchanged | marker → **"start revision"** | requester + handler |
| New version drafted | original `Sent`; new `Draft` | unchanged | marker → **"send revised quote"** (the marker is the prompt; no auto-created action — `next_action` lives on `client_communication`, which this flow does not write) | none |
| New version sent | original `Superseded`; new `Sent` | carried to the new row | marker cleared | requester |
| Revision rejected | unchanged | unchanged | marker cleared; reason shown | requester |
| Quote won / lost / cancelled / expired while open | per §4.3 | per change | marker cleared | requester |

An open revision on a quote that is marked `won` is moved to `superseded` and its requester notified. This also removes v2's deadlock: after `won`, the row is terminal and uneditable (F27), and no revision can legitimately exist against it.

Open detail for Phase 3 design (not decided here): the quotation numbering scheme for a new version, and how follow-up tracking history is attached when it moves rows (§15 Q4).

### 6.3 Who resolves (C6)

There is no `quotations.approve` permission to route to (F23), and this PRD does not add one (§3). Approvers are resolved from the **existing approval configuration** per `approval_type + level` (`approvals/notifications.ts:38-49`) for the revision's approval request — i.e. the people the engine already treats as approvers. **Id-space caveat:** `approval_workflows.approver_id` is matched against `employees.id` (`approvals/notifications.ts:6-9`), whereas `quotation_revisions.current_owner_id` is a foreign key to `user_profiles(user_id)` and the bell reads `auth.uid() = user_id`. Approvers must be mapped from `employees.id` to `auth.uid()` before any notification is keyed on them. If they cannot be, the default routing in §7.1 inserts notification rows nobody can ever see, and under a permissive insert policy that fails silently. Proving the mapping is a Phase 0 gate for Phase 3 (§15 Q9, Appendix A). The requester cannot approve their own revision. An internal rejection is recorded on the revision with actor and reason and does **not** change document status (the document stays `Sent`).

**This caveat is understated (G2).** The assumption that the two id spaces are the same is not something this feature would newly introduce — it is already load-bearing in code, and it already fails quietly. `getContact` (`approvals/notifications.ts:11-18`) does `.from('employees').select('name, email, phone').eq('id', userId).maybeSingle()` while its own comment states that the approval FKs point at `auth.users`; on mismatch it returns `null` and the caller proceeds without a contact. The schema shows the column *name* is not a reliable indicator of the id space in either direction: `20260714_hr_attendance_module.sql:70` declares `employee_id UUID NOT NULL REFERENCES auth.users(id)`, while `20261005000000_fix_projects_site_engineer_fk.sql:13` FKs `site_engineer_id` to `public.employees(id)`. So Phase 0's job is not to prove a mapping exists but to **measure the mismatch rate** (Appendix A) and treat any existing silent failures as a separate defect if the rate is non-zero.

### 6.4 Line references and edit safety (C5)

Row ids in `quotation_items` are destroyed and recreated on every save (twice, in the current edit flow — F27) and `line_no` / `item_code` do not exist on the table (F14). Each `line_requests` entry therefore stores a **mandatory snapshot**:

`{quotation_item_id (may die), material_item_id, item_code (via materials), display_order, rate, qty, request_kind, note}`

The stable match key across saves and versions is `material_item_id` with `display_order` as a tiebreaker for duplicate materials. History renders from the snapshot. With versioning (§6.2) the original row's lines are never edited after approval, which removes most of the exposure.

### 6.5 Expiry

A revision request does **not** change `valid_till`. The new version is created with the original `valid_till` as default, editable, with a warning when it is within 3 days. Expiry stays date-driven; `* → Expired` (system actor, §4.4) supersedes an open revision.

---

## 7. Notification design

### 7.1 Recipients (C7)

v2's rule resolved the handler to `current_owner_id`, which `initiateQuotationRevision` sets to the clicking user (F24); suppressing the actor then left the recipient set empty and triggered the manager-alert fallback on essentially every revision. Recipients are now defined by who must act, and the owner columns are written deliberately (§5.3 step 8):

| Event | Recipients | Resolution |
|---|---|---|
| `quotation_revision_requested` | the **handler**: `p_handler_id` if chosen in the drawer; otherwise the **approvers** from the existing approval configuration (§6.3), excluding the actor | no estimator/pricing owner exists in data; it must be assigned at creation or routed to approvers |
| | plus the quotation creator, if creator ≠ actor | informational; creators also see the queue marker (§6.2, §7.3) |
| `quotation_revision_resolved` (approved / rejected / new version sent) | the requester (actor of the original log) | requester stored on the revision |
| `quotation_status_changed` | creator if actor ≠ creator; plus `follow_up_quotation_tracking.assignee_user_id` (exists live) if set and different | self-notification suppressed |
| `quotation_price_objection` | the handler set above | |

Rules:
- Never notify the actor; never notify a deactivated user.
- **Notification rows are keyed on `auth.uid()`.** The "no handler → approvers" path is the one that fires most often, so the `employees.id` → `auth.uid()` mapping (§6.3) must be measured before this ships, not assumed: existing code already makes that assumption and drops contacts silently (G2). An approver with no mapping is skipped and logged, and counts toward the empty-set manager alert.
- **Do not reuse `ApprovalNotificationService.createNotification` as the fan-out** (F34). It writes a different table (`approval_notifications`) with the same swallowed-error pattern as F25 (`console.error`, no rethrow, `approvals/notifications.ts:73-98`). Quotation events go to the store chosen by §7.3 / §15 Q11.
- **Existing call sites that pass no handler must change.** `initiateQuotationRevision` is only reachable through the RPC after Phase 2; the `current_owner_id` readers (`ClientCommunication.tsx:3277,3280,3352`) keep working because they read the handler, which is a coherent meaning for "owner of the revision task".
- If the resolved set is still empty (no handler, no approvers configured), raise a **manager alert**. With §7.1 as written this should be rare, not the norm.
- Dedupe: `(user_id, event, document_id)` within 10 minutes — **but a notification for a new `revision_id` is never suppressed**.
- Recipient resolution is one SQL function used by both the preview and the fan-out.

### 7.2 Delivery

1. **In-app, in-transaction, isolated** insert into the canonical store chosen by §7.3 (savepoint, §5.3 step 10).
2. **Realtime** subscription on `notifications` `postgres_changes` INSERT filtered to `user_id`, reusing the `ManagerAlerts.tsx:58-82` pattern. Fallback: 60 s poll while visible.
3. **Email** for `quotation_revision_requested` only, gated on P0-1 being closed. Until then disabled by flag, not stubbed with `console.log`, and the UI must not promise it.

### 7.3 Surfaces

- **Bell + panel** in the app shell: unread count, list, mark-read, deep-link via `notifications.link` → `/quotation/view?id=` (`follow-up/api.ts:148`).
- **Queue markers** in the Follow-up Center, per §6.2.
- **Canonical store decided (H1, §15 Q11 resolved).** `notifications` **does not exist in production** — 415 live tables contain only `approval_notifications` and `warranty_notifications`, and no `get_notifications` / `create_notification` / `mark_notification_read` / `escalate_urgent_communications()` among the 427 live functions. So there is nothing to reconcile and nothing to re-point: Phase 3 **creates** the table, and the migration must be written as a create-if-absent with a pre-flight assertion (H1 + §11), because the repo's DDL for it has never run anywhere. The undeployed helpers in `subcontractorService.ts:422,433,448` become a **specification** for the new RPCs rather than code to reuse.
- **One store, not two (G1, H1, H2).** `approval_notifications` is the only notification table live, and it is write-mostly: 2× INSERT + 2× SELECT policies, **no UPDATE policy**, so its own `markNotificationAsRead` (`approvals/notifications.ts:345`) cannot clear `read_at` under RLS — the bell can receive but never be dismissed. The canonical table must therefore ship with, and be tested on, an UPDATE policy scoped to `user_id = auth.uid()`. Phase 3 chooses whether approval events migrate onto the canonical store or continue writing the old one behind a unified read view; shipping a canonical bell while approvals keep writing elsewhere reproduces the disconnection this feature exists to remove.

---

## 8. History / audit surfacing

- Quotation History tab reads `follow_up_activity_log` + `quotation_activity_log` unioned and renders `metadata` `{from,to}` as `rate 450 → 420`, `status Sent → Approved`. Line-level changes render from the revision snapshot (§6.4).
- **Synthesis fallback kept, with a cutover.** `fetchLifecycleMilestones` (`use-item-history.ts:168`) keeps synthesising milestones **only for quotations created before the cutover timestamp**, set when Phase 2 ships; or a one-time backfill (Phase 4 chooses). After the cutover, real events win.
- Version chain: the History tab shows the `revised_from_id` chain, so a `Superseded` quote links to its replacement.
- Drawer "Updates" tab gains `outcome` badges.
- Reuse the approvals actor/action/reason/timestamp row format for revision entries (the pattern is real; the write-back to revisions is what was missing — F20).

---

## 9. Edge cases

| Case | Required behaviour |
|---|---|
| Logged call on an `Approved` / `Converted` (or other terminal) quotation | **Allowed** with outcome `general_update` or `callback_scheduled`. The RPC rejects any stage change, status change or revision; the drawer hides those controls. **Enforcement is the trigger and RPC — not `fn_prevent_posted_quotation_mutation`, which never protected status (F26).** |
| Revision requested on a terminal quotation | Not offered; RPC rejects. |
| Stage change + revision where revision creation fails | Whole transaction rolls back; no orphan comm row. (Notification failure does not roll back — §5.3 step 10.) |
| Two salespeople act on the same quote | Loser gets `STAGE_CONFLICT` with current stage and last actor; UI refetches and asks to confirm. Server graph also rejects illegal second transitions. |
| Double-submit / slow network | Same `dedupe_key` returns the original result with `replayed = true`; no second row or notification. For `change_quotation_stage`, the key is on the activity row. |
| `follow_up_date` in the past | Allowed; flagged in the activity row. |
| Client has no `client_id` | RPC rejects with a named error. |
| Revision outcome with no scope chosen | Rejected by RPC; drawer prevents it earlier. |
| Revision outcome with no handler and no approvers configured | Manager alert; request still created. |
| Notification fan-out fails | Business write commits; failure on the activity row and in logs. |
| Salesperson tries to edit line rates while an approval request is open on the quotation | Rejected by the save RPC / trigger with a named error `QUOTATION_UNDER_APPROVAL` (§4.4, F33, G3). The guard tests for an open request, **not** for the status literal, because the live token is `PENDING_APPROVAL` and a status-string check would silently never fire. The approver's return or reject reopens the quote. |
| Quotation is under approval but its header status was never moved (no threshold breach, or an old writer) | Still blocked, because the open request is the predicate. This case is exactly why G3 rejects the status-literal version of the guard. |
| User already pressed "Submit for approval", then logs `won` or a revision | The open approval request is reused; no second approvals row is created. |
| `won` while a revision is open | Revision → `superseded`; requester notified. |
| Revision approved, but the original was edited in place meanwhile | Original keeps its own lines; the new version copies lines at "Start revision"; snapshot rendering keeps the request readable (§6.4). |
| `won` when internal approval is required | Stage `approved`, document `Pending Approval`; internal reject → document `Sent`, stage `in_negotiation`. |
| `won` when internal approval is not required | Stage `approved`, document `Approved` immediately. |
| `Under Negotiation` found in existing rows | Offender report; backfilled to `Sent` before the CHECK (§4.1). |
| Notification recipient has no `user_profiles` row | Skip and log; never fail the business write. Approver ids are `employees.id` (`approvals/notifications.ts:10-18`); resolve them to `auth.uid()` before keying a notification (§6.3, §15 Q9), otherwise the insert silently produces rows nobody can see. |
| Bulk status update on 200 quotations | Batch RPC; one notification per creator, coalesced per recipient per event type. |
| System-driven expiry | Allowed by the explicit `system` edge; logged with `actor_id IS NULL`. |
| Live `follow_up_status` CHECK rejects a stage | Phase 0 (P0-4) must establish this before Phase 1; the RPC fails loudly rather than partially committing. |

---

## 10. Data model changes

| Change | Notes |
|---|---|
| `client_communication.outcome text` + CHECK | §5.2. Nullable; historical rows stay NULL, never backfilled by guesswork. |
| `client_communication.dedupe_key uuid` unique | idempotency |
| `follow_up_activity_log.dedupe_key uuid` unique (nullable) | idempotency for `change_quotation_stage`. **Nothing else is needed:** the table already has `metadata JSONB NOT NULL DEFAULT '{}'` (carries `{from,to}` and `notify_error`), `actor_name TEXT DEFAULT 'System'` and a nullable `actor_id` (system actor = `actor_id IS NULL`). **Write pattern:** `metadata` is NOT NULL, so every write is a merge — `metadata = metadata || jsonb_build_object('notify_error', …)` — never an assignment. Otherwise step 10's failure record would clobber the `{from,to}` diff written in step 9 and defeat AC8 and AC19. Confirm against the deployed table in Phase 0. |
| **No new loss-reason column** | reuse `follow_up_quotation_tracking.win_loss_reason_id` / `win_loss_notes` (F13, C13). Confirm FK and population in Phase 0. |
| `quotation_revisions.requested_stage text` | audit only |
| `quotation_revisions.line_requests jsonb` | snapshot shape in §6.4 |
| `quotation_revisions.scope text` + CHECK (`lines`,`document`) | |
| `quotation_revisions.status` | the existing set already carries `approved, in_progress, completed, rejected` (F21); **add `superseded` only**, after confirming the deployed constraint matches |
| `quotation_header.status` CHECK | **Written as `20261019000006`, not applied.** A converging superset rather than the §4.1 list: canonical keys + `Under Negotiation` (Q3) + `Partially Converted` (Q13) + anything found in the data, all reported and admitted, none rewritten. Ships with `quotation_header_status_inventory` (value, key, canonical?, rows, last write) so the next narrowing is read from row counts instead of from grep |
| `quotation_header.revised_from_id` | **exists** (F22); no change. Used for versioning (§6.2). |
| `follow_up_quotation_tracking` | the RPC populates `next_action_label` if Phase 0 shows it is required (F31). No new columns expected beyond Phase 0 findings. Note `UNIQUE (organisation_id, quotation_id)` with `ON DELETE CASCADE` on `quotation_id` (§6.2). |
| `follow_up_activity_log` FK on `reference_id` | do not add blindly (F16); orphan audit first. |
| Canonical notification store | **decided (Q11) and reframed by H1: `notifications` does not exist live, so this is a create, not a reconcile.** One canonical table, recipient in `auth.uid()` space, RLS SELECT **and UPDATE** for the recipient (H2), plus `get/create/mark_read` RPCs matching the signatures the undeployed helpers already specify. `approval_notifications` rows are migrated in or exposed through a legacy union in Phase 3; `warranty_notifications` stays out of scope. No fourth writer, no third store. |
| Approval gate for quotations | **decided (Q1): reuse `approval_settings` (`QUOTATION`, `QUOTATION_REQUIRES_REVIEW`, `QUOTATION_REVIEWER_ID`) + `approval_workflows` tiers — the live table already has `UNIQUE (organisation_id, setting_key)`, so no new config table and no new surface.** The change is behavioural: `checkApprovalNeeded` moves server-side and fails **closed** (H6), and a threshold value is exposed on the Quotation tab. |
| Rejection outcome | **decided (Q2): `approval_status` only, `status` untouched** — the column pair (`approval_status`, `approval_requested_at`, `approval_completed_at`) already exists live (H4), so this is a one-line removal plus the backfill of any `Rejected`-status quotation rows created by the current code. |
| Versioning columns | **no migration needed (H4):** `revised_from_id`, `revision_no`, `revision_history` and `idempotency_key` are live on `quotation_header` today. §6.2's versioning assumption is confirmed against production, not just the repo. |

No `serial_number` column on `quotation_items`: a "unit/serial number" is a line identifier (decision Q3). Because `item_code` and `line_no` are not columns (F14), the line label is `display_order` + `item_code` from `materials`.

Repository hygiene (prerequisite to Phase 1): backfill the missing DDL for `quotation_revisions` and `follow_up_quotation_tracking`, replace the 0-byte migrations with real ones (F31), **and retire `database-quotation.sql:36-38` or move it out of the hand-run path — it would install the permissive `quotation_header` RLS policy. Note P0-2 is now refuted as a live leak: the 2026-09-16 capture records only `quotation_header_org_policy` and `quotation_header_tenant_isolation`, both `user_can_access_org(organisation_id)`, and no `USING (true)`. The hazard is that this script would *create* one, so it stays on the cleanup list for that reason only.** `approval_notifications` has no DDL under `supabase/migrations` either (F34); include it in the same repair so Phase 3's store decision is made against a file that exists.

---

## 11. Phases

| Phase | Deliverables | Depends on |
|---|---|---|
| **0 — Verify and stop the bleeding** *(starts now, parallel)* | **Ask A waived by the owner (2026-10-19): the catalog queries are not run before Phase 1.** The 2026-09-16 live capture in `supabase/remediation/` settles vocabulary migration not applied (H3), `quotation_header` RLS org-scoped and P0-2 refuted, `notifications` absent live (H1), `approval_notifications` policy set (H2), `quotation_header` has no status CHECK (F3/P0-4) but does carry the approval and versioning columns (H4), and the approver id space (H5, Q9), the `quotation_revisions.status` CHECK (`pending_approval/approved/in_progress/completed/rejected`) and the `win_loss_reason_id` FK (`→ win_loss_reasons ON DELETE SET NULL`), both of which Phase 0 had listed as open. **What is still unanswered and now moves to migration time rather than blocking:** `approvals` / `quotation_header` row counts, the `quotations` `approve` permission grant (F23), the live status distribution and the G4 blast radius, and `next_action_label`'s NOT NULL behaviour (F31). **Mitigation adopted in place of Ask A:** every migration opens with pre-flight assertions (expected column present/absent, expected constraint absent, expected table missing) and aborts with a named error, so a month-stale assumption fails loudly instead of half-applying. **Carried forward, still to do:** P0-1 key rotation (needs the account owner; must not wait); P0-3 repo repair (F31) incl. neutralising `database-quotation.sql:36-38`; status offender report **including `Under Negotiation`**; **the F33/G4 blast-radius count**; ~~decisions Q1, Q2, Q11~~ **recorded (§15)**; remaining decisions Q3, Q4, Q5, Q6, Q7, Q8, Q10; confirm the origin state of `integration.ts:256-263`; list every reader of `'PENDING_APPROVAL'` (F32); confirm live whether `update_quotation` permits edits while an approval is open (F33); transcribe `TRANSITION_GRAPH` | — |
| **1a — Retire the bypass** | **Landed 2026-10-19 (see the two blocks in §0):** rejection returns the document to `Sent` with `approval_status` + fail-closed source write (Q2/H7; the first cut left it stuck on `PENDING_APPROVAL` — see §0); `quotation_approval_requirement` RPC replaces the browser-side gate for quotations (Q1/H6); `change_quotation_stage` RPC with required reason + `dedupe_key` idempotency replaces the row-menu writes (F2/F3/F31); H8 priority logging fixed; canonical status vocabulary module (F7, partially). 12 unit tests. **Migrations `20261019000002`, `20261019000003` and `20261019000004` are written but not applied, and the client now depends on them — apply them in that order before shipping this code.** Remaining: the rest of the approvals write-back work (approvals UI untouched; agreed return outcome; **no** revision case yet); the Cancel writer, blocked on the `approved → cancelled` edge decision; deleting the dead bulk writer. The document-status trigger now exists in **audit-only** mode (`20261019000004`, §4.4) — enforcement is Phase 1b and needs the reject report read first. Every migration in this phase opens with the pre-flight assertions from Phase 0 | Phase 0 |
| **1b — Enforce** | **Written 2026-10-30, not applied:** the F33/G3 edit lock (`20261019000005`) — see the §0 bullet for why it reads `public.approvals` rather than the status token, why only `PENDING` blocks (Q12), and the overload pre-flight that a `CREATE OR REPLACE` of a differing argument list would have needed. Its named error, editor banner and unit tests are in. Still open in this phase: the enforcement flip of `20261019000004` — **no longer decision-free**, because the RPC's `in_negotiation → 'Under Negotiation'` projection is admitted by the CHECK but rejected by the trigger's canonical/edge graph, so the flip must either change `quotation_document_status_for_stage` in the same migration or admit the retired keys, which is Q3; the `Pending Approval` rename shipped atomically with every reader in F32; and the G4 release note (§14.1). Also written 2026-10-31, not applied: the **status CHECK** (`20261019000006`) as a converging superset with `Superseded` admitted ahead of Q4 — see its §0 bullet for the two writer findings. The **`Pending Approval` rename** must ship atomically with every reader in F32. The save RPC's edit lock removes an edit right users have today and is not merely enforcement (G4). Trigger switched to enforcing after the audit log shows no legitimate rejected writes over an agreed window (proposal: 7 consecutive days incl. one month-end, if one falls within it); **also requires the approvals write-back RPC live** | Phase 1a |
| **2 — Single path** | `log_quotation_communication` + `preview_quotation_notification` RPCs; drawer: outcome / stage / revision scope / assignee / loss reason / notify chips and the `materials` join for line labels; `outcome`, `dedupe_key` columns; client resolution fixed (F15); history cutover set. **Build starts once 1a is live and runs in parallel with the 1b window; it deploys once 1a is stable. It does not wait for 1b.** | Phase 1a |
| **3 — Close the loop and notify** | `quotation_revisions` case in the approvals write-back RPC (`approved` / `rejected`); "Start revision" + versioning via `revised_from_id`, with the original's tracking row terminal / Follow-up query excluding `Superseded`; `in_progress` / `completed` / `superseded` transitions; queue markers; **create the one canonical `notifications` table (H1: absent live) with recipient SELECT + UPDATE RLS (H2) and the `get/create/mark_read` RPCs, then decide whether `approval_notifications` migrates in or is unioned (F34, Q11 resolved)**; bell + realtime; recipient rules (§7.1), resolving `approver_id` through `user_profiles`/`approval_approvers.user_id` and **not** through `employees.id` (H5); manager-alert fallback; email only if P0-1 closed | Phase 2 |
| **4 — Honest history** | `metadata` diff rendering; version-chain display; snapshot rendering; synthesis cutover or backfill | Phases 1-2 |

Phases 1a-2 are the product ask ("streamlined, fluent"). Phase 3 is the notification-and-loop ask and is the largest build because the revision write-back does not exist. **Phase 2 without Phase 3 leaves revision requests created, routed to approvers and approved by nobody's write-back** — so if Phase 3 slips, Phase 2 must ship with the pending-revision marker (§6.2), the manager-alert fallback (§7.1) and a clear UI statement that approving a revision does not yet update it.

---

## 12. Acceptance criteria

**Functional**
1. One drawer save can create a comm row, change the stage, and create a `pending_approval` revision, all or nothing. Verify by forcing the revision insert to fail and confirming no comm row exists.
2. Staging a quotation as `under_review` leaves `quotation_header.status = 'Sent'`; staging `in_negotiation` also leaves it `Sent` (not `Under Negotiation`).
3. Setting an illegal status via direct Supabase `.update()` from the browser fails at the database once enforcement is on.
4. Logging a revision request creates exactly one `client_communication` row.
5. A revision request where the actor is the creator notifies the **handler or the approvers**, never nobody; the actor is never notified; the stored `current_owner_id` is never the actor unless explicitly chosen.
6. Re-submitting the same drawer payload creates no second row and no second notification, and returns the original result with `replayed = true`.
7. Two distinct revision requests on the same quote within 10 minutes each notify.
8. Forcing the notification insert to fail does not roll back the comm row, stage or revision; the activity row records `metadata.notify_error` **alongside the intact `{from,to}` diff**.
9. A stale `p_expected_stage` returns `STAGE_CONFLICT`; nothing is written.
10. Logging a call on an `Approved`/`Converted` quotation succeeds; any stage change, status change or revision on one is rejected **by the trigger/RPC**.
11. A revision outcome with no scope is rejected; `lost` with no `win_loss_reason_id` is rejected.
12. `won` — **branch A (approval required):** stage `approved`, document `Pending Approval` until approval completes, then `Approved`; an internal rejection returns the document to `Sent` and the stage to `in_negotiation`. **Branch B (approval not required):** stage `approved`, document `Approved` immediately.
13. **Approving a revision writes `quotation_revisions.status = 'approved'`** (regression test for the dead write-back, F18/F20); rejecting it writes `rejected` with the reason.
14. The revision lifecycle is observable end to end: `pending_approval → approved → in_progress → completed`, each producing the queue marker in §6.2; on completion the original row is `Superseded` and the new row carries the tracking forward.
15. An open revision on a quote marked `won`, `lost`, `cancelled` or `expired` moves to `superseded`; the requester is notified.
16. The approvals reject path no longer swallows errors: a forced write failure surfaces to the caller and the approval is not left half-applied.
17. The offender report lists `Under Negotiation` rows; after backfill none remain, and no code path writes it.
17a. After the `Pending Approval` rename, a quotation awaiting approval still appears in the Follow-up Center, shows the Approve button, and is selectable by the list's Pending filter (F32).
17b. After a new version is sent, the superseded original does not appear in the Follow-up list beside its replacement.
17c. A user who already submitted a quotation for approval and then logs `won` ends up with one approvals row, not two.
17d. While an approval request is open on a quotation, an attempt to edit its line rates through the save RPC is rejected with `QUOTATION_UNDER_APPROVAL`; after an approver returns or rejects it, edits succeed again. **The block must be demonstrated to fire under both `PENDING_APPROVAL` and `Pending Approval` header values** — a status-literal guard passes this test only by accident (G3).
17e. The bell shows quotation events and approval events from one store; no surface reads the other table (F34, Q11).
18. A status change never commits without its audit row: the live `event_type` CHECK is **confirmed not to include `quotation_status_changed`** (H3), so until the vocabulary migration ships, the RPC must fail loudly rather than write-and-swallow.
19. History shows actor, timestamp and before→after for at least one stage change and one line-rate revision, including one whose original `quotation_item_id` no longer exists.
20. Pre-cutover quotations still show synthesised milestones; post-cutover show only real events.
21. Double-clicking "Update Status" on a slow network writes one activity row and one notification set.
22. On a terminal quotation the stage stepper is not rendered and logging `callback_scheduled` changes no stage.

**Added in v3.4 (decisions Q1/Q2/Q11 + the live reconciliation)**
22a. **Rejection leaves the client-facing document alone (Q2, H7):** after a manager rejects an approval, `quotation_header.status` is unchanged and `approval_status = 'Rejected'`; the quotation is **still present** in the Follow-up Center and its stage is unchanged. Regression test for the row that disappears today. *(Unit-covered since 2026-10-19 by `quotationApprovalFlow.test.ts`; the Follow-up Center half still needs a live run.)*
22b. **The approval gate fails closed (Q1, H6):** with the gate's dependency made to throw (no org context, failing query), the quotation is **not** saved as unapproved — either the save surfaces an error or the check runs server-side and blocks. Today `integration.ts:920-922` returns `needed: false` on any error and the quote saves silently. *(Satisfied at the unit level by `quotation_approval_requirement` + `quotationApprovalGate.test.ts`; AC not considered met until the migration is applied and a real submit is observed failing closed.)*
22c. **Threshold control is one surface (Q1):** with `QUOTATION` enabled and no workflow tiers configured, every quotation requires approval; with a tier of ₹X, a quotation below ₹X does not. Both driven from Settings → Approval → Quotation, with no second config store. *(No UI work needed — the control set already exists; the RPC reads it. Needs a live two-quotation check on a configured org.)*
22d. **The bell can be cleared (H2):** the recipient marks a notification read from the browser role and it commits. Under `approval_notifications` as deployed this fails, because that table has no UPDATE policy — so the canonical table's UPDATE policy is tested, not assumed.
22e. **Audit writes match the live vocabulary (H3, H8):** an activity-log insert using `tab_source = 'quotations'` or `event_type = 'escalation'` (as `follow-up/api.ts:656-666` does today) is shown to fail *and report*, rather than being swallowed by `.catch(() => {})`.

**Non-functional**
23. Drawer submit p95 < 800 ms on preview including the RPC round-trip; the notification preview call adds no more than one round-trip and does not block typing.
24. Bell polling/realtime adds no measurable long tasks to first interaction.
25. Zero secrets in the client bundle; no Resend import reachable from `src/` browser code; the exposed key is rotated.

---

## 13. Metrics

Baseline unknown. Instrument from day one via `follow_up_activity_log`; targets are set **after a 30-day observation window** following Phase 2. Initial proposals marked †.

- Time sent → first logged communication (calls only; stage-only changes are excluded by design).
- Share of logs using `general_update`. † Alert above 40% in a month.
- % of revision requests reaching `completed`; median time requested → approved → in_progress → completed.
- Revisions `pending_approval` > 3 days. † Should trend to zero.
- Stage distribution vs. conversions, by stage.
- Loss-reason distribution (new: nothing writes the column today).

## 14. Risks

| Risk | Mitigation |
|---|---|
| If `20260916121500` is unapplied (likely applied, unconfirmed): stages silently rejected and audit rows lost | P0-4 first; apply the migration as its own change if needed |
| Existing rows hold status values outside the canonical set (`Under Negotiation` confirmed, `Partially Converted` new) | Done in `20261019000006`: the CHECK is built as a superset of canonical + live-written + observed, offenders are reported and admitted, no row is rewritten |
| Enforcement flip rejects the sanctioned RPC's own `Under Negotiation` projection | The CHECK admits it, so 006 is safe; the *trigger's* graph still rejects it, so flipping `20261019000004` to enforcing now depends on Q3 (see §11) |
| `quotation_header` now depends on `quotation_document_status_key` for its CHECK | Migrations replay fine; a `pg_dump` restore needs the helper functions created before the table constraint. Accepted deliberately over duplicating the normaliser, which would let the CHECK and the trigger drift |
| Trigger blocks a legitimate writer (approvals, crons, `record_quotation`, browser write-back) | Writers retired in 1a; audit-only mode between; explicit `system` edges; approvals write-back tested |
| Repo DDL differs from the deployed schema (F31) | P0-3 dump and repo repair before any migration |
| Revision write-back is net-new, not reuse | Scoped in Phase 3; Phase 2 ships safeguards (§11) |
| Versioning touches numbering, tracking carry-over and the creation path | Design inside Phase 3; confirm Q4 before Phase 2 ends |
| Permission predicate in the RPC is dead after the `edit`→`update` rename | Verify with a live query; use the action key that has grants |
| Approvals reject path swallows errors, leaving half-applied state | Fail-closed in the additive RPC (1a) |
| Making outcome required slows quick logging | `general_update` as a one-tap default; measure completion time against the 800 ms target |
| The hand-run script `database-quotation.sql:36-38` re-creates a permissive `quotation_header` policy if anyone runs it (P0-2 is stale per repo; live policy unconfirmed) | Confirm live `pg_policies`; repair or neutralise the script in Phase 0; do not ship Phase 3 surfaces until verified |
| A quotation under approval is edited under the approver (F33) | Guard is written (`20261019000005`, Phase 1b): `update_quotation` calls `quotation_open_approval()` after locking the header and raises `QUOTATION_UNDER_APPROVAL`. **Keys on the open request, not the status token, exactly as G3 requires** — and for a second reason: the submit flow writes the status from the browser and discards its own write failures (`approvals/api.ts:670,841,923`), so a status-literal guard can pass while a request is open. Not applied; live confirmation moves from Phase 0 to the migration's pre-flight |
| Removing the pending-approval edit right surprises users (G4) | Named error + editor banner + the release note in §14.1, sent with the migration. **Open half:** Phase 0 still has not sized how many quotations sit under approval today, so the number affected at flip time is unknown |
| A third notification store is built beside `notifications` and `approval_notifications` (F34) | Decide Q11 before Phase 3; AC17e requires one store |
| Approver contacts silently resolve to `null` because the id spaces differ (G2) | Measure the mismatch rate in Phase 0; if non-zero, the existing approvals notifications are their own defect |
| No handler or approvers configured → silent revisions | Manager-alert fallback (§7.1) |
| Exposed Resend key remains live | Rotate now; owner action required |

### 14.1 Release note draft for the Phase 1b edit lock (G4)

G4's point is that this change takes a right away rather than adding a guard rail, so it has to be announced in users' terms, not described as enforcement. The text below is for the in-app changelog; send it with the migration, not after it.

> **Quotations are now locked while an approver has them.** Once you press *Submit for approval*, the quotation stops accepting saves until the request is approved, rejected, returned or put on hold. This closes a real gap: previously the numbers could change after submission, so an approver could approve a quotation that was no longer the one on their screen. If something has to change while it is with an approver, ask them to **Return** it first — the quotation comes back to you, editable, and resubmitting starts a fresh request on the new numbers.

Internal notes for the same change: the lock is in `update_quotation`, so all four of its call sites inherit it (`src/api.ts:677`, `useQuotationMutations.ts:222` and `:301`, `CreateQuotation/index.tsx:2063`) — neither copy of the client-side save logic can bypass it. Autosave attempts against a locked quotation fail quietly by design; the editor banner is the visible signal, and it asks the database rather than reading the status label, so it cannot disagree with the server. Rollback is a single `CREATE OR REPLACE` back to the `20261006000001` body — no data is involved and this migration rewrites no rows. A quotation whose request is parked on `HOLD` or `FORWARDED` *is* still editable (Q12), which the user-facing text above does not mention; if that gap matters to the team, say so in the changelog rather than leaving it to be discovered.

## 15. Open questions

Answered by code probes in v3: who the handler is (no estimator exists in data — assign at creation or route to approvers; was Q1), what internal rejection does today (`Rejected` plus swallowed errors, `Under Negotiation` on return; was Q5), whether quote edits keep line ids (they never do; was Q6), mutate vs version (versioning is the designed path; was Q8), re-issue capture (new version sent *is* the re-issue; was Q7).

1. ~~Does a client-accepted quote always need internal approval, or only above the org's threshold?~~ **RESOLVED 2026-10-19 — threshold-driven, configured under Settings → Approval → Quotation, with "every quotation" expressible as a threshold of zero.** Both branches of §4.3 survive; they are now one control, not two code paths. Per H6 the mechanism already exists and is already called from all three quotation save paths (`approval_settings.QUOTATION` enables, `approval_workflows.min_amount/max_amount` tiers it, enabled-with-no-tiers means approve-everything), so the build is: add the threshold field to the Quotation tab, and **move `checkApprovalNeeded` server-side with fail-closed semantics** — it currently runs in the browser and returns `{ needed: false }` on any thrown error (`integration.ts:920-922`), which silently saves an unapproved quotation. No new config table.
2. ~~What should internal rejection mean for the document?~~ **RESOLVED 2026-10-19 — the client-facing document is never marked `Rejected`, and §4.1 returns it to `Sent`.** ("Leave `status` untouched" was implemented first and produced a dead-end `PENDING_APPROVAL` state — see the §0 correction.) The approval outcome is recorded in `approval_status` (exists live, H4) and `status` is left untouched, so a rejected quotation stays visible in the Follow-up Center and can be revised and re-submitted. This is a **behavioural fix, not a new feature**: `approvals/api.ts:869` currently writes `status: 'Rejected'` into `quotation_header` while every other document type's rejection writes only `approval_status` (`:876`, `:879`) — quotations are the outlier, `'Rejected'` is outside `QUOTATION_FOLLOW_UP_STATUSES`, and the follow-up query filters on it (`follow-up/api.ts:121`), so today a manager's rejection hides the quote (H7). Also drop the swallowed error at `:882-884` to match the fail-closed rule its sibling documents at `:859-863`. The recommended "return to `Sent`" is now **not** taken: no document write at all.
3. **Fold `Under Negotiation` into `Sent`** (recommended) or keep it as a document status?
4. **Confirm versioning (§6.2)** and decide the quotation numbering scheme for a new version, and how follow-up tracking history attaches when it moves rows.
5. **Normalise `PENDING_APPROVAL` to `Pending Approval`?** Not the "cheap" change v2 implied. It touches `QuotationView.tsx:2260,2461,74,46,96`, `follow-up/api.ts:42,121` and the list chips and colours (F32), and must ship as one change with the backfill. Recommended: yes, but only as that single coordinated change; if it cannot be, keep the token and generate the display map instead.
6. **Stage badge on the quotation list** for `under_review` / `in_negotiation`? Recommended: yes, so the salesperson sees deal state without opening the Follow-up Center.
7. **Auto-ageing of silent clients?** Proposed: an unanswered revision ages after 14 days; a quote on `on_hold` with no logged communication for 30 days → `Expired` via the system edge. Not specified in the body until confirmed.
8. **Revival edges:** keep `Expired → …` and `Cancelled → Sent` from the stage graph (F29) and mirror them on the document, or tighten?
9. ~~What is the actual mismatch rate between `employees.id` and `auth.uid()` for approvers?~~ **Substantially resolved by H5, without the query.** Live `approval_workflows.approver_id` FKs to **`user_profiles(user_id)`**, and the routed settings screen writes a `user_id` (`components/ApprovalSettings.tsx:1050`) — so approver ids are in `auth.uid()` space by constraint, not by assumption, and no mapping table is needed. The residual defect is not a data-divergence question but a **reader** bug: `getContact` (`approvals/notifications.ts:11-18`) resolves the approver against `employees.id` instead, which is a different table's primary key, so it returns `null` and drops the approval contact **today**. Fix is to resolve `approver_id → user_profiles`, or use the `user_id` already on `approval_approvers`. The dead writer `settings-api.ts:380` (which inserts `approval_approvers.id` into that FK column and swallows the constraint error) is unreachable — its only caller `pages/ApprovalSettings.tsx` is imported nowhere — so it goes on the cleanup list, not the critical path.
10. **Does the quotation-creation path copy lines cleanly for a version?** Verify in Phase 0 that the existing creation RPC can produce a copy with `revised_from_id` set.
11. ~~Which notification store does the bell read?~~ **RESOLVED 2026-10-19 — build a proper new canonical `notifications` table.** H1 reframes this: the choice was never between two live stores, because `notifications` **does not exist in production**. The decision becomes *create* — one table, recipient keyed on `auth.uid()`, carrying `type/message/title/body/link/read_at/created_at`, with RLS for the recipient to SELECT **and** UPDATE (H2 is why the UPDATE policy is a requirement, not an afterthought), plus the `get/create/mark_read` RPCs whose signatures the undeployed helpers already describe. `approval_notifications` keeps its rows; Phase 3 decides between migrating them in or exposing a legacy union to the bell, and `warranty_notifications` (the third live store, found during this reconciliation) is out of scope but must not be given a fourth writer. The old "canonicalise on `notifications` because it has the larger consumer set" reasoning is void — its consumer set is zero deployed rows and zero deployed functions.

12. **Does the edit lock extend to `HOLD` and `FORWARDED` approval requests?** `20261019000005` blocks only `status = 'PENDING'`, deliberately: both live decision paths refuse to act on any other status (`approvals/api.ts:307`, `workflow-engine.ts:42`) and the one function that would accept `HOLD` has no call site, so a `HOLD`/`FORWARDED` request can only be resubmitted — blocking those states freezes the quotation with no way out, the same unreachable-state class as the reject bug fixed in 1a. Cost of the choice: a quotation whose request is parked on `HOLD` or `FORWARDED` is editable again, while `approvals.amount` still holds the figure captured at submission, so an approval can be decided against numbers that have since moved. Recommended: widen the blocked set **only in the change that gives the approvals engine a way to close a `HOLD`/`FORWARDED` request** (approve, reject or return from either state), so the lock never outruns the escape route.
13. **Is `Partially Converted` a quotation document status?** Found while writing the status CHECK, not while reading the spec: `useSaveInvoice.ts:285` writes it into `quotation_header.status` on every partial convert-to-invoice, next to `conversion_status` which already carries the same fact. §4.1 never enumerates it, so today it (a) has no edge in the Phase 1b graph on either side, meaning nothing can legally leave it and enforcement would reject every partial conversion, (b) is missing from `QUOTATION_FOLLOW_UP_STATUSES`, so a quote disappears from the Follow-up Center as soon as one line is invoiced, and (c) is invisible to `mapQuotationStatus` / `stageFromDocumentStatus`, which fall through to `pending` for it. `20261019000006` admits it so billing keeps working, and `quotation_header_status_inventory` will show how many rows are stranded there. Recommended: **stop writing it** — `status` is the client-facing document state and a billing event is not one; let `conversion_status` carry partial-ness, keep the document `Sent`/`Approved`, and add `Converted` only when every line is billed. Alternative if the team wants the badge: add it to §4.1 with edges `Sent → Partially Converted → Converted` and put it in the follow-up status list, which makes it a state the loop has to reason about rather than a hole.

---

## Appendix A — Phase 0 catalog queries (read-only, supplied by the verification session)

Run against the **deployed** database before any migration is written. They answer P0-2, P0-4 and the live notification shapes (both stores, F34), size the Q11 merge and the G4 rollout, and show whether the vocabulary migration is applied.

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid IN ('follow_up_quotation_tracking'::regclass,
                    'follow_up_activity_log'::regclass,
                    'quotation_header'::regclass);

SELECT count(*) FROM follow_up_activity_log WHERE event_type = 'quotation_status_changed';

SELECT tablename, policyname, cmd, qual FROM pg_policies
 WHERE tablename IN ('quotation_header','notifications');

SELECT column_name FROM information_schema.columns
 WHERE table_name = 'notifications' ORDER BY ordinal_position;
```

**Additional queries for the rest of Phase 0** (from the review of v3):

```sql
-- the other two tables Phase 0 needs
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid IN ('quotation_revisions'::regclass,'client_communication'::regclass);

SELECT column_name, is_nullable, column_default FROM information_schema.columns
 WHERE table_name='follow_up_quotation_tracking'
   AND column_name IN ('next_action_label','win_loss_reason_id','assignee_user_id','win_loss_notes');

-- is the vocabulary migration applied? (direct answer to P0-4)
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE name LIKE '%remediation%' ORDER BY version;

-- does the guard predicate v3 relies on have any grants at all? (F23)
SELECT p.action_key, count(rp.id) FROM permissions p
  LEFT JOIN role_permissions rp ON rp.permission_id=p.id
 WHERE p.resource='quotations' GROUP BY 1 ORDER BY 1;

-- how many rows would the CHECK reject, and what is the Pending Approval blast radius? (Q5)
SELECT status, count(*) FROM quotation_header GROUP BY status ORDER BY count(*) DESC;

-- approver id space (§6.3, Q9)
SELECT a.approver_id,
       (a.approver_id IN (SELECT id FROM employees))           AS in_employees,
       (a.approver_id IN (SELECT user_id FROM user_profiles))  AS in_user_profiles
  FROM approval_workflows a WHERE a.approval_type='QUOTATION' AND a.is_active;

-- the same question as a rate, which is what Q9 actually needs (G2):
-- how many approver ids resolve in exactly one of the two spaces?
SELECT count(*) FILTER (WHERE x.in_employees AND NOT x.in_user_profiles)      AS employees_only,
       count(*) FILTER (WHERE x.in_user_profiles AND NOT x.in_employees)      AS profiles_only,
       count(*) FILTER (WHERE x.in_employees AND x.in_user_profiles)          AS both,
       count(*) FILTER (WHERE NOT x.in_employees AND NOT x.in_user_profiles)  AS neither,
       count(*)                                                              AS total
  FROM (SELECT a.approver_id,
              (a.approver_id IN (SELECT id FROM employees))          AS in_employees,
              (a.approver_id IN (SELECT user_id FROM user_profiles)) AS in_user_profiles
         FROM approval_workflows a WHERE a.is_active) x;

-- the second notification store (F34, Q11): shape and volume, next to notifications
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name IN ('notifications','approval_notifications')
 ORDER BY table_name, ordinal_position;

SELECT 'notifications' AS store, count(*) AS rows, count(*) FILTER (WHERE read_at IS NULL) AS unread
  FROM notifications
UNION ALL
SELECT 'approval_notifications', count(*), count(*) FILTER (WHERE read_at IS NULL)
  FROM approval_notifications;

-- F33 blast radius (G4): quotations resting under approval whose header was touched
-- recently. Uses quotation_header.updated_at on purpose: quotation_items has created_at
-- only (F14) and rows are deleted/re-inserted on every save (F27), so item timestamps are
-- not a stable churn signal.
SELECT count(*) FROM quotation_header
 WHERE upper(status) IN ('PENDING_APPROVAL','PENDING APPROVAL')
   AND updated_at > now() - interval '30 days';
```

The approver-id queries are the highest-value additions: `employees_only` or `neither` above zero means the default routing in §7.1 is broken as described in §6.3 **and** that `getContact` is already dropping contacts silently (G2), and that is learned before any RPC is written. A reminder-upsert test (insert a `follow_up_quotation_tracking` row the way `recordQuotationReminder` does, without `next_action_label`) settles F31 without any schema dump.

How to read the results: a `follow_up_status` CHECK with only five values means the vocabulary migration is **not** applied (F30); a count of zero for `quotation_status_changed` alongside real status changes means audit rows are being dropped; a `USING (true)` policy on `quotation_header` confirms P0-2; the `notifications` columns say whether `escalate_urgent_communications()` (writes `body`/`link`) or the subcontractor bell RPCs (read `type`/`message`/`is_read`) are broken today; the two-store counts size the Q11 merge; and a non-zero F33 blast radius is a rollout communication, not a surprise (G4).