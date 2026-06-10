-- Phase 2: Multi-DC → Quotation system
-- Junction table for linking DCs to quotations/proformas/invoices

-- Junction table: quotation ↔ DC links
CREATE TABLE IF NOT EXISTS quotation_dc_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES quotation_header(id) ON DELETE CASCADE,
  delivery_challan_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quotation_id, delivery_challan_id)
);

-- Junction table: proforma ↔ DC links
CREATE TABLE IF NOT EXISTS proforma_dc_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proforma_id UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  delivery_challan_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proforma_id, delivery_challan_id)
);

-- Junction table: invoice ↔ DC links
CREATE TABLE IF NOT EXISTS invoice_dc_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  delivery_challan_id UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, delivery_challan_id)
);

-- Add conversion_status to delivery_challans
ALTER TABLE delivery_challans
  ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT 'active';

-- Add invoiced_amount to delivery_challans (tracks how much has been invoiced)
ALTER TABLE delivery_challans
  ADD COLUMN IF NOT EXISTS invoiced_amount NUMERIC(12,2) DEFAULT 0;

-- Add multi_dc_mode to quotation_header (stores the layout mode used)
ALTER TABLE quotation_header
  ADD COLUMN IF NOT EXISTS multi_dc_mode TEXT;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotation_dc_links_quotation ON quotation_dc_links(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_dc_links_dc ON quotation_dc_links(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_proforma_dc_links_proforma ON proforma_dc_links(proforma_id);
CREATE INDEX IF NOT EXISTS idx_proforma_dc_links_dc ON proforma_dc_links(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_invoice_dc_links_invoice ON invoice_dc_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_dc_links_dc ON invoice_dc_links(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_dc_conversion_status ON delivery_challans(conversion_status);

-- RPC: Lock DCs for quotation conversion (sets status to 'pending_conversion')
CREATE OR REPLACE FUNCTION lock_dcs_for_quotation(dc_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE delivery_challans
  SET conversion_status = 'pending_conversion'
  WHERE id = ANY(dc_ids)
    AND conversion_status = 'active';
END;
$$ LANGUAGE plpgsql;

-- RPC: Release DCs (reverts to 'active' if conversion was cancelled)
CREATE OR REPLACE FUNCTION release_dcs_for_quotation(dc_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE delivery_challans
  SET conversion_status = 'active'
  WHERE id = ANY(dc_ids)
    AND conversion_status = 'pending_conversion';
END;
$$ LANGUAGE plpgsql;

-- RPC: Mark DCs as quoted after quotation is saved
CREATE OR REPLACE FUNCTION mark_dcs_quoted(dc_ids UUID[], quotation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE delivery_challans
  SET conversion_status = 'quoted'
  WHERE id = ANY(dc_ids)
    AND conversion_status IN ('active', 'pending_conversion');
END;
$$ LANGUAGE plpgsql;

-- RPC: Deduct stock with race condition protection
CREATE OR REPLACE FUNCTION deduct_stock(
  p_item_id UUID,
  p_variant_id UUID,
  p_warehouse_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_current_stock NUMERIC;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT current_stock INTO v_current_stock
  FROM item_stock
  WHERE item_id = p_item_id
    AND company_variant_id = p_variant_id
    AND warehouse_id = p_warehouse_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Stock record not found for item % in warehouse %', p_item_id, p_warehouse_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_current_stock, p_quantity;
  END IF;

  UPDATE item_stock
  SET current_stock = current_stock - p_quantity,
      updated_at = now()
  WHERE item_id = p_item_id
    AND company_variant_id = p_variant_id
    AND warehouse_id = p_warehouse_id;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for junction tables
ALTER TABLE quotation_dc_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_dc_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_dc_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_quotation_dc_links" ON quotation_dc_links
  FOR SELECT USING (true);

CREATE POLICY "org_insert_quotation_dc_links" ON quotation_dc_links
  FOR INSERT WITH CHECK (true);

CREATE POLICY "org_delete_quotation_dc_links" ON quotation_dc_links
  FOR DELETE USING (true);

CREATE POLICY "org_read_proforma_dc_links" ON proforma_dc_links
  FOR SELECT USING (true);

CREATE POLICY "org_insert_proforma_dc_links" ON proforma_dc_links
  FOR INSERT WITH CHECK (true);

CREATE POLICY "org_delete_proforma_dc_links" ON proforma_dc_links
  FOR DELETE USING (true);

CREATE POLICY "org_read_invoice_dc_links" ON invoice_dc_links
  FOR SELECT USING (true);

CREATE POLICY "org_insert_invoice_dc_links" ON invoice_dc_links
  FOR INSERT WITH CHECK (true);

CREATE POLICY "org_delete_invoice_dc_links" ON invoice_dc_links
  FOR DELETE USING (true);
