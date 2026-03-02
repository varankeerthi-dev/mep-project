-- Template Settings Module
-- Run this in Supabase SQL Editor

-- Document Templates Table
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name VARCHAR(255) NOT NULL,
  template_code VARCHAR(100) UNIQUE,
  document_type VARCHAR(50) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  page_size VARCHAR(20) DEFAULT 'A4',
  orientation VARCHAR(20) DEFAULT 'Portrait',
  show_logo BOOLEAN DEFAULT true,
  show_bank_details BOOLEAN DEFAULT true,
  show_terms BOOLEAN DEFAULT true,
  show_signature BOOLEAN DEFAULT true,
  column_settings JSONB DEFAULT '{
    "mandatory": ["sno", "item", "qty", "uom"],
    "optional": {
      "item_code": true,
      "variant": false,
      "description": true,
      "hsn_code": false,
      "rate": true,
      "discount_percent": true,
      "discount_amount": false,
      "tax_percent": true,
      "tax_amount": false,
      "line_total": true,
      "category": false,
      "brand": false
    }
  }',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON document_templates;
CREATE POLICY "Enable all access" ON document_templates FOR ALL USING (true) WITH CHECK (true);

-- Insert default templates for each document type
-- Only insert if no templates exist
INSERT INTO document_templates (template_name, document_type, is_default, page_size, orientation)
SELECT * FROM (SELECT 'Default Quotation', 'Quotation', true, 'A4', 'Portrait') AS t(template_name, document_type, is_default, page_size, orientation)
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE document_type = 'Quotation');

INSERT INTO document_templates (template_name, document_type, is_default, page_size, orientation)
SELECT * FROM (SELECT 'Default Sales Order', 'Sales Order', true, 'A4', 'Portrait') AS t(template_name, document_type, is_default, page_size, orientation)
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE document_type = 'Sales Order');

INSERT INTO document_templates (template_name, document_type, is_default, page_size, orientation)
SELECT * FROM (SELECT 'Default Proforma Invoice', 'Proforma Invoice', true, 'A4', 'Portrait') AS t(template_name, document_type, is_default, page_size, orientation)
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE document_type = 'Proforma Invoice');

INSERT INTO document_templates (template_name, document_type, is_default, page_size, orientation)
SELECT * FROM (SELECT 'Default Delivery Challan', 'Delivery Challan', true, 'A4', 'Portrait') AS t(template_name, document_type, is_default, page_size, orientation)
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE document_type = 'Delivery Challan');

INSERT INTO document_templates (template_name, document_type, is_default, page_size, orientation)
SELECT * FROM (SELECT 'Default Invoice', 'Invoice', true, 'A4', 'Portrait') AS t(template_name, document_type, is_default, page_size, orientation)
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE document_type = 'Invoice');

-- Function to set default template (removes default from others of same type)
CREATE OR REPLACE FUNCTION set_default_template(template_id UUID)
RETURNS VOID AS $$
DECLARE
  doc_type VARCHAR(50);
BEGIN
  SELECT document_type INTO doc_type FROM document_templates WHERE id = template_id;
  
  UPDATE document_templates 
  SET is_default = false 
  WHERE document_type = doc_type AND id != template_id;
  
  UPDATE document_templates 
  SET is_default = true 
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;
