# Communication Log PRD

## 1) Objective

Upgrade the manual CRUD communication log into an operational tool that the team actually uses daily — by fixing the cheap gaps first and setting the schema up for real integrations later.

Current state: a flat log where users manually type what happened.
Target state: a tracked, routed, exportable interaction record with thread support and attachments.

## 2) Scope

### In scope (Tier 1 — this week)

| # | Feature | Effort |
|---|---------|--------|
| 1 | **Clickable linked records** — `linked_type`/`linked_id` already exist in DB. Resolve them to actual `<Link>` components instead of plain text. | ~2h |
| 2 | **Assignment/ownership** — add `assigned_to` column, surface in table rows, filter, and sidebar. | ~3h |
| 3 | **CSV export** — client-side button that serialises the current (filtered) communications array to CSV. | ~1h |
| 4 | **SMS log type** — one entry in `CALL_CATEGORIES` constant. | ~5min |
| 5 | **Issue → Site Visit flow** — when Regarding=Issue, show a "Require site visit" radio toggle. If Yes, collect a date and auto-create a site visit record tagged `[Issue]` on submit. | ~2h |

### In scope (Tier 2 — next sprint)

| # | Feature | Effort |
|---|---------|--------|
| 6 | **Multi-reply thread** — `parent_communication_id` column + recursive query + threaded UI in conversation sidebar. | ~1-2d |
| 7 | **Attachment support** — Supabase Storage bucket + upload widget on create/edit + thumbnail/preview. | ~1d |
| 8 | **SLA/escalation** — cron or edge function that scans open Urgent communications past due and notifies the assignee. | ~2d |

### Out of scope (Tier 3 — future)

- Gmail/Outlook email sync (OAuth, polling, thread matching)
- WhatsApp Business API integration (Meta approval, template messages, per-message cost)
- Twilio/Exotel voice recording (compliance, storage)
- Email-forward auto-logging (inbound address + parser)

## 3) Design Principles

1. **No new infra for Tier 1.** Everything uses existing tables, storage, and client-side capabilities.
2. **Additive schema changes.** `assigned_to` and `parent_communication_id` are nullable columns — existing rows unchanged.
3. **Linked records resolved via a server-side join in the existing communications query.** Add the linked entity name/number to the existing `.select()` (same pattern as client/vendor/subcontractor/lead joins), keyed off `linked_type`/`linked_id`. No separate client-side resolver — the display label arrives pre-resolved from the API.
4. **Export respects current filters.** What you see is what you get in the CSV. All text fields properly escaped.
5. **Thread model first, UI second.** Get the `parent_communication_id` schema right before building the nested UI.

## 4) Users

- **Site Engineer** — logs calls/whatsapp with vendors and subcontractors; needs to attach photos of defects.
- **Project Manager** — owns follow-ups; needs to see who is assigned what by when.
- **Admin / Accountant** — needs CSV export for audit and reconciliation.
- **Client / Vendor** — indirect; linked records let them see communication context when viewing a quotation or invoice.

## 5) Functional Requirements

### FR1 — Clickable Linked Records

- The table column "Regarding / Topic" currently shows plain text like "Regarding: QTN-024 (Client Name)".
- The existing code already maps `linked_type` values to `call_regarding`: `quotation` → quotations, `invoice` → invoices, `podc` → project (the code sets `call_regarding: 'project'` for `podc`). This means the route for `podc` should be `/projects/{linked_id}`.
- Route map:
  - `quotation` → `/quotations/{linked_id}`
  - `invoice` → `/invoices/{linked_id}` or route matching the app's `InvoiceDetail` path
  - `podc` → `/projects/{linked_id}` (maps to project detail, consistent with existing code)
  - `site_visit` → `/site-visits/{linked_id}`
- If `linked_id` is empty, fall back to plain text.
- The linked record label (quotation number, invoice number, project name) should be fetched in the existing communications query via a join, not resolved N+1 client-side.

