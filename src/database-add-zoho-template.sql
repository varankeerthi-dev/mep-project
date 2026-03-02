-- Add Zoho Style Template to Document Templates for all types
-- Run this in Supabase SQL Editor

-- 1. Quotation Zoho Template
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
  'Zoho template',
  'QTN_ZOHO',
  'Quotation',
  false,
  'A4',
  'Portrait',
  true,
  true,
  true,
  true,
  '{
    "mandatory": ["sno", "item", "qty"],
    "optional": {
      "sno": true, "item": true, "qty": true, "uom": true, "description": true, 
      "hsn_code": true, "rate": true, "tax_percent": true, "line_total": true,
      "subtotal": true, "total_tax": true, "round_off": true, "grand_total": true
    },
    "labels": { "rate_after_discount": "Rate" },
    "header_labels": {
      "document_no": "Quote No:",
      "document_date": "Quote Date:",
      "po_no": "PO No:",
      "po_date": "PO Date:",
      "remarks": "Remarks:",
      "eway_bill": "E-Way Bill:"
    }
  }'::jsonb
)
ON CONFLICT (template_code) DO UPDATE 
SET template_name = EXCLUDED.template_name,
    document_type = EXCLUDED.document_type,
    column_settings = EXCLUDED.column_settings;

-- 2. Invoice Zoho Template
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
  'Zoho template',
  'INV_ZOHO',
  'Invoice',
  false,
  'A4',
  'Portrait',
  true,
  true,
  true,
  true,
  '{
    "mandatory": ["sno", "item", "qty"],
    "optional": {
      "sno": true, "item": true, "qty": true, "uom": true, "description": true, 
      "hsn_code": true, "rate": true, "tax_percent": true, "line_total": true,
      "subtotal": true, "total_tax": true, "round_off": true, "grand_total": true
    },
    "labels": { "rate_after_discount": "Rate" },
    "header_labels": {
      "document_no": "Invoice No:",
      "document_date": "Invoice Date:",
      "po_no": "PO No:",
      "po_date": "PO Date:",
      "remarks": "Remarks:",
      "eway_bill": "E-Way Bill:"
    }
  }'::jsonb
)
ON CONFLICT (template_code) DO UPDATE 
SET template_name = EXCLUDED.template_name,
    document_type = EXCLUDED.document_type,
    column_settings = EXCLUDED.column_settings;

-- 3. Delivery Challan Zoho Template
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
  'Zoho template',
  'DC_ZOHO',
  'Delivery Challan',
  false,
  'A4',
  'Portrait',
  true,
  true,
  true,
  true,
  '{
    "mandatory": ["sno", "item", "qty"],
    "optional": {
      "sno": true, "item": true, "qty": true, "uom": true, "description": true, 
      "hsn_code": true, "rate": true, "tax_percent": true, "line_total": true,
      "subtotal": true, "total_tax": true, "round_off": true, "grand_total": true
    },
    "labels": { "rate_after_discount": "Rate" },
    "header_labels": {
      "document_no": "DC No:",
      "document_date": "DC Date:",
      "po_no": "PO No:",
      "po_date": "PO Date:",
      "remarks": "Remarks:",
      "eway_bill": "E-Way Bill:"
    }
  }'::jsonb
)
ON CONFLICT (template_code) DO UPDATE 
SET template_name = EXCLUDED.template_name,
    document_type = EXCLUDED.document_type,
    column_settings = EXCLUDED.column_settings;
