-- Migration: 092_field_service_long_term.sql
-- Description: Creates database schema for long-term field service roadmap items

-- 1. Create amc_contracts table
CREATE TABLE IF NOT EXISTS amc_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  contract_number varchar NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_visits_included integer NOT NULL DEFAULT 4,
  frequency_months integer NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Alter site_visits to add new columns and foreign key references
ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS check_in_lat numeric,
ADD COLUMN IF NOT EXISTS check_in_lng numeric,
ADD COLUMN IF NOT EXISTS check_in_time timestamptz,
ADD COLUMN IF NOT EXISTS check_out_lat numeric,
ADD COLUMN IF NOT EXISTS check_out_lng numeric,
ADD COLUMN IF NOT EXISTS check_out_time timestamptz,
ADD COLUMN IF NOT EXISTS signed_off_by varchar,
ADD COLUMN IF NOT EXISTS signed_off_designation varchar,
ADD COLUMN IF NOT EXISTS signature_image_url varchar,
ADD COLUMN IF NOT EXISTS signed_off_at timestamptz,
ADD COLUMN IF NOT EXISTS amc_contract_id uuid REFERENCES amc_contracts(id) ON DELETE SET NULL;

-- 3. Alter site_reports to add site_visit_id
ALTER TABLE site_reports
ADD COLUMN IF NOT EXISTS site_visit_id uuid REFERENCES site_visits(id) ON DELETE SET NULL;

-- 4. Create project_snags table
CREATE TABLE IF NOT EXISTS project_snags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  status varchar CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')) DEFAULT 'Open',
  severity varchar CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
  location_area varchar,
  photo_url varchar,
  description text NOT NULL,
  covered_under_warranty boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Create checklist template and response tables
CREATE TABLE IF NOT EXISTS visit_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  visit_type varchar NOT NULL,
  title varchar NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_checklist_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE CASCADE,
  template_id uuid REFERENCES visit_checklist_templates(id) ON DELETE SET NULL,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Create safety_incidents table
CREATE TABLE IF NOT EXISTS safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  reporter varchar NOT NULL,
  incident_type varchar CHECK (incident_type IN ('Near Miss', 'First Aid', 'Medical Treatment', 'Lost Time', 'Fatality', 'Other')) NOT NULL,
  severity varchar CHECK (severity IN ('Minor', 'Moderate', 'Severe', 'Critical')) NOT NULL,
  description text NOT NULL,
  status varchar CHECK (status IN ('Reported', 'Investigating', 'Action Taken', 'Closed')) DEFAULT 'Reported',
  photo_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Create project_equipment table
CREATE TABLE IF NOT EXISTS project_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  equipment_name varchar NOT NULL,
  make_model varchar,
  serial_number varchar,
  supplier varchar,
  quantity integer NOT NULL DEFAULT 1,
  warranty_start_date date NOT NULL,
  warranty_duration_months integer NOT NULL DEFAULT 12,
  warranty_end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. Trigger to compute warranty_end_date automatically
CREATE OR REPLACE FUNCTION calculate_warranty_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.warranty_start_date IS NOT NULL AND NEW.warranty_duration_months IS NOT NULL THEN
    NEW.warranty_end_date := NEW.warranty_start_date + (NEW.warranty_duration_months * INTERVAL '1 month');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_warranty_end_date
BEFORE INSERT OR UPDATE ON project_equipment
FOR EACH ROW
EXECUTE FUNCTION calculate_warranty_end_date();

-- 9. Create warranty_claims table
CREATE TABLE IF NOT EXISTS warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  snag_id uuid REFERENCES project_snags(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES project_equipment(id) ON DELETE CASCADE,
  vendor_name varchar NOT NULL,
  claim_reference_number varchar,
  status varchar CHECK (status IN ('Draft', 'Pending Response', 'Acknowledged', 'Accepted', 'Partially Accepted', 'Disputed', 'Resolved', 'Rejected')) DEFAULT 'Draft',
  vendor_dispute_reason text,
  date_escalated date,
  escalated_warranty_start date,
  escalated_warranty_end date,
  parts_covered boolean DEFAULT true,
  labor_covered boolean DEFAULT false,
  vendor_claimed_cost numeric(12, 2),
  vendor_approved_cost numeric(12, 2),
  internal_cost_incurred numeric(12, 2),
  resolution_method varchar CHECK (resolution_method IN ('Replaced', 'Repaired', 'Credited', 'Rejected', 'N/A')),
  resolution_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. Enable RLS and setup permissive policies matching the rest of the application
DO $$ 
DECLARE
    tbl TEXT;
    table_list TEXT[] := ARRAY['amc_contracts', 'project_snags', 'visit_checklist_templates', 'visit_checklist_responses', 'safety_incidents', 'project_equipment', 'warranty_claims'];
BEGIN
    FOREACH tbl IN ARRAY table_list LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        
        EXECUTE format('
            DROP POLICY IF EXISTS "Users can view %1$s" ON %1$I;
            CREATE POLICY "Users can view %1$s" ON %1$I FOR SELECT USING (true);
            
            DROP POLICY IF EXISTS "Users can insert %1$s" ON %1$I;
            CREATE POLICY "Users can insert %1$s" ON %1$I FOR INSERT WITH CHECK (true);
            
            DROP POLICY IF EXISTS "Users can update %1$s" ON %1$I;
            CREATE POLICY "Users can update %1$s" ON %1$I FOR UPDATE USING (true);
            
            DROP POLICY IF EXISTS "Users can delete %1$s" ON %1$I;
            CREATE POLICY "Users can delete %1$s" ON %1$I FOR DELETE USING (true);
        ', tbl);
    END LOOP;
END $$;
