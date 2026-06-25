# Follow-Up Centre — Supabase Setup

## 1. Run the migration

In **Supabase Dashboard → SQL Editor**, open and execute the full script:

**File:** `supabase/migrations/051_follow_up_centre.sql`

Or copy from `src/database-follow-up-centre.sql` (same content).

Then run the assignee migration:

**File:** `supabase/migrations/052_follow_up_assignee.sql`

Adds `assignee_user_id` on quotation, PO/DC, and invoice tracking (who owns follow-up).

This creates:

| Table | Purpose |
|-------|---------|
| `follow_up_activity_log` | Unified audit trail |
| `follow_up_quotation_tracking` | Per-quote follow-up status & reminders |
| `follow_up_podc_backlog` | PO pending after DC/work |
| `follow_up_invoice_tracking` | Invoice reminder & risk overlay |

Also adds:

- RLS policies (`user_can_access_org`)
- Permissions: `follow_up.read`, `follow_up.manage`
- RPC: `follow_up_log_activity()`
- Optional backfill of PODC backlog from `delivery_challans`

## 2. Verify

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'follow_up_%';
```

Expected: 4 tables.

## 3. App behaviour

- After migration, reload **Follow-Up Centre** (`/follow-up`).
- Data loads from:
  - **Quotations:** `quotation_header` (Sent / Under Negotiation / …) + tracking
  - **PO/DC:** `follow_up_podc_backlog` (+ backfill from DCs)
  - **Invoices:** `invoices` where `status = 'final'` and balance &gt; 0
  - **Activity:** `follow_up_activity_log`

If tables are missing, the UI shows a **Demo data** banner and uses mock data until SQL is applied.

## 4. Optional env

```env
# Force mock data (development only)
VITE_FOLLOWUP_USE_MOCK=true
```

## 5. RBAC (app)

Write actions (remind, log response, flag issue) require org role: **admin**, **owner**, or **manager**. Other roles get read-only UI.

Assign `follow_up.manage` to roles in Access Control when fine-grained RBAC is enabled.

## 6. Adjust DC backfill

Section 9 of the migration backfills PODC rows for DCs with status in  
`delivered`, `completed`, `signed`, `final`. Edit that list to match your workflow.
