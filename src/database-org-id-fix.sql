-- Add organisation_id to variant discount tracking for multi-tenant safety
ALTER TABLE quotation_revision_variant_discount 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);

-- Optional: Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_quotation_revision_variant_discount_org 
ON quotation_revision_variant_discount(organisation_id);
