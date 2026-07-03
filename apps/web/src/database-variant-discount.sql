-- Database Migration: Phase-1 Dynamic Discount Header System
-- Created for MEP Project Quotation Enhancement

-- Step 1: Add new columns to quotation_items table for variant discount tracking
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS base_rate_snapshot DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS applied_discount_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS final_rate_snapshot DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Step 2: Create new table for storing header-level variant discounts per quotation revision
CREATE TABLE IF NOT EXISTS quotation_revision_variant_discount (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_revision_id UUID REFERENCES quotation_header(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
    header_discount_percent DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quotation_revision_id, variant_id)
);

-- Step 3: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotation_revision_variant_discount_revision 
ON quotation_revision_variant_discount(quotation_revision_id);

CREATE INDEX IF NOT EXISTS idx_quotation_revision_variant_discount_variant 
ON quotation_revision_variant_discount(variant_id);

-- Step 4: Add RLS policies (if RLS is enabled)
-- Note: Adjust these policies based on your existing RLS configuration
-- ALTER TABLE quotation_revision_variant_discount ENABLE ROW LEVEL SECURITY;

-- Optional: Add comments for documentation
COMMENT ON COLUMN quotation_items.base_rate_snapshot IS 'Stores the MRP/base rate when item was added to quotation';
COMMENT ON COLUMN quotation_items.applied_discount_percent IS 'The discount percent applied from header variant discount';
COMMENT ON COLUMN quotation_items.is_override IS 'Whether user manually overridden the discount percentage';
COMMENT ON COLUMN quotation_items.final_rate_snapshot IS 'Rate after applying variant discount (base_rate - discount)';
COMMENT ON COLUMN quotation_items.display_order IS 'Order of item display for drag-and-drop reordering';

COMMENT ON TABLE quotation_revision_variant_discount IS 'Stores header-level discount percentages per variant for each quotation revision';
COMMENT ON COLUMN quotation_revision_variant_discount.header_discount_percent IS 'Discount percentage applied to all items of this variant';
