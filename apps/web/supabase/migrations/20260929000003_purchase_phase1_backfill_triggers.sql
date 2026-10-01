-- ============================================================================
-- Purchase Phase 1.3 — Backfill live-only purchase TRIGGERS
--
-- Drift evidence (PURCHASE-PHASE1-DRIFT-REPORT.md, 2026-09-29):
--   5 triggers exist in project rujqejtisqermjyqqgoj but appear in NO file
--   under supabase/migrations/. Without them a rebuild would have:
--     * purchase orders with no immutability protection (hard DELETE allowed
--       on approved/open/completed POs, financial fields editable on
--       finalized POs);
--     * requisitions and requisition lines with no updated_at maintenance;
--     * debit notes with no updated_at maintenance;
--     * material inward rows deletable regardless of status.
--
--   Their action functions are defined in 20260929000001. This file only
--   creates the bindings.
--
-- Capture method: event_object_table, trigger_name, action_timing,
-- event_manipulation and tgfoid taken from information_schema.triggers joined
-- to pg_trigger. Verified live 2026-09-29.
--
-- Idempotent: DROP TRIGGER IF EXISTS precedes every CREATE TRIGGER.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 3a. Purchase order immutability
--
-- Action function: fn_prevent_posted_purchase_order_mutation (20260929000001)
--
-- Blocks hard DELETE once status is approved/open/completed/partially
-- received/cancelled, and blocks direct edits to total_amount / vendor_id /
-- organisation_id on finalized POs.
--
-- NOTE (carried forward, Phase 3 / W3.7): the action function opens with a
-- bypass on current_setting('app.p0_test_running', true) and
-- current_setting('app.allow_purchase_order_mutation', true). Any role can
-- set_config() those names and disable this trigger for its session. The
-- RPCs set their own values with is_local = true, which is correct, but
-- nothing prevents an external caller from setting them first. Reproduced
-- as-is; the GUC removal is Phase 3 work.
--
-- NOTE: this trigger also makes useDeletePO's browser-side 5-table linkage
-- check (usePurchaseQueries.ts:543-560) partly redundant — the server already
-- refuses DELETE on non-draft POs. The two rules can disagree; consolidating
-- them is Phase 4 work.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_posted_purchase_order_mutation ON public.purchase_orders;

CREATE TRIGGER trg_prevent_posted_purchase_order_mutation
  BEFORE DELETE OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_posted_purchase_order_mutation();


-- ---------------------------------------------------------------------------
-- 3b. Requisition updated_at maintenance
--
-- Action function: set_updated_at_purchase_requisitions (20260929000001)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_purchase_requisitions_updated_at ON public.purchase_requisitions;

CREATE TRIGGER trg_purchase_requisitions_updated_at
  BEFORE UPDATE ON public.purchase_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_purchase_requisitions();


-- ---------------------------------------------------------------------------
-- 3c. Requisition line updated_at maintenance
--
-- Action function: set_updated_at_purchase_requisitions (20260929000001)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_purchase_requisition_lines_updated_at ON public.purchase_requisition_lines;

CREATE TRIGGER trg_purchase_requisition_lines_updated_at
  BEFORE UPDATE ON public.purchase_requisition_lines
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_purchase_requisitions();


-- ---------------------------------------------------------------------------
-- 3d. Debit note updated_at maintenance
--
-- Action function: fn_update_updated_at (20260929000001).
-- Note this function already exists elsewhere in the migration tree; only
-- this binding was missing.
--
-- IMPORTANT INTERACTION: fn_prevent_posted_dn_mutation (created in
-- 20260817000004) already protects total_amount / vendor_id /
-- organisation_id / dn_number on approved debit notes, and it does NOT
-- block updated_at. These two triggers coexist by design — this one stamps
-- the timestamp, that one guards the money.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_debit_notes_updated_at ON public.debit_notes;

CREATE TRIGGER trg_debit_notes_updated_at
  BEFORE UPDATE ON public.debit_notes
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_updated_at();


-- ---------------------------------------------------------------------------
-- 3e. Material inward deletion guard
--
-- Action function: fn_prevent_active_inward_deletion (20260929000001)
--
-- Only DRAFT material inward rows may be deleted; anything active, issued or
-- historic must be cancelled instead. Included because the trigger is
-- live-only and its action function is defined in 20260929000001 — without
-- both, the guard would not exist at all on a rebuild.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_active_inward_deletion ON public.material_inward;

CREATE TRIGGER trg_prevent_active_inward_deletion
  BEFORE DELETE ON public.material_inward
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_active_inward_deletion();
