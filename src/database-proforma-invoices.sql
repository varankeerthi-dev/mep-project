-- Proforma Invoice Module
-- Migration: Create proforma_invoices and proforma_items tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Proforma Invoices Table
CREATE TABLE IF NOT EXISTS proforma_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  company_state TEXT,
  client_state TEXT,
  valid_until DATE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  source_type TEXT CHECK (source_type IN ('quotation', 'challan', 'po', 'manual')),
  source_id UUID,
  converted_invoice_id UUID REFERENCES invoices(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proforma Items Table
CREATE TABLE IF NOT EXISTS proforma_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proforma_id UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hsn_code TEXT,
  qty NUMERIC(15,3) NOT NULL DEFAULT 1,
  rate NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  meta_json JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_org 
  ON proforma_invoices(organisation_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_client 
  ON proforma_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_status 
  ON proforma_invoices(status);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_created 
  ON proforma_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_source 
  ON proforma_invoices(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_proforma_items_proforma 
  ON proforma_items(proforma_id);
CREATE INDEX IF NOT EXISTS idx_proforma_items_org 
  ON proforma_items(organisation_id);

-- Row Level Security
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proforma_invoices
DROP POLICY IF EXISTS "proforma_invoices_org_select" ON proforma_invoices;
CREATE POLICY "proforma_invoices_org_select" ON proforma_invoices
  FOR SELECT USING (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "proforma_invoices_org_insert" ON proforma_invoices;
CREATE POLICY "proforma_invoices_org_insert" ON proforma_invoices
  FOR INSERT WITH CHECK (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "proforma_invoices_org_update" ON proforma_invoices;
CREATE POLICY "proforma_invoices_org_update" ON proforma_invoices
  FOR UPDATE USING (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "proforma_invoices_org_delete" ON proforma_invoices;
CREATE POLICY "proforma_invoices_org_delete" ON proforma_invoices
  FOR DELETE USING (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

-- RLS Policies for proforma_items
DROP POLICY IF EXISTS "proforma_items_org_select" ON proforma_items;
CREATE POLICY "proforma_items_org_select" ON proforma_items
  FOR SELECT USING (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "proforma_items_org_insert" ON proforma_items;
CREATE POLICY "proforma_items_org_insert" ON proforma_items
  FOR INSERT WITH CHECK (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "proforma_items_org_update" ON proforma_items;
CREATE POLICY "proforma_items_org_update" ON proforma_items
  FOR UPDATE USING (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "proforma_items_org_delete" ON proforma_items;
CREATE POLICY "proforma_items_org_delete" ON proforma_items
  FOR DELETE USING (organisation_id = (SELECT organisation_id FROM auth.users WHERE id = auth.uid()));

-- Function to generate proforma invoice number
CREATE OR REPLACE FUNCTION generate_proforma_number(org_id UUID, year INTEGER)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
  result TEXT;
BEGIN
  prefix := 'PI/' || year || '/';
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN substring(pi_number FROM 1 FOR length(prefix)) = prefix 
      THEN substring(pi_number FROM length(prefix) + 1 FOR 6)::INTEGER 
      ELSE 0 
    END
  ), 0) + 1 INTO next_num
  FROM proforma_invoices
  WHERE organisation_id = org_id AND pi_number LIKE prefix || '%';
  
  result := prefix || lpad(next_num::TEXT, 6, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add pi_number column if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proforma_invoices' AND column_name = 'pi_number') THEN
    ALTER TABLE proforma_invoices ADD COLUMN pi_number TEXT;
  END IF;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON TABLE proforma_invoices IS 'Proforma invoices - preliminary invoices sent to clients before final invoice';
COMMENT ON TABLE proforma_items IS 'Line items for proforma invoices';