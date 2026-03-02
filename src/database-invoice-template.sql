-- ============================================
-- Invoice Template System Enhancement
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add invoice_template_code column to project_invoices table
ALTER TABLE project_invoices 
ADD COLUMN IF NOT EXISTS invoice_template_code VARCHAR(50);

-- 2. Add template_code column to document_templates table for easier reference
ALTER TABLE document_templates 
ADD COLUMN IF NOT EXISTS template_code VARCHAR(50);

-- 3. Add unique constraint if not exists (handle duplicates gracefully)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'document_templates_template_code_key'
  ) THEN
    ALTER TABLE document_templates 
    ADD CONSTRAINT document_templates_template_code_key UNIQUE (template_code);
  END IF;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- 4. Update existing templates with template codes if they don't have one
UPDATE document_templates SET template_code = 'QUO_DEFAULT' 
WHERE document_type = 'Quotation' AND template_code IS NULL 
AND (template_name LIKE '%Default%' OR is_default = true);

UPDATE document_templates SET template_code = 'SO_DEFAULT' 
WHERE document_type = 'Sales Order' AND template_code IS NULL 
AND (template_name LIKE '%Default%' OR is_default = true);

UPDATE document_templates SET template_code = 'PI_DEFAULT' 
WHERE document_type = 'Proforma Invoice' AND template_code IS NULL 
AND (template_name LIKE '%Default%' OR is_default = true);

UPDATE document_templates SET template_code = 'DC_DEFAULT' 
WHERE document_type = 'Delivery Challan' AND template_code IS NULL 
AND (template_name LIKE '%Default%' OR is_default = true);

UPDATE document_templates SET template_code = 'INV_DEFAULT' 
WHERE document_type = 'Invoice' AND template_code IS NULL 
AND (template_name LIKE '%Default%' OR is_default = true);

-- 5. Insert the Classic GST Layout V2 template for Invoice
INSERT INTO document_templates (
  template_name, 
  document_type, 
  template_code,
  is_default, 
  page_size, 
  orientation,
  show_logo,
  show_bank_details,
  show_terms,
  show_signature,
  column_settings,
  active
) 
SELECT 
  'Classic GST Layout V2',
  'Invoice',
  'INV_CLASSIC_V2',
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
      "sno": true,
      "item": true,
      "qty": true,
      "uom": true,
      "hsn_code": true,
      "rate": true,
      "tax_percent": true,
      "line_total": true,
      "bank_details": true,
      "po_no": true,
      "eway_bill": true,
      "remarks": true
    }
  }'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates 
  WHERE template_code = 'INV_CLASSIC_V2'
);

-- 6. Create function to set default invoice template
CREATE OR REPLACE FUNCTION set_default_invoice_template(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE document_templates 
  SET is_default = false 
  WHERE document_type = 'Invoice' AND id != template_id;
  
  UPDATE document_templates 
  SET is_default = true 
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Create index for faster template lookups
CREATE INDEX IF NOT EXISTS idx_document_templates_code ON document_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_project_invoices_template_code ON project_invoices(invoice_template_code);

-- ============================================
-- DONE!
-- ============================================
