-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20240101000156_double_entry_gl_engine.sql
-- Description: Hardened Double-Entry GL Posting Engine & FY Subledger Balances RPC
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Ensure Header and Line Table Columns Exist
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id),
  ADD COLUMN IF NOT EXISTS document_id UUID,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS financial_year VARCHAR(20);

ALTER TABLE journal_entry_lines 
  ADD COLUMN IF NOT EXISTS party_role party_role_type;

-- 2. Database-Level Unique Idempotency Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_source_document
ON journal_entries (organisation_id, document_type, document_id)
WHERE document_id IS NOT NULL;

-- 3. Hardened Double-Entry Journal Posting RPC
CREATE OR REPLACE FUNCTION post_double_entry_journal(
  p_organisation_id UUID,
  p_document_id UUID,
  p_document_type TEXT,
  p_voucher_no TEXT,
  p_voucher_type TEXT,
  p_transaction_date DATE,
  p_financial_year TEXT,
  p_narration TEXT,
  p_lines JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_id UUID;
  v_total_debit NUMERIC := 0;
  v_total_credit NUMERIC := 0;
  v_line_debit NUMERIC;
  v_line_credit NUMERIC;
  v_account_id UUID;
  v_account_type TEXT;
  v_account_org UUID;
  v_account_active BOOLEAN;
  elem JSONB;
BEGIN
  -- 1. Authentication Check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Tenant Access Check
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- 3. RBAC Posting Permission Check
  IF NOT EXISTS (
    SELECT 1 FROM org_members 
    WHERE user_id = auth.uid() 
      AND organisation_id = p_organisation_id 
      AND role IN ('admin', 'owner', 'accountant', 'manager')
  ) THEN
    RAISE EXCEPTION 'User lacks permission to post accounting entries in organisation %', p_organisation_id;
  END IF;

  -- 4. Rejection of Empty Journals
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Journal entry must contain at least one line';
  END IF;

  -- 5. Idempotency Check: check if journal already exists for document
  IF p_document_id IS NOT NULL THEN
    SELECT id INTO v_journal_id
    FROM journal_entries
    WHERE organisation_id = p_organisation_id
      AND document_id = p_document_id
      AND document_type = p_document_type
    LIMIT 1;

    IF v_journal_id IS NOT NULL THEN
      RETURN v_journal_id;
    END IF;
  END IF;

  -- 6. Line Validation Loop
  FOR elem IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    -- Explicit account_id Presence Check
    IF (elem->>'account_id') IS NULL OR TRIM(elem->>'account_id') = '' THEN
      RAISE EXCEPTION 'Journal line requires non-null account_id';
    END IF;
    
    v_account_id := (elem->>'account_id')::UUID;
    v_line_debit := COALESCE((elem->>'debit')::NUMERIC, 0.00);
    v_line_credit := COALESCE((elem->>'credit')::NUMERIC, 0.00);

    IF v_line_debit < 0 OR v_line_credit < 0 THEN
      RAISE EXCEPTION 'Debit and Credit amounts must be non-negative';
    END IF;

    IF v_line_debit > 0 AND v_line_credit > 0 THEN
      RAISE EXCEPTION 'A journal line cannot contain both Debit and Credit amounts';
    END IF;

    v_total_debit := v_total_debit + v_line_debit;
    v_total_credit := v_total_credit + v_line_credit;
    
    SELECT organisation_id, COALESCE(is_active, true), account_type 
    INTO v_account_org, v_account_active, v_account_type
    FROM accounts WHERE id = v_account_id;

    IF v_account_org IS NULL OR v_account_org <> p_organisation_id THEN
      RAISE EXCEPTION 'Account % does not belong to organization %', v_account_id, p_organisation_id;
    END IF;

    IF NOT v_account_active THEN
      RAISE EXCEPTION 'Account % is inactive', v_account_id;
    END IF;

    -- Control Account Party Requirement Enforcement
    IF v_account_type IN ('receivable', 'payable', 'Control Account') THEN
      IF (elem->>'party_id') IS NULL OR (elem->>'party_role') IS NULL THEN
        RAISE EXCEPTION 'Control account % requires party_id and party_role', v_account_id;
      END IF;
    END IF;

    -- Tenant-Aware Party Role Check
    IF (elem->>'party_id') IS NOT NULL THEN
      IF NOT validate_party_role(p_organisation_id, (elem->>'party_id')::UUID, (elem->>'party_role')::party_role_type) THEN
        RAISE EXCEPTION 'Party % does not possess role % in organisation %', elem->>'party_id', elem->>'party_role', p_organisation_id;
      END IF;
    END IF;
  END LOOP;

  -- 7. Zero-Value Rejection
  IF v_total_debit <= 0 THEN
    RAISE EXCEPTION 'Journal entry total amount must be greater than zero';
  END IF;

  -- 8. Mathematical Balance Check
  IF ROUND(v_total_debit, 2) <> ROUND(v_total_credit, 2) THEN
    RAISE EXCEPTION 'Unbalanced journal entry: Total Debit (%) != Total Credit (%)', v_total_debit, v_total_credit;
  END IF;

  -- 9. Explicit ON CONFLICT Header Insert for Deterministic Idempotency
  INSERT INTO journal_entries (
    organisation_id, company_id, document_id, document_type, voucher_no, voucher_date, voucher_type, financial_year, narration, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_document_id, p_document_type, p_voucher_no, p_transaction_date, p_voucher_type, p_financial_year, p_narration, 'Posted', auth.uid()
  )
  ON CONFLICT (organisation_id, document_type, document_id) WHERE document_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_journal_id;

  -- If concurrency race occurred and row existed, fetch existing journal ID
  IF v_journal_id IS NULL AND p_document_id IS NOT NULL THEN
    SELECT id INTO v_journal_id
    FROM journal_entries
    WHERE organisation_id = p_organisation_id 
      AND document_id = p_document_id 
      AND document_type = p_document_type;
    RETURN v_journal_id;
  END IF;

  -- 10. Insert Lines
  FOR elem IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, party_id, party_role, debit, credit, narration
    ) VALUES (
      v_journal_id,
      (elem->>'account_id')::UUID,
      (elem->>'party_id')::UUID,
      (elem->>'party_role')::party_role_type,
      COALESCE((elem->>'debit')::NUMERIC, 0.00),
      COALESCE((elem->>'credit')::NUMERIC, 0.00),
      elem->>'description'
    );
  END LOOP;

  RETURN v_journal_id;
