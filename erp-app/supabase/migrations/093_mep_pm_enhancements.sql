-- Migration: 093_mep_pm_enhancements.sql
-- Description: Creates database schema for drawings, joint measurement sheets, testing and commissioning protocols, and warranty SLA tracking.

-- 1. Create project_drawings table
CREATE TABLE IF NOT EXISTS project_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  file_url varchar NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Alter project_snags to add coordinate pins and drawings reference
ALTER TABLE project_snags 
ADD COLUMN IF NOT EXISTS drawing_id uuid REFERENCES project_drawings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pin_x numeric,
ADD COLUMN IF NOT EXISTS pin_y numeric;

-- 3. Create joint_measurements table
CREATE TABLE IF NOT EXISTS joint_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  measured_date date DEFAULT current_date,
  measured_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of items: [{item_name, unit, agreed_qty, rate}]
  subcontractor_id uuid REFERENCES subcontractors(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create tc_protocols table
CREATE TABLE IF NOT EXISTS tc_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES project_equipment(id) ON DELETE CASCADE,
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  test_type varchar NOT NULL,
  readings jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of test readings: [{parameter, required_value, actual_value, status}]
  test_report_url varchar,
  witnessed_by_client varchar,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Alter warranty_claims to add SLA details
ALTER TABLE warranty_claims
ADD COLUMN IF NOT EXISTS sla_due_date date,
ADD COLUMN IF NOT EXISTS vendor_notified_at timestamptz,
ADD COLUMN IF NOT EXISTS vendor_email varchar;

-- 6. Enable RLS and setup permissive policies matching the rest of the application
DO $$ 
DECLARE
    tbl TEXT;
    table_list TEXT[] := ARRAY['project_drawings', 'joint_measurements', 'tc_protocols'];
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
