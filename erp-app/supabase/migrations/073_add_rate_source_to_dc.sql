-- Rate source tracking for DCs
-- Tracks which pricing source was used when creating the DC
ALTER TABLE delivery_challans 
  ADD COLUMN IF NOT EXISTS rate_source VARCHAR(20) DEFAULT 'base';

COMMENT ON COLUMN delivery_challans.rate_source IS 
  'Rate source: base (item_variant_pricing), project (project_rates), arc (material_client_pricing), manual (user-typed)';
