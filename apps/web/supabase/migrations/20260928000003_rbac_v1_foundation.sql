-- WEL-44 Phase 1: RBAC Roles & Permissions Foundation V1 — database layer.
--
-- Builds on the existing roles/permissions/role_permissions model (flat
-- module.action keys stay the enforcement key so live RLS/RPCs keep working)
-- and adds: central module/action catalog with V1 whitelist, sensitive-field
-- catalog, Owner system role, helper/RPC suite, receipt-guarded role
-- assignment (no client-set trust markers), safety + audit triggers, RLS.
--
-- Deliberate non-goals of THIS migration (documented):
--  * Existing *.approve permission rows/grants are grandfathered untouched.
--    The new save path can never grant them (whitelist); removal of legacy
--    approve flows is a Phase 4 integration task.
--  * roles_write_admin / role_permissions_write_admin policies are kept so the
--    current client role editor keeps working; Phase 3 migrates it to the new
--    RPCs, then the policies are tightened.
--  * is_org_admin() / app_has_org_permission() text-role checks in OTHER
--    subsystems (channels, WCC) are left alone; only RBAC paths are converted.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Catalog tables
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rbac_modules (
  key text PRIMARY KEY,
  label text NOT NULL,
  grp text NOT NULL DEFAULT 'General',
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rbac_actions (
  key text PRIMARY KEY,
  label text NOT NULL,
  sort int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.rbac_module_actions (
  module_key text NOT NULL REFERENCES public.rbac_modules(key),
  action_key text NOT NULL REFERENCES public.rbac_actions(key),
  applicable boolean NOT NULL DEFAULT true,
  PRIMARY KEY (module_key, action_key)
);

INSERT INTO public.rbac_modules (key, label, grp, sort) VALUES
  ('quotations','Quotation','Sales',10),
  ('invoices','Invoice','Sales',11),
  ('delivery_challans','Delivery Challan','Sales',12),
  ('purchase_requests','Purchase Request','Purchasing',20),
  ('purchase_orders','Purchase Order','Purchasing',21),
  ('vendors','Vendor','Purchasing',22),
  ('materials','Material','Inventory',30),
  ('material_usage','Material Usage','Inventory',31),
  ('material_inward','Material Inward','Inventory',32),
  ('material_outward','Material Outward','Inventory',33),
  ('warehouses','Warehouse','Inventory',34),
  ('manufacturing_stores','Manufacturing Stores','Inventory',35),
  ('stock_requests','Stock Request','Inventory',36),
  ('dispatch','Dispatch','Inventory',37),
  ('projects','Project','Projects',40),
  ('boq','BOQ','Projects',41),
  ('site_visits','Site Visit','Projects',42),
  ('tasks','Task','Projects',43),
  ('manufacturing_job_cards','Manufacturing Job Card','Manufacturing',50),
  ('production','Production','Manufacturing',51),
  ('quality_control','Quality Control','Manufacturing',52),
  ('payments','Payment','Finance',60),
  ('ledger','Ledger','Finance',61),
  ('work_completion','Work Completion','Finance',62),
  ('leads','Lead','CRM',70),
  ('clients','Client','CRM',71),
  ('follow_up','Follow-up','CRM',72),
  ('hr','HR','People & Access',80),
  ('users','User','People & Access',81),
  ('roles','Role','People & Access',82),
  ('org','Organisation','People & Access',83),
  ('settings','Settings','System',90),
  ('workflows','Workflow','System',91),
  ('company','Company','System',92),
  ('audit_log','Audit Log','System',93),
  ('quick_lookup','Quick Lookup','System',94),
  ('reports','Report','Reports & AI',100),
  ('hermes_ai','Hermes AI','Reports & AI',101)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, grp = EXCLUDED.grp, sort = EXCLUDED.sort;

INSERT INTO public.rbac_actions (key, label, sort) VALUES
  ('read','Read',1),
  ('create','Create',2),
  ('edit','Edit',3),
  ('delete','Delete',4),
  ('print','Print',5),
  ('export','Export',6),
  ('send','Send',7),
  ('cancel','Cancel',8),
  ('reopen','Reopen',9),
  ('revise','Revise',10),
  ('convert','Convert',11),
  ('import','Import',12)
ON CONFLICT (key) DO NOTHING;

-- Applicability: all V1 actions applicable everywhere EXCEPT destructive /
-- mutating actions on audit + report surfaces (shown as —, never grantable).
INSERT INTO public.rbac_module_actions (module_key, action_key, applicable)
SELECT m.key, a.key, true
FROM public.rbac_modules m CROSS JOIN public.rbac_actions a
WHERE a.key IN ('read','create','edit','delete','print','export')
  AND NOT (m.key = 'audit_log' AND a.key IN ('create','edit','delete'))
  AND NOT (m.key = 'reports' AND a.key IN ('create','edit','delete'))
ON CONFLICT (module_key, action_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 2. permissions: module/action/whitelist columns + V1 seed
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS module_key text,
  ADD COLUMN IF NOT EXISTS action_key text,
  ADD COLUMN IF NOT EXISTS is_grantable_v1 boolean NOT NULL DEFAULT false;

UPDATE public.permissions
SET module_key = split_part(key, '.', 1),
    action_key = substring(key from position('.' in key) + 1)
WHERE module_key IS NULL;

UPDATE public.permissions
SET is_grantable_v1 = (action_key IN ('read','create','edit','delete','print','export'));

-- Seed missing V1 permission rows for every applicable module/action.
INSERT INTO public.permissions (key, description, module_key, action_key, is_grantable_v1)
SELECT
  ma.module_key || '.' || ma.action_key,
  CASE ma.action_key
    WHEN 'read' THEN 'View ' || lower(m.label)
    WHEN 'create' THEN 'Create ' || lower(m.label)
    WHEN 'edit' THEN 'Edit ' || lower(m.label)
    WHEN 'delete' THEN 'Delete ' || lower(m.label)
    WHEN 'print' THEN 'Print ' || lower(m.label)
    WHEN 'export' THEN 'Export ' || lower(m.label)
  END,
  ma.module_key, ma.action_key, true
FROM public.rbac_module_actions ma
JOIN public.rbac_modules m ON m.key = ma.module_key
WHERE ma.applicable
  AND NOT EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.module_key = ma.module_key AND p.action_key = ma.action_key
  );

-- ═══════════════════════════════════════════════════════════════════
-- 3. roles: lifecycle columns + Owner seed + grant backfill
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Owner system role per active tenant (idempotent).
INSERT INTO public.roles (organisation_id, name, is_system, description, is_active)
SELECT DISTINCT om.organisation_id, 'Owner', true,
  'Highest tenant administrative authority. Protected from ordinary edits.',
  true
FROM public.org_members om
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r
  WHERE r.organisation_id = om.organisation_id AND r.name = 'Owner'
);

-- Preserve current effective access as real grants: every Admin role holds
-- every permission key (including the 4 previously ungranted ones), every
-- Owner role holds everything. Existing approve grants are grandfathered
-- untouched (never grantable going forward).
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.is_system AND r.name IN ('Admin', 'Owner')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_key = p.key
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4. Sensitive-field catalog + grants
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rbac_sensitive_fields (
  key text PRIMARY KEY,
  module_key text NOT NULL REFERENCES public.rbac_modules(key),
  label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rbac_role_field_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  field_key text NOT NULL REFERENCES public.rbac_sensitive_fields(key),
  granted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, field_key)
);

