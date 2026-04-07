-- ============================================================
-- PROJECT MATERIAL MANAGEMENT SYSTEM MIGRATION
-- Run this in Supabase SQL editor
-- ============================================================

-- 1. PROJECT BOQ - Bill of Quantities per project
CREATE TABLE IF NOT EXISTS project_boq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  item_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  estimated_qty NUMERIC DEFAULT 0,
  unit_rate NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, item_id, variant_id)
);

ALTER TABLE project_boq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON project_boq FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_project_boq_org ON project_boq(organisation_id);
CREATE INDEX IF NOT EXISTS idx_project_boq_project ON project_boq(project_id);
CREATE INDEX IF NOT EXISTS idx_project_boq_item ON project_boq(item_id);

-- 2. PROJECT RATES - Fixed selling rates per project
CREATE TABLE IF NOT EXISTS project_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  item_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  selling_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, item_id, variant_id)
);

ALTER TABLE project_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON project_rates FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_project_rates_org ON project_rates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_project_rates_project ON project_rates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_rates_item ON project_rates(item_id);

-- 3. MATERIAL INTENTS - Engineer requests for materials
CREATE TABLE IF NOT EXISTS material_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  requested_by_name TEXT,
  item_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  variant_name TEXT,
  uom TEXT,
  requested_qty NUMERIC DEFAULT 0,
  received_qty NUMERIC DEFAULT 0,
  pending_qty NUMERIC DEFAULT 0,
  required_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Partial', 'Received', 'Rejected')),
  priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Emergency')),
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE material_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON material_intents FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_material_intents_org ON material_intents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_material_intents_project ON material_intents(project_id);
CREATE INDEX IF NOT EXISTS idx_material_intents_status ON material_intents(status);
CREATE INDEX IF NOT EXISTS idx_material_intents_priority ON material_intents(priority);
CREATE INDEX IF NOT EXISTS idx_material_intents_item ON material_intents(item_id);

-- 4. MATERIAL LOGS - Receipt and consumption tracking
CREATE TABLE IF NOT EXISTS material_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  intent_id UUID REFERENCES material_intents(id) ON DELETE SET NULL,
  item_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  qty_received NUMERIC DEFAULT 0,
  qty_used NUMERIC DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  supplier_id UUID REFERENCES purchase_vendors(id) ON DELETE SET NULL,
  supplier_name TEXT,
  purchase_price NUMERIC DEFAULT 0,
  dc_number TEXT,
  invoice_number TEXT,
  dc_date DATE,
  received_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  received_by_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE material_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON material_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_material_logs_org ON material_logs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_material_logs_project ON material_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_material_logs_intent ON material_logs(intent_id);
CREATE INDEX IF NOT EXISTS idx_material_logs_item ON material_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_material_logs_type ON material_logs(type);
CREATE INDEX IF NOT EXISTS idx_material_logs_date ON material_logs(created_at);

-- 5. Add organisation_id to projects if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organisation_id);
  END IF;
END $$;

-- 6. Add organisation_id to materials if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'materials' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE materials ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_materials_org ON materials(organisation_id);
  END IF;
END $$;

-- 7. Add organisation_id to purchase_vendors if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_vendors' AND column_name = 'organisation_id'
  ) THEN
    ALTER TABLE purchase_vendors ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_purchase_vendors_org ON purchase_vendors(organisation_id);
  END IF;
END $$;