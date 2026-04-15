-- Update Classic Quotation Template in database
-- Run this in Supabase SQL Editor

UPDATE document_templates
SET
  template_name = 'Classic Quotation Template',
  template_code = 'QTN_CLASSIC',
  document_type = 'Quotation',
  template_type = 'config',
  page_size = 'A4',
  orientation = 'Portrait',
  show_logo = false,
  show_bank_details = true,
  show_terms = true,
  show_signature = true,
  column_settings = '{
    "mandatory": ["sno", "item", "qty", "uom"],
    "optional": {
      "item_code": false,
      "variant": false,
      "description": true,
      "hsn_code": true,
      "rate": true,
      "discount_percent": false,
      "tax_percent": true,
      "line_total": true
    }
  }'::jsonb,
  active = true,
  updated_at = NOW()
WHERE template_code = 'QTN_CLASSIC';
