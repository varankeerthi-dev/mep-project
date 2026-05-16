-- Subcontractor Module - Soft Delete, Audit Trail & Duplicate Prevention
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: SOFT DELETE FOR SUBCONTRACTORS
-- ============================================================================

ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN subcontractors.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN subcontractors.deleted_at IS 'Timestamp when subcontractor was soft deleted';
COMMENT ON COLUMN subcontractors.deleted_by IS 'User who deleted the subcontractor';

-- ============================================================================
-- PART 2: AUDIT TRAIL - CREATED BY / UPDATED BY
-- ============================================================================

ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE subcontractor_payments
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES subcontractor_invoices(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE subcontractor_attendance
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE subcontractor_work_orders
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE subcontractor_daily_logs
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE subcontractor_invoices
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE subcontractor_documents
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

ALTER TABLE subcontractor_issues
ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES subcontractor_work_orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE subcontractor_work_order_amendments
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ============================================================================
-- PART 3: DUPLICATE PREVENTION - UNIQUE CONSTRAINTS
-- ============================================================================

-- Unique GSTIN per organisation (only for non-deleted, non-null GSTINs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractors_gstin_unique 
ON subcontractors(gstin, organisation_id) 
WHERE gstin IS NOT NULL AND gstin != '' AND is_deleted = false;

-- Unique company_name + sub_number per organisation
CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractors_company_org_unique 
ON subcontractors(company_name, organisation_id) 
WHERE is_deleted = false;

-- Unique work order number per subcontractor
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_wo_number_unique 
ON subcontractor_work_orders(work_order_no, subcontractor_id) 
WHERE is_amendment = false;

-- Unique invoice number per subcontractor
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique 
ON subcontractor_invoices(invoice_no, subcontractor_id);

-- Prevent duplicate attendance for same subcontractor on same date
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_date_unique 
ON subcontractor_attendance(subcontractor_id, attendance_date);

-- ============================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subcontractors_status ON subcontractors(status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_subcontractors_deleted ON subcontractors(is_deleted);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON subcontractor_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_subcontractor ON subcontractor_work_orders(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subcontractor_invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_subcontractor ON subcontractor_payments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_subcontractor ON subcontractor_daily_logs(subcontractor_id, log_date);
CREATE INDEX IF NOT EXISTS idx_issues_subcontractor ON subcontractor_issues(subcontractor_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_subcontractor ON subcontractor_documents(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_amendments_organisation ON subcontractor_work_order_amendments(organisation_id);

-- ============================================================================
-- PART 5: TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subcontractors_updated_at ON subcontractors;
CREATE TRIGGER trg_subcontractors_updated_at
BEFORE UPDATE ON subcontractors
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON subcontractor_payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON subcontractor_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON subcontractor_attendance;
CREATE TRIGGER trg_attendance_updated_at
BEFORE UPDATE ON subcontractor_attendance
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_work_orders_updated_at ON subcontractor_work_orders;
CREATE TRIGGER trg_work_orders_updated_at
BEFORE UPDATE ON subcontractor_work_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_logs_updated_at ON subcontractor_daily_logs;
CREATE TRIGGER trg_daily_logs_updated_at
BEFORE UPDATE ON subcontractor_daily_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON subcontractor_invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON subcontractor_invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 6: RLS POLICIES FOR SOFT DELETE
-- ============================================================================

-- Update existing RLS policy to exclude soft-deleted records by default
DROP POLICY IF EXISTS "Enable all access" ON subcontractors;
CREATE POLICY "Enable read access for non-deleted subcontractors"
ON subcontractors FOR SELECT
USING (is_deleted = false);

CREATE POLICY "Enable insert for subcontractors"
ON subcontractors FOR INSERT
WITH CHECK (true);

CREATE POLICY "Enable update for subcontractors"
ON subcontractors FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable soft delete for subcontractors"
ON subcontractors FOR DELETE
USING (true);

-- ============================================================================
-- PART 7: HELPER FUNCTION FOR SUB NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_sub_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  new_sub_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(sub_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM subcontractors
  WHERE organisation_id = org_id AND sub_number ~ '^SUB-';
  
  new_sub_number := 'SUB-' || LPAD(next_num::TEXT, 4, '0');
  RETURN new_sub_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Subcontractor Module - Soft Delete, Audit Trail & Duplicate Prevention Migration Complete!' as result;
