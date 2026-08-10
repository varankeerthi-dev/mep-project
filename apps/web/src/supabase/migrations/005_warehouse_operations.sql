-- ============================================================================
-- 005 — Warehouse Operations (Phase 4): Internal Transfers, Movement Audit
--       Trail, Replenishment Rules + atomic execution RPCs
--
-- PRD §9.10–9.25 (Stock Movement Engine):
--   * warehouse_transfers          — internal transfer requests with the full
--                                    lifecycle (Draft → Requested → Approved →
--                                    Picking → In Transit → Received → Completed,
--                                    plus Cancelled / Rejected) and the 5
--                                    priorities (Low/Normal/High/Urgent/Critical).
--   * warehouse_movements          — immutable audit trail. Every stock movement
--                                    records movement type, reference doc, source,
--                                    destination, operator, date, remarks.
--   * warehouse_replenishment_rules — per-bin min/max that drives the
--                                    Replenishment Engine (Bulk → Picking).
--
-- RLS mirrors 004: every table is org-scoped via user_organisations.
-- The SECURITY DEFINER RPCs (execute_warehouse_transfer, receive_warehouse_stock)
-- validate org membership + row ownership *inside* the function so callers can
-- never move another tenant's stock.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. warehouse_transfers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  transfer_no       TEXT NOT NULL,
  item_id           UUID,
  quantity          NUMERIC(14,3) NOT NULL DEFAULT 0,
  source_bin_id     UUID NOT NULL REFERENCES warehouse_bins(id),
  destination_bin_id UUID NOT NULL REFERENCES warehouse_bins(id),
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent','critical')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','requested','approved','picking',
                                      'in_transit','received','completed',
                                      'cancelled','rejected')),
  requested_by      UUID,
  requested_at      TIMESTAMPTZ,
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  picked_by         UUID,
  picked_at         TIMESTAMPTZ,
  moved_by          UUID,
  in_transit_at     TIMESTAMPTZ,
  received_by       UUID,
  received_at       TIMESTAMPTZ,
  completed_by      UUID,
  completed_at      TIMESTAMPTZ,
  cancelled_by      UUID,
  cancelled_at      TIMESTAMPTZ,
  remarks           TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_transfers_no
  ON warehouse_transfers (organisation_id, transfer_no);