INSERT INTO public.rbac_sensitive_fields (key, module_key, label) VALUES
  ('quotation.cost_margin', 'quotations', 'Quotation Cost / Margin'),
  ('boq.cost', 'boq', 'BOQ Cost'),
  ('purchase.rate', 'purchase_orders', 'Purchase Rate'),
  ('hr.salary', 'hr', 'HR Salary')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Assignment receipts (unforgeable, single-use, no client trust)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rbac_assignment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No GRANTs and no policies: only the table owner (via DEFINER functions)
-- can read/write. Authenticated clients can neither create nor consume.

-- ═══════════════════════════════════════════════════════════════════
-- 6. employees.role_id
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role_id uuid NULL REFERENCES public.roles(id);

-- ═══════════════════════════════════════════════════════════════════
-- 7. Helper + RPC suite
-- ═══════════════════════════════════════════════════════════════════

-- Internal: resolve caller's role in an org (fail-closed, deterministic).
CREATE OR REPLACE FUNCTION public._rbac_role_id(p_org_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_member public.org_members%ROWTYPE;
BEGIN
  SELECT * INTO v_member FROM public.org_members m
  WHERE m.organisation_id = p_org_id AND m.user_id = auth.uid()
    AND coalesce(lower(m.status), 'active') = 'active'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not have access to this organisation.';
  END IF;
  -- A linked non-active employee keeps no effective access (Scenario 11).
  IF v_member.employee_id IS NOT NULL THEN
    PERFORM 1 FROM public.employees e
    WHERE e.id = v_member.employee_id AND lower(coalesce(e.status, 'active')) = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'You do not have access to this organisation.';
    END IF;
  END IF;
  RETURN v_member.role_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_tenant_id(p_org_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._rbac_role_id(p_org_id);
  RETURN p_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public._role_has_perm(p_role_id uuid, p_module text, p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.permissions p ON p.key = rp.permission_key
    WHERE rp.role_id = p_role_id
      AND p.module_key = p_module AND p.action_key = p_action
  );
$function$;

CREATE OR REPLACE FUNCTION public.permission_scope(p_org_id uuid, p_module text, p_action text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role uuid;
BEGIN
  v_role := public._rbac_role_id(p_org_id);
  IF v_role IS NULL THEN RETURN NULL; END IF;
  IF public._role_has_perm(v_role, p_module, p_action) THEN RETURN 'all'; END IF;
  RETURN NULL;
END;
$function$;

-- Same signature as before; text-role bypass removed, employee-active enforced.
-- Effective access for current data is preserved via real grants (see §3).
CREATE OR REPLACE FUNCTION public.has_permission(p_org_id uuid, p_permission_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role uuid;
  v_module text := split_part(p_permission_key, '.', 1);
  v_action text := substring(p_permission_key from position('.' in p_permission_key) + 1);
BEGIN
  BEGIN
    v_role := public._rbac_role_id(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_role IS NULL THEN RETURN false; END IF;
  RETURN public._role_has_perm(v_role, v_module, v_action);
END;
$function$;

-- Same effective set as before (active members on system Owner/Admin roles),
-- now resolved through the role FK instead of free text.
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role uuid;
BEGIN
  BEGIN
    v_role := public._rbac_role_id(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_role IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = v_role AND r.is_system AND r.name IN ('Owner', 'Admin') AND r.is_active
  );
END;
$function$;

-- Two-arg variant (explicit user check for admin tooling): same FK semantics.
-- Previously text-role based; converted for consistency. Same effective set
-- on current data (all text-admins hold Admin FK roles).
CREATE OR REPLACE FUNCTION public.is_org_admin(user_id uuid, organisation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.user_id = is_org_admin.user_id
      AND m.organisation_id = is_org_admin.organisation_id
      AND coalesce(lower(m.status), 'active') = 'active'
      AND r.is_system AND r.name IN ('Owner', 'Admin') AND r.is_active
  );
$function$;

-- Field access = module Read AND field grant. Documented Owner policy: the
-- system Owner bypasses field denial (expected to see everything, incl.
-- salary); every other role needs both halves. No bypass for Admin.
CREATE OR REPLACE FUNCTION public.can_view_field(p_org_id uuid, p_field_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role uuid; v_mod text; v_is_owner boolean;
BEGIN
  BEGIN
    v_role := public._rbac_role_id(p_org_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_role IS NULL THEN RETURN false; END IF;
  SELECT (r.is_system AND r.name = 'Owner') INTO v_is_owner
  FROM public.roles r WHERE r.id = v_role;
  IF coalesce(v_is_owner, false) THEN RETURN true; END IF;
  SELECT f.module_key INTO v_mod FROM public.rbac_sensitive_fields f WHERE f.key = p_field_key;
  IF v_mod IS NULL THEN RETURN false; END IF;
  IF NOT public._role_has_perm(v_role, v_mod, 'read') THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.rbac_role_field_permissions fp
    WHERE fp.role_id = v_role AND fp.field_key = p_field_key AND fp.granted
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.require_permission(p_org_id uuid, p_module text, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.permission_scope(p_org_id, p_module, p_action) IS NULL THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_permissions(p_org_id uuid)
RETURNS TABLE(module_key text, action_key text, scope text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role uuid;
BEGIN
  v_role := public._rbac_role_id(p_org_id);
  IF v_role IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.module_key, p.action_key, 'all'::text
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.key = rp.permission_key
    WHERE rp.role_id = v_role;
END;
$function$;

-- Controlled assignment. Service-role (no auth.uid) is trusted bootstrap only.
CREATE OR REPLACE FUNCTION public.assign_employee_role(p_org_id uuid, p_employee_id uuid, p_role_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role uuid; v_is_system boolean := false; v_is_owner_actor boolean := false;
  v_emp public.employees%ROWTYPE; v_role public.roles%ROWTYPE;
  v_missing text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_actor_role := public._rbac_role_id(p_org_id);
    IF v_actor_role IS NULL THEN
      RAISE EXCEPTION 'You do not have permission to perform this action.';
    END IF;
    -- Actor must hold people-management authority.
    IF NOT public._role_has_perm(v_actor_role, 'users', 'edit')
       AND NOT public._role_has_perm(v_actor_role, 'hr', 'edit') THEN
      -- Fall back to legacy manage key for current Admin roles.
      IF NOT public.has_permission(p_org_id, 'org.manage_users') THEN
        RAISE EXCEPTION 'You do not have permission to perform this action.';
      END IF;
    END IF;
    SELECT (r.is_system AND r.name = 'Owner') INTO v_is_owner_actor
    FROM public.roles r WHERE r.id = v_actor_role;
    v_is_owner_actor := coalesce(v_is_owner_actor, false);
  ELSE
    v_is_system := true; -- service-role bootstrap path (server-only, audited)
  END IF;

  SELECT * INTO v_emp FROM public.employees e
  WHERE e.id = p_employee_id AND e.organisation_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in this organisation.'; END IF;
  IF lower(coalesce(v_emp.status, 'active')) <> 'active' THEN
    RAISE EXCEPTION 'Cannot assign a role to a non-active employee.';
  END IF;

  SELECT * INTO v_role FROM public.roles r
  WHERE r.id = p_role_id AND r.organisation_id = p_org_id AND r.is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found in this organisation.'; END IF;

  -- Delegation boundary: Owner/Admin targets need an Owner actor; any other
  -- target must be a subset of the actor's own grants (Owner/service exempt).
  IF v_role.is_system AND v_role.name IN ('Owner', 'Admin') AND NOT v_is_owner_actor AND NOT v_is_system THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  IF NOT v_is_owner_actor AND NOT v_is_system THEN
    SELECT string_agg(p.module_key || '.' || p.action_key, ', ') INTO v_missing
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.key = rp.permission_key
    WHERE rp.role_id = p_role_id
      AND NOT public._role_has_perm(v_actor_role, p.module_key, p.action_key);
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'You do not have permission to perform this action.';
    END IF;
  END IF;

  -- Last-admin safety: cannot strip the final Owner/Admin access path.
  IF EXISTS (
    SELECT 1 FROM public.org_members m
    JOIN public.roles r ON r.id = m.role_id
    WHERE m.organisation_id = p_org_id
      AND m.employee_id = p_employee_id
      AND coalesce(lower(m.status), 'active') = 'active'
      AND r.is_system AND r.name IN ('Owner', 'Admin')
  ) AND NOT (v_role.is_system AND v_role.name IN ('Owner', 'Admin')) THEN
    IF (SELECT count(*) FROM public.org_members m
        JOIN public.roles r ON r.id = m.role_id
        WHERE m.organisation_id = p_org_id
          AND coalesce(lower(m.status), 'active') = 'active'
          AND r.is_system AND r.name IN ('Owner', 'Admin')
          AND NOT (m.employee_id = p_employee_id)) = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last administrator of this organisation.';
    END IF;
  END IF;

  -- Single-use receipt consumed by the guard triggers below.
  INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
  VALUES (p_org_id, p_employee_id, p_role_id);

  UPDATE public.employees SET role_id = p_role_id WHERE id = p_employee_id;
  UPDATE public.org_members SET role_id = p_role_id
  WHERE organisation_id = p_org_id AND employee_id = p_employee_id;

  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_org_id, auth.uid(), 'rbac.assign', 'employee', p_employee_id,
    jsonb_build_object('role_id', p_role_id, 'by_system', v_is_system));

  RETURN jsonb_build_object('employee_id', p_employee_id, 'role_id', p_role_id);
END;
$function$;

-- Read-only diff preview for the save-confirm UI.
CREATE OR REPLACE FUNCTION public.role_permission_diff(p_org_id uuid, p_role_id uuid, p_grants jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_added jsonb; v_removed jsonb; v_count int;
BEGIN
  PERFORM public._rbac_role_id(p_org_id);
  WITH wanted AS (
    SELECT DISTINCT (g->>'module') AS module_key, (g->>'action') AS action_key
    FROM jsonb_array_elements(p_grants) g
  ), have AS (
    SELECT p.module_key, p.action_key FROM public.role_permissions rp
    JOIN public.permissions p ON p.key = rp.permission_key
    WHERE rp.role_id = p_role_id
  )
  SELECT coalesce(jsonb_agg(w.module_key || '.' || w.action_key), '[]'::jsonb) INTO v_added
  FROM wanted w LEFT JOIN have h USING (module_key, action_key) WHERE h.module_key IS NULL;
  WITH wanted AS (
    SELECT DISTINCT (g->>'module') AS module_key, (g->>'action') AS action_key
    FROM jsonb_array_elements(p_grants) g
  ), have AS (
    SELECT p.module_key, p.action_key FROM public.role_permissions rp
    JOIN public.permissions p ON p.key = rp.permission_key
    WHERE rp.role_id = p_role_id
  )
  SELECT coalesce(jsonb_agg(h.module_key || '.' || h.action_key), '[]'::jsonb) INTO v_removed
  FROM have h LEFT JOIN wanted w USING (module_key, action_key) WHERE w.module_key IS NULL;
  SELECT count(*) INTO v_count FROM public.org_members m
  WHERE m.role_id = p_role_id AND coalesce(lower(m.status), 'active') = 'active';
  RETURN jsonb_build_object('added', v_added, 'removed', v_removed, 'affected_employees', v_count);
END;
$function$;

-- Validated, version-checked, atomic permission save. NEVER grants approve or
-- future-only actions; rejects unknown/non-applicable/duplicates.
CREATE OR REPLACE FUNCTION public.save_role_permissions(
  p_org_id uuid, p_role_id uuid, p_expected_version int,
  p_grants jsonb, p_field_grants jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role uuid; v_is_owner_actor boolean := false;
  v_role public.roles%ROWTYPE; v_diff jsonb; v_n int;
BEGIN
  v_actor_role := public._rbac_role_id(p_org_id);
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  IF NOT public._role_has_perm(v_actor_role, 'roles', 'edit') THEN
    IF NOT public.has_permission(p_org_id, 'org.manage_roles') THEN
      RAISE EXCEPTION 'You do not have permission to perform this action.';
    END IF;
  END IF;

  SELECT * INTO v_role FROM public.roles r
  WHERE r.id = p_role_id AND r.organisation_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found in this organisation.'; END IF;
  IF NOT v_role.is_active THEN RAISE EXCEPTION 'Cannot modify a deactivated role.'; END IF;
  IF v_role.version <> p_expected_version THEN
    RAISE EXCEPTION 'Role changed since you opened it. Reload and review before saving.';
  END IF;
  SELECT (r.is_system AND r.name = 'Owner') INTO v_is_owner_actor
  FROM public.roles r WHERE r.id = v_actor_role;
  v_is_owner_actor := coalesce(v_is_owner_actor, false);

  -- Owner/Admin definitions are Owner-only.
  IF v_role.is_system AND v_role.name IN ('Owner', 'Admin') AND NOT v_is_owner_actor THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;

  -- Whitelist validation.
  SELECT count(*) INTO v_n FROM (
    SELECT DISTINCT (g->>'module') AS m, (g->>'action') AS a
    FROM jsonb_array_elements(p_grants) g
  ) d;
  IF (SELECT count(*) FROM jsonb_array_elements(p_grants)) <> v_n THEN
    RAISE EXCEPTION 'Duplicate entries in permission payload.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_grants) g
    WHERE NOT EXISTS (
      SELECT 1 FROM public.rbac_module_actions ma
      JOIN public.permissions p ON p.module_key = ma.module_key AND p.action_key = ma.action_key
      WHERE ma.module_key = (g->>'module') AND ma.action_key = (g->>'action')
        AND ma.applicable AND p.is_grantable_v1
    )
  ) THEN
    RAISE EXCEPTION 'Payload contains unknown, non-applicable, or non-grantable permissions.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_field_grants) fg
    WHERE NOT EXISTS (SELECT 1 FROM public.rbac_sensitive_fields f WHERE f.key = (fg->>'field'))
       OR (fg->>'granted') IS NULL
  ) THEN
    RAISE EXCEPTION 'Payload contains unknown sensitive-field identifiers.';
  END IF;

  -- Delegation boundary: every grant must already be held by the actor.
  IF NOT v_is_owner_actor AND EXISTS (
    SELECT 1 FROM (SELECT DISTINCT (g->>'module') AS m, (g->>'action') AS a
                   FROM jsonb_array_elements(p_grants) g) d
    WHERE NOT public._role_has_perm(v_actor_role, d.m, d.a)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;

  v_diff := public.role_permission_diff(p_org_id, p_role_id, p_grants);

  DELETE FROM public.role_permissions WHERE role_id = p_role_id;
  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT p_role_id, (g->>'module') || '.' || (g->>'action')
  FROM (SELECT DISTINCT (gg->>'module') AS module, (gg->>'action') AS action
        FROM jsonb_array_elements(p_grants) gg) g;

  DELETE FROM public.rbac_role_field_permissions WHERE role_id = p_role_id;
  INSERT INTO public.rbac_role_field_permissions (role_id, field_key, granted)
  SELECT p_role_id, (fg->>'field'), ((fg->>'granted')::boolean)
  FROM jsonb_array_elements(p_field_grants) fg
  WHERE (fg->>'granted')::boolean IS DISTINCT FROM false;

  UPDATE public.roles SET version = version + 1, updated_at = now() WHERE id = p_role_id;

  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_org_id, auth.uid(), 'rbac.permissions.save', 'role', p_role_id, v_diff);

  RETURN v_diff;
END;
$function$;

-- Role lifecycle RPCs.
CREATE OR REPLACE FUNCTION public.create_role(p_org_id uuid, p_name text, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_actor uuid;
BEGIN
  v_actor := public._rbac_role_id(p_org_id);
  IF NOT public._role_has_perm(v_actor, 'roles', 'edit')
     AND NOT public.has_permission(p_org_id, 'org.manage_roles') THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Role name is required.'; END IF;
  INSERT INTO public.roles (organisation_id, name, description, is_system, is_active)
  VALUES (p_org_id, btrim(p_name), p_description, false, true) RETURNING id INTO v_id;
  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_org_id, auth.uid(), 'rbac.role.create', 'role', v_id, jsonb_build_object('name', p_name));
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_role(p_org_id uuid, p_role_id uuid, p_name text, p_description text, p_expected_version int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role public.roles%ROWTYPE; v_owner boolean := false;
BEGIN
  PERFORM public._rbac_role_id(p_org_id);
  IF NOT public.has_permission(p_org_id, 'org.manage_roles')
     AND NOT public._role_has_perm(public._rbac_role_id(p_org_id), 'roles', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND organisation_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found in this organisation.'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'System roles cannot be renamed.'; END IF;
  IF v_role.version <> p_expected_version THEN
    RAISE EXCEPTION 'Role changed since you opened it. Reload and review before saving.';
  END IF;
  UPDATE public.roles SET name = btrim(p_name), description = p_description,
    version = version + 1, updated_at = now() WHERE id = p_role_id;
  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_org_id, auth.uid(), 'rbac.role.update', 'role', p_role_id,
    jsonb_build_object('name', p_name));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_role_active(p_org_id uuid, p_role_id uuid, p_active boolean, p_expected_version int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role public.roles%ROWTYPE; v_deps int;
BEGIN
  PERFORM public._rbac_role_id(p_org_id);
  IF NOT public.has_permission(p_org_id, 'org.manage_roles')
     AND NOT public._role_has_perm(public._rbac_role_id(p_org_id), 'roles', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND organisation_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found in this organisation.'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'System roles cannot be deactivated.'; END IF;
  IF v_role.version <> p_expected_version THEN
    RAISE EXCEPTION 'Role changed since you opened it. Reload and review before saving.';
  END IF;
  IF NOT p_active THEN
    SELECT count(*) INTO v_deps FROM public.org_members m
    WHERE m.role_id = p_role_id AND coalesce(lower(m.status), 'active') = 'active';
    SELECT v_deps + count(*) INTO v_deps FROM public.employees e
    WHERE e.role_id = p_role_id AND lower(coalesce(e.status, 'active')) = 'active';
    IF v_deps > 0 THEN
      RAISE EXCEPTION 'Role cannot be deactivated while active employees depend on it.';
    END IF;
  END IF;
  UPDATE public.roles SET is_active = p_active, version = version + 1, updated_at = now()
  WHERE id = p_role_id;
  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_org_id, auth.uid(), 'rbac.role.active', 'role', p_role_id,
    jsonb_build_object('is_active', p_active));
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_role(p_org_id uuid, p_role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role public.roles%ROWTYPE; v_deps int;
BEGIN
  PERFORM public._rbac_role_id(p_org_id);
  IF NOT public.has_permission(p_org_id, 'org.manage_roles')
     AND NOT public._role_has_perm(public._rbac_role_id(p_org_id), 'roles', 'edit') THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;
  SELECT * INTO v_role FROM public.roles WHERE id = p_role_id AND organisation_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found in this organisation.'; END IF;
  IF v_role.is_system THEN RAISE EXCEPTION 'System roles cannot be deleted.'; END IF;
  SELECT count(*) INTO v_deps FROM public.org_members WHERE role_id = p_role_id;
  SELECT v_deps + count(*) INTO v_deps FROM public.employees WHERE role_id = p_role_id;
  IF v_deps > 0 THEN
    RAISE EXCEPTION 'Role cannot be deleted while employees are assigned to it.';
  END IF;
  DELETE FROM public.roles WHERE id = p_role_id;
  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (p_org_id, auth.uid(), 'rbac.role.delete', 'role', p_role_id,
    jsonb_build_object('name', v_role.name));
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════
-- 8. Guard + audit triggers
-- ═══════════════════════════════════════════════════════════════════

-- Last-admin safety, FK-based (replaces text-role logic; no bypass switches).
CREATE OR REPLACE FUNCTION public.prevent_last_admin_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_was_admin boolean;
  v_still_admin boolean;
  v_others int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organisation_id;
    SELECT public._is_admin_path(OLD.id, OLD.organisation_id, OLD.status, OLD.role, OLD.role_id) INTO v_was_admin;
    IF v_was_admin THEN
      SELECT count(*) INTO v_others FROM public.org_members m
      WHERE m.organisation_id = v_org_id AND m.id <> OLD.id
        AND public._is_admin_path(m.id, m.organisation_id, m.status, m.role, m.role_id);
      IF v_others = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last administrator of this organisation.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: only a loss of admin path can strand a tenant.
  v_org_id := COALESCE(NEW.organisation_id, OLD.organisation_id);
  SELECT public._is_admin_path(OLD.id, OLD.organisation_id, OLD.status, OLD.role, OLD.role_id) INTO v_was_admin;
  SELECT public._is_admin_path(NEW.id, NEW.organisation_id, NEW.status, NEW.role, NEW.role_id) INTO v_still_admin;
  IF v_was_admin AND NOT v_still_admin THEN
    SELECT count(*) INTO v_others FROM public.org_members m
    WHERE m.organisation_id = v_org_id AND m.id <> OLD.id
      AND public._is_admin_path(m.id, m.organisation_id, m.status, m.role, m.role_id);
    IF v_others = 0 THEN
      RAISE EXCEPTION 'Cannot demote/deactivate the last administrator of this organisation.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Shared admin-path predicate: FK Owner/Admin (active) OR legacy text admin.
-- Text is counted only for safety (fail-closed removals), never for grants.
CREATE OR REPLACE FUNCTION public._is_admin_path(
  p_member_id uuid, p_org_id uuid, p_status text, p_role text, p_role_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(lower(p_status), 'active') = 'active' AND (
    lower(coalesce(p_role, '')) IN ('admin', 'owner')
    OR EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = p_role_id AND r.organisation_id = p_org_id
        AND r.is_system AND r.name IN ('Owner', 'Admin') AND r.is_active
    )
  );
$function$;

-- Receipt-guarded role writes: direct client writes without a same-row
-- single-use receipt (creatable only inside assign_employee_role /
-- approve_access_request, both DEFINER-owned) are rejected.
CREATE OR REPLACE FUNCTION public._consume_assignment_receipt(
  p_org_id uuid, p_employee_id uuid, p_role_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.rbac_assignment_receipts
  WHERE organisation_id = p_org_id AND employee_id = p_employee_id AND role_id = p_role_id
  ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role changes must go through role assignment.';
  END IF;
  DELETE FROM public.rbac_assignment_receipts WHERE id = v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_employees_role_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Employees must be created role-less, then assigned (PRD §20).
    IF NEW.role_id IS NOT NULL THEN
      PERFORM public._consume_assignment_receipt(NEW.organisation_id, NEW.id, NEW.role_id);
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: correct OLD/NEW handling; NEW.id/role_id only (never NEW on DELETE path).
  IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    PERFORM public._consume_assignment_receipt(
      COALESCE(NEW.organisation_id, OLD.organisation_id), NEW.id, NEW.role_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_org_members_role_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_emp uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role_id IS NOT NULL THEN
      IF NEW.employee_id IS NULL THEN
        RAISE EXCEPTION 'Membership roles require a linked employee assignment.';
      END IF;
      PERFORM public._consume_assignment_receipt(NEW.organisation_id, NEW.employee_id, NEW.role_id);
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    v_emp := COALESCE(NEW.employee_id, OLD.employee_id);
    IF v_emp IS NULL THEN
      RAISE EXCEPTION 'Membership roles require a linked employee assignment.';
    END IF;
    PERFORM public._consume_assignment_receipt(
      COALESCE(NEW.organisation_id, OLD.organisation_id), v_emp, NEW.role_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_employees_role_guard ON public.employees;
CREATE TRIGGER trg_employees_role_guard
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.trg_employees_role_guard();

DROP TRIGGER IF EXISTS trg_org_members_role_guard ON public.org_members;
CREATE TRIGGER trg_org_members_role_guard
BEFORE INSERT OR UPDATE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.trg_org_members_role_guard();

-- Audit trail for role system writes.
CREATE OR REPLACE FUNCTION public.trg_rbac_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_changes jsonb; v_entity uuid;
BEGIN
  IF TG_TABLE_NAME = 'roles' THEN
    v_org := COALESCE(NEW.organisation_id, OLD.organisation_id);
    v_entity := COALESCE(NEW.id, OLD.id);
    v_changes := jsonb_build_object(
      'old', CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('name', OLD.name, 'is_active', OLD.is_active, 'version', OLD.version) END,
      'new', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('name', NEW.name, 'is_active', NEW.is_active, 'version', NEW.version) END);
  ELSIF TG_TABLE_NAME = 'role_permissions' THEN
    SELECT r.organisation_id INTO v_org FROM public.roles r
    WHERE r.id = COALESCE(NEW.role_id, OLD.role_id);
    v_entity := COALESCE(NEW.role_id, OLD.role_id);
    v_changes := jsonb_build_object(
      'role_id', COALESCE(NEW.role_id, OLD.role_id),
      'permission_key', COALESCE(NEW.permission_key, OLD.permission_key));
  ELSE
    SELECT r.organisation_id INTO v_org FROM public.roles r
    WHERE r.id = COALESCE(NEW.role_id, OLD.role_id);
    v_entity := COALESCE(NEW.role_id, OLD.role_id);
    v_changes := jsonb_build_object(
      'role_id', COALESCE(NEW.role_id, OLD.role_id),
      'field_key', COALESCE(NEW.field_key, OLD.field_key),
      'granted', CASE WHEN TG_OP <> 'DELETE' THEN NEW.granted END);
  END IF;
  INSERT INTO public.audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
  VALUES (v_org, auth.uid(), 'rbac.' || TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME, v_entity, v_changes);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_rbac_audit_roles ON public.roles;
CREATE TRIGGER trg_rbac_audit_roles
AFTER INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.trg_rbac_audit();

DROP TRIGGER IF EXISTS trg_rbac_audit_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_rbac_audit_role_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.trg_rbac_audit();

DROP TRIGGER IF EXISTS trg_rbac_audit_field_permissions ON public.rbac_role_field_permissions;
CREATE TRIGGER trg_rbac_audit_field_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.rbac_role_field_permissions
FOR EACH ROW EXECUTE FUNCTION public.trg_rbac_audit();

-- approve_access_request: same behavior + tenant-validated role, Owner-guard,
-- and receipt so the guarded member upsert succeeds.
CREATE OR REPLACE FUNCTION public.approve_access_request(p_request_id uuid, p_role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_req public.org_access_requests%rowtype;
  v_employee_id uuid;
  v_role public.roles%ROWTYPE;
  v_is_owner_actor boolean := false;
begin
  select * into v_req
  from public.org_access_requests r
  where r.id = p_request_id
  limit 1;

  if not found then
    raise exception 'Access request not found.';
  end if;

  if lower(v_req.status) <> 'pending' then
    raise exception 'Access request is not pending.';
  end if;

  if not public.is_org_admin(v_req.organisation_id) and not public.has_permission(v_req.organisation_id, 'org.manage_users') then
    raise exception 'Not authorized to approve requests.';
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.organisation_id = v_req.organisation_id
    and lower(trim(e.email)) = lower(trim(v_req.email))
    and lower(e.status) = 'active'
  limit 1;

  if v_employee_id is null then
    raise exception 'Employee record not found or inactive for this email.';
  end if;

  select * into v_role from public.roles r
  where r.id = p_role_id and r.organisation_id = v_req.organisation_id and r.is_active;
  if not found then
    raise exception 'Role not found in this organisation.';
  end if;
  IF auth.uid() IS NOT NULL THEN
    SELECT (r.is_system AND r.name = 'Owner') INTO v_is_owner_actor
    FROM public.roles r
    JOIN public.org_members m ON m.role_id = r.id
    WHERE m.organisation_id = v_req.organisation_id AND m.user_id = auth.uid()
      AND coalesce(lower(m.status), 'active') = 'active';
    v_is_owner_actor := coalesce(v_is_owner_actor, false);
    IF v_role.is_system AND v_role.name IN ('Owner', 'Admin') AND NOT v_is_owner_actor THEN
      raise exception 'Not authorized to approve requests.';
    END IF;
  END IF;

  insert into public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
  values (v_req.organisation_id, v_employee_id, p_role_id);

  insert into public.org_members(organisation_id, user_id, role, status, employee_id, role_id)
  values (v_req.organisation_id, v_req.user_id, 'member', 'active', v_employee_id, p_role_id)
  on conflict (organisation_id, user_id)
  do update set
    status = 'active',
    employee_id = excluded.employee_id,
    role_id = excluded.role_id;

  update public.org_access_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = v_req.id;
end;
$function$;

-- New organisations must start with system roles and a linked Owner so the
-- creator keeps access after text-role checks stop granting it. Text 'admin'
-- is preserved for legacy readers.
CREATE OR REPLACE FUNCTION public.create_organisation_with_admin(org_name character varying, p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  org_id UUID; v_owner uuid; v_admin uuid; v_member uuid;
BEGIN
  INSERT INTO organisations (name)
  VALUES (org_name)
  RETURNING id INTO org_id;

  INSERT INTO public.roles (organisation_id, name, is_system, description, is_active)
  VALUES
    (org_id, 'Owner', true, 'Highest tenant administrative authority. Protected from ordinary edits.', true),
    (org_id, 'Admin', true, 'Administrative role below Owner. Cannot self-escalate to Owner.', true),
    (org_id, 'Member', true, 'Default least-privilege role.', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_owner FROM public.roles
  WHERE organisation_id = org_id AND name = 'Owner' AND is_system;

  -- Creator becomes the initial Owner (same effective access as the old
  -- text-admin bypass; now backed by a real grant path).
  INSERT INTO org_members (organisation_id, user_id, role, status, role_id)
  VALUES (org_id, p_user_id, 'admin', 'active', v_owner)
  ON CONFLICT (organisation_id, user_id)
  DO UPDATE SET status = 'active', role_id = EXCLUDED.role_id;

  UPDATE user_profiles SET role = 'admin' WHERE user_id = p_user_id;

  RETURN org_id;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════
-- 9. RLS + grants
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.rbac_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_module_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_sensitive_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_field_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_assignment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rbac_catalog_select ON public.rbac_modules;
CREATE POLICY rbac_catalog_select ON public.rbac_modules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rbac_catalog_select ON public.rbac_actions;
CREATE POLICY rbac_catalog_select ON public.rbac_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rbac_catalog_select ON public.rbac_module_actions;
CREATE POLICY rbac_module_actions_select ON public.rbac_module_actions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rbac_catalog_select ON public.rbac_sensitive_fields;
CREATE POLICY rbac_sensitive_fields_select ON public.rbac_sensitive_fields FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS rbac_field_grants_select ON public.rbac_role_field_permissions;
CREATE POLICY rbac_field_grants_select ON public.rbac_role_field_permissions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.roles r
            WHERE r.id = rbac_role_field_permissions.role_id
              AND (r.organisation_id IS NULL OR public.user_can_access_org(r.organisation_id)))
  );
-- No write policies on catalog/field-grants/receipts: writes go through DEFINER RPCs only.

GRANT SELECT ON public.rbac_modules, public.rbac_actions, public.rbac_module_actions,
  public.rbac_sensitive_fields, public.rbac_role_field_permissions TO authenticated;

-- Tighten cross-tenant system-role reads (anon + other-tenant members).
DROP POLICY IF EXISTS roles_select_members ON public.roles;
CREATE POLICY roles_select_members ON public.roles
  FOR SELECT TO authenticated USING (
    auth.uid() IS NOT NULL AND (
      organisation_id IS NULL OR public.user_can_access_org(organisation_id)
    )
  );
DROP POLICY IF EXISTS role_permissions_select_members ON public.role_permissions;
CREATE POLICY role_permissions_select_members ON public.role_permissions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.roles r
            WHERE r.id = role_permissions.role_id
              AND (r.organisation_id IS NULL OR public.user_can_access_org(r.organisation_id)))
  );

-- Function execute grants: callables to authenticated, internals to nobody.
-- Resolved by OID so overloaded names (is_org_admin) are handled exactly.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
    'my_tenant_id','permission_scope','has_permission','is_org_admin',
    'can_view_field','require_permission','my_permissions',
    'assign_employee_role','role_permission_diff','save_role_permissions',
    'create_role','update_role','set_role_active','delete_role'
  ) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
  -- Internal helpers and trigger functions must never be directly callable:
  -- _rbac_role_id leaks caller context, _role_has_perm/_is_admin_path are
  -- cross-tenant oracles, _consume_* burns single-use receipts.
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
    '_rbac_role_id','_role_has_perm','_is_admin_path','_consume_assignment_receipt',
    'trg_employees_role_guard','trg_org_members_role_guard','trg_rbac_audit'
  ) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 10. user_can_access_org: inactive linked employees lose access
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.user_can_access_org(p_org_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = auth.uid()
      AND om.organisation_id = p_org_id
      AND om.status = 'active'
      AND (
        om.employee_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = om.employee_id AND lower(coalesce(e.status, 'active')) = 'active'
        )
      )
  );
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════
-- 11. Fail-closed verification asserts
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE v_bad int;
BEGIN
  -- Owner exists per active tenant.
  SELECT count(*) INTO v_bad FROM (
    SELECT DISTINCT organisation_id FROM public.org_members
    EXCEPT
    SELECT organisation_id FROM public.roles WHERE name = 'Owner' AND is_system
  ) d;
  IF v_bad > 0 THEN RAISE EXCEPTION 'RBAC bootstrap incomplete: % tenant(s) lack Owner role', v_bad; END IF;

  -- Admin roles hold people-management keys (policies depend on them).
  SELECT count(*) INTO v_bad FROM public.roles r
  WHERE r.is_system AND r.name = 'Admin'
    AND (NOT public._role_has_perm(r.id, 'users', 'edit')
         AND NOT EXISTS (SELECT 1 FROM public.role_permissions rp
                         JOIN public.permissions p ON p.key = rp.permission_key
                         WHERE rp.role_id = r.id AND p.key = 'org.manage_users'));
  IF v_bad > 0 THEN RAISE EXCEPTION 'RBAC bootstrap incomplete: Admin role without people-management grant'; END IF;

  -- Nothing grantable may be an approve/future action.
  SELECT count(*) INTO v_bad FROM public.permissions
  WHERE is_grantable_v1 AND action_key NOT IN ('read','create','edit','delete','print','export');
  IF v_bad > 0 THEN RAISE EXCEPTION 'RBAC whitelist violated: non-V1 grantable permission present'; END IF;

  -- Every grantable V1 pair resolves to a permission row.
  SELECT count(*) INTO v_bad FROM public.rbac_module_actions ma
  WHERE ma.applicable
    AND NOT EXISTS (SELECT 1 FROM public.permissions p
                    WHERE p.module_key = ma.module_key AND p.action_key = ma.action_key
                      AND p.is_grantable_v1);
  IF v_bad > 0 THEN RAISE EXCEPTION 'RBAC catalog incomplete: % applicable pair(s) without permission row', v_bad; END IF;
END $$;
