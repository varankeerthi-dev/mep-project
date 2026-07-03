-- ============================================
-- 099_advances_expenses.sql
-- Employee advances, expense claims, reimbursements,
-- and petty cash float tracking.
-- Integrates with existing EXPENSE_CLAIM approvals.
-- ============================================

-- Petty Cash Floats
CREATE TABLE IF NOT EXISTS petty_cash_floats (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id),
  holder_id         UUID NOT NULL REFERENCES user_profiles(id),
  holder_name       VARCHAR(255),
  project_id        UUID REFERENCES projects(id),
  project_name      VARCHAR(255),
  float_amount      DECIMAL(15,2) NOT NULL,
  current_balance   DECIMAL(15,2) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Advances & Expenses
CREATE TABLE IF NOT EXISTS advances_expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  type            VARCHAR(20) NOT NULL CHECK (type IN ('ADVANCE', 'EXPENSE', 'REIMBURSEMENT')),
  request_type    VARCHAR(20) CHECK (request_type IN ('REIMBURSEMENT', 'PRE_APPROVAL')),
  transaction_no  VARCHAR(30),
  employee_id     UUID NOT NULL REFERENCES user_profiles(id),
  employee_name   VARCHAR(255),
  project_id      UUID REFERENCES projects(id),
  project_name    VARCHAR(255),
  category_id     UUID REFERENCES accounts(id),
  category_name   VARCHAR(255),
  amount          DECIMAL(15,2) NOT NULL,
  narration       TEXT,
  remarks         TEXT,
  advance_id      UUID REFERENCES advances_expenses(id),
  float_id        UUID REFERENCES petty_cash_floats(id),
  payout_method   VARCHAR(20) DEFAULT 'IMMEDIATE' CHECK (payout_method IN ('IMMEDIATE', 'WITH_SALARY')),
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')),
  approval_id     UUID REFERENCES approvals(id) ON DELETE SET NULL,
  workflow_step   VARCHAR(30) DEFAULT 'created',
  approval_status VARCHAR(20) DEFAULT 'Not Required',
  is_deleted      BOOLEAN DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID NOT NULL,
  created_by_name VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ae_org_type ON advances_expenses(organisation_id, type);
CREATE INDEX IF NOT EXISTS idx_ae_employee ON advances_expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_ae_project ON advances_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_ae_category ON advances_expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_ae_status ON advances_expenses(status);
CREATE INDEX IF NOT EXISTS idx_ae_transaction ON advances_expenses(transaction_no);
CREATE INDEX IF NOT EXISTS idx_ae_created_by ON advances_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_ae_advance ON advances_expenses(advance_id);
CREATE INDEX IF NOT EXISTS idx_pcf_org ON petty_cash_floats(organisation_id);
CREATE INDEX IF NOT EXISTS idx_pcf_holder ON petty_cash_floats(holder_id);
CREATE INDEX IF NOT EXISTS idx_pcf_project ON petty_cash_floats(project_id);

-- RLS
ALTER TABLE advances_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_floats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view their org's advances_expenses"
  ON advances_expenses FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users can insert advances_expenses"
  ON advances_expenses FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users can update advances_expenses"
  ON advances_expenses FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users can view petty_cash_floats"
  ON petty_cash_floats FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users can manage petty_cash_floats"
  ON petty_cash_floats FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users can update petty_cash_floats"
  ON petty_cash_floats FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- RPC to decrement petty cash float balance
CREATE OR REPLACE FUNCTION public.decrement_float_balance(
  float_id UUID,
  dec_amount DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE petty_cash_floats
  SET current_balance = current_balance - dec_amount,
      updated_at = NOW()
  WHERE id = float_id;
END;
$$;
