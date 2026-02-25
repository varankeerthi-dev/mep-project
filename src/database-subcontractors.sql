-- Sub-Contractor Table
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  state VARCHAR(100),
  gstin VARCHAR(50),
  nature_of_work VARCHAR(255),
  internal_remarks TEXT,
  nda_signed BOOLEAN DEFAULT false,
  contract_signed BOOLEAN DEFAULT false,
  nda_date DATE,
  contract_date DATE,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractors FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Payments
CREATE TABLE IF NOT EXISTS subcontractor_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(50),
  reference_no VARCHAR(100),
  work_order_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_payments FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Attendance
CREATE TABLE IF NOT EXISTS subcontractor_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  workers_count INTEGER DEFAULT 1,
  supervisor_name VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_attendance FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Work Orders
CREATE TABLE IF NOT EXISTS subcontractor_work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_order_no VARCHAR(50) NOT NULL,
  work_description TEXT,
  start_date DATE,
  end_date DATE,
  contract_value DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_work_orders FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Daily Logs
CREATE TABLE IF NOT EXISTS subcontractor_daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES subcontractor_work_orders(id) ON DELETE SET NULL,
  log_date DATE NOT NULL,
  work_done TEXT,
  delays TEXT,
  safety_incidents TEXT,
  workers_count INTEGER,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_daily_logs FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Invoices
CREATE TABLE IF NOT EXISTS subcontractor_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES subcontractor_work_orders(id) ON DELETE SET NULL,
  invoice_no VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_invoices FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Issues
CREATE TABLE IF NOT EXISTS subcontractor_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'Open',
  resolved_date DATE,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_issues FOR ALL USING (true) WITH CHECK (true);

-- Sub-Contractor Documents
CREATE TABLE IF NOT EXISTS subcontractor_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  document_name VARCHAR(255),
  document_url TEXT NOT NULL,
  document_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subcontractor_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON subcontractor_documents FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subcontractor_work_orders ON subcontractor_work_orders(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_daily_logs ON subcontractor_daily_logs(subcontractor_id, log_date);
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices ON subcontractor_invoices(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_attendance ON subcontractor_attendance(subcontractor_id, attendance_date);
