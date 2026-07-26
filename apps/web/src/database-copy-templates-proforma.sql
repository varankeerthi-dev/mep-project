-- ═══════════════════════════════════════════════════════════════════════════════
-- Copy Quotation Templates for Proforma Invoices
-- This script copies all existing Quotation templates and creates Proforma
-- counterparts with updated template_codes (QTN_XXX → PI_XXX).
--
-- Run this in your Supabase SQL Editor while logged in as your org.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Copy each Quotation template as a Proforma template
-- The template_code mapping:
--   QTN_CLASSIC  → PI_CLASSIC
--   QTN_GRID_PRO → PI_GRID_PRO
--   QTN_SAKTHI   → PI_SAKTHI
--   QTN_VERTICAL → PI_VERTICAL
--   QTN_ENTERPRISE → PI_ENTERPRISE
--   QTN_ZOHO     → PI_ZOHO

INSERT INTO document_templates (
  organisation_id,
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
  active,
  template_type,
  template_content
)
SELECT
  qt.organisation_id,
  REPLACE(qt.template_name, 'Quotation', 'Proforma'),
  REPLACE(qt.template_code, 'QTN_', 'PI_'),
  'proforma',  -- document_type for proforma
  false,        -- is_default (we'll set default later)
  qt.page_size,
  qt.orientation,
  qt.show_logo,
  qt.show_bank_details,
  qt.show_terms,
  qt.show_signature,
  qt.column_settings,
  true,
  qt.template_type,
  qt.template_content
FROM document_templates qt
WHERE qt.document_type = 'Quotation'
  AND qt.active = true
  AND NOT EXISTS (
    SELECT 1 FROM document_templates pt
    WHERE pt.document_type = 'proforma'
      AND pt.organisation_id = qt.organisation_id
      AND pt.template_code = REPLACE(qt.template_code, 'QTN_', 'PI_')
  );

-- Step 2: Set the first Proforma template as default
UPDATE document_templates
SET is_default = true
WHERE id = (
  SELECT id FROM document_templates
  WHERE document_type = 'proforma'
    AND organisation_id IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM document_templates
  WHERE document_type = 'proforma'
    AND is_default = true
);

-- Step 3: Also create a basic default proforma template if no templates were copied
INSERT INTO document_templates (
  organisation_id,
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
)
SELECT
  o.id,
  'Default Proforma',
  'PI_DEFAULT',
  'proforma',
  true,
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
      "hsn_code": false,
      "rate": true,
      "discount_percent": true,
      "discount_amount": false,
      "tax_percent": true,
      "tax_amount": false,
      "line_total": true,
      "category": false,
      "brand": false
    },
    "print": {
      "style": "default"
    }
  }'::jsonb,
  true
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates pt
  WHERE pt.document_type = 'proforma'
    AND pt.organisation_id = o.id
);

-- Step 4: Also create a clean 'Proforma' template for the Proforma Invoice style
INSERT INTO document_templates (
  organisation_id,
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
)
SELECT
  o.id,
  'Proforma Invoice (Clean)',
  'PI_CLEAN',
  'proforma',
  false,
  'A4',
  'Portrait',
  true,
  true,
  true,
  true,
  '{
    "mandatory": ["sno", "item", "qty", "uom", "rate", "amount"],
    "optional": {
      "item_code": true,
      "variant": false,
      "description": true,
      "hsn_code": true,
      "rate": false,
      "discount_percent": false,
      "discount_amount": false,
      "tax_percent": true,
      "tax_amount": false,
      "line_total": false,
      "category": false,
      "brand": false
    },
    "print": {
      "style": "vertical"
    }
  }'::jsonb,
  true
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates pt
  WHERE pt.document_type = 'proforma'
    AND pt.template_code = 'PI_CLEAN'
    AND pt.organisation_id = o.id
);

-- Step 5: Verify the results
SELECT 
  template_name, 
  template_code, 
  document_type, 
  is_default,
  page_size,
  orientation
FROM document_templates 
WHERE document_type = 'proforma'
ORDER BY is_default DESC, template_name ASC;
