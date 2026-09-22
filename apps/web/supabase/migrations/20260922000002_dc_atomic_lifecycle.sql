-- 20260922000002_dc_atomic_lifecycle.sql
-- ADR-001: atomic Delivery Challan lifecycle (server-side stock enforcement).
-- Forward-only, idempotent (IF NOT EXISTS guards). Run in Supabase SQL editor.
-- Does NOT modify or drop the legacy cancel_delivery_challan_atomic (LIVE-ONLY source);
-- the app switches to cancel_dc_atomic after this migration is verified live.

-- ── 1. Header columns for idempotency + cancel audit ─────────────────────────
ALTER TABLE public.delivery_challans
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.delivery_challans
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.delivery_challans
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- One live key per org; NULLs remain non-conflicting (Postgres NULL semantics).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dc_org_idempotency
  ON public.delivery_challans (organisation_id, idempotency_key);

-- ── 2. Movement-ledger extension on material_logs (nullable, additive) ───────
ALTER TABLE public.material_logs ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE public.material_logs ADD COLUMN IF NOT EXISTS company_variant_id UUID;
ALTER TABLE public.material_logs ADD COLUMN IF NOT EXISTS movement_type TEXT;
ALTER TABLE public.material_logs ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.material_logs ADD COLUMN IF NOT EXISTS quantity_change NUMERIC;