### FR2 — Assignment / Ownership

- Add `assigned_to` UUID column to `client_communication` table referencing `user_profiles(user_id)` — same FK convention as `call_received_by` and `call_entered_by` already in the table.
- Add "Assignee" column to the table (between Status and Priority).
- Add "Assignee" filter to the advanced filters panel.
- In the follow-up sidebar card, show assignee name below the party name.
- Default to the creating user on new communication (consistent with `call_entered_by` defaulting to `user?.id`). No "default to org admin" — if unassigned, it stays null, and the SLA runner (FR8) handles escalation for unowned items.

### FR3 — CSV Export

- Button in the table header bar: "Export CSV".
- Serialises the currently filtered `communications` array.
- Columns: Time, Date, Party, Party Type, Subject, Brief, Type, Regarding, Next Action, Status, Priority, Follow-Up Date, Assignee.
- **Must escape commas, quotes, and newlines** in `call_brief` and `next_action` fields — wrap in double quotes and escape inner quotes as `""`, not a naive `.join(','')`.
- Include linked record URLs as a separate column so the exported file is navigable.
- Uses `Blob` + download link — no server call.

### FR4 — SMS Log Type

- Add `{ value: 'sms', label: 'SMS' }` to `CALL_CATEGORIES`.
- Map in `TYPE_DISPLAY` with appropriate icon/color.

### FR5 — Issue → Site Visit Flow

- When `call_regarding === 'issue'` in the create modal, render a conditional section below Next Action.
- Show a radio toggle: "Require site visit?" with Yes/No options.
- If Yes, show a required date input for the site visit date.
- **On submit:** if toggle is Yes and date is set, first insert a row into `site_visits`:
  - `client_id` → from the communication's party selection
  - `visit_date` → from the date input
  - `purpose` → `"[Issue] {subject or 'Issue follow-up'} — {call_brief preview}"`
  - `notes` → includes the full call brief and next action
  - `organisation_id` → from current org
- Use the returned `site_visit_id` in the `client_communication` insert.
- The site visit is bracketed `[Issue]` in its purpose field so it's traceable back to origin.
- Reset the toggle and date when Changing Regarding away from `issue` or closing the modal.

### FR6 — Multi-Reply Thread

- Add `parent_communication_id UUID REFERENCES client_communication(id) ON DELETE SET NULL` column.
- **Cycle protection:** validate on insert/update that `parent_communication_id`:
  - Is not the same as `id` (no self-reference).
  - Is not a descendant of the new row (no A→B→A cycles). Check by walking up the parent chain before saving. Client-side guard is sufficient for the UI; add a DB trigger for safety.
- **Same-party constraint:** parent and child must share the same `party_type` and `party_id` (e.g. same `client_id`). Enforce in the mutation function.
- In the party conversation sidebar, group communications by `parent_communication_id` into a visual thread (nested cards, connector lines, indentation per depth level).
- Create modal: add optional "In reply to" dropdown showing recent (last 20) communications with that party.
- Render thread depth visually up to 3 levels, then flatten to "Show N more replies".

### FR7 — Attachment Support

- Create Supabase Storage bucket `communication-attachments` (private bucket — not public).
- **Storage path:** `{organisation_id}/{communication_id}/{filename}` — this enforces org-level isolation so org A cannot access org B's attachments.
- **Storage RLS:** policy checks the requesting user's organisation membership via `org_members` table — same pattern as every other table in the app.
- Add `attachments` JSONB column to `client_communication` (array of `{ name, url, type, size }`).
- Upload widget in create/edit modal (accepts images, PDFs, docs; max 10MB per file).
- Show first attachment as a small thumbnail in the table row; full gallery in the detail/sidebar view.
- **On communication delete: explicitly delete storage files in the delete mutation.** Supabase Storage objects are not Postgres rows — there is no DB-level cascade. The delete mutation must call `supabase.storage.from('communication-attachments').list(orgId + '/' + commId)` then `.remove(paths)` before deleting the DB row. Otherwise orphaned files accumulate.

