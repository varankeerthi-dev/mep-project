-- 078_production_schedule_items.sql
-- Adds production_schedule_items (one row per BOM in a multi-product schedule)
-- and the missing generate_schedule_no RPC.
--
-- This migration assumes production_schedules already exists as a header-only
-- table (as created by database-manufacturing.sql). It does NOT alter
-- production_schedules because that table has no per-product columns.

-- ============================================================
-- 1. CREATE PRODUCTION_SCHEDULE_ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS production_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES production_schedules(id) ON DELETE CASCADE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE RESTRICT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  output_unit VARCHAR(20) DEFAULT 'nos',
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_schedule_items_schedule
  ON production_schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_schedule_items_bom
  ON production_schedule_items(bom_id);

ALTER TABLE production_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON production_schedule_items FOR ALL USING (
  schedule_id IN (
    SELECT id FROM production_schedules WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================
-- 2. GENERATE_SCHEDULE_NO RPC
-- ============================================================

CREATE OR REPLACE FUNCTION generate_schedule_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(schedule_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM production_schedules WHERE organisation_id = org_id;
  RETURN 'PS-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. AUTO-BUMP UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_production_schedules_updated_at ON production_schedules;
CREATE TRIGGER trg_production_schedules_updated_at
  BEFORE UPDATE ON production_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_production_schedule_items_updated_at ON production_schedule_items;
CREATE TRIGGER trg_production_schedule_items_updated_at
  BEFORE UPDATE ON production_schedule_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();