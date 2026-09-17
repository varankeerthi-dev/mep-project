-- ============================================================================
-- REMEDIATION PHASE 1.2 — Follow-up activity log + quotation tracking vocabulary
-- Live defects (verified 2026-09-16, project rujqejtisqermjyqqgoj):
--
--   1. follow_up_activity_log_event_type_check accepts only 6 event types,
--      but the application writes: quotation_status_changed (follow-up/api.ts:372),
--      procurement_reminder_sent (follow-up/api.ts:508), invoice_edited
--      (InvoiceEditorPage.tsx:1325), approval_status_changed (approvals/api.ts:393).
--      quotation_expired and invoice_finalized exist in the module vocabulary
--      (filters in ActivityLogDrawer.tsx) and are reserved for scheduled/done
--      transitions. The result: the activity write throws AFTER the tracking row
--      is already written (logActivity RPC → fallback insert → throw).
--
--   2. follow_up_activity_log_tab_source_check accepts only 4 tabs, but the
--      module writes tab_source='procurement' for the procurement tab
--      (recordProcurementReminder). 'lead' is reserved for the lead overlay tab.
--
--   3. follow_up_quotation_tracking_follow_up_status_check accepts only 5
--      statuses, but the module's transition graph (lib/followup/quotation-workflow.ts)
--      writes approved / expired / cancelled / on_hold. The live partial index
--      idx_follow_up_quotation_next_action already anticipates approved /
--      cancelled / expired — the constraint was authored before the workflow
--      and never migrated. Widening aligns the constraint with the shipped,
--      user-visible transition graph (no business semantics changed).
--
--   4. follow_up_log_activity is currently executable by `anon`. The function
--      is SECURITY DEFINER and writes to the activity log; it must require an
--      authenticated session (fail closed). It already guards with
--      user_can_access_org internally.
--
-- Forward-only, idempotent (checks replaced by fixed name = same names).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. event_type: full module vocabulary (types/followup.ts ActivityEventType)
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log
  DROP CONSTRAINT IF EXISTS follow_up_activity_log_event_type_check;

ALTER TABLE public.follow_up_activity_log
  ADD CONSTRAINT follow_up_activity_log_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'quotation_reminder_sent'::text,
    'quotation_response_logged'::text,
    'quotation_status_changed'::text,
    'quotation_expired'::text,
    'podc_pack_shared'::text,
    'podc_issue_flagged'::text,
    'invoice_reminder_sent'::text,
    'invoice_escalation_changed'::text,
    'invoice_edited'::text,
    'invoice_finalized'::text,
    'approval_status_changed'::text,
    'procurement_reminder_sent'::text
  ]));

-- ---------------------------------------------------------------------------
-- 2. tab_source: module tabs (types/followup.ts FollowUpTab)
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log
  DROP CONSTRAINT IF EXISTS follow_up_activity_log_tab_source_check;

ALTER TABLE public.follow_up_activity_log
  ADD CONSTRAINT follow_up_activity_log_tab_source_check
  CHECK (tab_source = ANY (ARRAY[
    'quotation'::text,
    'podc'::text,
    'invoice'::text,
    'procurement'::text,
    'lead'::text,
    'activity'::text
  ]));

-- ---------------------------------------------------------------------------
-- 3. quotation tracking status: module transition graph
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_quotation_tracking
  DROP CONSTRAINT IF EXISTS follow_up_quotation_tracking_follow_up_status_check;

ALTER TABLE public.follow_up_quotation_tracking
  ADD CONSTRAINT follow_up_quotation_tracking_follow_up_status_check
  CHECK (follow_up_status = ANY (ARRAY[
    'sent'::text,
    'under_review'::text,
    'in_negotiation'::text,
    'pending'::text,
    'approved'::text,
    'expired'::text,
    'cancelled'::text,
    'on_hold'::text,
    'lost_to_competitor'::text
  ]));

-- ---------------------------------------------------------------------------
-- 4. follow_up_log_activity: fail closed for anon
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.follow_up_log_activity(
  uuid, text, text, text, text, uuid, text, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_log_activity(
  uuid, text, text, text, text, uuid, text, jsonb, text
) TO authenticated, service_role;
