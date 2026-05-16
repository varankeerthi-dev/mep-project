-- Migration 012: Create quotation_terms_conditions table

CREATE TABLE IF NOT EXISTS quotation_terms_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  custom_content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_terms_quotation_id ON quotation_terms_conditions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_terms_organisation_id ON quotation_terms_conditions(organisation_id);

COMMENT ON TABLE quotation_terms_conditions IS 'Stores custom terms and conditions for quotations';
COMMENT ON COLUMN quotation_terms_conditions.custom_content IS 'JSON structure for terms sections and content';