END;
$$;

-- 4. Corrected FY-Filtered Party Subledger Balances RPC
CREATE OR REPLACE FUNCTION get_party_ledger_balances(
  p_organisation_id UUID,
  p_financial_year TEXT
) RETURNS TABLE (
  party_id UUID,
  party_role party_role_type,
  party_name TEXT,
  financial_year TEXT,
  opening_balance NUMERIC,
  opening_balance_type balance_type,
  total_debit NUMERIC,
  total_credit NUMERIC,
  current_balance NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  RETURN QUERY
  SELECT 
    p.id AS party_id,
    pr.role AS party_role,
    p.name AS party_name,
    p_financial_year AS financial_year,
    COALESCE(ob.amount, 0.00) AS opening_balance,
    COALESCE(ob.balance_type, 'debit') AS opening_balance_type,
    COALESCE(SUM(jel.debit), 0.00) AS total_debit,
    COALESCE(SUM(jel.credit), 0.00) AS total_credit,
    CASE 
      WHEN pr.role = 'customer' THEN 
        CASE WHEN COALESCE(ob.balance_type, 'debit') = 'debit' 
          THEN COALESCE(ob.amount, 0.00) + COALESCE(SUM(jel.debit - jel.credit), 0.00)
          ELSE (0.00 - COALESCE(ob.amount, 0.00)) + COALESCE(SUM(jel.debit - jel.credit), 0.00)
        END
      ELSE 
        CASE WHEN COALESCE(ob.balance_type, 'credit') = 'credit'
          THEN COALESCE(ob.amount, 0.00) + COALESCE(SUM(jel.credit - jel.debit), 0.00)
          ELSE (0.00 - COALESCE(ob.amount, 0.00)) + COALESCE(SUM(jel.credit - jel.debit), 0.00)
        END
    END AS current_balance
  FROM parties p
  JOIN party_roles pr ON pr.party_id = p.id
  LEFT JOIN party_opening_balances ob ON ob.party_id = p.id AND ob.role = pr.role AND ob.financial_year = p_financial_year
  LEFT JOIN journal_entries je ON je.organisation_id = p_organisation_id AND je.financial_year = p_financial_year
  LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.party_id = p.id AND jel.party_role = pr.role
  WHERE p.organisation_id = p_organisation_id
  GROUP BY p.id, pr.role, p.name, ob.amount, ob.balance_type;
END;
$$;
