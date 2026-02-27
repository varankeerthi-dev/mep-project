-- Quick Stock Check Module
-- Run this in Supabase SQL Editor

-- Quick Checks Table
CREATE TABLE IF NOT EXISTS quick_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES organisations(id),
  check_no VARCHAR(50) UNIQUE NOT NULL,
  client_name TEXT,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  variant_filter VARCHAR(20) DEFAULT 'All',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE quick_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON quick_checks;
CREATE POLICY "Enable all access" ON quick_checks FOR ALL USING (true) WITH CHECK (true);

-- Quick Check Items Table
CREATE TABLE IF NOT EXISTS quick_check_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quick_check_id UUID REFERENCES quick_checks(id) ON DELETE CASCADE,
  item_id UUID REFERENCES materials(id),
  company_variant_id UUID,
  qty_required DECIMAL(10,2) DEFAULT 0,
  warehouse_snapshot JSONB DEFAULT '{}',
  total_available DECIMAL(10,2) DEFAULT 0,
  pending_qty DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE quick_check_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON quick_check_items;
CREATE POLICY "Enable all access" ON quick_check_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quick_checks_date ON quick_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_quick_check_items_quick_check ON quick_check_items(quick_check_id);
