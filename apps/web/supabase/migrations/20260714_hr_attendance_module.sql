-- 0. Safely create generic helpers and sites table if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_coordinates ON public.sites(latitude, longitude);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to view sites" ON public.sites;
CREATE POLICY "Allow authenticated users to view sites" ON public.sites
    FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Allow admins to manage sites" ON public.sites;
CREATE POLICY "Allow admins to manage sites" ON public.sites
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM org_members
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

DROP TRIGGER IF EXISTS update_sites_updated_at ON public.sites;
CREATE TRIGGER update_sites_updated_at
    BEFORE UPDATE ON public.sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1. Safely rename attendance to site_checkins if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_checkins') THEN
        ALTER TABLE public.attendance RENAME TO site_checkins;
        
        -- Rename indexes if they existed
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_attendance_employee_id') THEN
            ALTER INDEX idx_attendance_employee_id RENAME TO idx_site_checkins_employee_id;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_attendance_recorded_at') THEN
            ALTER INDEX idx_attendance_recorded_at RENAME TO idx_site_checkins_recorded_at;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_attendance_site_id') THEN
            ALTER INDEX idx_attendance_site_id RENAME TO idx_site_checkins_site_id;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_attendance_status') THEN
            ALTER INDEX idx_attendance_status RENAME TO idx_site_checkins_status;
        END IF;
    END IF;
END $$;

-- 2. Create site_checkins if it still doesn't exist (e.g. if legacy attendance table was dropped/missing)
CREATE TABLE IF NOT EXISTS public.site_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('checked_in', 'checked_out', 'absent', 'on_leave')),
    remarks TEXT, 
    check_in_latitude DOUBLE PRECISION,
    check_in_longitude DOUBLE PRECISION,
    check_out_latitude DOUBLE PRECISION,
    check_out_longitude DOUBLE PRECISION,
    recorded_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Re-create indexes safely
CREATE INDEX IF NOT EXISTS idx_site_checkins_employee_id ON public.site_checkins(employee_id);
CREATE INDEX IF NOT EXISTS idx_site_checkins_recorded_at ON public.site_checkins(recorded_at);
CREATE INDEX IF NOT EXISTS idx_site_checkins_site_id ON public.site_checkins(site_id);
CREATE INDEX IF NOT EXISTS idx_site_checkins_status ON public.site_checkins(status);

-- 3. Reset policies for site_checkins
DROP POLICY IF EXISTS "Allow employees to insert their own attendance" ON site_checkins;
DROP POLICY IF EXISTS "Allow employees to view their own attendance" ON site_checkins;
DROP POLICY IF EXISTS "Allow employees to update their own attendance (check-out)" ON site_checkins;
DROP POLICY IF EXISTS "Allow admins to view all attendance" ON site_checkins;
DROP POLICY IF EXISTS "Allow admins to update all attendance" ON site_checkins;

DROP POLICY IF EXISTS "Allow employees to insert their own site_checkins" ON site_checkins;
DROP POLICY IF EXISTS "Allow employees to view their own site_checkins" ON site_checkins;
DROP POLICY IF EXISTS "Allow employees to update their own site_checkins (check-out)" ON site_checkins;
DROP POLICY IF EXISTS "Allow admins to view all site_checkins" ON site_checkins;
DROP POLICY IF EXISTS "Allow admins to update all site_checkins" ON site_checkins;

ALTER TABLE site_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow employees to insert their own site_checkins" ON site_checkins
    FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Allow employees to view their own site_checkins" ON site_checkins
    FOR SELECT TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "Allow employees to update their own site_checkins (check-out)" ON site_checkins
    FOR UPDATE TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "Allow admins to view all site_checkins" ON site_checkins
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM org_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    ));

CREATE POLICY "Allow admins to update all site_checkins" ON site_checkins
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM org_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    ));

-- Rename trigger
DROP TRIGGER IF EXISTS update_attendance_updated_at ON site_checkins;
DROP TRIGGER IF EXISTS update_site_checkins_updated_at ON site_checkins;
CREATE TRIGGER update_site_checkins_updated_at
    BEFORE UPDATE ON site_checkins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Modify existing tables
ALTER TABLE sites 
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS virtual_type TEXT; -- 'on_leave', 'unassigned'

ALTER TABLE site_visits
  ADD COLUMN IF NOT EXISTS needs_reschedule BOOLEAN DEFAULT false;

-- 5. Create HR Tables

-- Employees table (table already created in 003_rbac_access_control.sql)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'employees' 
          AND column_name = 'full_name'
    ) THEN
        ALTER TABLE public.employees RENAME COLUMN full_name TO name;
    END IF;
END $$;

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS employee_code TEXT,
    ADD COLUMN IF NOT EXISTS designation TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS dob DATE,
    ADD COLUMN IF NOT EXISTS deployment_mode TEXT DEFAULT 'project' CHECK (deployment_mode IN ('continuous', 'project')),
    ADD COLUMN IF NOT EXISTS default_site_id UUID REFERENCES sites(id) ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(organisation_id);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for employees" ON employees;
CREATE POLICY "Enable all access for employees" ON employees FOR ALL USING (
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND organisation_id = employees.organisation_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND organisation_id = employees.organisation_id)
);

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- New attendance table (Plan + Actual)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    planned_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    actual_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('manual_plan', 'inherited_site_visit', 'default_continuous', 'inherited_leave')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'checked_in', 'absent')),
    shift_type TEXT CHECK (shift_type IN ('Day', 'Night', 'DN')),
    in_time TIME,
    out_time TIME,
    remarks TEXT,
    check_in_payload JSONB,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_org_id ON attendance(organisation_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_emp_date ON attendance(employee_id, plan_date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for attendance" ON attendance;
CREATE POLICY "Enable all access for attendance" ON attendance FOR ALL USING (
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND organisation_id = attendance.organisation_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND organisation_id = attendance.organisation_id)
);

DROP TRIGGER IF EXISTS update_hr_attendance_updated_at ON attendance;
CREATE TRIGGER update_hr_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    leave_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Approved' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_org_id ON leave_requests(organisation_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_id ON leave_requests(employee_id);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for leave_requests" ON leave_requests;
CREATE POLICY "Enable all access for leave_requests" ON leave_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND organisation_id = leave_requests.organisation_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid() AND organisation_id = leave_requests.organisation_id)
);

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER update_leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
