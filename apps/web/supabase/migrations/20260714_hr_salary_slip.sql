CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    employee_id UUID REFERENCES employees(id),
    employee_name VARCHAR(255),
    total_amount NUMERIC(10, 2),
    emi_amount NUMERIC(10, 2),
    remaining_amount NUMERIC(10, 2),
    status VARCHAR(50) DEFAULT 'Active',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    loan_id UUID REFERENCES loans(id),
    month VARCHAR(7),
    amount NUMERIC(10, 2),
    skip BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(loan_id, month)
);

CREATE TABLE IF NOT EXISTS variable_pay_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    employee_id UUID REFERENCES employees(id),
    employee_name VARCHAR(255),
    date DATE,
    month VARCHAR(7),
    food NUMERIC(10, 2) DEFAULT 0,
    convenience NUMERIC(10, 2) DEFAULT 0,
    bonus NUMERIC(10, 2) DEFAULT 0,
    is_settled BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS hr_advances_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    employee_id UUID REFERENCES employees(id),
    type VARCHAR(50), 
    date DATE,
    amount NUMERIC(10, 2),
    hr_approval VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    employee_id UUID REFERENCES employees(id),
    date DATE,
    amount NUMERIC(10, 2),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ot_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    employee_id UUID REFERENCES employees(id),
    month VARCHAR(7),
    adjustment NUMERIC(10, 2), 
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, month)
);

CREATE TABLE IF NOT EXISTS sandwich_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    employee_id UUID REFERENCES employees(id),
    date DATE,
    month VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    month VARCHAR(7),
    status VARCHAR(50) DEFAULT 'review', 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organisation_id, month)
);

-- RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_pay_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_advances_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandwich_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for loans' AND tablename = 'loans') THEN
        CREATE POLICY "Enable all for loans" ON loans USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for loan_overrides' AND tablename = 'loan_overrides') THEN
        CREATE POLICY "Enable all for loan_overrides" ON loan_overrides USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for variable_pay_logs' AND tablename = 'variable_pay_logs') THEN
        CREATE POLICY "Enable all for variable_pay_logs" ON variable_pay_logs USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for hr_advances_expenses' AND tablename = 'hr_advances_expenses') THEN
        CREATE POLICY "Enable all for hr_advances_expenses" ON hr_advances_expenses USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for fines' AND tablename = 'fines') THEN
        CREATE POLICY "Enable all for fines" ON fines USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for ot_adjustments' AND tablename = 'ot_adjustments') THEN
        CREATE POLICY "Enable all for ot_adjustments" ON ot_adjustments USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for sandwich_deductions' AND tablename = 'sandwich_deductions') THEN
        CREATE POLICY "Enable all for sandwich_deductions" ON sandwich_deductions USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all for payroll_runs' AND tablename = 'payroll_runs') THEN
        CREATE POLICY "Enable all for payroll_runs" ON payroll_runs USING (true) WITH CHECK (true);
    END IF;
END $$;
