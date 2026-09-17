-- ============================================
-- Subcontractor V2 — RPC Hardening
-- ============================================
-- Purpose: move all subcontractor mutations behind
-- SECURITY DEFINER RPCs so the browser never gets
-- direct table write access.
-- ============================================

-- 1. RPC: record_subcontractor
-- Handles both create and update of subcontractor master.
CREATE OR REPLACE FUNCTION public.record_subcontractor(
  p_organisation_id uuid,
  p_subcontractor_id uuid DEFAULT NULL::uuid,
  p_company_name text DEFAULT NULL::text,
  p_contact_person text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_state text DEFAULT NULL::text,
  p_gstin text DEFAULT NULL::text,
  p_pincode text DEFAULT NULL::text,
  p_pan_card text DEFAULT NULL::text,
  p_bank_name text DEFAULT NULL::text,
  p_bank_account_number text DEFAULT NULL::text,
  p_bank_ifsc_code text DEFAULT NULL::text,
  p_bank_account_type text DEFAULT NULL::text,
  p_previous_projects text DEFAULT NULL::text,
  p_nature_of_work text DEFAULT NULL::text,
  p_internal_remarks text DEFAULT NULL::text,
  p_nda_signed boolean DEFAULT false,
  p_contract_signed boolean DEFAULT false,
  p_nda_date date DEFAULT NULL::date,
  p_contract_date date DEFAULT NULL::date,
  p_status text DEFAULT 'Active'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub RECORD;
  v_sub_number text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF NULLIF(TRIM(p_company_name), '') IS NULL THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;

  IF p_subcontractor_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.subcontractors
    WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id FOR UPDATE;

    IF v_sub IS NULL THEN
      RAISE EXCEPTION 'Subcontractor not found or does not belong to organization';
    END IF;

    UPDATE public.subcontractors SET
      company_name = p_company_name,
      contact_person = p_contact_person,
      phone = p_phone,
      email = p_email,
      address = p_address,
      state = p_state,
      gstin = UPPER(COALESCE(p_gstin, '')),
      pincode = p_pincode,
      pan_card = UPPER(COALESCE(p_pan_card, '')),
      bank_name = p_bank_name,
      bank_account_number = p_bank_account_number,
      bank_ifsc_code = UPPER(COALESCE(p_bank_ifsc_code, '')),
      bank_account_type = p_bank_account_type,
      previous_projects = p_previous_projects,
      nature_of_work = p_nature_of_work,
      internal_remarks = p_internal_remarks,
      nda_signed = p_nda_signed,
      contract_signed = p_contract_signed,
      nda_date = CASE WHEN p_nda_signed THEN p_nda_date ELSE NULL END,
      contract_date = CASE WHEN p_contract_signed THEN p_contract_date ELSE NULL END,
      status = p_status,
      updated_at = NOW()
    WHERE id = p_subcontractor_id;

    RETURN jsonb_build_object(
      'status', 'success',
      'subcontractor_id', p_subcontractor_id,
      'operation', 'update'
    );
  ELSE
    v_sub_number := public.generate_next_subcontractor_number(p_organisation_id);

    INSERT INTO public.subcontractors (
      organisation_id, sub_number, company_name, contact_person, phone, email,
      address, state, gstin, pincode, pan_card, bank_name, bank_account_number,
      bank_ifsc_code, bank_account_type, previous_projects, nature_of_work,
      internal_remarks, nda_signed, contract_signed, nda_date, contract_date, status
    ) VALUES (
      p_organisation_id, v_sub_number, p_company_name, p_contact_person, p_phone, p_email,
      p_address, p_state, UPPER(COALESCE(p_gstin, '')), p_pincode, UPPER(COALESCE(p_pan_card, '')),
      p_bank_name, p_bank_account_number, UPPER(COALESCE(p_bank_ifsc_code, '')), p_bank_account_type,
      p_previous_projects, p_nature_of_work, p_internal_remarks, p_nda_signed, p_contract_signed,
      CASE WHEN p_nda_signed THEN p_nda_date ELSE NULL END, CASE WHEN p_contract_signed THEN p_contract_date ELSE NULL END, p_status
    )
    RETURNING id INTO v_sub;

    RETURN jsonb_build_object(
      'status', 'success',
      'subcontractor_id', v_sub.id,
      'sub_number', v_sub_number,
      'operation', 'create'
    );
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_subcontractor(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, date, date, text) TO authenticated;


-- 2. RPC: record_attendance
-- Creates manpower attendance entries.
CREATE OR REPLACE FUNCTION public.record_attendance(
  p_organisation_id uuid,
  p_attendance_date date,
  p_labour_category_id uuid,
  p_subcontractor_id uuid DEFAULT NULL::uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_work_unit_id uuid DEFAULT NULL::uuid,
  p_work_unit_type text DEFAULT 'GENERAL'::text,
  p_workers_count integer DEFAULT 1,
  p_hours_worked numeric DEFAULT 8,
  p_supervisor_name text DEFAULT NULL::text,
  p_applied_modifiers jsonb DEFAULT '[]'::jsonb,
  p_base_rate numeric DEFAULT 0,
  p_adjusted_rate numeric DEFAULT 0,
  p_original_amount numeric DEFAULT 0,
  p_adjusted_amount numeric DEFAULT 0,
  p_remarks text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  INSERT INTO public.manpower_attendance (
    organisation_id, subcontractor_id, client_id, work_unit_id, work_unit_type,
    attendance_date, labour_category_id, workers_count, hours_worked, supervisor_name,
    applied_modifiers, base_rate, adjusted_rate, original_amount, adjusted_amount, remarks
  ) VALUES (
    p_organisation_id, p_subcontractor_id, p_client_id, p_work_unit_id, p_work_unit_type,
    p_attendance_date, p_labour_category_id, p_workers_count, p_hours_worked, p_supervisor_name,
    p_applied_modifiers, p_base_rate, p_adjusted_rate, p_original_amount, p_adjusted_amount, p_remarks
  )
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object(
    'status', 'success',
    'attendance_id', v_entry.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_attendance(uuid, date, uuid, uuid, uuid, uuid, text, integer, numeric, text, jsonb, numeric, numeric, numeric, numeric, text) TO authenticated;


-- 3. RPC: update_attendance
CREATE OR REPLACE FUNCTION public.update_attendance(
  p_attendance_id uuid,
  p_organisation_id uuid,
  p_workers_count integer DEFAULT NULL::integer,
  p_hours_worked numeric DEFAULT NULL::numeric,
  p_supervisor_name text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_entry FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  UPDATE public.manpower_attendance SET
    workers_count = COALESCE(p_workers_count, workers_count),
    hours_worked = COALESCE(p_hours_worked, hours_worked),
    supervisor_name = COALESCE(p_supervisor_name, supervisor_name),
    remarks = COALESCE(p_remarks, remarks),
    updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('status', 'success', 'attendance_id', p_attendance_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_attendance(uuid, uuid, integer, numeric, text, text) TO authenticated;


-- 4. RPC: delete_attendance
CREATE OR REPLACE FUNCTION public.delete_attendance(
  p_attendance_id uuid,
  p_organisation_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_entry FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  IF v_entry.status = 'APPROVED' THEN
    RAISE EXCEPTION 'Approved attendance entries cannot be deleted';
  END IF;

  DELETE FROM public.manpower_attendance WHERE id = p_attendance_id;

  RETURN jsonb_build_object('status', 'success');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_attendance(uuid, uuid) TO authenticated;


-- 5. RPC: approve_attendance
CREATE OR REPLACE FUNCTION public.approve_attendance(
  p_attendance_id uuid,
  p_organisation_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_entry FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  IF v_entry.status = 'APPROVED' THEN
    RETURN jsonb_build_object('status', 'already_approved', 'attendance_id', p_attendance_id);
  END IF;

  UPDATE public.manpower_attendance SET
    status = 'APPROVED',
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('status', 'success', 'attendance_id', p_attendance_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_attendance(uuid, uuid) TO authenticated;
