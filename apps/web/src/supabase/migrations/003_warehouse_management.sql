-- ============================================================
-- WAREHOUSE MANAGEMENT SYSTEM — PHASE 0: DATABASE FOUNDATION
-- Hierarchy: Organisation → Warehouse → Floor → Zone → Layout
--            → Rack → Tier (Level) → Bin → Inventory
-- Conventions (per Warehouse_TAD.md §4):
--   • Every business entity belongs to exactly one organisation
--   • Configuration vs transaction data separated
--   • Soft delete on master records (deleted_at)
--   • Audit fields on every entity
--   • Capacity stored on the bin (never derived from inventory)
--   • Published layouts are immutable + versioned
-- ============================================================

-- ------------------------------------------------------------------
-- 0. EXTEND EXISTING `warehouses` TABLE
-- ------------------------------------------------------------------
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS manager VARCHAR(255),
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_floor_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_warehouses_organisation ON warehouses(organisation_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON warehouses(is_active) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------
-- 1. STORAGE ROLES (configuration)
-- Business logic must always use storage roles, never warehouse names.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_storage_roles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code          VARCHAR(40) NOT NULL UNIQUE,          -- e.g. bulk_storage
  name          VARCHAR(120) NOT NULL,                -- e.g. Bulk Storage
  description   TEXT,
  color         VARCHAR(20) DEFAULT '#94a3b8',
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE warehouse_storage_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_storage_roles_all_access" ON warehouse_storage_roles;
CREATE POLICY "warehouse_storage_roles_all_access" ON warehouse_storage_roles
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO warehouse_storage_roles (code, name, description, color, sort_order) VALUES
  ('bulk_storage',  'Bulk Storage',  'High-volume reserve storage',           '#2563eb', 10),
  ('picking',       'Picking',       'Forward picking locations',             '#16a34a', 20),
  ('receiving',     'Receiving',     'Inbound goods staging',                 '#d97706', 30),
  ('dispatch',      'Dispatch',      'Outbound order staging',                '#dc2626', 40),
  ('returns',       'Returns',       'Customer / vendor returns',             '#7c3aed', 50),
  ('quality_hold',  'Quality Hold',  'Quarantine / inspection hold',          '#db2777', 60),
  ('overflow',      'Overflow',      'Temporary overflow storage',            '#64748b', 70),
  ('maintenance',   'Maintenance',   'Assets under maintenance',              '#0d9488', 80),
  ('custom',        'Custom',        'Custom user-defined storage role',      '#6b7280', 90)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------
-- 2. FLOORS
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_floors (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name            VARCHAR(160) NOT NULL,               -- e.g. Ground Floor
  code            VARCHAR(40),
  description     TEXT,
  display_order   INTEGER DEFAULT 0,                   -- drag & drop ordering
  height_m        NUMERIC(8,2),                        -- floor height in metres
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_floors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_floors_all_access" ON warehouse_floors;
CREATE POLICY "warehouse_floors_all_access" ON warehouse_floors
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_floors_org ON warehouse_floors(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_floors_warehouse ON warehouse_floors(warehouse_id);

-- ------------------------------------------------------------------
-- 3. ZONES
-- A Zone is a logical storage area with exactly one storage role.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_zones (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  floor_id        UUID NOT NULL REFERENCES warehouse_floors(id) ON DELETE CASCADE,
  name            VARCHAR(160) NOT NULL,               -- e.g. RM Bulk Zone
  code            VARCHAR(40),
  storage_role    VARCHAR(40) REFERENCES warehouse_storage_roles(code),
  description     TEXT,
  color           VARCHAR(20) DEFAULT '#e2e8f0',       -- zone colour used by the viewer
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_zones_all_access" ON warehouse_zones;
CREATE POLICY "warehouse_zones_all_access" ON warehouse_zones
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_zones_org ON warehouse_zones(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_zones_floor ON warehouse_zones(floor_id);
CREATE INDEX IF NOT EXISTS idx_wh_zones_role ON warehouse_zones(storage_role);

-- ------------------------------------------------------------------
-- 4. LAYOUTS
-- Layouts belong to Zones (never directly to warehouses).
-- Multiple layouts may exist inside one zone. Published layouts are
-- immutable; editing requires duplicate → modify → validate → publish.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_layouts (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  zone_id                 UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
  name                    VARCHAR(160) NOT NULL,       -- e.g. Grid Layout A
  code                    VARCHAR(40),
  layout_type             VARCHAR(40) NOT NULL DEFAULT 'grid'
                          CHECK (layout_type IN
                            ('grid', 'parallel_rows', 'double_aisle', 'single_aisle',
                             'u_shape', 'l_shape', 'open_yard', 'custom')),
  description             TEXT,
  orientation             VARCHAR(20) DEFAULT 'horizontal',  -- horizontal | vertical
  spacing_m              NUMERIC(8,2) DEFAULT 1.0,     -- rack spacing in metres
  aisle_width_m           NUMERIC(8,2) DEFAULT 3.0,    -- aisle width in metres
  walkway_width_m         NUMERIC(8,2) DEFAULT 2.0,
  scale                   NUMERIC(6,2) DEFAULT 1.0,
  default_rack_direction  VARCHAR(20) DEFAULT 'north',
  status                  VARCHAR(20) DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  version                 INTEGER DEFAULT 1,
  parent_version_id       UUID REFERENCES warehouse_layouts(id) ON DELETE SET NULL,
  published_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_on            TIMESTAMP WITH TIME ZONE,
  archived_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_on             TIMESTAMP WITH TIME ZONE,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at              TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_layouts_all_access" ON warehouse_layouts;
CREATE POLICY "warehouse_layouts_all_access" ON warehouse_layouts
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_layouts_org ON warehouse_layouts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_layouts_zone ON warehouse_layouts(zone_id);
CREATE INDEX IF NOT EXISTS idx_wh_layouts_status ON warehouse_layouts(status);

-- ------------------------------------------------------------------
-- 5. RACKS
-- Racks belong to layouts. Dimensions are independent per rack —
-- never assume identical racks.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_racks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  layout_id       UUID NOT NULL REFERENCES warehouse_layouts(id) ON DELETE CASCADE,
  name            VARCHAR(160) NOT NULL,               -- e.g. A-01
  code            VARCHAR(40),
  rack_type       VARCHAR(40) DEFAULT 'pallet_rack'
                  CHECK (rack_type IN
                    ('pallet_rack', 'shelf_rack', 'double_rack', 'wall_rack',
                     'island_rack', 'cantilever', 'open_storage', 'custom')),
  columns_count   INTEGER DEFAULT 1,                   -- bin columns per level
  levels_count    INTEGER DEFAULT 1,                   -- number of tiers/levels
  width_m         NUMERIC(8,2),
  depth_m         NUMERIC(8,2),
  height_m        NUMERIC(8,2),
  max_weight_kg   NUMERIC(12,2),
  max_volume_m3   NUMERIC(12,2),
  orientation     VARCHAR(20) DEFAULT 'north',
  position_x      NUMERIC(10,2) DEFAULT 0,             -- design-grid X coordinate
  position_y      NUMERIC(10,2) DEFAULT 0,             -- design-grid Y coordinate
  rotation_deg    NUMERIC(6,2) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'available'
                  CHECK (status IN
                    ('available', 'partial', 'full', 'blocked', 'maintenance',
                     'reserved', 'inactive')),
  qr_code         TEXT,
  barcode         TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_racks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_racks_all_access" ON warehouse_racks;
CREATE POLICY "warehouse_racks_all_access" ON warehouse_racks
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_racks_org ON warehouse_racks(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_racks_layout ON warehouse_racks(layout_id);

-- ------------------------------------------------------------------
-- 6. TIERS (LEVELS)
-- Every rack may contain a different number of tiers.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_tiers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  rack_id         UUID NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
  tier_number     INTEGER NOT NULL,                    -- 1-based level number
  name            VARCHAR(80) NOT NULL,                -- e.g. L1
  height_m        NUMERIC(8,2),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE,
  UNIQUE (rack_id, tier_number)
);

ALTER TABLE warehouse_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_tiers_all_access" ON warehouse_tiers;
CREATE POLICY "warehouse_tiers_all_access" ON warehouse_tiers
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_tiers_org ON warehouse_tiers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_tiers_rack ON warehouse_tiers(rack_id);

-- ------------------------------------------------------------------
-- 7. BINS
-- The smallest physical storage location. Inventory always belongs
-- to a bin. Capacity is stored here (never derived from inventory).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_bins (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tier_id               UUID NOT NULL REFERENCES warehouse_tiers(id) ON DELETE CASCADE,
  rack_id               UUID NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
  column_number         INTEGER NOT NULL,              -- 1-based column within tier
  name                  VARCHAR(160) NOT NULL,         -- e.g. A-01-L1
  code                  VARCHAR(80),
  width_m               NUMERIC(8,2),
  depth_m               NUMERIC(8,2),
  height_m              NUMERIC(8,2),
  max_quantity          NUMERIC(14,3),
  max_weight_kg         NUMERIC(14,3),
  max_volume_m3         NUMERIC(14,3),
  max_pallets           INTEGER,
  current_quantity      NUMERIC(14,3) DEFAULT 0,       -- live, maintained by movement engine
  reserved_quantity     NUMERIC(14,3) DEFAULT 0,
  status                VARCHAR(20) DEFAULT 'available'
                        CHECK (status IN
                          ('available', 'occupied', 'nearly_full', 'full',
                           'reserved', 'blocked', 'maintenance', 'quality_hold',
                           'cycle_count', 'returns', 'inactive')),
  notes                 TEXT,
  qr_code               TEXT,
  barcode               TEXT,
  last_movement_at      TIMESTAMP WITH TIME ZONE,
  last_count_at         TIMESTAMP WITH TIME ZONE,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at            TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_bins_all_access" ON warehouse_bins;
CREATE POLICY "warehouse_bins_all_access" ON warehouse_bins
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_bins_org ON warehouse_bins(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_bins_tier ON warehouse_bins(tier_id);
CREATE INDEX IF NOT EXISTS idx_wh_bins_rack ON warehouse_bins(rack_id);
CREATE INDEX IF NOT EXISTS idx_wh_bins_name ON warehouse_bins(name);
CREATE INDEX IF NOT EXISTS idx_wh_bins_qr ON warehouse_bins(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wh_bins_barcode ON warehouse_bins(barcode) WHERE barcode IS NOT NULL;

-- ------------------------------------------------------------------
-- 8. NAMING RULES (configuration)
-- Business identifiers are configurable. The naming engine persists
-- its configuration per layout so regeneration is deterministic.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_naming_rules (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  layout_id         UUID NOT NULL REFERENCES warehouse_layouts(id) ON DELETE CASCADE,
  entity_type       VARCHAR(20) NOT NULL CHECK (entity_type IN ('rack', 'bin')),
  prefix            VARCHAR(20) DEFAULT '',
  separator         VARCHAR(10) DEFAULT '-',
  numbering_style   VARCHAR(20) DEFAULT 'numeric'
                    CHECK (numbering_style IN ('numeric', 'alpha', 'alphanumeric')),
  padding           INTEGER DEFAULT 2,                 -- zero padding, e.g. 01
  level_format      VARCHAR(20) DEFAULT 'L{n}',        -- {n} replaced by tier number
  suffix            VARCHAR(20) DEFAULT '',
  sample            VARCHAR(120),                      -- live preview example
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at        TIMESTAMP WITH TIME ZONE,
  UNIQUE (layout_id, entity_type)
);

ALTER TABLE warehouse_naming_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_naming_rules_all_access" ON warehouse_naming_rules;
CREATE POLICY "warehouse_naming_rules_all_access" ON warehouse_naming_rules
  FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------
-- 9. CAPACITY PROFILES (configuration)
-- Reusable named capacity definitions assignable to racks/bins.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_capacity_profiles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  max_quantity    NUMERIC(14,3),
  max_weight_kg   NUMERIC(14,3),
  max_volume_m3   NUMERIC(14,3),
  max_pallets     INTEGER,
  is_active       BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_capacity_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_capacity_profiles_all_access" ON warehouse_capacity_profiles;
CREATE POLICY "warehouse_capacity_profiles_all_access" ON warehouse_capacity_profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_capacity_profiles_org ON warehouse_capacity_profiles(organisation_id);

-- ------------------------------------------------------------------
-- 10. BIN ↔ ITEM LOCATION MAPPING (Phase 3 ready)
-- Links inventory items to bins without forcing schema changes later.
-- Phase 3 will populate this; created now so the hierarchy is complete.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_bin_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bin_id          UUID NOT NULL REFERENCES warehouse_bins(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES materials(id) ON DELETE CASCADE,
  item_variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  quantity        NUMERIC(14,3) DEFAULT 0,
  is_primary      BOOLEAN DEFAULT false,               -- primary picking location
  is_reserve      BOOLEAN DEFAULT false,
  batch_no        VARCHAR(80),
  lot_no          VARCHAR(80),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

ALTER TABLE warehouse_bin_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_bin_items_all_access" ON warehouse_bin_items;
CREATE POLICY "warehouse_bin_items_all_access" ON warehouse_bin_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wh_bin_items_org ON warehouse_bin_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wh_bin_items_bin ON warehouse_bin_items(bin_id);
CREATE INDEX IF NOT EXISTS idx_wh_bin_items_item ON warehouse_bin_items(item_id);

-- ------------------------------------------------------------------
-- 11. GENERATION FUNCTION: build racks, tiers and bins from a config
-- Phase 1 uses this server-side generator so bin creation is atomic.
-- ------------------------------------------------------------------
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
  p_level_format VARCHAR DEFAULT 'L{n}'
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

  FOR v_i IN 1 .. v_count LOOP
    -- Rack
    INSERT INTO warehouse_racks
      (organisation_id, layout_id, name, code, rack_type, columns_count, levels_count, status, max_weight_kg)
    VALUES
      (p_organisation_id, p_layout_id, p_rack_names[v_i], p_rack_names[v_i], p_rack_type,
       p_columns[v_i], p_levels[v_i], 'available', NULL)
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
