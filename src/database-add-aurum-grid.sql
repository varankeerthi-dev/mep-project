-- AURUM GRID - Business Document Suite Registration
-- Run this in Supabase SQL Editor

-- 1. AURUM GRID – Tax Invoice
INSERT INTO document_templates (
  template_name, template_code, document_type, is_default, page_size, orientation,
  show_logo, show_bank_details, show_terms, show_signature, column_settings
) VALUES (
  'AURUM GRID – Tax Invoice', 'DOC_AURUM_INV_V1', 'Invoice', false, 'A4', 'Portrait',
  true, true, true, true,
  '{
    "mandatory": ["sno", "item", "qty"],
    "optional": { "sno": true, "hsn_code": true, "item": true, "qty": true, "uom": true, "rate": true, "tax_percent": true, "line_total": true },
    "labels": { "rate_after_discount": "Rate" },
    "header_labels": {
      "document_title": "Tax Invoice", "document_no": "Invoice No", "document_date": "Invoice Date", "po_no": "PO No", "eway_bill": "E-Way Bill"
    }
  }'::jsonb
) ON CONFLICT (template_code) DO UPDATE SET template_name = EXCLUDED.template_name, column_settings = EXCLUDED.column_settings;

-- 2. AURUM GRID – Quotation
INSERT INTO document_templates (
  template_name, template_code, document_type, is_default, page_size, orientation,
  show_logo, show_bank_details, show_terms, show_signature, column_settings
) VALUES (
  'AURUM GRID – Quotation', 'DOC_AURUM_QUO_V1', 'Quotation', false, 'A4', 'Portrait',
  true, true, true, true,
  '{
    "mandatory": ["sno", "item", "qty"],
    "optional": { "sno": true, "item": true, "description": true, "qty": true, "uom": true, "rate": true, "line_total": true, "hsn_code": false, "tax_percent": false },
    "labels": { "rate_after_discount": "Rate" },
    "header_labels": {
      "document_title": "Quotation", "document_no": "Quote No", "document_date": "Date", "po_no": "Ref No"
    }
  }'::jsonb
) ON CONFLICT (template_code) DO UPDATE SET template_name = EXCLUDED.template_name, column_settings = EXCLUDED.column_settings;

-- 3. AURUM GRID – Delivery Challan
INSERT INTO document_templates (
  template_name, template_code, document_type, is_default, page_size, orientation,
  show_logo, show_bank_details, show_terms, show_signature, column_settings
) VALUES (
  'AURUM GRID – Delivery Challan', 'DOC_AURUM_DC_V1', 'Delivery Challan', false, 'A4', 'Portrait',
  true, false, true, true,
  '{
    "mandatory": ["sno", "item", "qty"],
    "optional": { "sno": true, "item": true, "description": true, "qty": true, "uom": true, "rate": false, "line_total": false, "hsn_code": false, "tax_percent": false },
    "labels": {},
    "header_labels": {
      "document_title": "Delivery Challan", "document_no": "DC No", "document_date": "Date", "po_no": "PO No"
    }
  }'::jsonb
) ON CONFLICT (template_code) DO UPDATE SET template_name = EXCLUDED.template_name, column_settings = EXCLUDED.column_settings;
