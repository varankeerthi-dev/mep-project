-- Enhanced Projects Module
-- Run this in Supabase SQL Editor

-- First, ensure created_at exists in projects table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_at') THEN
    ALTER TABLE projects ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Step 1: Add new columns to existing projects table (run this first if table exists)
-- Use DO block to safely add columns if they don't exist
DO $$
BEGIN
  -- Add client_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_id') THEN
    ALTER TABLE projects ADD COLUMN client_id UUID REFERENCES clients(id);
  END IF;
  
  -- Add project_code column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_code') THEN
    ALTER TABLE projects ADD COLUMN project_code VARCHAR(50) UNIQUE;
  END IF;
  
  -- Add project_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_name') THEN
    ALTER TABLE projects ADD COLUMN project_name VARCHAR(255);
  END IF;
  
  -- Add parent_project_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'parent_project_id') THEN
    ALTER TABLE projects ADD COLUMN parent_project_id UUID REFERENCES projects(id);
  END IF;
  
  -- Add project_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_type') THEN
    ALTER TABLE projects ADD COLUMN project_type VARCHAR(50);
  END IF;
  
  -- Add project_estimated_value column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_estimated_value') THEN
    ALTER TABLE projects ADD COLUMN project_estimated_value DECIMAL(15,2);
  END IF;
  
  -- Add po_required column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'po_required') THEN
    ALTER TABLE projects ADD COLUMN po_required BOOLEAN DEFAULT true;
  END IF;
  
  -- Add po_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'po_status') THEN
    ALTER TABLE projects ADD COLUMN po_status VARCHAR(50);
  END IF;

  -- Add po_number column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'po_number') THEN
    ALTER TABLE projects ADD COLUMN po_number VARCHAR(50);
  END IF;

  -- Add po_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'po_date') THEN
    ALTER TABLE projects ADD COLUMN po_date DATE;
  END IF;
  
  -- Add start_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'start_date') THEN
    ALTER TABLE projects ADD COLUMN start_date DATE;
  END IF;
  
  -- Add expected_end_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'expected_end_date') THEN
    ALTER TABLE projects ADD COLUMN expected_end_date DATE;
  END IF;
  
  -- Add actual_end_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'actual_end_date') THEN
    ALTER TABLE projects ADD COLUMN actual_end_date DATE;
  END IF;
  
  -- Add completion_percentage column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'completion_percentage') THEN
    ALTER TABLE projects ADD COLUMN completion_percentage DECIMAL(5,2) DEFAULT 0;
  END IF;
  
  -- Add status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'status') THEN
    ALTER TABLE projects ADD COLUMN status VARCHAR(50) DEFAULT 'Draft';
  END IF;
  
  -- Add remarks column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'remarks') THEN
    ALTER TABLE projects ADD COLUMN remarks TEXT;
  END IF;
END $$;

-- Migrate data from old 'name' column if it exists
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'name'
  ) INTO col_exists;
  
  IF col_exists THEN
    UPDATE projects SET project_name = name WHERE project_name IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- Now update any remaining NULL project_name values
-- First, try to populate from 'name' column if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'name') THEN
    UPDATE projects SET project_name = name WHERE project_name IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- If still NULL, generate from id
UPDATE projects SET project_name = 'Untitled-' || SUBSTRING(id::TEXT FROM 1 FOR 8) WHERE project_name IS NULL;

-- Add CHECK constraints (check if they exist first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_project_type') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_project_type CHECK (project_type IN ('Main', 'Expansion', 'Service'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_status') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_po_status CHECK (po_status IN ('Not Required', 'Pending', 'Received'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_status') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_status CHECK (status IN ('Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed'));
  END IF;
END $$;

-- Step 2: Create function to generate project code
-- Drop existing function and trigger first to ensure clean update
DROP TRIGGER IF EXISTS trigger_generate_project_code ON projects;
DROP FUNCTION IF EXISTS generate_project_code() CASCADE;

CREATE FUNCTION generate_project_code()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  count_num INTEGER;
  count_part TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COUNT(*) INTO count_num
  FROM projects
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  count_part := LPAD((count_num + 1)::TEXT, 4, '0');
  
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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_purchase_orders' AND column_name = 'project_id') THEN
    ALTER TABLE client_purchase_orders ADD COLUMN project_id UUID REFERENCES projects(id);
  END IF;
END $$;

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
