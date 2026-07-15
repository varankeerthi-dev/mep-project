CREATE TABLE IF NOT EXISTS salary_increments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    total_salary NUMERIC(10, 2) DEFAULT 0,
    basic_percent NUMERIC(5, 2) DEFAULT 40,
    hra_percent NUMERIC(5, 2) DEFAULT 20,
    pf_percent NUMERIC(5, 2) DEFAULT 0,
    esi_percent NUMERIC(5, 2) DEFAULT 0,
    effective_from DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE salary_increments ENABLE ROW LEVEL SECURITY;

-- Create policy
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for salary_increments' AND tablename = 'salary_increments') THEN
        CREATE POLICY "Enable all for salary_increments" ON salary_increments USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Seed existing employees into salary_increments
-- Set their effective_from to a date far in the past so it acts as the baseline
INSERT INTO salary_increments (
    organisation_id, 
    employee_id, 
    total_salary, 
    basic_percent, 
    hra_percent, 
    pf_percent, 
    esi_percent, 
    effective_from, 
    reason
)
SELECT 
    organisation_id, 
    id, 
    COALESCE(monthly_salary, 0), 
    40, 
    20, 
    0, 
    0, 
    '2000-01-01', 
    'Initial baseline migration'
FROM employees
WHERE include_in_salary = true
ON CONFLICT DO NOTHING;
