-- Subcontractor Ledger System - Complete Database Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: SUBCONTRACTOR PROFILE - TDS FIELDS
-- ============================================================================

ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS tds_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds_applicable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);

COMMENT ON COLUMN subcontractors.tds_percentage IS 'TDS percentage to deduct (e.g., 1.00, 2.00)';
COMMENT ON COLUMN subcontractors.tds_applicable IS 'Whether TDS is applicable for this subcontractor';
COMMENT ON COLUMN subcontractors.pan_number IS 'PAN number for TDS compliance';

-- ============================================================================
-- PART 2: PAYMENT TABLE - TDS FIELDS
-- ============================================================================

ALTER TABLE subcontractor_payments
ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS tds_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15,2);

COMMENT ON COLUMN subcontractor_payments.gross_amount IS 'Original payment amount before TDS';
COMMENT ON COLUMN subcontractor_payments.tds_percentage IS 'TDS % applied';
COMMENT ON COLUMN subcontractor_payments.tds_amount IS 'TDS amount deducted';
COMMENT ON COLUMN subcontractor_payments.net_amount IS 'Net amount paid after TDS';

-- ============================================================================
-- PART 3: INVOICE-WORK ORDER LINK
-- ============================================================================

ALTER TABLE subcontractor_invoices 
ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES subcontractor_work_orders(id);

COMMENT ON COLUMN subcontractor_invoices.work_order_id IS 'Linked work order for this invoice';

-- ============================================================================
-- PART 4: WORK ORDER AMENDMENT FIELDS
-- ============================================================================

ALTER TABLE subcontractor_work_orders 
ADD COLUMN IF NOT EXISTS parent_work_order_id UUID REFERENCES subcontractor_work_orders(id),
ADD COLUMN IF NOT EXISTS amendment_no INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_amendment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS amendment_status VARCHAR(50) DEFAULT 'Draft';

COMMENT ON COLUMN subcontractor_work_orders.parent_work_order_id IS 'Parent WO reference for amendments';
COMMENT ON COLUMN subcontractor_work_orders.amendment_no IS 'Amendment sequence number';
COMMENT ON COLUMN subcontractor_work_orders.is_amendment IS 'True if this is an amendment';
COMMENT ON COLUMN subcontractor_work_orders.amendment_status IS 'Draft, Pending, Approved, Rejected';

-- ============================================================================
-- PART 5: AMENDMENT TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subcontractor_work_order_amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES subcontractor_work_orders(id) ON DELETE CASCADE NOT NULL,
  amendment_no INTEGER NOT NULL,
  previous_amount DECIMAL(15,2) NOT NULL,
  new_amount DECIMAL(15,2) NOT NULL,
  difference_amount DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subcontractor_work_order_amendments IS 'Tracks all work order amendments with approval workflow';
COMMENT ON COLUMN subcontractor_work_order_amendments.amendment_no IS 'Sequential number (AMD-001, AMD-002, etc.)';
COMMENT ON COLUMN subcontractor_work_order_amendments.difference_amount IS 'New amount - Previous amount (can be + or -)';
COMMENT ON COLUMN subcontractor_work_order_amendments.status IS 'Pending, Approved, or Rejected';

-- ============================================================================
-- PART 6: TDS PAYMENT TRACKING (Simplified)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subcontractor_tds_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES subcontractor_payments(id) ON DELETE CASCADE,
  tds_amount DECIMAL(15,2) NOT NULL,
  challan_no VARCHAR(50),
  challan_date DATE,
  quarter VARCHAR(10), -- Q1, Q2, Q3, Q4 (manual entry)
  financial_year VARCHAR(10), -- e.g., 2026-27
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subcontractor_tds_payments IS 'Tracks TDS payments to government for each subcontractor';
COMMENT ON COLUMN subcontractor_tds_payments.quarter IS 'Financial quarter (Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)';
COMMENT ON COLUMN subcontractor_tds_payments.financial_year IS 'Financial year in format YYYY-YY';

-- ============================================================================
-- PART 7: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_wo_amendments_wo ON subcontractor_work_order_amendments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_amendments_status ON subcontractor_work_order_amendments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_wo ON subcontractor_invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tds ON subcontractor_payments(tds_amount) WHERE tds_amount > 0;
CREATE INDEX IF NOT EXISTS idx_tds_payments_sub ON subcontractor_tds_payments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_tds_payments_status ON subcontractor_tds_payments(status);

-- ============================================================================
-- PART 8: TRIGGERS
-- ============================================================================

-- Amendment timestamp trigger
CREATE OR REPLACE FUNCTION update_amendment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_amendment_timestamp ON subcontractor_work_order_amendments;
CREATE TRIGGER update_amendment_timestamp
BEFORE UPDATE ON subcontractor_work_order_amendments
FOR EACH ROW EXECUTE FUNCTION update_amendment_timestamp();

-- TDS payment timestamp trigger
CREATE OR REPLACE FUNCTION update_tds_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tds_payment_timestamp ON subcontractor_tds_payments;
CREATE TRIGGER update_tds_payment_timestamp
BEFORE UPDATE ON subcontractor_tds_payments
FOR EACH ROW EXECUTE FUNCTION update_tds_payment_timestamp();

-- ============================================================================
-- PART 9: RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE subcontractor_work_order_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_tds_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subcontractor_work_order_amendments;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subcontractor_tds_payments;

-- Create policies (adjust based on your auth requirements)
CREATE POLICY "Enable all access for authenticated users" 
ON subcontractor_work_order_amendments 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" 
ON subcontractor_tds_payments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Subcontractor Ledger System - Database Migration Complete!' as result;
