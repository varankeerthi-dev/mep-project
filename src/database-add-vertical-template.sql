-- Add Vertical Style Template (High Fidelity React Rendering)
-- Run this in Supabase SQL Editor to make the template available in the UI

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
  'Vertical template',
  'QTN_VERTICAL',
  'Quotation',
  false,
  'A4',
  'Portrait',
  true,
  true,
  true,
  true,
  '{
    "print": {
      "style": "vertical"
    },
    "mandatory": ["sno", "item", "qty"],
    "optional": {
      "sno": true, "hsn": true, "item": true, "qty": true, "uom": true, "rate": true, "amount": true
    },
    "labels": {
      "sno": "S.No.",
      "hsn": "HSN Code",
      "item": "Item & Description",
      "qty": "Qty",
      "uom": "UOM",
      "rate": "Rate (INR)",
      "amount": "Amount (INR)"
    }
  }'::jsonb
)
ON CONFLICT (template_code) DO UPDATE 
SET template_name = EXCLUDED.template_name,
    document_type = EXCLUDED.document_type,
    column_settings = EXCLUDED.column_settings;
