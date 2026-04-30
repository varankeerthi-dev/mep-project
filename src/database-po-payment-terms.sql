-- PO Payment Terms Module
-- Enterprise-grade payment milestone tracking for Supply & Erection
-- Run this in Supabase SQL Editor

-- ============================================
-- Project Payment Terms Table
-- Stores default payment terms templates for projects
-- ============================================
CREATE TABLE IF NOT EXISTS project_payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  
  -- Milestone classification
  milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN ('supply', 'erection')),
  milestone_name VARCHAR(100) NOT NULL,
  milestone_order INTEGER NOT NULL,
  
  -- Payment terms
  percentage DECIMAL(5,2) NOT NULL,
  fixed_amount DECIMAL(15,2),
  condition TEXT,
  due_days INTEGER,
  
  -- Metadata
  is_default BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique milestone name per project
  CONSTRAINT unique_project_milestone UNIQUE (project_id, milestone_name)
);

-- Enable RLS for project payment terms
ALTER TABLE project_payment_terms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Project Payment Terms
DROP POLICY IF EXISTS "Users can view project payment terms for their org" ON project_payment_terms;
CREATE POLICY "Users can view project payment terms for their org"
  ON project_payment_terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organisations org ON p.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE p.id = project_payment_terms.project_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can insert project payment terms for their org" ON project_payment_terms;
CREATE POLICY "Users can insert project payment terms for their org"
  ON project_payment_terms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organisations org ON p.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE p.id = project_payment_terms.project_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update project payment terms for their org" ON project_payment_terms;
CREATE POLICY "Users can update project payment terms for their org"
  ON project_payment_terms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organisations org ON p.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE p.id = project_payment_terms.project_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete project payment terms for their org" ON project_payment_terms;
CREATE POLICY "Users can delete project payment terms for their org"
  ON project_payment_terms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN organisations org ON p.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE p.id = project_payment_terms.project_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Indexes for project payment terms
CREATE INDEX IF NOT EXISTS idx_project_payment_terms_project_id ON project_payment_terms(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payment_terms_type ON project_payment_terms(milestone_type);

-- ============================================
-- PO Line Items Table
-- Stores individual line items for each PO (description, qty, rate)
-- ============================================
CREATE TABLE IF NOT EXISTS po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES client_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Item details
  description TEXT NOT NULL,
  quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
  unit VARCHAR(50), -- e.g., "pcs", "kg", "m", "nos"
  rate_per_unit DECIMAL(15,2) NOT NULL,
  gst_percentage DECIMAL(5,2) DEFAULT 18, -- GST percentage (e.g., 18, 12, 5, 0)
  
  -- Calculated amounts
  basic_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    quantity * rate_per_unit
  ) STORED,
  gst_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    (quantity * rate_per_unit) * (gst_percentage / 100)
  ) STORED,
  amount DECIMAL(15,2) GENERATED ALWAYS AS (
    (quantity * rate_per_unit) + ((quantity * rate_per_unit) * (gst_percentage / 100))
  ) STORED,
  
  -- Optional fields
  item_code VARCHAR(100),
  remarks TEXT,
  
  -- Order
  line_order INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for PO line items
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for PO Line Items
DROP POLICY IF EXISTS "Users can view PO line items for their org" ON po_line_items;
CREATE POLICY "Users can view PO line items for their org"
  ON po_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_line_items.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can insert PO line items for their org" ON po_line_items;
CREATE POLICY "Users can insert PO line items for their org"
  ON po_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_line_items.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update PO line items for their org" ON po_line_items;
CREATE POLICY "Users can update PO line items for their org"
  ON po_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_line_items.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete PO line items for their org" ON po_line_items;
CREATE POLICY "Users can delete PO line items for their org"
  ON po_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_line_items.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Indexes for PO line items
CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_order ON po_line_items(line_order);

-- Trigger to update PO total value when line items change
CREATE OR REPLACE FUNCTION update_po_total_from_line_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total from all line items
  DECLARE
    total_amount DECIMAL(15,2);
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_amount
    FROM po_line_items
    WHERE po_id = NEW.po_id;
    
    -- Update PO total value
    UPDATE client_purchase_orders
    SET 
      po_total_value = total_amount,
      po_available_value = total_amount - COALESCE(po_utilized_value, 0),
      updated_at = NOW()
    WHERE id = NEW.po_id;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_total_from_line_items ON po_line_items;
CREATE TRIGGER trigger_update_po_total_from_line_items
  AFTER INSERT OR UPDATE OR DELETE ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total_from_line_items();

