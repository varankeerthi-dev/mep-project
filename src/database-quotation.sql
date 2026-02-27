-- Quotation Module Database Structure
-- Run this in Supabase SQL Editor

-- Quotation Header Table
CREATE TABLE IF NOT EXISTS quotation_header (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_no VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  billing_address TEXT,
  gstin VARCHAR(50),
  state VARCHAR(100),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_till DATE,
  payment_terms TEXT,
  reference VARCHAR(255),
  subtotal DECIMAL(15,2) DEFAULT 0,
  total_item_discount DECIMAL(15,2) DEFAULT 0,
  extra_discount_percent DECIMAL(5,2) DEFAULT 0,
  extra_discount_amount DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  round_off DECIMAL(15,2) DEFAULT 0,
  grand_total DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Draft',
  negotiation_mode BOOLEAN DEFAULT false,
  template_id UUID,
  revised_from_id UUID REFERENCES quotation_header(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE quotation_header ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON quotation_header;
CREATE POLICY "Enable all access" ON quotation_header FOR ALL USING (true) WITH CHECK (true);

-- Quotation Items Table
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID REFERENCES quotation_header(id) ON DELETE CASCADE,
  item_id UUID REFERENCES materials(id),
  variant_id UUID,
  description TEXT,
  qty DECIMAL(10,2) DEFAULT 1,
  uom VARCHAR(50),
  rate DECIMAL(15,2) DEFAULT 0,
  original_discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) DEFAULT 0,
  override_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON quotation_items;
CREATE POLICY "Enable all access" ON quotation_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quotation_header_client ON quotation_header(client_id);
CREATE INDEX IF NOT EXISTS idx_quotation_header_project ON quotation_header(project_id);
CREATE INDEX IF NOT EXISTS idx_quotation_header_status ON quotation_header(status);
CREATE INDEX IF NOT EXISTS idx_quotation_header_date ON quotation_header(date);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- Document Series for Quotation Number Generation
-- Note: Quotation number is generated in application code by querying max existing number
-- This table is optional and centralized can be used for number management
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_series') THEN
    CREATE TABLE document_series (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      document_type VARCHAR(50) UNIQUE NOT NULL,
      prefix VARCHAR(20) DEFAULT '',
      suffix VARCHAR(20) DEFAULT '',
      next_number INTEGER DEFAULT 1,
      padding INTEGER DEFAULT 4,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE document_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON document_series;
CREATE POLICY "Enable all access" ON document_series FOR ALL USING (true) WITH CHECK (true);
