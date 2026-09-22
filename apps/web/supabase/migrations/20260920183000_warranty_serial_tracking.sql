-- Warranty & Serial Tracking Module — Phase 1: Database Schema
-- Adds warranty/serial tracking to materials, GRN, warehouse, DC
-- Creates vendor_returns and vendor_return_items tables

-- ============================================================
-- 1. MATERIALS TABLE — Item master warranty/serial flags
-- ============================================================

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS has_warranty boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_period integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_unit varchar DEFAULT NULL CHECK (warranty_unit IN ('months', 'years')),
  ADD COLUMN IF NOT EXISTS has_serial_number boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS serial_number_format varchar DEFAULT NULL;

-- Indexes for filtering serialized/warrantied items
CREATE INDEX IF NOT EXISTS idx_materials_has_serial ON public.materials(has_serial_number) WHERE has_serial_number = true;
CREATE INDEX IF NOT EXISTS idx_materials_has_warranty ON public.materials(has_warranty) WHERE has_warranty = true;
CREATE INDEX IF NOT EXISTS idx_materials_organisation_id ON public.materials(organisation_id);

-- ============================================================
-- 2. GRN_ITEMS TABLE — Serial/warranty capture at goods receipt
-- ============================================================

ALTER TABLE public.grn_items
  ADD COLUMN IF NOT EXISTS serial_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_start_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_end_date date DEFAULT NULL;

-- Indexes for serial lookup
CREATE INDEX IF NOT EXISTS idx_grn_items_serial ON public.grn_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON public.grn_items(grn_id);

-- ============================================================
-- 3. WAREHOUSE_BIN_ITEMS TABLE — Serial/warranty tracking in inventory
-- ============================================================

ALTER TABLE public.warehouse_bin_items
  ADD COLUMN IF NOT EXISTS serial_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_start_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS returned_to_supplier boolean DEFAULT false;

-- Indexes for warranty tracking and vendor returns
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_items_serial ON public.warehouse_bin_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_items_warranty_end ON public.warehouse_bin_items(warranty_end_date) WHERE warranty_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_items_returned ON public.warehouse_bin_items(returned_to_supplier) WHERE returned_to_supplier = true;
CREATE INDEX IF NOT EXISTS idx_warehouse_bin_items_org ON public.warehouse_bin_items(organisation_id);

-- ============================================================
-- 4. DELIVERY_CHALLAN_ITEMS TABLE — Serial/warranty at sales delivery
-- ============================================================

ALTER TABLE public.delivery_challan_items
  ADD COLUMN IF NOT EXISTS serial_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_start_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warranty_end_date date DEFAULT NULL;

-- Indexes for post-sales tracking
CREATE INDEX IF NOT EXISTS idx_dc_items_serial ON public.delivery_challan_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dc_items_dc_id ON public.delivery_challan_items(delivery_challan_id);

-- ============================================================
-- 5. VENDOR_RETURNS TABLE — New vendor return header
-- ============================================================

CREATE TABLE public.vendor_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  grn_id uuid DEFAULT NULL,
  purchase_bill_id uuid DEFAULT NULL,
  return_number varchar NOT NULL,
  return_date date NOT NULL,
  reason text NOT NULL,
  return_type varchar DEFAULT 'credit_note' CHECK (return_type IN ('credit_note', 'delivery_challan')),
  status varchar DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'returned', 'credited', 'cancelled')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_vendor_returns_organisation ON public.vendor_returns(organisation_id);
CREATE INDEX idx_vendor_returns_vendor ON public.vendor_returns(vendor_id);
CREATE INDEX idx_vendor_returns_status ON public.vendor_returns(status);
CREATE INDEX idx_vendor_returns_grn ON public.vendor_returns(grn_id);

-- ============================================================
-- 6. VENDOR_RETURN_ITEMS TABLE — Serial-level return tracking
-- ============================================================

CREATE TABLE public.vendor_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_return_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  material_id uuid NOT NULL,
  grn_item_id uuid DEFAULT NULL,
  serial_number text DEFAULT NULL,
  quantity numeric NOT NULL,
  unit varchar NOT NULL,
  batch_no varchar DEFAULT NULL,
  warranty_start_date date DEFAULT NULL,
  warranty_end_date date DEFAULT NULL,
  reason text DEFAULT NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_vendor_return_items_return ON public.vendor_return_items(vendor_return_id);
CREATE INDEX idx_vendor_return_items_serial ON public.vendor_return_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_vendor_return_items_org ON public.vendor_return_items(organisation_id);

-- ============================================================
-- 7. FOREIGN KEYS
-- ============================================================

-- FK: vendor_returns → organisations
ALTER TABLE public.vendor_returns
  ADD CONSTRAINT fk_vendor_returns_organisation 
  FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);

-- FK: vendor_returns → purchase_vendors
ALTER TABLE public.vendor_returns
  ADD CONSTRAINT fk_vendor_returns_vendor 
  FOREIGN KEY (vendor_id) REFERENCES public.purchase_vendors(id);

-- FK: vendor_returns → goods_receipt_notes (optional link)
ALTER TABLE public.vendor_returns
  ADD CONSTRAINT fk_vendor_returns_grn 
  FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id) ON DELETE SET NULL;

-- FK: vendor_return_items → vendor_returns
ALTER TABLE public.vendor_return_items
  ADD CONSTRAINT fk_vendor_return_items_return 
  FOREIGN KEY (vendor_return_id) REFERENCES public.vendor_returns(id) ON DELETE CASCADE;

-- FK: vendor_return_items → materials
ALTER TABLE public.vendor_return_items
  ADD CONSTRAINT fk_vendor_return_items_material 
  FOREIGN KEY (material_id) REFERENCES public.materials(id);

-- FK: vendor_return_items → grn_items (optional link)
ALTER TABLE public.vendor_return_items
  ADD CONSTRAINT fk_vendor_return_items_grn 
  FOREIGN KEY (grn_item_id) REFERENCES public.grn_items(id) ON DELETE SET NULL;

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.vendor_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_return_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: vendor_returns
CREATE POLICY "Users can view their org vendor returns" ON public.vendor_returns
  FOR SELECT USING (public.user_can_access_org(organisation_id));

CREATE POLICY "Users can insert vendor returns in their org" ON public.vendor_returns
  FOR INSERT WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY "Users can update their org vendor returns" ON public.vendor_returns
  FOR UPDATE USING (public.user_can_access_org(organisation_id));

CREATE POLICY "Users can delete their org vendor returns" ON public.vendor_returns
  FOR DELETE USING (public.user_can_access_org(organisation_id));

-- RLS Policies: vendor_return_items
CREATE POLICY "Users can view their org vendor return items" ON public.vendor_return_items
  FOR SELECT USING (public.user_can_access_org(organisation_id));

CREATE POLICY "Users can insert vendor return items in their org" ON public.vendor_return_items
  FOR INSERT WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY "Users can update their org vendor return items" ON public.vendor_return_items
  FOR UPDATE USING (public.user_can_access_org(organisation_id));

CREATE POLICY "Users can delete their org vendor return items" ON public.vendor_return_items
  FOR DELETE USING (public.user_can_access_org(organisation_id));

-- ============================================================
-- 9. GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_return_items TO authenticated;
