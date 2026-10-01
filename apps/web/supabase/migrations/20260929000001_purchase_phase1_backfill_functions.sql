-- ============================================================================
-- Purchase Phase 1.1 — Backfill live-only purchase FUNCTIONS
--
-- Purpose: make the repository reproduce the live database.
--
-- Drift evidence (PURCHASE-PHASE1-DRIFT-REPORT.md, 2026-09-29):
--   24 functions exist in project rujqejtisqermjyqqgoj but appear in NO file
--   under supabase/migrations/ and NO file under src/*.sql. A rebuild from the
--   repository therefore produces a database without them, and without them
--   the Purchase module has no atomic PO create/approve/cancel, no debit-note
--   stock movement, no requisition approval chain, and no goods receipt.
--
-- Faithfulness rule:
--   Bodies below are captured VERBATIM from the live catalog
--   (pg_get_functiondef, pulled 2026-10-01), including security posture
--   (SECURITY DEFINER, search_path, row_security) and parameter defaults.
--   This is deliberate. Phase 1 reproduces live state so that the Phase 1.9
--   scratch-rebuild parity diff is meaningful. Defects found in these bodies
--   are recorded in the drift report and fixed in separate, clearly-labelled
--   migrations — NOT silently corrected here.
--
--   Known carried-forward defect:
--     verify_purchase_bill_3way references v_po.grand_total, which does not
--     exist on public.purchase_orders (the column is total_amount). v_po is a
--     RECORD, so this compiles and fails at runtime:
--       ERROR: record "v_po" has no field "grand_total"
--     Verified empirically 2026-09-29. See PURCHASE-PHASE1-DRIFT-REPORT.md §4.
--
-- Idempotency note (42P13 fix, 2026-10-01):
--   CREATE OR REPLACE cannot add, remove, or rename parameters, nor remove
--   parameter defaults. The signatures below therefore carry the live defaults
--   verbatim (e.g. p_items jsonb DEFAULT NULL::jsonb); an earlier revision of
--   this file omitted them and failed with
--     ERROR 42P13: cannot remove parameter defaults from existing function.
--   OR REPLACE (not DROP+CREATE) is used throughout so trigger bindings and
--   any other dependents survive the migration. The sole exception is the
--   generate_po_number(uuid, integer) DROP, which is DROP IF EXISTS and has no
--   recorded callers.
--
-- Forward-only. This migration performs no DDL on tables and no data changes.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1a. Shared prerequisite — generic updated_at helper
--
-- Backs trg_debit_notes_updated_at (bound in 1c). The function itself IS
-- present in the migration tree elsewhere; only the purchase trigger binding
-- was missing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1b. Requisition updated_at helper
--
-- Backs trg_purchase_requisitions_updated_at and
-- trg_purchase_requisition_lines_updated_at (bound in 1c).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_purchase_requisitions()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 1c. Purchase-order immutability trigger function
--
-- Backs trg_prevent_posted_purchase_order_mutation.
--
-- CARRIED-FORWARD DEFECT: every function in this immutability family opens
-- with a bypass on a caller-settable session GUC:
--     current_setting('app.p0_test_running', true) = 'true'
-- Any role may set_config() that name and disable the guard for its session.
-- Recorded for Phase 3 (W3.7). Not corrected here — this file reproduces live.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_purchase_order_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF current_setting('app.allow_purchase_order_mutation', true) = 'true'
     OR current_setting('app.p0_test_running', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'open', 'completed', 'partially received', 'cancelled') THEN
      RAISE EXCEPTION 'Hard deletion of Purchase Order % is prohibited. Use cancel_purchase_order_atomic() instead.', OLD.po_number;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(OLD.status, '')) NOT IN ('draft', 'pending') THEN
      IF NEW.total_amount != OLD.total_amount OR NEW.vendor_id != OLD.vendor_id OR NEW.organisation_id != OLD.organisation_id THEN
        RAISE EXCEPTION 'Direct modification of financial fields on finalized Purchase Order % is prohibited.', OLD.po_number;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1d. Material-inward deletion guard
--
-- Backs trg_prevent_active_inward_deletion. Included because the trigger is
-- live-only and this is its action function.
--
-- Same app.p0_test_running bypass as 1c — carried forward, recorded for W3.7.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_active_inward_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF current_setting('app.p0_test_running', true) = 'true' THEN
    RETURN OLD;
  END IF;

  IF UPPER(COALESCE(OLD.status, 'ACTIVE')) != 'DRAFT' THEN
    RAISE EXCEPTION 'Cannot delete Material Inward % with status "%". Active, issued, or historic Material Inwards must not be deleted. Must use cancellation.', COALESCE(OLD.inward_number, OLD.invoice_no, OLD.id::TEXT), OLD.status;
  END IF;
  RETURN OLD;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1e. generate_po_number — overload A (retained)
--
-- Two live overloads existed; this file captures overload A only. Overload B
-- is intentionally NOT recreated — see 1e-bis for the rationale.
--
-- Overload A is the one invoked by create_purchase_order_atomic (1f) and is
-- the only one referenced anywhere.
--
-- CARRIED-FORWARD LIMITATION: COUNT(*)+1 is not concurrency-safe. A collision
-- is caught by idx_purchase_orders_org_po_number and retried by the caller's
-- unique_violation handler, so it surfaces as an error rather than silent
-- corruption. Recorded for Phase 3.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.generate_po_number(uuid, integer);

CREATE OR REPLACE FUNCTION public.generate_po_number(p_organisation_id uuid)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_count INT;
  v_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.purchase_orders
  WHERE organisation_id = p_organisation_id;

  v_num := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_num;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1e-bis. generate_po_number — overload B (dropped, rationale)
--
-- Live signature: generate_po_number(p_org_id uuid, p_year integer)
-- Live body counted POs per calendar year; returned 'PO-<year>-<count>'.
-- Live posture: SECURITY DEFINER false, no SET search_path.
--
-- Dropped because: nothing in apps/web/src or supabase/migrations/ references
-- it, and create_purchase_order_atomic calls overload A. Reproducing it would
-- reintroduce an unreferenced function with weaker security posture than the
-- one retained.
--
-- NOTE: the DROP above is DROP IF EXISTS without CASCADE. If any environment
-- outside this repository calls generate_po_number(uuid, integer), that call
-- will break — and if anything depends on it, the DROP itself will fail loudly
-- rather than cascade silently. No such caller was found in this repository.
-- Recorded here so the decision is visible rather than silent.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1f. create_purchase_order_atomic
--
-- The server-side PO create the frontend does not currently call. Recomputes
-- every line server-side, derives intra/inter-state GST from
-- organisations.state vs purchase_vendors.state, delegates numbering to
-- generate_po_number, writes created_by = auth.uid(), and honours
-- p_idempotency_key with unique_violation replay.
--
-- CARRIED-FORWARD OBSERVATIONS (not corrected here):
--   * Auto-approves: writes approval_status='Approved', status='Open'.
--   * Line math uses discount_amount only; discount_percent is stored, never
--     applied. A caller sending percent-only gets an undiscounted line.
--   * Quantity AND rate must each be > 0; a zero-rate line is rejected.
--   * The item recordset carries NO variant_id and NO discount_category_id.
--     Those arrive with 20260929000004 (record_purchase_order), which is why
--     the V2 editor must not call this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_purchase_order_atomic(p_organisation_id uuid, p_vendor_id uuid, p_po_date date DEFAULT CURRENT_DATE, p_delivery_date date DEFAULT NULL::date, p_reference_no text DEFAULT NULL::text, p_terms_conditions text DEFAULT NULL::text, p_internal_notes text DEFAULT NULL::text, p_delivery_location text DEFAULT NULL::text, p_currency text DEFAULT 'INR'::text, p_exchange_rate numeric DEFAULT 1.0, p_project_id uuid DEFAULT NULL::uuid, p_items jsonb DEFAULT '[]'::jsonb, p_idempotency_key text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_vendor RECORD;
  v_existing_po RECORD;
  v_effective_idempotency_key TEXT;
  v_po_id UUID;
  v_po_number TEXT;
  v_item RECORD;
  v_line_qty NUMERIC(15,3);
  v_line_rate NUMERIC(15,2);
  v_line_discount NUMERIC(15,2);
  v_line_tax_pct NUMERIC(5,2);
  v_line_taxable NUMERIC(15,2);
  v_line_cgst NUMERIC(15,2) := 0;
  v_line_sgst NUMERIC(15,2) := 0;
  v_line_igst NUMERIC(15,2) := 0;
  v_line_total NUMERIC(15,2);

  v_subtotal NUMERIC(15,2) := 0;
  v_total_discount NUMERIC(15,2) := 0;
  v_total_taxable NUMERIC(15,2) := 0;
  v_total_cgst NUMERIC(15,2) := 0;
  v_total_sgst NUMERIC(15,2) := 0;
  v_total_igst NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  v_grand_total_inr NUMERIC(15,2) := 0;

  v_is_intrastate BOOLEAN := TRUE;
  v_org_state TEXT;
  v_vendor_state TEXT;
  v_sr INT := 1;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor ID is required';
  END IF;

  SELECT * INTO v_vendor
  FROM public.purchase_vendors
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;

  IF v_vendor.id IS NULL THEN
    RAISE EXCEPTION 'Vendor not found or does not belong to organization';
  END IF;

  v_effective_idempotency_key := NULLIF(TRIM(p_idempotency_key), '');
  IF v_effective_idempotency_key IS NOT NULL THEN
    SELECT id, po_number, total_amount, status INTO v_existing_po
    FROM public.purchase_orders
    WHERE organisation_id = p_organisation_id
      AND idempotency_key = v_effective_idempotency_key
      AND status != 'Cancelled'
    LIMIT 1;

    IF v_existing_po.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'po_id', v_existing_po.id,
        'po_number', v_existing_po.po_number,
        'total_amount', v_existing_po.total_amount,
        'doc_status', v_existing_po.status,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Purchase order must contain at least one line item';
  END IF;

  -- GST Jurisdiction
  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  v_vendor_state := v_vendor.state;
  IF v_org_state IS NOT NULL AND v_vendor_state IS NOT NULL AND LOWER(TRIM(v_org_state)) != LOWER(TRIM(v_vendor_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_id uuid, item_code text, item_name text, description text, hsn_code text,
    quantity numeric, unit text, rate numeric, discount_amount numeric, discount_percent numeric,
    tax_percent numeric, make text, variant text, requisition_line_id uuid, inquiry_line_id uuid, notes text
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_discount := COALESCE(v_item.discount_amount, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);

    IF v_line_qty <= 0 OR v_line_rate <= 0 THEN
      RAISE EXCEPTION 'Line item quantity and rate must be greater than zero (Item: %)', COALESCE(v_item.item_name, 'Unknown');
    END IF;

    v_line_taxable := ROUND((v_line_qty * v_line_rate) - v_line_discount, 2);
    IF v_line_taxable < 0 THEN
      RAISE EXCEPTION 'Line item discount cannot exceed gross amount';
    END IF;

    IF v_is_intrastate THEN
      v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_igst := 0;
    ELSE
      v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
      v_line_cgst := 0;
      v_line_sgst := 0;
    END IF;

    v_line_total := v_line_taxable + v_line_cgst + v_line_sgst + v_line_igst;

    v_subtotal := v_subtotal + ROUND(v_line_qty * v_line_rate, 2);
    v_total_discount := v_total_discount + v_line_discount;
    v_total_taxable := v_total_taxable + v_line_taxable;
    v_total_cgst := v_total_cgst + v_line_cgst;
    v_total_sgst := v_total_sgst + v_line_sgst;
    v_total_igst := v_total_igst + v_line_igst;
  END LOOP;

  v_grand_total := v_total_taxable + v_total_cgst + v_total_sgst + v_total_igst;
  v_grand_total_inr := ROUND(v_grand_total * COALESCE(p_exchange_rate, 1.0), 2);

  v_po_number := public.generate_po_number(p_organisation_id);

  PERFORM set_config('app.allow_purchase_order_mutation', 'true', true);

  BEGIN
    INSERT INTO public.purchase_orders (
      organisation_id, vendor_id, po_number, po_date, delivery_date,
      reference_no, terms_conditions, internal_notes, delivery_location,
      currency, exchange_rate, project_id, subtotal, discount_amount,
      taxable_amount, cgst_amount, sgst_amount, igst_amount,
      total_amount, total_amount_inr, approval_status, status,
      idempotency_key, created_by, created_at
    ) VALUES (
      p_organisation_id, p_vendor_id, v_po_number, COALESCE(p_po_date, CURRENT_DATE), p_delivery_date,
      p_reference_no, p_terms_conditions, p_internal_notes, p_delivery_location,
      COALESCE(p_currency, 'INR'), COALESCE(p_exchange_rate, 1.0), p_project_id,
      v_subtotal, v_total_discount, v_total_taxable, v_total_cgst, v_total_sgst, v_total_igst,
      v_grand_total, v_grand_total_inr, 'Approved', 'Open',
      v_effective_idempotency_key, auth.uid(), NOW()
    ) RETURNING id INTO v_po_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_effective_idempotency_key IS NOT NULL THEN
      SELECT id, po_number, total_amount, status INTO v_existing_po
      FROM public.purchase_orders
      WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_idempotency_key;

      IF v_existing_po.id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'status', 'success',
          'po_id', v_existing_po.id,
          'po_number', v_existing_po.po_number,
          'total_amount', v_existing_po.total_amount,
          'doc_status', v_existing_po.status,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_id uuid, item_code text, item_name text, description text, hsn_code text,
    quantity numeric, unit text, rate numeric, discount_amount numeric, discount_percent numeric,
    tax_percent numeric, make text, variant text, requisition_line_id uuid, inquiry_line_id uuid, notes text
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_discount := COALESCE(v_item.discount_amount, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);
    v_line_taxable := ROUND((v_line_qty * v_line_rate) - v_line_discount, 2);

    IF v_is_intrastate THEN
      v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_igst := 0;
    ELSE
      v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
      v_line_cgst := 0;
      v_line_sgst := 0;
    END IF;
    v_line_total := v_line_taxable + v_line_cgst + v_line_sgst + v_line_igst;

    INSERT INTO public.purchase_order_items (
      organisation_id, po_id, sr, item_id, item_code, item_name, description, hsn_code,
      quantity, unit, rate, discount_percent, discount_amount, taxable_value,
      cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount,
      total_amount, total_amount_inr, received_qty, balance_qty, make, variant,
      requisition_line_id, inquiry_line_id, notes
    ) VALUES (
      p_organisation_id, v_po_id, v_sr, v_item.item_id, v_item.item_code, COALESCE(v_item.item_name, 'Item'),
      v_item.description, v_item.hsn_code, v_line_qty, COALESCE(v_item.unit, 'Nos'),
      v_line_rate, COALESCE(v_item.discount_percent, 0), v_line_discount, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total, ROUND(v_line_total * COALESCE(p_exchange_rate, 1.0), 2),
      0, v_line_qty, v_item.make, v_item.variant,
      v_item.requisition_line_id, v_item.inquiry_line_id, v_item.notes
    );
    v_sr := v_sr + 1;
  END LOOP;

  PERFORM set_config('app.allow_purchase_order_mutation', 'false', true);

  RETURN jsonb_build_object(
    'status', 'success',
    'po_id', v_po_id,
    'po_number', v_po_number,
    'total_amount', v_grand_total,
    'doc_status', 'Open',
    'idempotent_replayed', false
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1g. approve_purchase_order_atomic
--
-- NOTE (carried forward): writes approval_status='Approved' and Draft->Open,
-- but performs NO maker-checker. auth.uid() is not compared against
-- created_by, and no threshold is consulted. Recorded for Phase 3 (W3.2).
--
-- Live detail worth knowing: when the PO is a Draft, status becomes 'Open'
-- (not 'Approved'); any other status is left untouched while approval_status
-- still flips to 'Approved'. Already-approved returns idempotent success.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_purchase_order_atomic(p_po_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_po RECORD;
BEGIN
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF v_po.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(v_po.organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF LOWER(COALESCE(v_po.approval_status, '')) = 'approved' THEN
    RETURN jsonb_build_object('status', 'success', 'already_approved', true, 'po_id', p_po_id);
  END IF;

  PERFORM set_config('app.allow_purchase_order_mutation', 'true', true);

  UPDATE public.purchase_orders
  SET approval_status = 'Approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      status = CASE WHEN status = 'Draft' THEN 'Open' ELSE status END,
      updated_at = NOW()
  WHERE id = p_po_id;

  PERFORM set_config('app.allow_purchase_order_mutation', 'false', true);

  RETURN jsonb_build_object('status', 'success', 'po_id', p_po_id, 'doc_status', 'Approved');
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1h. cancel_purchase_order_atomic
--
-- Enforces the two invariants the browser-side linkage check duplicates:
-- no received quantity and no active bills. Idempotent on already-cancelled.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_purchase_order_atomic(p_po_id uuid, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_po RECORD;
  v_total_received NUMERIC := 0;
  v_active_bills NUMERIC := 0;
BEGIN
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF v_po.id IS NULL THEN RAISE EXCEPTION 'Purchase order not found'; END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(v_po.organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF LOWER(COALESCE(v_po.status, '')) = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'success', 'already_cancelled', true, 'po_id', p_po_id, 'po_number', v_po.po_number);
  END IF;

  -- Check if received quantity > 0
  SELECT COALESCE(SUM(received_qty), 0) INTO v_total_received
  FROM public.purchase_order_items
  WHERE po_id = p_po_id;

  IF v_total_received > 0 THEN
    RAISE EXCEPTION 'Cannot cancel Purchase Order % with received goods (Received Qty: %). Cancel GRNs/Inward receipts first.',
      v_po.po_number, v_total_received;
  END IF;

  -- Check if active bills exist
  SELECT COUNT(*) INTO v_active_bills
  FROM public.purchase_bills
  WHERE po_id = p_po_id AND LOWER(COALESCE(approval_status, '')) NOT IN ('cancelled', 'rejected');

  IF v_active_bills > 0 THEN
    RAISE EXCEPTION 'Cannot cancel Purchase Order % with active purchase bills. Cancel associated bills first.',
      v_po.po_number;
  END IF;

  PERFORM set_config('app.allow_purchase_order_mutation', 'true', true);

  UPDATE public.purchase_orders
  SET status = 'Cancelled',
      approval_status = 'Cancelled',
      internal_notes = COALESCE(internal_notes || ' | ', '') || 'Cancelled: ' || COALESCE(p_reason, 'No reason provided'),
      updated_at = NOW()
  WHERE id = p_po_id;

  PERFORM set_config('app.allow_purchase_order_mutation', 'false', true);

  RETURN jsonb_build_object(
    'status', 'success',
    'po_id', p_po_id,
    'po_number', v_po.po_number,
    'doc_status', 'Cancelled'
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1i. cancel_debit_note_atomic
--
-- Posts the reversing GL entry and recalculates the vendor balance inside the
-- same transaction, which the browser-side delete path does not do.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_debit_note_atomic(p_dn_id uuid, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_dn RECORD;
  v_ap_account_id UUID;
  v_purchase_return_account_id UUID;
  v_journal_id UUID;
BEGIN
  SELECT * INTO v_dn
  FROM public.debit_notes
  WHERE id = p_dn_id
  FOR UPDATE;

  IF v_dn.id IS NULL THEN RAISE EXCEPTION 'Debit note not found'; END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(v_dn.organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF LOWER(COALESCE(v_dn.approval_status, '')) = 'cancelled' THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'already_cancelled', true,
      'dn_id', p_dn_id,
      'dn_number', v_dn.dn_number
    );
  END IF;

  -- Post Reversing GL Entry (Dr Purchase Returns, Cr Accounts Payable)
  SELECT id INTO v_ap_account_id FROM public.accounts WHERE (organisation_id = v_dn.organisation_id OR company_id = v_dn.organisation_id) AND account_code = '2100' LIMIT 1;
  SELECT id INTO v_purchase_return_account_id FROM public.accounts WHERE (organisation_id = v_dn.organisation_id OR company_id = v_dn.organisation_id) AND (account_code IN ('5000', '1500', '2000') OR name ILIKE '%Purchase Return%' OR name ILIKE '%Inventory%') LIMIT 1;

  IF v_ap_account_id IS NOT NULL AND v_purchase_return_account_id IS NOT NULL AND v_dn.total_amount > 0 THEN
    INSERT INTO public.journal_entries (
      company_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      v_dn.organisation_id,
      'REV-' || COALESCE(v_dn.dn_number, v_dn.id::TEXT),
      CURRENT_DATE,
      'Debit Note',
      'Reversal of Debit Note ' || COALESCE(v_dn.dn_number, '') || COALESCE(' (' || p_reason || ')', ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_purchase_return_account_id, 'vendor', v_dn.vendor_id, v_dn.total_amount, 0.00, 'Reversal of Purchase Returns');

    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_ap_account_id, 'vendor', v_dn.vendor_id, 0.00, v_dn.total_amount, 'Reversal of AP Reduction');
  END IF;

  UPDATE public.debit_notes
  SET approval_status = 'Cancelled',
      reason = COALESCE(reason || ' | ', '') || 'Cancelled: ' || COALESCE(p_reason, 'No reason provided'),
      updated_at = NOW()
  WHERE id = p_dn_id;

  PERFORM public.recalc_vendor_balance(v_dn.vendor_id, v_dn.organisation_id);

  RETURN jsonb_build_object(
    'status', 'success',
    'dn_id', p_dn_id,
    'dn_number', v_dn.dn_number,
    'doc_status', 'cancelled',
    'journal_id', v_journal_id
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1j. process_debit_note_stock_atomic
--
-- The correct stock path per .agents/DATA-INTEGRITY.md. Takes FOR UPDATE row
-- locks on item_stock, writes the canonical material_logs movement, and is
-- idempotent via debit_notes.stock_reversed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_debit_note_stock_atomic(p_debit_note_id uuid, p_action text, p_items jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dn RECORD;
  v_org_id UUID;
  v_user_id UUID;
  r_item RECORD;
  v_mat_id UUID;
  v_stock_id UUID;
  v_current_stock NUMERIC;
  v_action TEXT := LOWER(COALESCE(p_action, 'deduct'));
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_dn
  FROM public.debit_notes
  WHERE id = p_debit_note_id
  FOR UPDATE;

  IF v_dn IS NULL THEN
    RAISE EXCEPTION 'Debit Note not found';
  END IF;

  v_org_id := v_dn.organisation_id;
  IF v_user_id IS NOT NULL AND NOT public.user_can_access_org(v_org_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF v_action = 'approve' THEN
    v_action := 'deduct';
  END IF;

  IF v_action = 'deduct' THEN
    IF COALESCE(v_dn.stock_reversed, false) = TRUE THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'already_processed', true,
        'debit_note_id', p_debit_note_id,
        'action', v_action
      );
    END IF;

    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
      FOR r_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        item_id uuid,
        material_id uuid,
        variant_id uuid,
        warehouse_id uuid,
        quantity numeric
      )
      LOOP
        v_mat_id := COALESCE(r_item.material_id, r_item.item_id);
        IF v_mat_id IS NOT NULL AND r_item.warehouse_id IS NOT NULL AND r_item.quantity > 0 THEN
          SELECT id, current_stock INTO v_stock_id, v_current_stock
          FROM public.item_stock
          WHERE item_id = v_mat_id
            AND warehouse_id = r_item.warehouse_id
            AND ((r_item.variant_id IS NULL AND company_variant_id IS NULL) OR company_variant_id = r_item.variant_id)
          FOR UPDATE;

          IF v_stock_id IS NULL OR v_current_stock < r_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for material % in warehouse % to reverse via Debit Note: available %, requested %',
              v_mat_id, r_item.warehouse_id, COALESCE(v_current_stock, 0), r_item.quantity;
          END IF;

          UPDATE public.item_stock
          SET current_stock = current_stock - r_item.quantity, updated_at = NOW()
          WHERE id = v_stock_id;

          INSERT INTO public.material_logs (
            organisation_id, item_id, variant_id,
            qty_received, qty_used, type, invoice_number, received_by, remarks, created_at
          ) VALUES (
            v_org_id, v_mat_id, r_item.variant_id,
            0, r_item.quantity, 'OUT', v_dn.dn_number, v_user_id,
            'Debit Note Vendor Return: ' || COALESCE(v_dn.dn_number, v_dn.id::TEXT), NOW()
          );
        END IF;
      END LOOP;
    END IF;

    UPDATE public.debit_notes SET stock_reversed = TRUE, updated_at = NOW() WHERE id = p_debit_note_id;

  ELSIF v_action = 'restore' THEN
    IF COALESCE(v_dn.stock_reversed, false) = FALSE THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'already_processed', true,
        'debit_note_id', p_debit_note_id,
        'action', v_action
      );
    END IF;

    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
      FOR r_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        item_id uuid,
        material_id uuid,
        variant_id uuid,
        warehouse_id uuid,
        quantity numeric
      )
      LOOP
        v_mat_id := COALESCE(r_item.material_id, r_item.item_id);
        IF v_mat_id IS NOT NULL AND r_item.warehouse_id IS NOT NULL AND r_item.quantity > 0 THEN
          SELECT id INTO v_stock_id
          FROM public.item_stock
          WHERE item_id = v_mat_id
            AND warehouse_id = r_item.warehouse_id
            AND ((r_item.variant_id IS NULL AND company_variant_id IS NULL) OR company_variant_id = r_item.variant_id)
          FOR UPDATE;

          IF v_stock_id IS NOT NULL THEN
            UPDATE public.item_stock
            SET current_stock = current_stock + r_item.quantity, updated_at = NOW()
            WHERE id = v_stock_id;
          ELSE
            INSERT INTO public.item_stock (
              organisation_id, item_id, warehouse_id, company_variant_id, current_stock
            ) VALUES (
              v_org_id, v_mat_id, r_item.warehouse_id, r_item.variant_id, r_item.quantity
            );
          END IF;

          INSERT INTO public.material_logs (
            organisation_id, item_id, variant_id,
            qty_received, qty_used, type, invoice_number, received_by, remarks, created_at
          ) VALUES (
            v_org_id, v_mat_id, r_item.variant_id,
            r_item.quantity, 0, 'IN', v_dn.dn_number, v_user_id,
            'Debit Note Reversal: ' || COALESCE(v_dn.dn_number, v_dn.id::TEXT), NOW()
          );
        END IF;
      END LOOP;
    END IF;

    UPDATE public.debit_notes SET stock_reversed = FALSE, updated_at = NOW() WHERE id = p_debit_note_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'debit_note_id', p_debit_note_id,
    'action', v_action,
    'stock_reversed', (v_action = 'deduct')
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1k. approve_purchase_requisition
--
-- Source-determines requisition lines (store vs procure) on approval. Called by
-- submit_purchase_requisition_for_approval (1l) and
-- process_purchase_requisition_approval (1m).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_purchase_requisition(p_requisition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_line record;
  v_available numeric;
BEGIN
  SELECT organisation_id INTO v_org_id
  FROM public.purchase_requisitions
  WHERE id = p_requisition_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Requisition not found';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(v_org_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  FOR v_line IN
    SELECT id, item_id, requested_qty
    FROM public.purchase_requisition_lines
    WHERE requisition_id = p_requisition_id
    ORDER BY line_no
  LOOP
    SELECT COALESCE(i.quantity, 0) INTO v_available
    FROM public.inventory i
    WHERE i.organisation_id = v_org_id
      AND i.item_id = v_line.item_id
    LIMIT 1;

    UPDATE public.purchase_requisition_lines
    SET
      available_stock_qty = COALESCE(v_available, 0),
      store_allocated_qty = 0,
      procure_required_qty = COALESCE(v_line.requested_qty, 0),
      source_type = 'PROCURE',
      open_qty = COALESCE(v_line.requested_qty, 0),
      status = 'Open'
    WHERE id = v_line.id;
  END LOOP;

  UPDATE public.purchase_requisitions
  SET status = 'Approved'
  WHERE id = p_requisition_id;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1l. submit_purchase_requisition_for_approval
--
-- Server-side equivalent of submitPurchaseRequisitionFallback in
-- src/purchase-requisitions/api.ts:216. Both compute required_approval_level
-- from purchase_release_rules; this file restores the authoritative copy.
-- Removing the client fallback is Phase 3 (W4.3) work, not this file's.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_purchase_requisition_for_approval(p_requisition_id uuid, p_actor_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_purpose text;
  v_amount numeric;
  v_required_level int := 1;
BEGIN
  SELECT organisation_id, purpose_type INTO v_org, v_purpose
  FROM public.purchase_requisitions
  WHERE id = p_requisition_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Requisition not found';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(v_org) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT COALESCE(SUM(COALESCE(estimated_amount,0)),0) INTO v_amount
  FROM public.purchase_requisition_lines
  WHERE requisition_id = p_requisition_id;

  SELECT COALESCE(MAX(required_level), 1) INTO v_required_level
  FROM public.purchase_release_rules
  WHERE organisation_id = v_org
    and is_active = true
    and (purpose_type is null or purpose_type = v_purpose)
    and v_amount >= min_amount
    and (max_amount is null or v_amount <= max_amount);

  UPDATE public.purchase_requisitions
  SET
    approval_status = CASE WHEN v_required_level > 1 THEN 'Pending Approval' ELSE 'Approved' END,
    required_approval_level = v_required_level,
    current_approval_level = CASE WHEN v_required_level > 1 THEN 1 ELSE v_required_level END,
    approved_by = CASE WHEN v_required_level > 1 THEN NULL ELSE COALESCE(p_actor_id, auth.uid()) END,
    approved_at = CASE WHEN v_required_level > 1 THEN NULL ELSE NOW() END,
    status = CASE WHEN v_required_level > 1 THEN 'Pending' ELSE 'Approved' END
  WHERE id = p_requisition_id;

  INSERT INTO public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
  VALUES (
    v_org, 'REQUISITION', p_requisition_id,
    CASE WHEN v_required_level > 1 THEN 'SUBMITTED_FOR_APPROVAL' ELSE 'AUTO_APPROVED' END,
    COALESCE(p_actor_id, auth.uid()),
    jsonb_build_object('required_level', v_required_level, 'estimated_total', v_amount)
  );

  IF v_required_level = 1 THEN
    PERFORM public.approve_purchase_requisition(p_requisition_id);
  END IF;

  RETURN CASE WHEN v_required_level > 1 THEN 'PENDING_APPROVAL' ELSE 'APPROVED' END;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1m. process_purchase_requisition_approval
--
-- Server-side equivalent of processPurchaseRequisitionApprovalFallback in
-- src/purchase-requisitions/api.ts:269.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_purchase_requisition_approval(p_requisition_id uuid, p_action text, p_actor_id uuid DEFAULT NULL::uuid, p_comment text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org uuid;
  v_current int;
  v_required int;
begin
  select organisation_id, current_approval_level, required_approval_level
  into v_org, v_current, v_required
  from public.purchase_requisitions
  where id = p_requisition_id;

  if v_org is null then
    raise exception 'Requisition not found';
  end if;

  if upper(p_action) = 'REJECT' then
    update public.purchase_requisitions
    set approval_status = 'Rejected', status = 'Rejected'
    where id = p_requisition_id;

    insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
    values (v_org, 'REQUISITION', p_requisition_id, 'REJECTED', p_actor_id, jsonb_build_object('comment', p_comment));
    return 'REJECTED';
  end if;

  if v_current + 1 >= v_required then
    update public.purchase_requisitions
    set approval_status = 'Approved', status = 'Approved', current_approval_level = v_required, approved_by = p_actor_id, approved_at = now()
    where id = p_requisition_id;

    perform public.approve_purchase_requisition(p_requisition_id);

    insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
    values (v_org, 'REQUISITION', p_requisition_id, 'FINAL_APPROVED', p_actor_id, jsonb_build_object('comment', p_comment));
    return 'APPROVED';
  else
    update public.purchase_requisitions
    set current_approval_level = v_current + 1
    where id = p_requisition_id;

    insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
    values (v_org, 'REQUISITION', p_requisition_id, 'LEVEL_APPROVED', p_actor_id, jsonb_build_object('new_level', v_current + 1, 'comment', p_comment));
    return 'PENDING_APPROVAL';
  end if;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 1n. post_goods_receipt
--
-- Called from src/purchase-inquiries/api.ts:223. Writes the GR header + line
-- and rolls the received quantity back onto the originating requisition line.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_goods_receipt(p_organisation_id uuid, p_po_id uuid, p_po_item_id uuid, p_received_qty numeric, p_created_by uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gr_id uuid;
  v_po_item record;
  v_req_line_id uuid;
  v_total_received numeric;
  v_gr_no text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_po_item
  FROM public.purchase_order_items
  WHERE id = p_po_item_id AND organisation_id = p_organisation_id;

  IF v_po_item.id IS NULL THEN
    RAISE EXCEPTION 'PO item not found';
  END IF;

  v_req_line_id := v_po_item.requisition_line_id;
  v_gr_no := 'GR-' || to_char(now(), 'YYMMDD-HH24MISSMS');

  INSERT INTO public.goods_receipts (
    organisation_id, gr_number, po_id, vendor_id, created_by
  )
  VALUES (
    p_organisation_id, v_gr_no, p_po_id, NULL, COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_gr_id;

  INSERT INTO public.goods_receipt_lines (
    organisation_id, goods_receipt_id, po_item_id, requisition_line_id, received_qty
  )
  VALUES (
    p_organisation_id, v_gr_id, p_po_item_id, v_req_line_id, p_received_qty
  );

  IF v_req_line_id IS NOT NULL THEN
    SELECT COALESCE(SUM(received_qty), 0) INTO v_total_received
    FROM public.goods_receipt_lines
    WHERE requisition_line_id = v_req_line_id
      AND organisation_id = p_organisation_id;

    UPDATE public.purchase_requisition_lines
    SET
      received_qty = v_total_received,
      open_qty = GREATEST(COALESCE(requested_qty, 0) - v_total_received, 0),
      status = CASE
        WHEN v_total_received <= 0 THEN 'Open'
        WHEN v_total_received < COALESCE(requested_qty, 0) THEN 'Partially Fulfilled'
        ELSE 'Fulfilled'
      END
    WHERE id = v_req_line_id;
  END IF;

  RETURN v_gr_id;
END;
$function$;


-- ---------------------------------------------------------------------------
-- 1o. verify_purchase_bill_3way
--
-- CARRIED-FORWARD DEFECT (see file header): the live function reads
-- v_po.grand_total. public.purchase_orders has no such column; the real column
-- is total_amount. Because v_po is a RECORD the reference compiles and fails
-- only on execution:
--   ERROR: record "v_po" has no field "grand_total"
-- Verified 2026-09-29. It is captured verbatim here on purpose so the Phase 1.9
-- scratch rebuild reproduces production behaviour exactly; the fix belongs in
-- its own migration immediately after the rebuild gate passes.
--
-- This matters for Phase 3: W3.6 makes record_purchase_bill call this
-- function and RAISE on 'FAILED'. Doing that before the fix would block every
-- bill that carries a po_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_purchase_bill_3way(p_organisation_id uuid, p_bill_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bill record;
  v_po record;
  v_set record;
  v_received numeric := 0;
  v_qty_variance numeric := 0;
  v_value_variance numeric := 0;
  v_date_variance int := 0;
  v_status text := 'PASSED';
  v_message text := '3-way check passed';
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_bill
  FROM public.purchase_bills
  WHERE id = p_bill_id AND organisation_id = p_organisation_id;
  IF v_bill.id IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = v_bill.po_id AND organisation_id = p_organisation_id;

  SELECT * INTO v_set
  FROM public.purchase_iv_settings
  WHERE organisation_id = p_organisation_id;
  IF v_set.id IS NULL THEN
    INSERT INTO public.purchase_iv_settings(organisation_id) VALUES (p_organisation_id)
    RETURNING * INTO v_set;
  END IF;

  IF v_po.id IS NOT NULL THEN
    SELECT COALESCE(SUM(grl.received_qty), 0) INTO v_received
    FROM public.goods_receipts gr
    JOIN public.goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
    WHERE gr.organisation_id = p_organisation_id
      AND gr.po_id = v_po.id;

    IF COALESCE(v_bill.total_amount,0) > 0 AND COALESCE(v_po.grand_total,0) > 0 THEN
      v_value_variance := ABS((v_bill.total_amount - v_po.grand_total) / NULLIF(v_po.grand_total,0)) * 100;
    END IF;

    IF COALESCE(v_po.po_date, CURRENT_DATE) IS NOT NULL AND COALESCE(v_bill.bill_date, CURRENT_DATE) IS NOT NULL THEN
      v_date_variance := ABS(v_bill.bill_date - v_po.po_date);
    END IF;

    DECLARE v_po_qty NUMERIC := 0;
    BEGIN
      SELECT COALESCE(SUM(quantity),0) INTO v_po_qty
      FROM public.purchase_order_items
      WHERE po_id = v_po.id AND organisation_id = p_organisation_id;
      IF v_po_qty > 0 THEN
        v_qty_variance := ABS((v_po_qty - v_received) / v_po_qty) * 100;
      END IF;
    END;
  ELSE
    v_status := 'WARN';
    v_message := 'PO link missing for 3-way verification';
  END IF;

  IF v_qty_variance > v_set.qty_tolerance_percent
     OR v_value_variance > v_set.value_tolerance_percent
     OR v_date_variance > v_set.date_tolerance_days THEN
    v_status := 'FAILED';
    v_message := 'Tolerance exceeded';
  ELSIF v_status = 'PASSED' AND (v_qty_variance > 0 OR v_value_variance > 0 OR v_date_variance > 0) THEN
    v_status := 'WARN';
    v_message := 'Within tolerance';
  END IF;

  INSERT INTO public.purchase_invoice_verifications(
    organisation_id, bill_id, po_id, verification_status, qty_variance_percent, value_variance_percent, date_variance_days, message
  )
  VALUES (
    p_organisation_id, p_bill_id, v_bill.po_id, v_status, v_qty_variance, v_value_variance, v_date_variance, v_message
  )
  ON CONFLICT (organisation_id, bill_id)
  DO UPDATE SET
    verification_status = EXCLUDED.verification_status,
    qty_variance_percent = EXCLUDED.qty_variance_percent,
    value_variance_percent = EXCLUDED.value_variance_percent,
    date_variance_days = EXCLUDED.date_variance_days,
    message = EXCLUDED.message,
    updated_at = NOW();

  RETURN v_status;
END;
$function$;