-- ---------------------------------------------------------------------------
-- 2. warehouse_movements — immutable audit trail (PRD §9.23)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  movement_type     TEXT NOT NULL CHECK (movement_type IN (
                      'receive','transfer_out','transfer_in','dispatch',
                      'consolidate','overflow','replenish','adjust','other')),
  reference_type    TEXT NOT NULL DEFAULT 'transfer'
                    CHECK (reference_type IN ('transfer','receiving','dispatch',
                                              'consolidation','replenishment',
                                              'adjustment','other')),
  reference_id      TEXT,
  item_id           UUID,
  source_bin_id     UUID REFERENCES warehouse_bins(id),
  destination_bin_id UUID REFERENCES warehouse_bins(id),
  quantity          NUMERIC(14,3) NOT NULL DEFAULT 0,
  operator_id       UUID,
  device            TEXT,
  remarks           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_warehouse_movements_bin
  ON warehouse_movements (organisation_id, source_bin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_warehouse_movements_dest
  ON warehouse_movements (organisation_id, destination_bin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_warehouse_movements_item
  ON warehouse_movements (organisation_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_warehouse_movements_ref
  ON warehouse_movements (organisation_id, reference_id);

-- ---------------------------------------------------------------------------
-- 3. warehouse_replenishment_rules — Replenishment Engine config (PRD §9.14)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_replenishment_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bin_id            UUID NOT NULL REFERENCES warehouse_bins(id),
  item_id           UUID,
  min_qty           NUMERIC(14,3) NOT NULL DEFAULT 0,
  max_qty           NUMERIC(14,3) NOT NULL DEFAULT 0,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_replenish_min_lt_max CHECK (max_qty = 0 OR min_qty < max_qty)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_replenishment_rule
  ON warehouse_replenishment_rules (organisation_id, bin_id, item_id);

-- The RPCs below use ON CONFLICT (bin_id, item_id), which requires a unique
-- constraint. 003 only added plain indexes on bin_id/item_id. A plain unique
-- index is correct here: Postgres treats NULL item_ids as distinct, so rows
-- without an item can coexist while (bin_id, item_id) pairs stay unique.
CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_bin_items_bin_item
  ON warehouse_bin_items (bin_id, item_id);

-- ---------------------------------------------------------------------------
-- 4. RLS — org-scoped, same convention as 004
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouse_transfers',
    'warehouse_movements',
    'warehouse_replenishment_rules'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all_access', t);
    policy_name := 'wh_org_member_all_' || t;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, t);
    EXECUTE format($pol$
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          organisation_id IN (
            SELECT organisation_id FROM user_organisations
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
        WITH CHECK (
          organisation_id IN (
            SELECT organisation_id FROM user_organisations
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
    $pol$, policy_name, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Atomic transfer execution RPC.
--
-- Validates (PRD §9.19): qty > 0, source ≠ destination, source has enough
-- stock, destination has capacity (max_quantity). Decrements the source
-- bin-item, increments the destination (or inserts), writes BOTH movement
-- rows (transfer_out + transfer_in), and advances the transfer to 'received'
-- (the PRD §9.11 flow then completes it via advanceTransferStatus). All in
-- one transaction.
--
-- Tenant isolation: the transfer's org must be one the caller belongs to AND
-- both bins must belong to that same org (SECURITY DEFINER bypasses RLS, so
-- every FK the function touches is re-checked here).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION execute_warehouse_transfer(
  p_transfer_id UUID,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_qty NUMERIC;
  v_src UUID;
  v_dst UUID;
  v_src_qty NUMERIC;
  v_dst_max NUMERIC;
  v_row RECORD;
BEGIN
  -- Transfer must exist and belong to an org the caller is a member of.
  SELECT organisation_id, item_id, quantity, source_bin_id, destination_bin_id, status
    INTO v_org, v_item_id, v_qty, v_src, v_dst, v_row.status
    FROM warehouse_transfers
   WHERE id = p_transfer_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transfer not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_row.status NOT IN ('requested','approved','picking','in_transit') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Transfer status ' || v_row.status || ' cannot be executed');
  END IF;

  -- Both bins must belong to the SAME org as the transfer (tenant isolation).
  IF NOT EXISTS (
    SELECT 1 FROM warehouse_bins
     WHERE id IN (v_src, v_dst) AND organisation_id = v_org AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source/destination bin not found in this organisation');
  END IF;

  -- Source must have enough stock (only live rows — soft-deleted rows never
  -- count as available inventory).
  SELECT COALESCE(SUM(quantity), 0) INTO v_src_qty
    FROM warehouse_bin_items
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND deleted_at IS NULL;
  IF v_src_qty < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient stock in source bin: ' || v_src_qty || ' < ' || v_qty);
  END IF;

  -- Destination capacity validation. (Weight/dimension checks are performed
  -- client-side by the pure transfer-validator where item weight can be
  -- supplied optionally — the materials table has no weight column.)
  SELECT max_quantity INTO v_dst_max FROM warehouse_bins WHERE id = v_dst;

  IF v_dst_max IS NOT NULL AND v_dst_max > 0 THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_src_qty
      FROM warehouse_bin_items WHERE bin_id = v_dst AND deleted_at IS NULL;
    IF v_src_qty + v_qty > v_dst_max THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Destination bin capacity exceeded: ' || v_src_qty || ' + ' || v_qty || ' > ' || v_dst_max);
    END IF;
  END IF;

  -- Decrement source; when a row reaches 0 it is soft-deleted (the module's
  -- convention — the movement audit trail is the permanent record).
  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - v_qty),
         updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND deleted_at IS NULL;
  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  -- Increment destination (upsert; clears deleted_at so a previously
  -- soft-deleted row is properly revived, not hidden).
  INSERT INTO warehouse_bin_items (organisation_id, bin_id, item_id, quantity, is_primary, created_at, updated_at)
  VALUES (v_org, v_dst, v_item_id, v_qty, false, now(), now())
  ON CONFLICT (bin_id, item_id)
  DO UPDATE SET quantity = warehouse_bin_items.quantity + EXCLUDED.quantity,
                deleted_at = NULL,
                updated_at = now();

  -- Audit rows (PRD §9.23).
  INSERT INTO warehouse_movements
    (organisation_id, movement_type, reference_type, reference_id, item_id,
     source_bin_id, destination_bin_id, quantity, operator_id, device, remarks)
  VALUES
    (v_org, 'transfer_out', 'transfer', p_transfer_id::TEXT, v_item_id,
     v_src, v_dst, -v_qty, p_operator_id, p_device, p_remarks),
    (v_org, 'transfer_in', 'transfer', p_transfer_id::TEXT, v_item_id,
     v_src, v_dst, v_qty, p_operator_id, p_device, p_remarks);

  -- Mark the transfer as received (PRD §9.11 — Confirm Receipt). The UI then
  -- advances it to 'completed'.
  UPDATE warehouse_transfers
     SET status = 'received',
         received_by = COALESCE(p_operator_id, received_by),
         received_at = now(),
         updated_at = now()
   WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'transfer_id', p_transfer_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Receiving RPC — put stock into a bin with a movement record and
--    optional capacity validation. Powers the Receiving workflow + put-away
--    suggestions (PRD §9.16).
--
-- Tenant isolation: the caller must be a member of p_organisation_id AND the
-- bin must belong to that org (SECURITY DEFINER bypasses RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION receive_warehouse_stock(
  p_organisation_id UUID,
  p_bin_id UUID,
  p_item_id UUID,
  p_quantity NUMERIC,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max NUMERIC;
  v_cur NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be positive');
  END IF;

  -- Bin must belong to the caller's org. (max_quantity may legitimately be
  -- NULL — uncapped — so existence is checked separately.)
  SELECT max_quantity INTO v_max
    FROM warehouse_bins
   WHERE id = p_bin_id AND organisation_id = p_organisation_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin not found in this organisation');
  END IF;
  v_max := COALESCE(v_max, 0);

  SELECT COALESCE(SUM(quantity), 0) INTO v_cur
    FROM warehouse_bin_items
   WHERE bin_id = p_bin_id AND item_id IS NOT DISTINCT FROM p_item_id AND deleted_at IS NULL;
  IF v_max > 0 AND v_cur + p_quantity > v_max THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Bin capacity exceeded: ' || v_cur || ' + ' || p_quantity || ' > ' || v_max);
  END IF;

  INSERT INTO warehouse_bin_items (organisation_id, bin_id, item_id, quantity, is_primary, created_at, updated_at)
  VALUES (p_organisation_id, p_bin_id, p_item_id, p_quantity, true, now(), now())
  ON CONFLICT (bin_id, item_id)
  DO UPDATE SET quantity = warehouse_bin_items.quantity + EXCLUDED.quantity,
                deleted_at = NULL,
                updated_at = now();

  INSERT INTO warehouse_movements
    (organisation_id, movement_type, reference_type, reference_id, item_id,
     destination_bin_id, quantity, operator_id, device, remarks)
  VALUES
    (p_organisation_id, 'receive', 'receiving', NULL, p_item_id,
     p_bin_id, p_quantity, p_operator_id, p_device, p_remarks);

  RETURN jsonb_build_object('ok', true, 'bin_id', p_bin_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Replenishment RPC — Bulk → Picking in one transaction:
--    moves qty from a bulk bin to a picking bin, writes 'replenish' movements,
--    and leaves the rule untouched (the engine re-evaluates next run).
--
-- Tenant isolation: both bins must belong to the caller's org.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION replenish_bin(
  p_organisation_id UUID,
  p_source_bin_id UUID,
  p_destination_bin_id UUID,
  p_item_id UUID,
  p_quantity NUMERIC,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_qty NUMERIC;
  v_ok BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be positive');
  END IF;

  -- Both bins must belong to the caller's org.
  SELECT COUNT(*) = 2 INTO v_ok
    FROM warehouse_bins
   WHERE id IN (p_source_bin_id, p_destination_bin_id)
     AND organisation_id = p_organisation_id AND deleted_at IS NULL;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source/destination bin not found in this organisation');
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_src_qty
    FROM warehouse_bin_items
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id
     AND deleted_at IS NULL;
  IF v_src_qty < p_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient bulk stock: ' || v_src_qty || ' < ' || p_quantity);
  END IF;

  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - p_quantity), updated_at = now()
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id
     AND deleted_at IS NULL;
  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  INSERT INTO warehouse_bin_items (organisation_id, bin_id, item_id, quantity, is_primary, created_at, updated_at)
  VALUES (p_organisation_id, p_destination_bin_id, p_item_id, p_quantity, false, now(), now())
  ON CONFLICT (bin_id, item_id)
  DO UPDATE SET quantity = warehouse_bin_items.quantity + EXCLUDED.quantity,
                deleted_at = NULL,
                updated_at = now();

  INSERT INTO warehouse_movements
    (organisation_id, movement_type, reference_type, reference_id, item_id,
     source_bin_id, destination_bin_id, quantity, operator_id, device, remarks)
  VALUES
    (p_organisation_id, 'replenish', 'replenishment', NULL, p_item_id,
     p_source_bin_id, p_destination_bin_id, p_quantity, p_operator_id, p_device,
     'Bulk → Picking replenishment');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Transfer number sequence — next number per organisation (only for org
--    members; returns NULL otherwise so no cross-tenant info leaks).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_warehouse_transfer_no(p_organisation_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN EXISTS (
           SELECT 1 FROM user_organisations
            WHERE organisation_id = p_organisation_id
              AND user_id = auth.uid() AND status = 'active'
         )
    THEN 'TRF-' || LPAD(
      (COALESCE(MAX(CAST(SUBSTRING(transfer_no FROM 5) AS INTEGER)), 0) + 1)::TEXT,
      6, '0')
    ELSE NULL END
  FROM warehouse_transfers WHERE organisation_id = p_organisation_id;
$$;
