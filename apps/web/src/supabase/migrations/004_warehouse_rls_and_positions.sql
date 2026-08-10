-- ============================================================================
-- 004 — Warehouse RLS hardening + layout rotation + rack position persistence
--
-- Closes the Phase 0/1 permission gaps found in the compliance review:
--   * Enables RLS on all 9 warehouse tables that had none (only
--     warehouse_capacity_profiles had a (permissive) policy).
--   * Every policy is org-scoped: the row's organisation_id must be an
--     organisation the authenticated user belongs to (user_organisations).
--   * warehouse_capacity_profiles' old permissive "all_access" policy is
--     replaced with the same org-scoped policy (was USING (true) — an
--     open door to other tenants' profiles).
--   * Adds warehouse_layouts.rotation_deg so the designer's layout config
--     (PRD §5.10) round-trips completely.
--   * Extends generate_warehouse_bins with optional p_pos_x/p_pos_y arrays
--     so the save pipeline persists the design-grid coordinates of each
--     rack (G11 — the viewer can then reproduce designed U/L shapes
--     instead of auto-arranging).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. warehouse_layouts: rotation column (additive, safe to re-run)
-- ---------------------------------------------------------------------------
ALTER TABLE warehouse_layouts
  ADD COLUMN IF NOT EXISTS rotation_deg NUMERIC(6,2) DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Org-scoped RLS for every warehouse table
--    is_org_admin is NOT used here — any active member may read/write the
--    org's warehouse structure. Use the membership junction directly.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  policy_name TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'warehouses',
    'warehouse_floors',
    'warehouse_zones',
    'warehouse_layouts',
    'warehouse_racks',
    'warehouse_tiers',
    'warehouse_bins',
    'warehouse_naming_rules',
    'warehouse_bin_items',
    'warehouse_capacity_profiles'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- Drop any legacy permissive policy on this table. The one table that
    -- shipped with a policy (003) named it `<table>_all_access` (e.g.
    -- warehouse_capacity_profiles_all_access), so drop by exact table name.
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
-- 3. generate_warehouse_bins — optional per-rack design-grid positions
--    DROP + CREATE because CREATE OR REPLACE cannot add parameters.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS generate_warehouse_bins(
  UUID, UUID, VARCHAR[], INTEGER[], INTEGER[], VARCHAR, NUMERIC, VARCHAR, VARCHAR, INTEGER, VARCHAR
);

CREATE OR REPLACE FUNCTION generate_warehouse_bins(
  p_layout_id UUID,
  p_organisation_id UUID,
  p_rack_names VARCHAR[],           -- rack names in generation order
  p_columns INTEGER[],              -- columns per rack (parallel arrays)
  p_levels INTEGER[],               -- levels per rack
  p_rack_type VARCHAR DEFAULT 'pallet_rack',
  p_max_qty NUMERIC DEFAULT 500,
  p_bin_prefix VARCHAR DEFAULT '',
  p_separator VARCHAR DEFAULT '-',
  p_padding INTEGER DEFAULT 2,
  p_level_format VARCHAR DEFAULT 'L{n}',
  p_pos_x NUMERIC[] DEFAULT NULL,   -- optional design-grid X per rack
  p_pos_y NUMERIC[] DEFAULT NULL    -- optional design-grid Y per rack
) RETURNS INTEGER AS $$
DECLARE
  v_rack_id UUID;
  v_tier_id UUID;
  v_created INTEGER := 0;
  v_i INTEGER;
  v_col INTEGER;
  v_lvl INTEGER;
  v_bin_name TEXT;
  v_level_label TEXT;
  v_rack_prefix TEXT;
  v_count INTEGER;
BEGIN
  -- Tenant guard: the layout must exist AND belong to the claimed
  -- organisation. The function is SECURITY DEFINER (bypasses RLS), so this
  -- check is what stops one tenant injecting racks/tiers/bins into another's
  -- warehouse by passing a foreign p_layout_id / p_organisation_id.
  IF NOT EXISTS (
    SELECT 1 FROM warehouse_layouts
    WHERE id = p_layout_id AND organisation_id = p_organisation_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'generate_warehouse_bins: layout % not found in organisation %',
      p_layout_id, p_organisation_id;
  END IF;

  v_count := array_length(p_rack_names, 1);
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN 0;
  END IF;

  -- Parallel-array safety: mismatched arrays silently produce NULL columns
  -- and zero bins, so reject them up front.
  IF array_length(p_columns, 1) IS DISTINCT FROM v_count
     OR array_length(p_levels, 1) IS DISTINCT FROM v_count THEN
    RAISE EXCEPTION 'generate_warehouse_bins: rack/columns/levels arrays must have equal length (% vs % vs %)',
      v_count, array_length(p_columns, 1), array_length(p_levels, 1);
  END IF;
  IF p_pos_x IS NOT NULL AND array_length(p_pos_x, 1) IS DISTINCT FROM v_count THEN
    RAISE EXCEPTION 'generate_warehouse_bins: p_pos_x length (%) != rack count (%)',
      array_length(p_pos_x, 1), v_count;
  END IF;
  IF p_pos_y IS NOT NULL AND array_length(p_pos_y, 1) IS DISTINCT FROM v_count THEN
    RAISE EXCEPTION 'generate_warehouse_bins: p_pos_y length (%) != rack count (%)',
      array_length(p_pos_y, 1), v_count;
  END IF;

  FOR v_i IN 1 .. v_count LOOP
    -- Rack (positions persist the designer's grid so the viewer can
    -- reproduce U/L shapes faithfully — G11).
    INSERT INTO warehouse_racks
      (organisation_id, layout_id, name, code, rack_type, columns_count, levels_count,
       status, max_weight_kg, position_x, position_y)
    VALUES
      (p_organisation_id, p_layout_id, p_rack_names[v_i], p_rack_names[v_i], p_rack_type,
       p_columns[v_i], p_levels[v_i], 'available', NULL,
       CASE WHEN p_pos_x IS NULL THEN 0 ELSE p_pos_x[v_i] END,
       CASE WHEN p_pos_y IS NULL THEN 0 ELSE p_pos_y[v_i] END)
    RETURNING id INTO v_rack_id;

    -- Bin prefix is the rack's own name so names are unique per rack and
    -- match the frontend preview (rackName + separator + column + level).
    v_rack_prefix := p_rack_names[v_i];

    -- Tiers
    FOR v_lvl IN 1 .. p_levels[v_i] LOOP
      v_level_label := replace(p_level_format, '{n}', v_lvl::text);
      INSERT INTO warehouse_tiers (organisation_id, rack_id, tier_number, name)
      VALUES (p_organisation_id, v_rack_id, v_lvl, v_level_label)
      RETURNING id INTO v_tier_id;

      -- Bins
      FOR v_col IN 1 .. p_columns[v_i] LOOP
        v_bin_name :=
          v_rack_prefix
          || p_separator
          || lpad(v_col::text, GREATEST(p_padding, 1), '0')
          || p_separator
          || v_level_label;

        INSERT INTO warehouse_bins
          (organisation_id, tier_id, rack_id, column_number, name, code, max_quantity, status)
        VALUES
          (p_organisation_id, v_tier_id, v_rack_id, v_col, v_bin_name, v_bin_name, p_max_qty, 'available');

        v_created := v_created + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN v_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
