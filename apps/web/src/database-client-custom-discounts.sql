-- Add custom_discounts JSONB column to store client-specific discount percentages per variant
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_discounts JSONB DEFAULT '{}';

COMMENT ON COLUMN clients.custom_discounts IS 'Stores custom discount percentages per variant: {"variant_id": discount_percent}';