-- ============================================
-- Payment Milestones Table
-- Stores payment terms/milestones for each PO
-- ============================================
CREATE TABLE IF NOT EXISTS po_payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES client_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Milestone classification
  milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN ('supply', 'erection')),
  milestone_name VARCHAR(100) NOT NULL, -- e.g., "Advance", "Against Invoice", "RA Bill"
  milestone_order INTEGER NOT NULL, -- Order of execution
  
  -- Payment terms
  percentage DECIMAL(5,2) NOT NULL, -- Percentage of PO total
  fixed_amount DECIMAL(15,2), -- Optional fixed amount override
  condition TEXT, -- e.g., "Against Invoice within 5 days"
  due_days INTEGER, -- Days from PO date or previous milestone
  
  -- Amount calculations
  milestone_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(fixed_amount, 0)
  ) STORED,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'overdue')),
  paid_amount DECIMAL(15,2) DEFAULT 0,
  pending_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Dates
  due_date DATE,
  completed_date DATE,
  
  -- Metadata
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique milestone name per PO
  CONSTRAINT unique_milestone_per_po UNIQUE (po_id, milestone_name)
);

-- ============================================
-- Payment Transactions Table
-- Tracks actual payments against milestones
-- ============================================
CREATE TABLE IF NOT EXISTS po_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES po_payment_milestones(id) ON DELETE CASCADE NOT NULL,
  po_id UUID REFERENCES client_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Payment details
  transaction_number VARCHAR(50) UNIQUE,
  transaction_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50), -- e.g., "Bank Transfer", "Cheque", "UPI"
  reference_number VARCHAR(100), -- e.g., cheque number, UTR number
  
  -- Status
  status VARCHAR(50) DEFAULT 'received' CHECK (status IN ('pending', 'received', 'bounced', 'cancelled')),
  
  -- Supporting documents
  attachment_url TEXT,
  attachment_name TEXT,
  
  -- Metadata
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE po_payment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_payment_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for Payment Milestones
-- ============================================
-- Users can see milestones for POs in their organisation
DROP POLICY IF EXISTS "Users can view payment milestones for their org" ON po_payment_milestones;
CREATE POLICY "Users can view payment milestones for their org"
  ON po_payment_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_milestones.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Users can insert milestones for POs in their organisation
DROP POLICY IF EXISTS "Users can insert payment milestones for their org" ON po_payment_milestones;
CREATE POLICY "Users can insert payment milestones for their org"
  ON po_payment_milestones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_milestones.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Users can update milestones for POs in their organisation
DROP POLICY IF EXISTS "Users can update payment milestones for their org" ON po_payment_milestones;
CREATE POLICY "Users can update payment milestones for their org"
  ON po_payment_milestones FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_milestones.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- Users can delete milestones for POs in their organisation
DROP POLICY IF EXISTS "Users can delete payment milestones for their org" ON po_payment_milestones;
CREATE POLICY "Users can delete payment milestones for their org"
  ON po_payment_milestones FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_milestones.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- ============================================
-- RLS Policies for Transactions
-- ============================================
DROP POLICY IF EXISTS "Users can view payment transactions for their org" ON po_payment_transactions;
CREATE POLICY "Users can view payment transactions for their org"
  ON po_payment_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_transactions.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can insert payment transactions for their org" ON po_payment_transactions;
CREATE POLICY "Users can insert payment transactions for their org"
  ON po_payment_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_transactions.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update payment transactions for their org" ON po_payment_transactions;
CREATE POLICY "Users can update payment transactions for their org"
  ON po_payment_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM client_purchase_orders po
      INNER JOIN organisations org ON po.organisation_id = org.id
      INNER JOIN org_members om ON org.id = om.organisation_id
      WHERE po.id = po_payment_transactions.po_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_po_payment_milestones_po_id ON po_payment_milestones(po_id);
CREATE INDEX IF NOT EXISTS idx_po_payment_milestones_type ON po_payment_milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_po_payment_milestones_status ON po_payment_milestones(status);
CREATE INDEX IF NOT EXISTS idx_po_payment_milestones_due_date ON po_payment_milestones(due_date);

CREATE INDEX IF NOT EXISTS idx_po_payment_transactions_milestone_id ON po_payment_transactions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_po_payment_transactions_po_id ON po_payment_transactions(po_id);
CREATE INDEX IF NOT EXISTS idx_po_payment_transactions_date ON po_payment_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_po_payment_transactions_status ON po_payment_transactions(status);

