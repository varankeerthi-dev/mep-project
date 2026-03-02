-- Add Classic GST Layout V2 Invoice Template
-- Run this in Supabase SQL Editor

-- 1. Add template_code column if not exists
ALTER TABLE document_templates 
ADD COLUMN IF NOT EXISTS template_code VARCHAR(50);

-- 2. Insert Classic GST Layout V2 template for Invoice
INSERT INTO document_templates (
  template_name, 
  template_code, 
  document_type, 
  is_default, 
  page_size, 
  orientation,
  show_logo,
  show_bank_details,
  show_terms,
  show_signature,
  column_settings,
  active
) VALUES (
  'Classic GST Layout V2',
  'INV_CLASSIC_V2',
  'Invoice',
  false,
  'A4',
  'Portrait',
  true,
  true,
  true,
  true,
  '{
    "mandatory": ["sno", "item", "qty", "uom"],
    "optional": {
      "item_code": true,
      "variant": false,
      "description": true,
      "hsn_code": true,
      "rate": true,
      "discount_percent": false,
      "discount_amount": false,
      "tax_percent": true,
      "tax_amount": false,
      "line_total": true,
      "category": false,
      "brand": false,
      "po_no": true,
      "eway_bill": true
    }
  }'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- 3. Add template_code column to project_invoices table if not exists
ALTER TABLE project_invoices 
ADD COLUMN IF NOT EXISTS invoice_template_code VARCHAR(50);

-- 4. Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_project_invoices_template_code ON project_invoices(invoice_template_code);

-- 5. Update existing templates with template_code if null
UPDATE document_templates 
SET template_code = 'QUO_DEFAULT' 
WHERE document_type = 'Quotation' AND template_code IS NULL;

UPDATE document_templates 
SET template_code = 'SO_DEFAULT' 
WHERE document_type = 'Sales Order' AND template_code IS NULL;

UPDATE document_templates 
SET template_code = 'PI_DEFAULT' 
WHERE document_type = 'Proforma Invoice' AND template_code IS NULL;

UPDATE document_templates 
SET template_code = 'DC_DEFAULT' 
WHERE document_type = 'Delivery Challan' AND template_code IS NULL;

UPDATE document_templates 
SET template_code = 'INV_DEFAULT' 
WHERE document_type = 'Invoice' AND template_code IS NULL;
