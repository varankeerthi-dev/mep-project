-- ==========================================
-- HR Employees Schema Expansion
-- Adds required fields for the new Employee Creation form
-- ==========================================

-- We will alter the `employees` table to include all missing fields
-- Using PL/pgSQL DO blocks to handle ENUM types if necessary, though we will use TEXT with CHECK constraints to be safe and easily reversible.

ALTER TABLE employees
    -- Identity & Demographics
    ADD COLUMN IF NOT EXISTS blood_group TEXT,
    ADD COLUMN IF NOT EXISTS marital_status TEXT,
    ADD COLUMN IF NOT EXISTS father_name TEXT,
    ADD COLUMN IF NOT EXISTS mother_name TEXT,

    -- Work Settings
    ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full-time',
    ADD COLUMN IF NOT EXISTS joined_date DATE,
    ADD COLUMN IF NOT EXISTS shift_id TEXT,
    ADD COLUMN IF NOT EXISTS min_daily_hours NUMERIC,
    ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS permission_hours NUMERIC DEFAULT 2,
    ADD COLUMN IF NOT EXISTS hide_in_attendance BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS include_in_salary BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS include_in_task BOOLEAN DEFAULT true,

    -- Contact Details
    ADD COLUMN IF NOT EXISTS mobile_no TEXT,
    ADD COLUMN IF NOT EXISTS office_no TEXT,
    ADD COLUMN IF NOT EXISTS personal_no TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,

    -- Access & Login
    ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS personal_email TEXT,
    ADD COLUMN IF NOT EXISTS work_email TEXT,
    ADD COLUMN IF NOT EXISTS login_email_type TEXT DEFAULT 'work',
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Employee',

    -- KYC / Identity
    ADD COLUMN IF NOT EXISTS aadhar_no TEXT,
    ADD COLUMN IF NOT EXISTS pan_no TEXT,
    ADD COLUMN IF NOT EXISTS pf_no TEXT,
    ADD COLUMN IF NOT EXISTS esi_no TEXT,
    ADD COLUMN IF NOT EXISTS driving_license_no TEXT,
    ADD COLUMN IF NOT EXISTS has_own_vehicle BOOLEAN DEFAULT false,

    -- Payroll
    ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS withdraw_full_salary BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS personal_bank JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS company_bank JSONB DEFAULT '{}'::jsonb;