### FR8 — SLA / Escalation

- Supabase cron job (pg_cron or Edge Function) every 15 minutes.
- Queries `client_communication` where `priority = 'Urgent'` and `status = 'Open'` AND:
  - **If `follow_up_date` is set:** `follow_up_date < now()` (past due).
  - **If `follow_up_date` is null:** `created_at < now() - interval '4 hours'` (stale urgent).
  - Escalates to `org_admin` role if `assigned_to` is null or the item remains past due for > 24 hours.
- Sends in-app notification (via existing notification mechanism or a simple `notifications` table).

## 6) Schema Changes

```sql
-- FR2: Assignment (matches existing call_received_by / call_entered_by FK convention)
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(user_id);

-- FR5: Threading with cycle safety
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS parent_communication_id UUID REFERENCES client_communication(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comm_parent ON client_communication(parent_communication_id);

-- Prevent self-reference at DB level (cycle prevention is handled in app + trigger)
CREATE OR REPLACE FUNCTION check_comm_parent_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_communication_id = NEW.id THEN
    RAISE EXCEPTION 'Communication cannot be its own parent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comm_no_self_parent
  BEFORE INSERT OR UPDATE ON client_communication
  FOR EACH ROW
  WHEN (NEW.parent_communication_id IS NOT NULL)
  EXECUTE FUNCTION check_comm_parent_cycle();

-- FR6: Attachments
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
```

## 7) UI Mockups (Text)

### Table column order (updated)

```
Time | Party | Subject / Topic | Type | Next Action | Status | Priority | Assignee | Follow Up | Actions
```

### Linked record rendering

- `quotation` → `<Link to="/quotations/QTN-024">QTN-024</Link>` (blue, underlined)
- `invoice` → `<Link to="/invoices/INV-001">INV-001</Link>`
- `podc` → `<Link to="/projects/{id}">{project_name}</Link>`
- `site_visit` → `<Link to="/site-visits/{id}">Site Visit {date}</Link>`
- Unlinked entries stay as plain text.

### Conversation thread (sidebar)

```
[Timeline dot] ─── 10:30 AM Today ─── Email ───
───────────────────────────────────────────────
[Thread parent]
  Subject: RE: Site access delay
  Brief: Confirmed access from Monday

  [Reply #1] ─── 11:15 AM today ───
    Brief: Client pushed to Tuesday

    [Reply #2] ─── 2:00 PM today ───  depth 3 → flattened
      Show 2 more replies...
```

## 8) Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Communications with linked records | ~0% (all plain text) | >50% within 2 weeks |
| Communications with assignee set | 0% | >80% within 1 week |
| Time to find a specific communication | 2-5 min (scroll + search) | <30s (filter + click) |
| CSV export usage | N/A | Used at least once per week by admin |
| SMS as logged type | N/A | >10% of new comms within 1 month |

## 9) Migration / Rollout

1. Run schema SQL (adds columns, no downtime).
2. Ship Tier 1 features in one deploy (FR1-FR4).
3. Collect usage data for 1 sprint.
4. Ship Tier 2 (FR6-FR8) based on adoption signal.
5. Tier 3 evaluated after 2 months of sustained daily use.

## 10) Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Default assignee? | Creating user (matches `call_entered_by`). Null is fine — FR8 escalates unassigned urgent items. |
| Thread depth limit? | 3 visual levels, then "Show N more replies" flatten. |
| Attachment file size? | 10MB per file. |
| CSV include URLs? | Yes — separate column with linked record paths. |
| podc route? | `/projects/{linked_id}` — the existing code maps podc to `call_regarding: 'project'`. |
| FK convention? | `REFERENCES user_profiles(user_id)` — same as `call_received_by` and `call_entered_by`. |
| Thread ON DELETE? | `SET NULL` — deleting a parent orphans children so they remain accessible, just ungrouped. Cycle prevention via app + trigger. |