-- ============================================
-- Trigger: Auto-calculate milestone amount from PO total
-- ============================================
CREATE OR REPLACE FUNCTION calculate_milestone_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- If percentage is set and no fixed amount, calculate from PO total
  IF NEW.percentage IS NOT NULL AND NEW.fixed_amount IS NULL THEN
    DECLARE
      po_total DECIMAL(15,2);
    BEGIN
      SELECT po_total_value INTO po_total
      FROM client_purchase_orders
      WHERE id = NEW.po_id;
      
      NEW.milestone_amount := (po_total * NEW.percentage) / 100;
    END;
  END IF;
  
  -- Calculate due date if due_days is set
  IF NEW.due_days IS NOT NULL AND NEW.due_date IS NULL THEN
    DECLARE
      base_date DATE;
    BEGIN
      -- Use PO date as base
      SELECT po_date INTO base_date
      FROM client_purchase_orders
      WHERE id = NEW.po_id;
      
      NEW.due_date := base_date + NEW.due_days;
    END;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_milestone_amount ON po_payment_milestones;
CREATE TRIGGER trigger_calculate_milestone_amount
  BEFORE INSERT OR UPDATE ON po_payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION calculate_milestone_amount();

-- ============================================
-- Trigger: Update milestone status based on payments
-- ============================================
CREATE OR REPLACE FUNCTION update_milestone_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total paid for this milestone
  DECLARE
    total_paid DECIMAL(15,2);
    milestone_amt DECIMAL(15,2);
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM po_payment_transactions
    WHERE milestone_id = NEW.milestone_id
    AND status = 'received';
    
    SELECT milestone_amount INTO milestone_amt
    FROM po_payment_milestones
    WHERE id = NEW.milestone_id;
    
    -- Update milestone paid amount, pending amount, and status
    UPDATE po_payment_milestones
    SET 
      paid_amount = total_paid,
      pending_amount = milestone_amt - total_paid,
      status = CASE
        WHEN total_paid >= milestone_amt THEN 'completed'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      completed_date = CASE
        WHEN total_paid >= milestone_amt THEN NEW.transaction_date
        ELSE completed_date
      END
    WHERE id = NEW.milestone_id;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_milestone_payment_status ON po_payment_transactions;
CREATE TRIGGER trigger_update_milestone_payment_status
  AFTER INSERT OR UPDATE ON po_payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_payment_status();

-- ============================================
-- Function: Get PO payment summary
-- ============================================
CREATE OR REPLACE FUNCTION get_po_payment_summary(p_po_id UUID)
RETURNS TABLE (
  total_milestones INTEGER,
  total_milestone_amount DECIMAL(15,2),
  total_paid DECIMAL(15,2),
  total_pending DECIMAL(15,2),
  supply_progress DECIMAL(5,2),
  erection_progress DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(milestone_amount), 0),
    COALESCE(SUM(paid_amount), 0),
    COALESCE(SUM(pending_amount), 0),
    CASE
      WHEN (SELECT SUM(milestone_amount) FROM po_payment_milestones WHERE po_id = p_po_id AND milestone_type = 'supply') > 0
      THEN (
        (SELECT SUM(paid_amount) FROM po_payment_milestones WHERE po_id = p_po_id AND milestone_type = 'supply') /
        (SELECT SUM(milestone_amount) FROM po_payment_milestones WHERE po_id = p_po_id AND milestone_type = 'supply')
      ) * 100
      ELSE 0
    END,
    CASE
      WHEN (SELECT SUM(milestone_amount) FROM po_payment_milestones WHERE po_id = p_po_id AND milestone_type = 'erection') > 0
      THEN (
        (SELECT SUM(paid_amount) FROM po_payment_milestones WHERE po_id = p_po_id AND milestone_type = 'erection') /
        (SELECT SUM(milestone_amount) FROM po_payment_milestones WHERE po_id = p_po_id AND milestone_type = 'erection')
      ) * 100
      ELSE 0
    END
  FROM po_payment_milestones
  WHERE po_id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Check overdue milestones
-- ============================================
CREATE OR REPLACE FUNCTION check_overdue_milestones()
RETURNS TABLE (po_id UUID, milestone_id UUID, milestone_name VARCHAR, days_overdue INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.po_id,
    pm.id,
    pm.milestone_name,
    EXTRACT(DAY FROM (CURRENT_DATE - pm.due_date))::INTEGER
  FROM po_payment_milestones pm
  WHERE pm.due_date < CURRENT_DATE
  AND pm.status IN ('pending', 'partial')
  AND pm.status != 'completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add comment for documentation
-- ============================================
COMMENT ON TABLE po_payment_milestones IS 'Stores payment milestones (supply/erection) for each PO with percentage-based or fixed amounts';
COMMENT ON TABLE po_payment_transactions IS 'Tracks actual payments received against each milestone';
COMMENT ON COLUMN po_payment_milestones.milestone_type IS 'Type of milestone: supply or erection';
COMMENT ON COLUMN po_payment_milestones.percentage IS 'Percentage of PO total for this milestone';
COMMENT ON COLUMN po_payment_milestones.condition IS 'Payment condition, e.g., "Against Invoice within 5 days"';
COMMENT ON COLUMN po_payment_milestones.due_days IS 'Days from PO date when this milestone is due';
