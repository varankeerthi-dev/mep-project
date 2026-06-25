-- 1. Add is_header column to quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS is_header BOOLEAN DEFAULT false;

-- 2. Ensure Professional Template has proper header labels in its settings
UPDATE document_templates 
SET column_settings = column_settings || '{
  "header_labels": {
    "document_no": "Quotation No:",
    "document_date": "Quotation Date:",
    "po_no": "PO No:",
    "po_date": "PO Date:",
    "remarks": "Remarks:",
    "eway_bill": "E-Way Bill:"
  }
}'::jsonb
WHERE template_code = 'QTN_PROFESSIONAL';

-- 3. Add same for Tally Template
UPDATE document_templates 
SET column_settings = column_settings || '{
  "header_labels": {
    "document_no": "Quotation No.",
    "document_date": "Dated",
    "po_no": "PO No.",
    "po_date": "PO Date",
    "remarks": "Remarks",
    "eway_bill": "E-Way Bill"
  }
}'::jsonb
WHERE template_code = 'QTN_TALLY';
