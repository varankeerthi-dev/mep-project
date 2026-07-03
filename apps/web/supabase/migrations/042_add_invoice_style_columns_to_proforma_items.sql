-- Add invoice-style columns to proforma_items for consistency with quotation and invoice
-- This enables material dropdown, make, variant, and unit tracking in proforma invoices

-- Add new columns to proforma_items if they don't exist
DO $$
BEGIN
  -- item_id: Reference to materials table for inventory integration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'proforma_items' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE proforma_items ADD COLUMN item_id UUID REFERENCES materials(id) ON DELETE SET NULL;
  END IF;
  
  -- variant_id: Reference to item_variant_pricing for variant tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'proforma_items' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE proforma_items ADD COLUMN variant_id UUID;
  END IF;
  
  -- make: Make/manufacturer of the item
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'proforma_items' AND column_name = 'make'
  ) THEN
    ALTER TABLE proforma_items ADD COLUMN make TEXT;
  END IF;
  
  -- variant: Variant name from company_variants
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'proforma_items' AND column_name = 'variant'
  ) THEN
    ALTER TABLE proforma_items ADD COLUMN variant TEXT;
  END IF;
  
  -- unit: Unit of measurement (nos, kg, m, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'proforma_items' AND column_name = 'unit'
  ) THEN
    ALTER TABLE proforma_items ADD COLUMN unit TEXT;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_proforma_items_item_id 
  ON proforma_items(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proforma_items_variant_id 
  ON proforma_items(variant_id) WHERE variant_id IS NOT NULL;

COMMENT ON COLUMN proforma_items.item_id IS 'Reference to materials table for inventory integration';
COMMENT ON COLUMN proforma_items.variant_id IS 'Reference to item_variant_pricing for variant tracking';
COMMENT ON COLUMN proforma_items.make IS 'Make/manufacturer of the item';
COMMENT ON COLUMN proforma_items.variant IS 'Variant name from company_variants';
COMMENT ON COLUMN proforma_items.unit IS 'Unit of measurement (nos, kg, m, etc.)';
