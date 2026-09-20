-- Subcontractor registration validation hardening
-- Adds format validation and duplicate checks to record_subcontractor

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
  v_duplicate_count int;
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

  -- Format validations
  IF p_gstin IS NOT NULL AND TRIM(p_gstin) != '' THEN
    IF length(TRIM(p_gstin)) != 15 THEN
      RAISE EXCEPTION 'GSTIN must be exactly 15 characters';
    END IF;
    IF p_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9]{1}[Z]{1}[A-Z0-9]{1}$' THEN
      RAISE EXCEPTION 'GSTIN format is invalid';
    END IF;
  END IF;

  IF p_pan_card IS NOT NULL AND TRIM(p_pan_card) != '' THEN
    IF length(TRIM(p_pan_card)) != 10 THEN
      RAISE EXCEPTION 'PAN must be exactly 10 characters';
    END IF;
    IF p_pan_card !~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' THEN
      RAISE EXCEPTION 'PAN format is invalid';
    END IF;
  END IF;

  IF p_bank_ifsc_code IS NOT NULL AND TRIM(p_bank_ifsc_code) != '' THEN
    IF length(TRIM(p_bank_ifsc_code)) != 11 THEN
      RAISE EXCEPTION 'IFSC code must be exactly 11 characters';
    END IF;
    IF p_bank_ifsc_code !~ '^[A-Z]{4}0[A-Z0-9]{6}$' THEN
      RAISE EXCEPTION 'IFSC code format is invalid';
    END IF;
  END IF;

  IF p_phone IS NOT NULL AND TRIM(p_phone) != '' THEN
    IF p_phone !~ '^[0-9]{10,15}$' THEN
      RAISE EXCEPTION 'Phone number must be 10-15 digits';
    END IF;
  END IF;

  IF p_email IS NOT NULL AND TRIM(p_email) != '' THEN
    IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Email format is invalid';
    END IF;
  END IF;

  IF p_bank_account_number IS NOT NULL AND TRIM(p_bank_account_number) != '' THEN
    IF length(TRIM(p_bank_account_number)) < 9 OR length(TRIM(p_bank_account_number)) > 18 THEN
      RAISE EXCEPTION 'Bank account number must be 9-18 digits';
    END IF;
    IF p_bank_account_number !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Bank account number must contain only digits';
    END IF;
  END IF;

  -- Duplicate checks
  IF p_gstin IS NOT NULL AND TRIM(p_gstin) != '' THEN
    SELECT COUNT(*) INTO v_duplicate_count FROM public.subcontractors
    WHERE organisation_id = p_organisation_id
      AND UPPER(TRIM(gstin)) = UPPER(TRIM(p_gstin))
      AND (p_subcontractor_id IS NULL OR id != p_subcontractor_id);
    IF v_duplicate_count > 0 THEN
      RAISE EXCEPTION 'A subcontractor with this GSTIN already exists in your organisation';
    END IF;
  END IF;

  IF p_pan_card IS NOT NULL AND TRIM(p_pan_card) != '' THEN
    SELECT COUNT(*) INTO v_duplicate_count FROM public.subcontractors
    WHERE organisation_id = p_organisation_id
      AND UPPER(TRIM(pan_card)) = UPPER(TRIM(p_pan_card))
      AND (p_subcontractor_id IS NULL OR id != p_subcontractor_id);
    IF v_duplicate_count > 0 THEN
      RAISE EXCEPTION 'A subcontractor with this PAN already exists in your organisation';
    END IF;
  END IF;

  IF p_phone IS NOT NULL AND TRIM(p_phone) != '' THEN
    SELECT COUNT(*) INTO v_duplicate_count FROM public.subcontractors
    WHERE organisation_id = p_organisation_id
      AND phone = TRIM(p_phone)
      AND (p_subcontractor_id IS NULL OR id != p_subcontractor_id);
    IF v_duplicate_count > 0 THEN
      RAISE EXCEPTION 'A subcontractor with this phone number already exists';
    END IF;
  END IF;

  IF p_email IS NOT NULL AND TRIM(p_email) != '' THEN
    SELECT COUNT(*) INTO v_duplicate_count FROM public.subcontractors
    WHERE organisation_id = p_organisation_id
      AND LOWER(TRIM(email)) = LOWER(TRIM(p_email))
      AND (p_subcontractor_id IS NULL OR id != p_subcontractor_id);
    IF v_duplicate_count > 0 THEN
      RAISE EXCEPTION 'A subcontractor with this email already exists';
    END IF;
  END IF;

  IF p_subcontractor_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.subcontractors
    WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id FOR UPDATE;

    IF v_sub IS NULL THEN
      RAISE EXCEPTION 'Subcontractor not found or unauthorized';
    END IF;

    UPDATE public.subcontractors SET
      company_name = NULLIF(TRIM(p_company_name), ''),
      contact_person = p_contact_person,
      phone = p_phone,
      email = p_email,
      address = p_address,
      state = p_state,
      gstin = UPPER(TRIM(p_gstin)),
      pincode = p_pincode,
      pan_card = UPPER(TRIM(p_pan_card)),
      bank_name = p_bank_name,
      bank_account_number = p_bank_account_number,
      bank_ifsc_code = UPPER(TRIM(p_bank_ifsc_code)),
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
      'sub_number', v_sub.sub_number,
      'operation', 'update'
    );
  ELSE
    v_sub_number := 'SUB-' || LPAD(EXTRACT(EPOCH FROM NOW())::text, 8, '0');

    INSERT INTO public.subcontractors (
      organisation_id, sub_number, company_name, contact_person, phone, email,
      address, state, gstin, pincode, pan_card, bank_name, bank_account_number,
      bank_ifsc_code, bank_account_type, previous_projects, nature_of_work,
      internal_remarks, nda_signed, contract_signed, nda_date, contract_date, status
    ) VALUES (
      p_organisation_id, v_sub_number, NULLIF(TRIM(p_company_name), ''), p_contact_person, p_phone, p_email,
      p_address, p_state, UPPER(TRIM(p_gstin)), p_pincode, UPPER(TRIM(p_pan_card)),
      p_bank_name, p_bank_account_number, UPPER(TRIM(p_bank_ifsc_code)), p_bank_account_type,
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