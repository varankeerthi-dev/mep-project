-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4J: MANUFACTURING PERPETUAL INVENTORY GL POSTING ENGINE
-- Migration: 021_manufacturing_perpetual_gl.sql
-- Date: August 13, 2026
-- ============================================================

CREATE OR REPLACE FUNCTION post_manufacturing_inventory_gl(
  p_org_id UUID,
  p_movement_type TEXT, -- 'CONSUME' | 'PRODUCE' | 'DISPATCH'
  p_reference_no TEXT,
  p_material_id UUID,
  p_qty NUMERIC,
  p_unit_cost NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_mat_name TEXT;
  v_voucher_no TEXT;
  v_voucher_id UUID;

  v_raw_mat_acc_id UUID;
  v_wip_acc_id UUID;
  v_fg_acc_id UUID;
  v_cogs_acc_id UUID;

  v_dr_acc_id UUID;
  v_cr_acc_id UUID;
  v_narration TEXT;
BEGIN
  v_amount := ROUND(ABS(COALESCE(p_qty, 0)) * COALESCE(p_unit_cost, 0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'Zero or negative movement value');
  END IF;

  -- 1. Idempotency Check: verify if GL entry already posted for this movement reference
  v_voucher_no := 'GL-' || p_movement_type || '-' || UPPER(REGEXP_REPLACE(p_reference_no, '[^a-zA-Z0-9]', '', 'g'));

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE voucher_no = v_voucher_no
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'voucher_no', v_voucher_no);
  END IF;

  -- Get Material Name
  SELECT COALESCE(name, 'Material') INTO v_mat_name FROM materials WHERE id = p_material_id;

  -- 2. Account Resolution (Resolve or Auto-Provision standard inventory accounts per org)
  -- Raw Material Stock Account
  SELECT id INTO v_raw_mat_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '1410' OR LOWER(name) LIKE '%raw material%') AND is_group = false LIMIT 1;
  IF v_raw_mat_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('1410', 'Raw Material Stock', false, 'Asset', p_org_id) RETURNING id INTO v_raw_mat_acc_id;
  END IF;

  -- Work in Process (WIP) Account
  SELECT id INTO v_wip_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '1420' OR LOWER(name) LIKE '%work in process%' OR LOWER(name) LIKE '%wip%') AND is_group = false LIMIT 1;
  IF v_wip_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('1420', 'Work In Process Inventory', false, 'Asset', p_org_id) RETURNING id INTO v_wip_acc_id;
  END IF;

  -- Finished Goods Stock Account
  SELECT id INTO v_fg_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '1430' OR LOWER(name) LIKE '%finished goods%') AND is_group = false LIMIT 1;
  IF v_fg_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('1430', 'Finished Goods Stock', false, 'Asset', p_org_id) RETURNING id INTO v_fg_acc_id;
  END IF;

  -- Cost of Goods Sold Account
  SELECT id INTO v_cogs_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '5100' OR LOWER(name) LIKE '%cost of goods sold%' OR LOWER(name) LIKE '%cogs%') AND is_group = false LIMIT 1;
  IF v_cogs_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('5100', 'Cost of Goods Sold', false, 'Expense', p_org_id) RETURNING id INTO v_cogs_acc_id;
  END IF;

  -- 3. Determine Debit and Credit Accounts by Transaction Movement Type
  IF p_movement_type = 'CONSUME' THEN
    -- Material to WIP: Dr WIP / Cr Raw Material Stock
    v_dr_acc_id := v_wip_acc_id;
    v_cr_acc_id := v_raw_mat_acc_id;
    v_narration := 'Manufacturing Consume ' || p_reference_no || ' — ' || v_mat_name;
  ELSIF p_movement_type = 'PRODUCE' THEN
    -- Production Completion: Dr Finished Goods / Cr WIP
    v_dr_acc_id := v_fg_acc_id;
    v_cr_acc_id := v_wip_acc_id;
    v_narration := 'Manufacturing Production ' || p_reference_no || ' — ' || v_mat_name;
  ELSIF p_movement_type = 'DISPATCH' THEN
    -- Sales Outward: Dr COGS / Cr Finished Goods
    v_dr_acc_id := v_cogs_acc_id;
    v_cr_acc_id := v_fg_acc_id;
    v_narration := 'Sales Dispatch ' || p_reference_no || ' — ' || v_mat_name;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid movement type: ' || p_movement_type);
  END IF;

  -- 4. Create Double-Entry Journal Entry & Lines atomically
  INSERT INTO journal_entries (
    voucher_no, voucher_date, voucher_type, narration, status, organisation_id
  ) VALUES (
    v_voucher_no, CURRENT_DATE, 'JOURNAL', v_narration, 'posted', p_org_id
  ) RETURNING id INTO v_voucher_id;

  -- Debit Line
  INSERT INTO journal_entry_lines (
    journal_entry_id, account_id, debit, credit, narration
  ) VALUES (
    v_voucher_id, v_dr_acc_id, v_amount, 0.00, v_narration
  );

  -- Credit Line
  INSERT INTO journal_entry_lines (
    journal_entry_id, account_id, debit, credit, narration
  ) VALUES (
    v_voucher_id, v_cr_acc_id, 0.00, v_amount, v_narration
  );

  RETURN jsonb_build_object(
    'ok', true,
    'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no,
    'amount', v_amount,
    'movement_type', p_movement_type
  );
END;
$$;
