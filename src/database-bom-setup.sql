-- ============================================================
-- BOM + Manufacturing Tables + RPCs (run in Supabase SQL Editor)
-- ============================================================

-- BOM Headers table
CREATE TABLE IF NOT EXISTS bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_code VARCHAR(50) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  output_qty DECIMAL(12,2) NOT NULL DEFAULT 100,
  output_unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOM Items table
CREATE TABLE IF NOT EXISTS bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  required_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'kg',
  wastage_pct DECIMAL(5,2) DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Cards table
CREATE TABLE IF NOT EXISTS job_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_no VARCHAR(50) UNIQUE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id),
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  output_unit VARCHAR(20) DEFAULT 'kg',
  priority VARCHAR(20) DEFAULT 'normal',
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  issued_by UUID,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Card Materials
CREATE TABLE IF NOT EXISTS job_card_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID REFERENCES job_cards(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  bom_item_id UUID REFERENCES bom_items(id) ON DELETE SET NULL,
  planned_qty DECIMAL(12,2) NOT NULL,
  issued_qty DECIMAL(12,2) DEFAULT 0,
  consumed_qty DECIMAL(12,2) DEFAULT 0,
  wastage_qty DECIMAL(12,2) DEFAULT 0,
  return_qty DECIMAL(12,2) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'kg',
  is_additional BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'reserved'
    CHECK (status IN ('reserved','issued','consumed','returned')),
  warehouse_id UUID REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Schedules table
CREATE TABLE IF NOT EXISTS production_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_no VARCHAR(50) UNIQUE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id),
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  output_unit VARCHAR(20) DEFAULT 'kg',
  scheduled_date DATE,
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC: BOM code generation
CREATE OR REPLACE FUNCTION generate_bom_code(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE next_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(bom_code FROM 5) AS INTEGER)), 0) + 1
  INTO next_code FROM bom_headers WHERE organisation_id = org_id;
  RETURN 'BOM-' || LPAD(next_code::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- RPC: Job Card number generation
CREATE OR REPLACE FUNCTION generate_job_card_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_card_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM job_cards WHERE organisation_id = org_id;
  RETURN 'JC-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- RPC: Schedule number generation
CREATE OR REPLACE FUNCTION generate_schedule_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(schedule_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM production_schedules WHERE organisation_id = org_id;
  RETURN 'PS-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_access" ON bom_headers;
DROP POLICY IF EXISTS "org_access" ON bom_items;
DROP POLICY IF EXISTS "org_access" ON job_cards;
DROP POLICY IF EXISTS "org_access" ON job_card_materials;
DROP POLICY IF EXISTS "org_access" ON production_schedules;

CREATE POLICY "org_access" ON bom_headers FOR ALL USING (
  organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "org_access" ON bom_items FOR ALL USING (
  bom_id IN (SELECT id FROM bom_headers WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "org_access" ON job_cards FOR ALL USING (
  organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "org_access" ON job_card_materials FOR ALL USING (
  job_card_id IN (SELECT id FROM job_cards WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "org_access" ON production_schedules FOR ALL USING (
  organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
);
