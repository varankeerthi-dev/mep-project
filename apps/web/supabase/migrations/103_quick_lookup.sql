-- Migration: 103_quick_lookup.sql
-- Description: Adds schema modifications and RPC functions for the Quick Lookup & Routing layer.

BEGIN;

-- 1. Schema Modifications

-- Add site_engineer_id to projects referencing auth.users(id)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS site_engineer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add logged_by_role to client_communication
ALTER TABLE public.client_communication 
ADD COLUMN IF NOT EXISTS logged_by_role TEXT;

-- Update description comment for linked_type in client_communication
COMMENT ON COLUMN public.client_communication.linked_type IS 'quotation | invoice | podc | site_visit | sales_order';

-- 2. Dispatch Blockers / Status RPC Function
CREATE OR REPLACE FUNCTION public.get_dispatch_status(p_sales_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_so RECORD;
  v_payment_pending NUMERIC := 0;
  v_invoice_details TEXT := '';
  v_shortfall_details TEXT := '';
  v_status_label TEXT := 'Unknown';
  v_detail TEXT := '';
  v_produced_qty NUMERIC := 0;
  v_total_qty NUMERIC := 0;
  v_pct_complete INT := 0;
BEGIN
  -- 1. Fetch sales order details
  SELECT * INTO v_so FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sales Order not found');
  END IF;

  -- 2. Check for finalized unpaid invoices linked to this SO or its Quotation
  SELECT 
    COALESCE(SUM(i.total - COALESCE(r.paid_amount, 0)), 0),
    COALESCE(STRING_AGG(i.invoice_no || ' (₹' || TRIM(TO_CHAR(i.total - COALESCE(r.paid_amount, 0), 'FM99,99,99,990.00')) || ' due)', ', '), '')
  INTO v_payment_pending, v_invoice_details
  FROM public.invoices i
  LEFT JOIN (
    SELECT invoice_id, SUM(amount) as paid_amount 
    FROM public.receipts 
    GROUP BY invoice_id
  ) r ON r.invoice_id = i.id
  WHERE i.status = 'final'
    AND (
      (i.source_type = 'po' AND i.source_id = p_sales_order_id)
      OR (i.source_type = 'quotation' AND i.source_id = v_so.quotation_id)
    );

  -- 3. Check for stock shortfall details
  SELECT 
    COALESCE(STRING_AGG(m.name || ' (' || (soi.qty - soi.reserved_qty)::text || ' ' || m.unit || ' short)', ', '), '')
  INTO v_shortfall_details
  FROM public.sales_order_items soi
  JOIN public.materials m ON m.id = soi.item_id
  WHERE soi.sales_order_id = p_sales_order_id
    AND soi.qty > soi.reserved_qty;

  -- 4. Calculate production progress
  SELECT 
    COALESCE(SUM(produced_qty), 0),
    COALESCE(SUM(qty), 0)
  INTO v_produced_qty, v_total_qty
  FROM public.sales_order_items
  WHERE sales_order_id = p_sales_order_id;

  IF v_total_qty > 0 THEN
    v_pct_complete := ROUND((v_produced_qty / v_total_qty) * 100);
  END IF;

  -- 5. Determine computed status
  IF v_so.status = 'cancelled' THEN
    v_status_label := 'Cancelled';
    v_detail := 'This order has been cancelled.';
  ELSIF v_so.status = 'completed' THEN
    v_status_label := 'Completed';
    v_detail := 'Material has been fully dispatched and delivered.';
  ELSIF v_so.status = 'waiting_approval' THEN
    v_status_label := 'Blocked: Pending Approval';
    v_detail := 'The order is waiting for manager approval.';
  ELSIF v_payment_pending > 0 THEN
    v_status_label := 'Blocked: Advance Payment Pending';
    v_detail := '₹' || TRIM(TO_CHAR(v_payment_pending, 'FM99,99,99,990.00')) || ' due on: ' || v_invoice_details;
  ELSIF v_so.stock_status = 'shortfall' THEN
    v_status_label := 'Blocked: Stock Shortfall';
    v_detail := 'Shortage on items: ' || COALESCE(NULLIF(v_shortfall_details, ''), 'Unknown material shortage');
  ELSIF v_so.status = 'in_production' THEN
    v_status_label := 'In Production';
    v_detail := v_pct_complete::text || '% complete, no blockers.';
  ELSIF v_so.status = 'open' AND v_so.stock_status = 'fully_reserved' THEN
    v_status_label := 'Ready to Dispatch';
    v_detail := 'Stock is fully reserved. Pending vehicle assignment.';
  ELSE
    v_status_label := INITCAP(v_so.status);
    v_detail := 'Stock status: ' || INITCAP(v_so.stock_status);
  END IF;

  RETURN jsonb_build_object(
    'status_label', v_status_label,
    'detail', v_detail,
    'so_status', v_so.status,
    'stock_status', v_so.stock_status,
    'payment_pending', v_payment_pending
  );
END;
$$;

-- 3. Scope Verification Fuzzy Search RPC Function
CREATE OR REPLACE FUNCTION public.search_quotation_scope(p_project_id UUID, p_keyword TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matches JSONB;
  v_in_scope BOOLEAN := false;
BEGIN
  -- Search for matching quotation items under approved/converted quotations
  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'item_name', COALESCE(qi.description, m.name, 'Unknown'),
      'quotation_no', qh.quotation_no,
      'rate', qi.rate,
      'approved_date', qh.date::text
    )
  ), '[]'::jsonb) INTO v_matches
  FROM public.quotation_items qi
  JOIN public.quotation_header qh ON qh.id = qi.quotation_id
  LEFT JOIN public.materials m ON m.id = qi.item_id
  WHERE qh.project_id = p_project_id
    AND (LOWER(qh.status) = 'approved' OR LOWER(qh.status) = 'converted')
    AND (
      qi.description ILIKE '%' || p_keyword || '%'
      OR m.name ILIKE '%' || p_keyword || '%'
    );

  IF jsonb_array_length(v_matches) > 0 THEN
    v_in_scope := true;
  END IF;

  RETURN jsonb_build_object(
    'matches', v_matches,
    'in_scope', v_in_scope
  );
END;
$$;

-- 4. Seed and Assign Permission Key
INSERT INTO public.permissions (key, description)
VALUES ('quick_lookup.access', 'Access to Quick Lookup for client dispatch status and scope verification')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

-- Grant permission to MD, GM, ASM, Deputy Manager, Project Manager, and Admin roles
DO $$
DECLARE
  v_role RECORD;
  v_perm_key TEXT := 'quick_lookup.access';
BEGIN
  FOR v_role IN 
    SELECT id FROM public.roles 
    WHERE name ILIKE 'MD%' 
       OR name ILIKE 'GM%' 
       OR name ILIKE 'ASM%' 
       OR name ILIKE 'Deputy Manager%'
       OR name ILIKE 'admin%'
       OR name ILIKE 'Project Manager%'
  LOOP
    INSERT INTO public.role_permissions (role_id, permission_key)
    VALUES (v_role.id, v_perm_key)
    ON CONFLICT (role_id, permission_key) DO NOTHING;
  END LOOP;
END $$;

COMMIT;
