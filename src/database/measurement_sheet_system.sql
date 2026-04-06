-- Measurement Sheet System - Database Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PART 1: MEASUREMENT SHEETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subcontractor_measurement_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES subcontractor_work_orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Sheet Identification
  sheet_no VARCHAR(50) NOT NULL,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  measured_by VARCHAR(255),
  description TEXT,
  
  -- Line Items (Actual measurements vs Contract)
  line_items JSONB DEFAULT '[]'::jsonb,
  -- Structure: [
  --   {
  --     description: "Wall Plastering",
  --     unit: "sq.ft",
  --     contract_qty: 500,
  --     actual_qty: 480,
  --     rate: 50.00,
  --     amount: 24000.00,
  --     difference: -1000.00
  --   }
  -- ]
  
  -- Totals
  contract_value DECIMAL(15,2) DEFAULT 0,
  actual_value DECIMAL(15,2) DEFAULT 0,
  difference DECIMAL(15,2) DEFAULT 0, -- Actual - Contract
  
  -- Auto-amendment tracking
  amendment_created BOOLEAN DEFAULT false,
  amendment_id UUID REFERENCES subcontractor_work_order_amendments(id),
  
  -- Status
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, Approved, Rejected
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT
);

COMMENT ON TABLE subcontractor_measurement_sheets IS 'Tracks actual site measurements against contract quantities for work orders';
COMMENT ON COLUMN subcontractor_measurement_sheets.line_items IS 'Array of measured items with contract vs actual comparison';
COMMENT ON COLUMN subcontractor_measurement_sheets.difference IS 'Positive = more work than contract, Negative = less work than contract';
COMMENT ON COLUMN subcontractor_measurement_sheets.amendment_created IS 'True if an amendment was auto-created due to actual > contract';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ms_work_order ON subcontractor_measurement_sheets(work_order_id);
CREATE INDEX IF NOT EXISTS idx_ms_status ON subcontractor_measurement_sheets(status);
CREATE INDEX IF NOT EXISTS idx_ms_sheet_no ON subcontractor_measurement_sheets(sheet_no);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_measurement_sheet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_measurement_sheet_timestamp ON subcontractor_measurement_sheets;
CREATE TRIGGER update_measurement_sheet_timestamp
BEFORE UPDATE ON subcontractor_measurement_sheets
FOR EACH ROW EXECUTE FUNCTION update_measurement_sheet_timestamp();

-- ============================================================================
-- PART 2: RETENTION TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subcontractor_retention (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES subcontractor_work_orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Retention Details
  retention_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  retention_amount DECIMAL(15,2) NOT NULL,
  
  -- Dates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_release_date DATE,
  actual_release_date DATE,
  
  -- Status & Payment
  status VARCHAR(50) DEFAULT 'Held', -- Held, Released
  payment_reference VARCHAR(100),
  payment_id UUID REFERENCES subcontractor_payments(id),
  
  -- Notes
  notes TEXT
);

COMMENT ON TABLE subcontractor_retention IS 'Tracks retention money held from final payments and their release';
COMMENT ON COLUMN subcontractor_retention.status IS 'Held = money retained, Released = money paid to subcontractor';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retention_wo ON subcontractor_retention(work_order_id);
CREATE INDEX IF NOT EXISTS idx_retention_status ON subcontractor_retention(status);
CREATE INDEX IF NOT EXISTS idx_retention_release_date ON subcontractor_retention(scheduled_release_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_retention_timestamp ON subcontractor_retention;
CREATE TRIGGER update_retention_timestamp
BEFORE UPDATE ON subcontractor_retention
FOR EACH ROW EXECUTE FUNCTION update_measurement_sheet_timestamp();

-- ============================================================================
-- PART 3: UPDATE WORK ORDERS TABLE
-- ============================================================================

ALTER TABLE subcontractor_work_orders
ADD COLUMN IF NOT EXISTS retention_held BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS retention_amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_measurements_count INTEGER DEFAULT 0;

COMMENT ON COLUMN subcontractor_work_orders.retention_held IS 'True if retention money is being held for this WO';
COMMENT ON COLUMN subcontractor_work_orders.total_measurements_count IS 'Number of approved measurement sheets';

-- ============================================================================
-- PART 4: UPDATE INVOICES TABLE (Link to measurement sheet)
-- ============================================================================

ALTER TABLE subcontractor_invoices
ADD COLUMN IF NOT EXISTS measurement_sheet_id UUID REFERENCES subcontractor_measurement_sheets(id),
ADD COLUMN IF NOT EXISTS is_final_invoice BOOLEAN DEFAULT false;

COMMENT ON COLUMN subcontractor_invoices.measurement_sheet_id IS 'Reference to the measurement sheet this invoice is based on';
COMMENT ON COLUMN subcontractor_invoices.is_final_invoice IS 'True if this is the final invoice for the work order';

-- ============================================================================
-- PART 5: RLS POLICIES
-- ============================================================================

ALTER TABLE subcontractor_measurement_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_retention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subcontractor_measurement_sheets;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subcontractor_retention;

CREATE POLICY "Enable all access for authenticated users" 
ON subcontractor_measurement_sheets 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" 
ON subcontractor_retention 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ============================================================================
-- PART 6: LEDGER TYPE ENUM (if not exists)
-- ============================================================================

-- Note: We use the existing ledger system but add new transaction types
-- The types are handled in the UI/frontend logic

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 'Measurement Sheet System - Database Migration Complete!' as result;
