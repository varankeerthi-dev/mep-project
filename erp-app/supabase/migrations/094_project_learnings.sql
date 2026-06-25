-- Migration: 094_project_learnings.sql
-- Description: Creates the project_insights table for tracking operational opportunities, best practices, feedbacks, coordination issues, and actions.

-- 1. Create project_insights table
CREATE TABLE IF NOT EXISTS project_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Generic source mapping
  source_type varchar(50) NOT NULL DEFAULT 'custom',
  source_id uuid,
  
  -- Explicit legacy references (kept for backward compatibility and DB integrity)
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE SET NULL,
  site_report_id uuid REFERENCES site_reports(id) ON DELETE SET NULL,
  
  category varchar(50) NOT NULL CHECK (category IN (
    'Improvement Opportunity',
    'Best Practice',
    'Client Feedback',
    'Coordination Issue',
    'Safety Observation',
    'Cost Saving Idea'
  )),
  title varchar(255) NOT NULL,
  description text,
  
  -- Manager-enriched details
  impact_type varchar(50) CHECK (impact_type IN (
    'Cost',
    'Time',
    'Quality',
    'Safety',
    'Customer Satisfaction'
  )),
  impact_level varchar(20) DEFAULT 'Low' CHECK (impact_level IN (
    'Low',
    'Medium',
    'High',
    'Critical'
  )),
  estimated_loss_amount numeric(15, 2) DEFAULT 0,
  estimated_delay_days integer DEFAULT 0,
  root_cause varchar(100) CHECK (root_cause IN (
    'Human Error',
    'Process Gap',
    'Training Gap',
    'Vendor Issue',
    'Client Change',
    'Design Error',
    'Communication Failure',
    'Material Quality'
  )),
  tags text[],
  
  -- Visibility options
  visibility varchar(50) NOT NULL DEFAULT 'Everyone' CHECK (visibility IN (
    'Project Team',
    'Managers',
    'Leadership',
    'Everyone'
  )),
  
  -- Repeat issue flag
  is_repeat_issue boolean DEFAULT false,
  repeat_issue_count integer DEFAULT 1,
  
  -- Action items tracking
  assigned_to uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  target_date date,
  status varchar(20) NOT NULL DEFAULT 'Open' CHECK (status IN (
    'Open',
    'In Progress',
    'Closed'
  )),
  resolved_at timestamptz,
  
  created_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Triggers for updated_at and resolved_at auto-updates
CREATE OR REPLACE FUNCTION update_project_insights_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Closed' AND (OLD.status IS NULL OR OLD.status <> 'Closed') THEN
        NEW.resolved_at = now();
    ELSIF NEW.status <> 'Closed' THEN
        NEW.resolved_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_project_insights_resolved_at ON project_insights;
CREATE TRIGGER trg_project_insights_resolved_at
    BEFORE UPDATE ON project_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_project_insights_resolved_at();

-- 3. Enable RLS and setup permissive policies
DO $$ 
DECLARE
    tbl TEXT := 'project_insights';
BEGIN
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
END $$;
