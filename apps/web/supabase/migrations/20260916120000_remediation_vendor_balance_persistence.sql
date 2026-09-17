-- ============================================================================
-- REMEDIATION PHASE 1.1 — Vendor balance persistence
-- Live defect (verified 2026-09-16, project rujqejtisqermjyqqgoj):
--   recalc_vendor_balance(p_vendor_id, p_organisation_id) computes
--   v_balance and returns without persisting or returning it.
--   cancel_purchase_bill_atomic / cancel_vendor_payment_atomic and the web app
--   (usePurchaseQueries.updateVendorBalance) call it expecting persistence.
--   The stub trigger fn update_vendor_balance was never wired to any table.
--
-- Fix (forward-only, additive):
--   1. purchase_vendors.current_balance column
--   2. recalc_vendor_balance persists (UPDATE) and RETURNS numeric
--   3. AFTER triggers on purchase_bills / debit_notes / purchase_payments
--      re-sync the balance on every mutation path
--   4. one-time backfill for all vendors
--
-- Aggregates are copied verbatim from the deployed function body (2026-09-16)
-- to preserve the intended business semantics.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Persisted balance column
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_vendors
  ADD COLUMN IF NOT EXISTS current_balance numeric(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.purchase_vendors.current_balance IS
  'Server-maintained outstanding balance = opening_balance + approved bills - approved/posted debit notes - released/approved payments. Maintained by recalc_vendor_balance (trigger + RPC synced).';

-- ---------------------------------------------------------------------------
-- 2. recalc_vendor_balance: persist + return
--    (DROP/CREATE needed because Postgres cannot change a return type in-place)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.recalc_vendor_balance(uuid, uuid);

CREATE OR REPLACE FUNCTION public.recalc_vendor_balance(
  p_vendor_id       uuid,
  p_organisation_id uuid
)
RETURNS numeric(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_total_bills   numeric(15,2) := 0;
    v_total_debits  numeric(15,2) := 0;
    v_total_paid    numeric(15,2) := 0;
    v_opening_bal   numeric(15,2) := 0;
    v_balance       numeric(15,2) := 0;
BEGIN
    -- Tenant guard — semantics preserved from the deployed 2026-09-16 body:
    -- enforce membership only when a user JWT context exists; service-side
    -- contexts (backfill, cron, service_role) are trusted.
    IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
        RAISE EXCEPTION 'Unauthorized organization access';
    END IF;

    SELECT COALESCE(opening_balance, 0) INTO v_opening_bal
    FROM public.purchase_vendors
    WHERE id = p_vendor_id AND organisation_id = p_organisation_id;

    -- Sum approved bills (verbatim from deployed 2026-09-16 body)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_bills
    FROM public.purchase_bills
    WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id
      AND LOWER(COALESCE(approval_status, '')) NOT IN ('cancelled', 'draft');

    -- Sum approved debit notes (verbatim)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_debits
    FROM public.debit_notes
    WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id
      AND LOWER(COALESCE(approval_status, '')) IN ('approved', 'posted', 'final');

    -- Sum released payments (verbatim)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.purchase_payments
    WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id
      AND is_deleted = false
      AND (LOWER(COALESCE(workflow_step, '')) = 'released'
           OR LOWER(COALESCE(approval_status, '')) IN ('approved', 'released', 'posted', 'final'));

    v_balance := v_opening_bal + v_total_bills - v_total_debits - v_total_paid;

    -- THE FIX: persist the computed balance.
    UPDATE public.purchase_vendors
       SET current_balance = v_balance
     WHERE id = p_vendor_id
       AND organisation_id = p_organisation_id;

    RETURN v_balance;
END;
$fn$;

-- Restore execute grants for the surfaces that use it.
-- (Anon no longer executes financial mutations: fail-closed, Phase 4 direction.)
REVOKE EXECUTE ON FUNCTION public.recalc_vendor_balance(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_vendor_balance(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Sync triggers on the three source tables
--    (covers every write path: AP RPCs, approval flows, direct/legacy writes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trg_sync_vendor_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE
    v_vendor uuid;
    v_org    uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_vendor := OLD.vendor_id;
        v_org    := OLD.organisation_id;
    ELSE
        v_vendor := NEW.vendor_id;
        v_org    := NEW.organisation_id;
    END IF;

    IF v_vendor IS NULL OR v_org IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    BEGIN
        PERFORM public.recalc_vendor_balance(v_vendor, v_org);
    EXCEPTION WHEN OTHERS THEN
        -- Balance sync must never block the business mutation itself.
        RAISE WARNING 'vendor balance sync failed (% %): %', TG_OP, v_vendor, SQLERRM;
    END;

    RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_vendor_balance ON public.purchase_bills;
CREATE TRIGGER trg_sync_vendor_balance
AFTER INSERT OR UPDATE OF total_amount, approval_status, vendor_id, organisation_id OR DELETE
ON public.purchase_bills
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_vendor_balance();

DROP TRIGGER IF EXISTS trg_sync_vendor_balance ON public.debit_notes;
CREATE TRIGGER trg_sync_vendor_balance
AFTER INSERT OR UPDATE OF total_amount, approval_status, vendor_id, organisation_id OR DELETE
ON public.debit_notes
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_vendor_balance();

DROP TRIGGER IF EXISTS trg_sync_vendor_balance ON public.purchase_payments;
CREATE TRIGGER trg_sync_vendor_balance
AFTER INSERT OR UPDATE OF amount, approval_status, workflow_step, is_deleted, vendor_id, organisation_id OR DELETE
ON public.purchase_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_trg_sync_vendor_balance();

-- ---------------------------------------------------------------------------
-- 4. One-time backfill of every vendor balance
-- ---------------------------------------------------------------------------
DO $fn$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT id, organisation_id FROM public.purchase_vendors LOOP
        BEGIN
            PERFORM public.recalc_vendor_balance(r.id, r.organisation_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'backfill failed for vendor %: %', r.id, SQLERRM;
        END;
    END LOOP;
END;
$fn$;
