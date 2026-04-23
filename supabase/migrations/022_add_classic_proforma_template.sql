-- Add Classic Proforma Template (same format as Classic Quotation Template)
-- Run this in Supabase SQL Editor

INSERT INTO document_templates (
  template_name,
  template_code,
  document_type,
  template_type,
  page_size,
  orientation,
  show_logo,
  show_bank_details,
  show_terms,
  show_signature,
  column_settings,
  active
)
VALUES (
  'Classic Proforma Template',
  'PI_CLASSIC',
  'Proforma Invoice',
  'config',
  'A4',
  'Portrait',
  false,
  true,
  true,
  true,
  '{
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
    },
    "header_labels": {
      "document_no": "Proforma No.",
      "document_date": "Date",
      "po_no": "PO No.",
      "po_date": "PO Date",
      "valid_till": "Valid Till",
      "payment": "Payment Terms",
      "remarks": "Remarks",
      "eway_bill": "E-Way Bill"
    }
  }'::jsonb,
  true
)
ON CONFLICT (template_code) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  document_type = EXCLUDED.document_type,
  column_settings = EXCLUDED.column_settings,
  updated_at = NOW();
