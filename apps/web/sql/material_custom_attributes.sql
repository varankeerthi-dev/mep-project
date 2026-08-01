-- ============================================================
-- Material Custom Attributes (Dynamic Technical Specifications)
-- ============================================================
-- Replaces hardcoded columns (size, pressure_class, make, etc.)
-- with a flexible EAV-style system. Users define freeform
-- label + value + unit per material. Attribute definitions
-- auto-learn from usage for autocomplete suggestions.
-- ============================================================

-- 1. Attribute Definitions (auto-learned catalog per org)
CREATE TABLE IF NOT EXISTS attribute_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_unit TEXT DEFAULT '',
  known_units TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, name)
);

-- 2. Material Custom Attributes (per-material values)
CREATE TABLE IF NOT EXISTS material_custom_attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  attribute_value TEXT DEFAULT '',
  attribute_unit TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attr_def_org ON attribute_definitions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_mca_material ON material_custom_attributes(material_id);
CREATE INDEX IF NOT EXISTS idx_mca_org ON material_custom_attributes(organisation_id);

-- RLS policies
ALTER TABLE attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_custom_attributes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_attr_def' AND tablename = 'attribute_definitions') THEN
    CREATE POLICY "org_access_attr_def" ON attribute_definitions
      FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_mca' AND tablename = 'material_custom_attributes') THEN
    CREATE POLICY "org_access_mca" ON material_custom_attributes
      FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
END $$;
