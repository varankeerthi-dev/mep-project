-- ============================================================
-- PROCUREMENT MODULE MIGRATION
-- Run this in Supabase SQL editor
-- ============================================================

-- 1. PROCUREMENT LISTS (header per BOQ/Quotation/Manual)
CREATE TABLE IF NOT EXISTS procurement_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                          -- e.g. "BOQ-001 Stock Check" or "Manual - Client A"
  source TEXT DEFAULT 'manual',                 -- 'manual' | 'quotation' | 'boq'
  quotation_id UUID REFERENCES quotation_header(id) ON DELETE SET NULL,
  quotation_no TEXT,                            -- snapshot
  boq_id UUID,                                  -- references boq_header if exists
  boq_no TEXT,                                  -- snapshot
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT,                             -- snapshot
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  project_name TEXT,                            -- snapshot
  notes TEXT,
  status TEXT DEFAULT 'Active',                 -- 'Active' | 'Archived'
  archived_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE procurement_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON procurement_lists FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_procurement_lists_org ON procurement_lists(organisation_id);
CREATE INDEX IF NOT EXISTS idx_procurement_lists_status ON procurement_lists(status);
CREATE INDEX IF NOT EXISTS idx_procurement_lists_source ON procurement_lists(source);

-- 2. PROCUREMENT ITEMS (line items per list)
CREATE TABLE IF NOT EXISTS procurement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES procurement_lists(id) ON DELETE CASCADE,
  item_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  make TEXT,
  variant_name TEXT,
  uom TEXT,
  boq_qty NUMERIC DEFAULT 0,
  stock_qty NUMERIC DEFAULT 0,
  local_qty NUMERIC DEFAULT 0,
  vendor_id UUID REFERENCES purchase_vendors(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'Pending',               -- Pending | Sourcing | PO Raised | Received | Dispatched
  display_order INTEGER DEFAULT 0,
  is_header_row BOOLEAN DEFAULT FALSE,          -- for section headers from BOQ
  header_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- gap is computed on the fly in the app (boq_qty - stock_qty - local_qty)
-- Not a generated column so it can handle negative values cleanly

ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON procurement_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_procurement_items_list ON procurement_items(list_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_org ON procurement_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_vendor ON procurement_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_status ON procurement_items(status);
