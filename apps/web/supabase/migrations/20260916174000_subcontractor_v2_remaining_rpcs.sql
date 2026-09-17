-- Remaining v2 RPCs for documents, invoices, and work orders

-- 1. RPC: create_subcontractor_document
CREATE OR REPLACE FUNCTION public.create_subcontractor_document(
  p_organisation_id uuid,
  p_subcontractor_id uuid,
  p_document_name text,
  p_document_url text,
  p_document_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  INSERT INTO public.subcontractor_documents (
    organisation_id, subcontractor_id, document_name, document_url, document_type
  ) VALUES (
    p_organisation_id, p_subcontractor_id, p_document_name, p_document_url, p_document_type
  )
  RETURNING * INTO v_doc;

  RETURN jsonb_build_object(
    'status', 'success',
    'document_id', v_doc.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_subcontractor_document(uuid, uuid, text, text, text) TO authenticated;


-- 2. RPC: delete_subcontractor_invoice
CREATE OR REPLACE FUNCTION public.delete_subcontractor_invoice(
  p_invoice_id uuid,
  p_organisation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_invoice FROM public.subcontractor_invoices
  WHERE id = p_invoice_id AND organisation_id = p_organisation_id;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found or unauthorized';
  END IF;

  IF v_invoice.status = 'PAID' THEN
    RAISE EXCEPTION 'Paid invoices cannot be deleted';
  END IF;

  DELETE FROM public.subcontractor_invoices WHERE id = p_invoice_id;

  RETURN jsonb_build_object('status', 'success');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_subcontractor_invoice(uuid, uuid) TO authenticated;


-- 3. RPC: record_issue_activity_log
CREATE OR REPLACE FUNCTION public.record_issue_activity_log(
  p_organisation_id uuid,
  p_issue_id uuid,
  p_action text,
  p_old_value jsonb DEFAULT NULL::jsonb,
  p_new_value jsonb DEFAULT NULL::jsonb,
  p_done_by uuid DEFAULT NULL::uuid,
  p_done_by_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  INSERT INTO public.issue_activity_logs (
    organisation_id, issue_id, action, old_value, new_value, done_by, done_by_name
  ) VALUES (
    p_organisation_id, p_issue_id, p_action, p_old_value, p_new_value, p_done_by, p_done_by_name
  )
  RETURNING * INTO v_log;

  RETURN jsonb_build_object(
    'status', 'success',
    'log_id', v_log.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_issue_activity_log(uuid, uuid, text, jsonb, jsonb, uuid, text) TO authenticated;


-- 4. RPC: update_subcontractor_work_order_status
CREATE OR REPLACE FUNCTION public.update_subcontractor_work_order_status(
  p_work_order_id uuid,
  p_organisation_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wo RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_wo FROM public.subcontractor_work_orders
  WHERE id = p_work_order_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_wo IS NULL THEN
    RAISE EXCEPTION 'Work order not found or unauthorized';
  END IF;

  UPDATE public.subcontractor_work_orders SET
    status = p_status,
    updated_at = NOW()
  WHERE id = p_work_order_id;

  RETURN jsonb_build_object('status', 'success', 'work_order_id', p_work_order_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_subcontractor_work_order_status(uuid, uuid, text) TO authenticated;