-- ── 3. create_dc_atomic ──────────────────────────────────────────────────────
-- Single transaction: numbering + header + items + stock deduction + ledger.
-- p_header: jsonb with the app's buildDCData fields (dc_date, client_name,
--   project_id, source_type, warehouse_id, variant_id, vehicle_number,
--   driver_name, eway_*, po_*, remarks, ship_to_*, rate_source,
--   authorized_signatory_id, dc_type ['billable' default | 'non-billable'],
--   status ['active' default; DRAFT allowed]).
-- p_items: jsonb array of {material_id, variant_id, warehouse_id, material_name,
--   unit, quantity, rate, amount, make, is_service}.
-- p_allow_insufficient: when false (default), missing/insufficient stock FAILS LOUD.
CREATE OR REPLACE FUNCTION public.create_dc_atomic(
  p_organisation_id UUID,
  p_header JSONB,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_allow_insufficient BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dc_type TEXT := COALESCE(NULLIF(p_header->>'dc_type', ''), 'billable');
  v_status TEXT := COALESCE(NULLIF(p_header->>'status', ''), 'active');
  v_source TEXT := COALESCE(NULLIF(p_header->>'source_type', ''), 'WAREHOUSE');
  v_dc_id UUID;
  v_dc_number TEXT;
  v_existing RECORD;
  v_item JSONB;
  v_qty NUMERIC;
  v_wh UUID;
  v_variant UUID;
  v_is_service BOOLEAN;
  v_stock RECORD;
  v_new_stock NUMERIC;
  v_series RECORD;
  v_cfg JSONB;
  v_num INT;
  v_padding INT;
  v_prefix TEXT;
  v_now DATE := CURRENT_DATE;
  v_fy TEXT;
BEGIN
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF v_dc_type NOT IN ('billable', 'non-billable') THEN
    RAISE EXCEPTION 'Invalid dc_type: %', v_dc_type;
  END IF;

  -- Idempotency: same key returns the original document, no second deduction.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, dc_number INTO v_existing
    FROM public.delivery_challans
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('id', v_existing.id, 'dc_number', v_existing.dc_number, 'duplicate', TRUE);
    END IF;
  END IF;

  -- ── Numbering (server-side; mirrors app semantics, race-safe) ──
  SELECT id, configs, current_number INTO v_series
  FROM public.document_series
  WHERE is_default IS TRUE
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  IF v_dc_type = 'billable' THEN
    v_cfg := COALESCE(v_series.configs->'dc', '{}'::jsonb);
    IF COALESCE((v_cfg->>'enabled')::boolean, FALSE) THEN
      v_num := COALESCE(v_series.current_number, (v_cfg->>'start_number')::int, 1);
      v_padding := COALESCE((v_cfg->>'padding')::int, 4);
      v_prefix := COALESCE(v_cfg->>'prefix', '');
      IF v_prefix LIKE '%{FY}%' THEN
        v_fy := CASE WHEN EXTRACT(MONTH FROM v_now) < 3
          THEN (EXTRACT(YEAR FROM v_now)::int - 1) || '-' || to_char(v_now, 'YY')
          ELSE to_char(v_now, 'YYYY') || '-' || to_char(v_now + INTERVAL '1 year', 'YY') END;
        v_prefix := replace(v_prefix, '{FY}', v_fy);
      END IF;
      v_dc_number := v_prefix || lpad(v_num::text, v_padding, '0') || COALESCE(v_cfg->>'suffix', '');
      UPDATE public.document_series SET current_number = v_num + 1 WHERE id = v_series.id;
    ELSE
      -- Legacy count fallback (pre-series behavior).
      SELECT COUNT(*) + 1 INTO v_num FROM public.delivery_challans WHERE organisation_id = p_organisation_id;
      v_dc_number := 'DC' || lpad(v_num::text, 5, '0');
    END IF;
  ELSE
    -- Non-billable: NBDC- max+1 serialized per org (advisory lock kills the race).
    PERFORM pg_advisory_xact_lock(hashtext('nbdc:' || p_organisation_id::text));
    v_padding := COALESCE((v_series.configs->'dc'->>'padding')::int, 4);
    SELECT COALESCE(MAX(
      CASE WHEN dc_number ~ '^NBDC-[0-9]+$'
        THEN (regexp_match(dc_number, '^NBDC-([0-9]+)$'))[1]::int ELSE 0 END
    ), 0) + 1 INTO v_num
    FROM public.delivery_challans
    WHERE organisation_id = p_organisation_id AND dc_type = 'non-billable';
    v_dc_number := 'NBDC-' || lpad(v_num::text, v_padding, '0');
  END IF;

  -- ── Header ──
  INSERT INTO public.delivery_challans (
    organisation_id, dc_number, dc_type, status, idempotency_key,
    dc_date, client_name, site_address, project_id,
    source_type, warehouse_id, variant_id,
    vehicle_number, driver_name,
    eway_bill_no, eway_bill_date,
    po_no, po_date, remarks,
    ship_to_name, ship_to_address_line1, ship_to_address_line2,
    ship_to_city, ship_to_state, ship_to_pincode, ship_to_gstin, ship_to_contact,
    rate_source, authorized_signatory_id
  ) VALUES (
    p_organisation_id, v_dc_number, v_dc_type, v_status, p_idempotency_key,
    NULLIF(p_header->>'dc_date', '')::date,
    NULLIF(p_header->>'client_name', ''),
    NULLIF(p_header->>'site_address', ''),
    NULLIF(p_header->>'project_id', '')::uuid,
    v_source,
    NULLIF(p_header->>'warehouse_id', '')::uuid,
    NULLIF(p_header->>'variant_id', '')::uuid,
    NULLIF(p_header->>'vehicle_number', ''),
    NULLIF(p_header->>'driver_name', ''),
    NULLIF(p_header->>'eway_bill_no', ''),
    NULLIF(p_header->>'eway_bill_date', '')::date,
    NULLIF(p_header->>'po_no', ''),
    NULLIF(p_header->>'po_date', '')::date,
    NULLIF(p_header->>'remarks', ''),
    NULLIF(p_header->>'ship_to_name', ''),
    NULLIF(p_header->>'ship_to_address_line1', ''),
    NULLIF(p_header->>'ship_to_address_line2', ''),
    NULLIF(p_header->>'ship_to_city', ''),
    NULLIF(p_header->>'ship_to_state', ''),
    NULLIF(p_header->>'ship_to_pincode', ''),
    NULLIF(p_header->>'ship_to_gstin', ''),
    NULLIF(p_header->>'ship_to_contact', ''),
    COALESCE(NULLIF(p_header->>'rate_source', ''), 'base'),
    NULLIF(p_header->>'authorized_signatory_id', '')::uuid
  ) RETURNING id INTO v_dc_id;

  -- ── Items + stock ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for item %', COALESCE(v_item->>'material_name', '?');
    END IF;
    v_is_service := COALESCE((v_item->>'is_service')::boolean, FALSE);
    -- Billable requires per-item warehouse; non-billable falls back to header (merged-form rule).
    v_wh := NULLIF(v_item->>'warehouse_id', '')::uuid;
    IF v_wh IS NULL AND v_dc_type = 'non-billable' THEN
      v_wh := NULLIF(p_header->>'warehouse_id', '')::uuid;
    END IF;
    v_variant := NULLIF(v_item->>'variant_id', '')::uuid;

    INSERT INTO public.delivery_challan_items (
      delivery_challan_id, organisation_id, material_id, material_name,
      unit, quantity, rate, amount, variant_id, warehouse_id, make
    ) VALUES (
      v_dc_id, p_organisation_id,
      NULLIF(v_item->>'material_id', '')::uuid,
      COALESCE(NULLIF(v_item->>'material_name', ''), 'Unknown'),
      COALESCE(NULLIF(v_item->>'unit', ''), 'Nos'),
      v_qty,
      COALESCE((v_item->>'rate')::numeric, 0),
      COALESCE((v_item->>'amount')::numeric, 0),
      v_variant, v_wh,
      NULLIF(v_item->>'make', '')
    );

    -- Stock movement (WAREHOUSE source, non-service rows only).
    IF v_source = 'WAREHOUSE' AND NOT v_is_service THEN
      IF v_wh IS NULL THEN
        RAISE EXCEPTION 'Warehouse required for item %', COALESCE(v_item->>'material_name', '?');
      END IF;
      SELECT * INTO v_stock FROM public.item_stock
      WHERE item_id = NULLIF(v_item->>'material_id', '')::uuid
        AND warehouse_id = v_wh
        AND ((v_variant IS NULL AND company_variant_id IS NULL) OR company_variant_id = v_variant)
      FOR UPDATE;
      IF NOT FOUND THEN
        IF p_allow_insufficient THEN
          CONTINUE; -- recorded on the DC, no stock row to move; loud only when strict
        END IF;
        RAISE EXCEPTION 'No stock record for item % in warehouse', COALESCE(v_item->>'material_name', '?');
      END IF;
      v_new_stock := v_stock.current_stock - v_qty;
      IF v_new_stock < 0 AND NOT p_allow_insufficient THEN
        RAISE EXCEPTION 'Insufficient stock for item % (have %, need %)',
          COALESCE(v_item->>'material_name', '?'), v_stock.current_stock, v_qty;
      END IF;
      UPDATE public.item_stock
      SET current_stock = GREATEST(v_new_stock, 0), updated_at = now()
      WHERE id = v_stock.id;

      INSERT INTO public.material_logs (
        organisation_id, item_id, company_variant_id, warehouse_id,
        movement_type, reference_id, quantity_change, remarks
      ) VALUES (
        p_organisation_id,
        NULLIF(v_item->>'material_id', '')::uuid, v_variant, v_wh,
        'DC_OUT', v_dc_id, -v_qty,
        'Deducted for Delivery Challan ' || v_dc_number
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_dc_id, 'dc_number', v_dc_number, 'duplicate', FALSE);
END;
$$;

-- ── 4. cancel_dc_atomic (guarded; supersedes legacy blind-restore cancel) ────
-- Locks the DC, restores stock exactly once, audits the cancel.
-- Double-cancel RAISES (no second restore) — this closes the inflation defect.
CREATE OR REPLACE FUNCTION public.cancel_dc_atomic(
  p_dc_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dc RECORD;
  v_item RECORD;
  v_stock RECORD;
BEGIN
  SELECT * INTO v_dc FROM public.delivery_challans WHERE id = p_dc_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery Challan not found';
  END IF;
  IF NOT public.user_can_access_org(v_dc.organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;
  IF upper(COALESCE(v_dc.status, '')) = 'CANCELLED' THEN
    RAISE EXCEPTION 'Delivery Challan already cancelled';
  END IF;

  FOR v_item IN
    SELECT * FROM public.delivery_challan_items WHERE delivery_challan_id = p_dc_id
  LOOP
    IF v_dc.source_type = 'WAREHOUSE' AND v_item.warehouse_id IS NOT NULL THEN
      SELECT * INTO v_stock FROM public.item_stock
      WHERE item_id = v_item.material_id
        AND warehouse_id = v_item.warehouse_id
        AND ((v_item.variant_id IS NULL AND company_variant_id IS NULL)
             OR company_variant_id = v_item.variant_id)
      FOR UPDATE;
      IF FOUND THEN
        UPDATE public.item_stock
        SET current_stock = v_stock.current_stock + v_item.quantity, updated_at = now()
        WHERE id = v_stock.id;
      ELSE
        INSERT INTO public.item_stock (organisation_id, item_id, company_variant_id, warehouse_id, current_stock)
        VALUES (v_dc.organisation_id, v_item.material_id, v_item.variant_id, v_item.warehouse_id, v_item.quantity);
      END IF;
      INSERT INTO public.material_logs (
        organisation_id, item_id, company_variant_id, warehouse_id,
        movement_type, reference_id, quantity_change, remarks
      ) VALUES (
        v_dc.organisation_id,
        v_item.material_id, v_item.variant_id, v_item.warehouse_id,
        'DC_CANCEL', p_dc_id, v_item.quantity,
        'Restored on cancel of Delivery Challan ' || v_dc.dc_number
      );
    END IF;
  END LOOP;

  UPDATE public.delivery_challans
  SET status = 'CANCELLED', cancel_reason = p_reason, cancelled_at = now(), updated_at = now()
  WHERE id = p_dc_id;

  RETURN jsonb_build_object('id', p_dc_id, 'status', 'CANCELLED');
END;
$$;

-- ── 5. Least-privilege execution for app clients ─────────────────────────────
GRANT EXECUTE ON FUNCTION public.create_dc_atomic(UUID, JSONB, JSONB, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_dc_atomic(UUID, TEXT) TO authenticated;
