-- 1. Remove Purpose fields from older data in site_visits
UPDATE site_visits 
SET purpose_of_visit = NULL, purpose = NULL;

-- 2. Drop the restrictive visit_type check constraint so custom categories can be saved
ALTER TABLE site_visits DROP CONSTRAINT IF EXISTS site_visits_visit_type_check;

-- 3. Create visit_types table for customizable categories
CREATE TABLE IF NOT EXISTS visit_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS and setup policies
ALTER TABLE visit_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'visit_types_select' AND polrelid = 'visit_types'::regclass
  ) THEN
    CREATE POLICY visit_types_select ON visit_types FOR SELECT
      USING ((organisation_id IS NULL) OR user_can_access_org(organisation_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'visit_types_modify' AND polrelid = 'visit_types'::regclass
  ) THEN
    CREATE POLICY visit_types_modify ON visit_types FOR ALL
      USING ((organisation_id IS NOT NULL) AND user_can_access_org(organisation_id))
      WITH CHECK ((organisation_id IS NOT NULL) AND user_can_access_org(organisation_id));
  END IF;
END $$;

-- 5. Seed default standard categories
INSERT INTO visit_types (name, organisation_id)
SELECT v, NULL
FROM (VALUES 
  ('Survey'),
  ('Installation'),
  ('Maintenance'),
  ('Inspection'),
  ('Repair'),
  ('Handover'),
  ('Consultation'),
  ('Other')
) AS default_types(v)
WHERE NOT EXISTS (
  SELECT 1 FROM visit_types WHERE name = default_types.v AND organisation_id IS NULL
);
