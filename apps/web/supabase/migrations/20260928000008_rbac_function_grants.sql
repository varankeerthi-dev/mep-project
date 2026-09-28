-- WEL-44 Phase 5 hardening: function EXECUTE grants, done correctly.
-- Applied directly to the live database via Supabase MCP on 2026-09-28.
--
-- Lesson recorded: `REVOKE ... FROM PUBLIC` is a no-op here because default
-- privileges grant ±anon/authenticated/service_role explicitly per function.
-- Revocation must name those roles. (The loop in 20260928000003 only removed
-- a PUBLIC entry that never existed.)
--
-- Posture after this file:
--   * 15 callable RPCs (incl. list_payroll_inputs): authenticated only
--     (+ owner/service_role by default). Anon revoked.
--   * 9 internal/trigger helpers: no execute for anon or authenticated.
--     service_role intentionally left untouched (trusted infra + test suites).

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
    'my_tenant_id','permission_scope','has_permission','is_org_admin',
    'can_view_field','require_permission','my_permissions',
    'assign_employee_role','role_permission_diff','save_role_permissions',
    'create_role','update_role','set_role_active','delete_role',
    'list_payroll_inputs'
  ) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
    '_rbac_role_id','_role_has_perm','_is_admin_path','_consume_assignment_receipt',
    'trg_employees_role_guard','trg_org_members_role_guard','trg_rbac_audit',
    'trg_require_perm','trg_employees_salary_guard'
  ) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;
