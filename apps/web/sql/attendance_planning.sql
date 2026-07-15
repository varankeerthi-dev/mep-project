-- Create attendance_plans table
CREATE TABLE IF NOT EXISTS attendance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    plan_date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'default_continuous', 'inherited_site_visit', 'inherited_leave'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organisation_id, employee_id, plan_date)
);

-- Index for fast lookups by org + date
CREATE INDEX IF NOT EXISTS idx_attendance_plans_org_date
    ON attendance_plans (organisation_id, plan_date);

-- RLS Policies
ALTER TABLE attendance_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view attendance_plans' AND tablename = 'attendance_plans') THEN
        CREATE POLICY "Users can view attendance_plans" ON attendance_plans FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert attendance_plans' AND tablename = 'attendance_plans') THEN
        CREATE POLICY "Users can insert attendance_plans" ON attendance_plans FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update attendance_plans' AND tablename = 'attendance_plans') THEN
        CREATE POLICY "Users can update attendance_plans" ON attendance_plans FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete attendance_plans' AND tablename = 'attendance_plans') THEN
        CREATE POLICY "Users can delete attendance_plans" ON attendance_plans FOR DELETE USING (true);
    END IF;
END $$;

-- Optional: add needs_reschedule to site_visits if it doesn't exist
ALTER TABLE site_visits
ADD COLUMN IF NOT EXISTS needs_reschedule BOOLEAN DEFAULT false;
