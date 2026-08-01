-- Migration for Manufacturing Module Gap Features
-- Date: July 30, 2026

-- =========================================================================
-- 1. Support Rejection Warehouses
-- =========================================================================
-- Recreate the check constraint on warehouses.warehouse_purpose to allow 'rejection'
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_warehouse_purpose_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_warehouse_purpose_check 
  CHECK (warehouse_purpose IN ('main', 'wip', 'fg', 'general', 'rejection'));


-- =========================================================================
-- 2. Dispatch Module Tables
-- =========================================================================

-- Dispatch Orders
CREATE TABLE IF NOT EXISTS dispatch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no TEXT NOT NULL UNIQUE,
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  planned_dispatch_date DATE,
  actual_dispatch_date DATE,
  status TEXT DEFAULT 'draft', -- draft | picking | packed | verified | dispatched | cancelled
  transport_mode TEXT,
  vehicle_number TEXT,
  driver_name TEXT,
  driver_contact TEXT,
  freight_charges NUMERIC(12,2) DEFAULT 0,
  tracking_number TEXT,
  estimated_delivery_date DATE,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dispatch Items
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  sales_order_item_id UUID, -- links to sales_order_items if exists
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  ordered_qty NUMERIC(12,3) NOT NULL,
  picked_qty NUMERIC(12,3) DEFAULT 0,
  packed_qty NUMERIC(12,3) DEFAULT 0,
  dispatched_qty NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  batch_no TEXT,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending | picking | packed | dispatched
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dispatch Packing Boxes/Cartons
CREATE TABLE IF NOT EXISTS dispatch_packing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  carton_number INTEGER NOT NULL,
  carton_type TEXT, -- box | crate | pallet
  length_cm NUMERIC(8,2),
  width_cm NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  gross_weight_kg NUMERIC(10,3),
  net_weight_kg NUMERIC(10,3),
  contents JSONB DEFAULT '[]'::jsonb, -- Array of items {material_id, qty, batch_no}
  handling_instructions TEXT,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blind Count Verification
CREATE TABLE IF NOT EXISTS dispatch_count_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  system_qty NUMERIC(12,3) NOT NULL,
  counted_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  variance_qty NUMERIC(12,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  variance_reason TEXT,
  status TEXT DEFAULT 'pending', -- pending | matched | discrepancy | resolved
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =========================================================================
-- 3. FG QC Acceptance Gate Tables
-- =========================================================================

-- Quality Control Parameters
CREATE TABLE IF NOT EXISTS qc_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES bom_headers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL, -- e.g. "Dimension", "Weight", "Color"
  specification TEXT NOT NULL,  -- e.g. "10 ± 0.5 cm"
  measurement_unit TEXT,
  test_method TEXT,
  aql_level TEXT DEFAULT 'II',
  severity TEXT DEFAULT 'major', -- critical | major | minor
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quality Inspections for Finished Goods
CREATE TABLE IF NOT EXISTS fg_qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no TEXT NOT NULL UNIQUE,
  production_entry_id UUID REFERENCES production_entries(id) ON DELETE SET NULL,
  job_card_id UUID REFERENCES job_cards(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  batch_no TEXT NOT NULL,
  produced_qty NUMERIC(12,3) NOT NULL,
  sample_size NUMERIC(12,3),
  accepted_qty NUMERIC(12,3) DEFAULT 0,
  rejected_qty NUMERIC(12,3) DEFAULT 0,
  rework_qty NUMERIC(12,3) DEFAULT 0,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inspection_result TEXT DEFAULT 'pending', -- pending | accepted | partially_accepted | rejected
  defect_categories JSONB DEFAULT '[]'::jsonb, -- Defect breakdown categories
  remarks TEXT,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- QC Parameter Measurements/Results
CREATE TABLE IF NOT EXISTS qc_parameter_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES fg_qc_inspections(id) ON DELETE CASCADE,
  parameter_id UUID NOT NULL REFERENCES qc_parameters(id) ON DELETE CASCADE,
  measured_value TEXT,
  is_pass BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- =========================================================================
-- 4. Stores Independent Console Tables
-- =========================================================================

-- Production Material Requisitions
CREATE TABLE IF NOT EXISTS material_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_no TEXT NOT NULL UNIQUE,
  job_card_id UUID REFERENCES job_cards(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  status TEXT DEFAULT 'draft', -- draft | submitted | approved | partially_issued | issued | rejected
  remarks TEXT,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES material_requisitions(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  required_qty NUMERIC(12,3) NOT NULL,
  issued_qty NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  stock_available NUMERIC(12,3),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending | issued | short_supplied
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Goods Receipt Notes (GRN) for Purchasing/Stores Inward
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_no TEXT NOT NULL UNIQUE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date DATE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft', -- draft | qc_pending | qc_passed | qc_failed | accepted | rejected
  vehicle_number TEXT,
  challan_number TEXT,
  remarks TEXT,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  purchase_order_item_id UUID,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  ordered_qty NUMERIC(12,3) NOT NULL,
  received_qty NUMERIC(12,3) NOT NULL,
  accepted_qty NUMERIC(12,3) DEFAULT 0,
  rejected_qty NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  batch_no TEXT,
  expiry_date DATE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending | qc_passed | qc_failed | accepted
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Raw Materials QC Inspection (for incoming raw goods)
CREATE TABLE IF NOT EXISTS rm_qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  inspection_no TEXT NOT NULL UNIQUE,
  inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  result TEXT DEFAULT 'pending', -- pending | passed | failed | conditional
  remarks TEXT,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- =========================================================================
-- 5. Row Level Security policies
-- =========================================================================

ALTER TABLE dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_packing ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_count_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE fg_qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_parameter_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rm_qc_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for dispatch_orders" ON dispatch_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for dispatch_items" ON dispatch_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for dispatch_packing" ON dispatch_packing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for dispatch_count_verification" ON dispatch_count_verification FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for qc_parameters" ON qc_parameters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for fg_qc_inspections" ON fg_qc_inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for qc_parameter_results" ON qc_parameter_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for material_requisitions" ON material_requisitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for material_requisition_items" ON material_requisition_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for goods_receipt_notes" ON goods_receipt_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for grn_items" ON grn_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for rm_qc_inspections" ON rm_qc_inspections FOR ALL USING (true) WITH CHECK (true);
