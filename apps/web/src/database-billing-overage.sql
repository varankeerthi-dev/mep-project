-- =============================================================================
-- BILLING OVERAGE TRACKING
-- Run in Supabase SQL Editor
-- Adds per-line-item billing tracking + structured over-billing audit log
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add billed tracking columns to po_line_items
-- ---------------------------------------------------------------------------
ALTER TABLE po_line_items
  ADD COLUMN IF NOT EXISTS billed_qty DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN po_line_items.billed_qty IS 'Total quantity billed across all invoices/proformas referencing this PO line item';
COMMENT ON COLUMN po_line_items.billed_amount IS 'Total amount billed across all invoices/proformas referencing this PO line item';

-- ---------------------------------------------------------------------------
-- 2. Billing overage audit log
-- Tracks every instance where a PO line item was over-billed (qty or rate)
-- alongside the structured reason provided by the user.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_overage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  po_line_item_id UUID NOT NULL REFERENCES po_line_items(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES client_purchase_orders(id) ON DELETE CASCADE,
  
  -- Source document that triggered the over-billing
  source_type TEXT NOT NULL CHECK (source_type IN ('invoice', 'proforma')),
  source_id UUID NOT NULL,
  source_number TEXT,
  
  -- Line item details at time of billing
  item_description TEXT NOT NULL,
  original_qty DECIMAL(15,2) NOT NULL,
  billed_qty DECIMAL(15,2) NOT NULL,
  overage_qty DECIMAL(15,2) NOT NULL, -- billed_qty - original_qty (positive = over-billing)
  original_rate DECIMAL(15,2) NOT NULL,
  billed_rate DECIMAL(15,2) NOT NULL,
  
  -- Structured reason
  reason TEXT NOT NULL CHECK (reason IN (
    'client_email_approval',
    'client_verbal_confirmation',
    'site_variation_extra_work',
    'rate_revision_agreed',
    'correction_short_billing',
    'other'
  )),
  reference TEXT,       -- Free-form reference (mandatory when reason = 'other')
  approved_by TEXT,     -- Person who authorized the over-billing
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_overage_org
  ON billing_overage_log(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_overage_po
  ON billing_overage_log(po_id);
CREATE INDEX IF NOT EXISTS idx_billing_overage_po_item
  ON billing_overage_log(po_line_item_id);
CREATE INDEX IF NOT EXISTS idx_billing_overage_source
  ON billing_overage_log(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_billing_overage_reason
  ON billing_overage_log(reason);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE billing_overage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_overage_select ON billing_overage_log;
DROP POLICY IF EXISTS billing_overage_insert ON billing_overage_log;

CREATE POLICY billing_overage_select ON billing_overage_log
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY billing_overage_insert ON billing_overage_log
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ---------------------------------------------------------------------------
-- 4. Function: Update billed_qty / billed_amount on po_line_items
--    Called after an invoice or proforma is finalized
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_po_line_item_billed(
  p_line_item_id UUID,
  p_qty DECIMAL(15,2),
  p_amount DECIMAL(15,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE po_line_items
  SET
    billed_qty = COALESCE(billed_qty, 0) + p_qty,
    billed_amount = COALESCE(billed_amount, 0) + p_amount,
    updated_at = NOW()
  WHERE id = p_line_item_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Function: Log billing overage entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION insert_billing_overage_log(
  p_organisation_id UUID,
  p_po_line_item_id UUID,
  p_po_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_source_number TEXT,
  p_item_description TEXT,
  p_original_qty DECIMAL(15,2),
  p_billed_qty DECIMAL(15,2),
  p_overage_qty DECIMAL(15,2),
  p_original_rate DECIMAL(15,2),
  p_billed_rate DECIMAL(15,2),
  p_reason TEXT,
  p_reference TEXT DEFAULT NULL,
  p_approved_by TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO billing_overage_log (
    organisation_id, po_line_item_id, po_id,
    source_type, source_id, source_number,
    item_description, original_qty, billed_qty, overage_qty,
    original_rate, billed_rate,
    reason, reference, approved_by,
    created_by
  ) VALUES (
    p_organisation_id, p_po_line_item_id, p_po_id,
    p_source_type, p_source_id, p_source_number,
    p_item_description, p_original_qty, p_billed_qty, p_overage_qty,
    p_original_rate, p_billed_rate,
    p_reason, p_reference, p_approved_by,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_po_line_item_billed TO authenticated;
GRANT EXECUTE ON FUNCTION insert_billing_overage_log TO authenticated;

COMMIT;
