-- Enhanced Projects Module
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns to existing projects table (run this first if table exists)
-- Use dynamic SQL to safely check and migrate
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  -- Check if name column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'name'
  ) INTO col_exists;
  
  IF col_exists THEN
    -- Migrate name to project_name if project_name is null
    EXECUTE 'UPDATE projects SET project_name = name WHERE project_name IS NULL AND name IS NOT NULL';
  END IF;
END $$;

-- Add columns as nullable first, then make NOT NULL after data migration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code VARCHAR(50) UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) CHECK (project_type IN ('Main', 'Expansion', 'Service'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_estimated_value DECIMAL(15,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS po_required BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS po_status VARCHAR(50) CHECK (po_status IN ('Not Required', 'Pending', 'Received'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Now update any NULL project_name values and set NOT NULL constraint
UPDATE projects SET project_name = 'Untitled-' || LEFT(id::TEXT, 8) WHERE project_name IS NULL;
ALTER TABLE projects ALTER COLUMN project_name SET NOT NULL;

-- Step 2: Create function to generate project code
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TRIGGER AS $$
DECLARE
  year_part VARCHAR(4);
  count_part VARCHAR(4);
BEGIN
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
  
  SELECT COUNT(*)::VARCHAR + 1 INTO count_part
  FROM projects
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  count_part := LPAD(count_part, 4, '0');
  
  NEW.project_code := 'PRJ-' || year_part || '-' || count_part;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger for auto-generating project code
DROP TRIGGER IF EXISTS trigger_generate_project_code ON projects;
CREATE TRIGGER trigger_generate_project_code
  BEFORE INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.project_code IS NULL)
  EXECUTE FUNCTION generate_project_code();

-- Step 4: Add project_id to client_purchase_orders
ALTER TABLE client_purchase_orders ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Create index for project_id in client_purchase_orders
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_project_id ON client_purchase_orders(project_id);

-- Step 5: Create project_invoices table
CREATE TABLE IF NOT EXISTS project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partially Paid', 'Paid', 'Cancelled')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create project_payments table
CREATE TABLE IF NOT EXISTS project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT NOT NULL,
  invoice_id UUID REFERENCES project_invoices(id) ON DELETE SET NULL,
  payment_number VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  payment_amount DECIMAL(15,2) NOT NULL,
  payment_mode VARCHAR(50) CHECK (payment_mode IN ('Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other')),
  reference_number VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Create project_expenses table
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE RESTRICT NOT NULL,
  expense_date DATE NOT NULL,
  expense_type VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  vendor_name VARCHAR(255),
  reference_number VARCHAR(100),
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 8: Enable RLS on all new tables
ALTER TABLE project_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Enable all access" ON project_invoices;
CREATE POLICY "Enable all access" ON project_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON project_payments;
CREATE POLICY "Enable all access" ON project_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON project_expenses;
CREATE POLICY "Enable all access" ON project_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_invoices_project_id ON project_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_invoice_date ON project_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_payment_date ON project_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_expense_date ON project_expenses(expense_date);

-- Step 9: Create function to auto-update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid DECIMAL(15,2);
  invoice_total DECIMAL(15,2);
BEGIN
  -- Get the invoice total
  SELECT total_amount INTO invoice_total
  FROM project_invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Calculate total payments for this invoice
  SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid
  FROM project_payments
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Update invoice status
  IF total_paid >= invoice_total AND invoice_total > 0 THEN
    UPDATE project_invoices SET status = 'Paid' WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  ELSIF total_paid > 0 THEN
    UPDATE project_invoices SET status = 'Partially Paid' WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_status ON project_payments;
CREATE TRIGGER trigger_update_invoice_status
  AFTER INSERT OR UPDATE ON project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- Step 10: Add unique constraint for invoice_number per project
ALTER TABLE project_invoices ADD CONSTRAINT unique_invoice_number_per_project UNIQUE (project_id, invoice_number);

-- Step 11: Add unique constraint for payment_number per project
ALTER TABLE project_payments ADD CONSTRAINT unique_payment_number_per_project UNIQUE (project_id, payment_number);

-- Step 12: Create view for project financial summary
CREATE OR REPLACE VIEW project_financial_summary AS
SELECT 
  p.id as project_id,
  p.project_code,
  p.project_name,
  p.client_id,
  c.client_name,
  COALESCE(SUM(DISTINCT cpo.po_total_value), 0) as total_po_value,
  COALESCE(SUM(DISTINCT pi.total_amount), 0) as total_invoice_value,
  COALESCE(SUM(DISTINCT pp.payment_amount), 0) as total_payment_received,
  COALESCE(SUM(DISTINCT pe.amount), 0) as total_expense,
  COALESCE(SUM(DISTINCT pi.total_amount), 0) - COALESCE(SUM(DISTINCT pp.payment_amount), 0) as outstanding_amount,
  COALESCE(SUM(DISTINCT pi.total_amount), 0) - COALESCE(SUM(DISTINCT pe.amount), 0) as profit,
  COALESCE(SUM(DISTINCT cpo.po_total_value), 0) - COALESCE(SUM(DISTINCT pi.total_amount), 0) as po_balance
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN client_purchase_orders cpo ON cpo.project_id = p.id
LEFT JOIN project_invoices pi ON pi.project_id = p.id
LEFT JOIN project_payments pp ON pp.project_id = p.id
LEFT JOIN project_expenses pe ON pe.project_id = p.id
GROUP BY p.id, p.project_code, p.project_name, p.client_id, c.client_name;

-- Step 13: Create function to check if project can be deleted
CREATE OR REPLACE FUNCTION can_delete_project(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  po_count INTEGER;
  invoice_count INTEGER;
  expense_count INTEGER;
  payment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO po_count FROM client_purchase_orders WHERE project_id = p_id;
  SELECT COUNT(*) INTO invoice_count FROM project_invoices WHERE project_id = p_id;
  SELECT COUNT(*) INTO expense_count FROM project_expenses WHERE project_id = p_id;
  SELECT COUNT(*) INTO payment_count FROM project_payments WHERE project_id = p_id;

  IF po_count > 0 OR invoice_count > 0 OR expense_count > 0 OR payment_count > 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Create function to check if project can be closed
CREATE OR REPLACE FUNCTION can_close_project(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  outstanding DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(pi.total_amount), 0) - COALESCE(SUM(pp.payment_amount), 0)
  INTO outstanding
  FROM project_invoices pi
  LEFT JOIN project_payments pp ON pp.project_id = pi.project_id
  WHERE pi.project_id = p_id;

  IF outstanding > 0 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
