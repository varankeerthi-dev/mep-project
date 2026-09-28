-- WEL-44 Phase 4 (increment 2): hr.salary read layer.
-- Applied directly to the live database via Supabase MCP on 2026-09-28.
--
-- Direct PostgREST reads of employees.monthly_salary are closed for the
-- authenticated role. Legitimate readers:
--   * payroll computation -> list_payroll_inputs() (DEFINER, field-gated)
--   * HR edits          -> gated form field + trg_employees_salary_guard
--     (see 20260928000004_rbac_v1_module_guards.sql)
--   * general employee reads -> explicit column lists (no salary)
-- New columns default to ungranted (fail-closed); extend the GRANT list
-- deliberately when adding non-sensitive columns.

CREATE OR REPLACE FUNCTION public.list_payroll_inputs(p_org_id uuid)
RETURNS SETOF public.employees
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._rbac_role_id(p_org_id);
  IF NOT public.can_view_field(p_org_id, 'hr.salary') THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  RETURN QUERY
    SELECT e.* FROM public.employees e
    WHERE e.organisation_id = p_org_id
      AND lower(coalesce(e.status, 'active')) = 'active'
      AND coalesce(e.include_in_salary, true) = true
    ORDER BY e.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_payroll_inputs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_payroll_inputs(uuid) TO authenticated;

REVOKE SELECT ON public.employees FROM authenticated;

GRANT SELECT (
  id, organisation_id, name, email, phone, status, created_at, updated_at,
  employee_code, designation, department, dob, deployment_mode, default_site_id,
  blood_group, marital_status, father_name, mother_name, employment_type,
  joined_date, shift_id, min_daily_hours, reporting_manager_id, permission_hours,
  hide_in_attendance, include_in_salary, include_in_task, mobile_no, office_no,
  personal_no, emergency_contact, address, login_enabled, personal_email,
  work_email, login_email_type, role, role_id, aadhar_no, pan_no, pf_no, esi_no,
  driving_license_no, has_own_vehicle, withdraw_full_salary, personal_bank,
  company_bank
) ON public.employees TO authenticated;
