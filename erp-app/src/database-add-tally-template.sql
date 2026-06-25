-- Add Tally Style Template to Quotations
-- Run this in Supabase SQL Editor

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
  column_settings
)
VALUES (
  'Tally template',
  'QTN_TALLY',
  'Quotation',
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
      "item_code": true,
      "variant": false,
      "description": true,
      "hsn_code": true,
      "rate": true,
      "discount_percent": true,
      "discount_amount": false,
      "rate_after_discount": false,
      "tax_percent": true,
      "tax_amount": false,
      "line_total": true,
      "category": false,
      "brand": false,
      "subtotal": true,
      "total_tax": true,
      "round_off": true,
      "grand_total": true
    },
    "labels": {
      "rate_after_discount": "Rate/Unit"
    }
  }'::jsonb
)
ON CONFLICT (template_code) DO NOTHING;
