-- Migration: 20261103010000_phase0_labour_foundation.sql
-- Description: Phase 0 Foundation Repair for BillFast Labour & Subcontractor Attendance
-- 1. Add project_id column and index to manpower_attendance; backfill from work_unit_id
-- 2. Fix attendance_status_check on attendance to include 'leave' and 'no_show'
-- 3. Audit logging table (labour_audit_log) and append-only trigger
-- 4. Re-home template labour_categories and context_modifiers for active tenants
-- 5. Tighten RLS policies on labour_categories, context_modifiers, manpower_attendance, manpower_billing, rate_cards to TO authenticated with user_can_access_org
-- 6. Add RLS policies for parties and party_roles
-- 7. Seed RBAC permissions for labour domain and grant to Admin & Owner roles
-- 8. Server-side rate resolution and money computation functions: resolve_labour_rate, calculate_context_multiplier
-- 9. Hardened record_attendance, update_attendance, approve_attendance, reject_attendance, reopen_attendance
-- 10. Fix get_subcontractor_wo_rollup to use wo.total_amount instead of non-existent contract_value

-- ====================================================================
-- 1. Project Column on manpower_attendance
-- ====================================================================
ALTER TABLE public.manpower_attendance
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_manpower_attendance_project_id
  ON public.manpower_attendance(project_id);

-- Backfill project_id where work_unit_type is 'PROJECT' and valid FK exists
UPDATE public.manpower_attendance
SET project_id = work_unit_id
WHERE work_unit_type = 'PROJECT'
  AND work_unit_id IS NOT NULL
  AND project_id IS NULL
  AND work_unit_id IN (SELECT id FROM public.projects);

-- ====================================================================
-- 2. Status CHECK fix on attendance table
-- ====================================================================
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status = ANY (ARRAY['planned'::text, 'checked_in'::text, 'absent'::text, 'leave'::text, 'no_show'::text]));

-- ====================================================================
-- 3. Audit Infrastructure: labour_audit_log
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.labour_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  row_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labour_audit_org_created 
  ON public.labour_audit_log(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_labour_audit_table_row 
  ON public.labour_audit_log(table_name, row_id);

ALTER TABLE public.labour_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "labour_audit_log_select" ON public.labour_audit_log;
CREATE POLICY "labour_audit_log_select" ON public.labour_audit_log
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

-- Immutable trigger: reject UPDATE and DELETE on audit log
CREATE OR REPLACE FUNCTION public.trg_prevent_labour_audit_tampering()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RAISE EXCEPTION 'labour_audit_log is append-only and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_labour_audit_immutable ON public.labour_audit_log;
CREATE TRIGGER trg_labour_audit_immutable
  BEFORE UPDATE OR DELETE ON public.labour_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_labour_audit_tampering();

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.trg_labour_audit_record()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row_id UUID;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organisation_id;
    v_row_id := OLD.id;
    INSERT INTO public.labour_audit_log(organisation_id, table_name, row_id, action, old_data, new_data, actor_id)
    VALUES (v_org_id, TG_TABLE_NAME, v_row_id, 'DELETE', to_jsonb(OLD), NULL, v_actor);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_org_id := NEW.organisation_id;
    v_row_id := NEW.id;
    INSERT INTO public.labour_audit_log(organisation_id, table_name, row_id, action, old_data, new_data, actor_id)
    VALUES (
      v_org_id, 
      TG_TABLE_NAME, 
      v_row_id, 
      CASE 
        WHEN TG_TABLE_NAME = 'manpower_attendance' AND OLD.status != 'APPROVED' AND NEW.status = 'APPROVED' THEN 'APPROVE'
        WHEN TG_TABLE_NAME = 'manpower_attendance' AND OLD.status = 'APPROVED' AND NEW.status = 'DRAFT' THEN 'REOPEN'
        ELSE 'UPDATE'
      END, 
      to_jsonb(OLD), 
      to_jsonb(NEW), 
      v_actor
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_org_id := NEW.organisation_id;
    v_row_id := NEW.id;
    INSERT INTO public.labour_audit_log(organisation_id, table_name, row_id, action, old_data, new_data, actor_id)
    VALUES (v_org_id, TG_TABLE_NAME, v_row_id, 'INSERT', NULL, to_jsonb(NEW), v_actor);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach audit trigger to core tables
DROP TRIGGER IF EXISTS trg_audit_manpower_attendance ON public.manpower_attendance;
CREATE TRIGGER trg_audit_manpower_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.manpower_attendance
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

DROP TRIGGER IF EXISTS trg_audit_rate_cards ON public.rate_cards;
CREATE TRIGGER trg_audit_rate_cards
  AFTER INSERT OR UPDATE OR DELETE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

DROP TRIGGER IF EXISTS trg_audit_labour_categories ON public.labour_categories;
CREATE TRIGGER trg_audit_labour_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

DROP TRIGGER IF EXISTS trg_audit_manpower_billing ON public.manpower_billing;
CREATE TRIGGER trg_audit_manpower_billing
  AFTER INSERT OR UPDATE OR DELETE ON public.manpower_billing
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

-- ====================================================================
-- 4. Re-homing Global Template Rows to Active Organisations
-- ====================================================================
DO $$
DECLARE
  v_org RECORD;
BEGIN
  FOR v_org IN SELECT id FROM public.organisations LOOP
    -- Backfill labour_categories templates per tenant
    INSERT INTO public.labour_categories (organisation_id, name, code, description, base_rate, unit, is_active)
    SELECT v_org.id, name, code, description, base_rate, unit, is_active
    FROM public.labour_categories
    WHERE organisation_id IS NULL
    ON CONFLICT DO NOTHING;

    -- Backfill context_modifiers templates per tenant
    INSERT INTO public.context_modifiers (organisation_id, name, code, modifier_type, multiplier, is_percentage, description, is_active)
    SELECT v_org.id, name, code, modifier_type, multiplier, is_percentage, description, is_active
    FROM public.context_modifiers
    WHERE organisation_id IS NULL
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ====================================================================
-- 5. Tighten RLS Policies (TO authenticated with user_can_access_org)
-- ====================================================================

-- 5.1 labour_categories
ALTER TABLE public.labour_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can delete their labour categories" ON public.labour_categories;
DROP POLICY IF EXISTS "Organisations can insert their labour categories" ON public.labour_categories;
DROP POLICY IF EXISTS "Organisations can update their labour categories" ON public.labour_categories;
DROP POLICY IF EXISTS "Organisations can view their labour categories" ON public.labour_categories;
DROP POLICY IF EXISTS "labour_categories_tenant_isolation" ON public.labour_categories;

CREATE POLICY "labour_categories_tenant_isolation" ON public.labour_categories
  FOR ALL TO authenticated
  USING (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id))
  WITH CHECK (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id));

-- 5.2 context_modifiers
ALTER TABLE public.context_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can delete their context modifiers" ON public.context_modifiers;
DROP POLICY IF EXISTS "Organisations can insert their context modifiers" ON public.context_modifiers;
DROP POLICY IF EXISTS "Organisations can update their context modifiers" ON public.context_modifiers;
DROP POLICY IF EXISTS "Organisations can view their context modifiers" ON public.context_modifiers;
DROP POLICY IF EXISTS "context_modifiers_tenant_isolation" ON public.context_modifiers;

CREATE POLICY "context_modifiers_tenant_isolation" ON public.context_modifiers
  FOR ALL TO authenticated
  USING (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id))
  WITH CHECK (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id));

-- 5.3 manpower_attendance
ALTER TABLE public.manpower_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can delete their manpower attendance" ON public.manpower_attendance;
DROP POLICY IF EXISTS "Organisations can insert their manpower attendance" ON public.manpower_attendance;
DROP POLICY IF EXISTS "Organisations can update their manpower attendance" ON public.manpower_attendance;
DROP POLICY IF EXISTS "Organisations can view their manpower attendance" ON public.manpower_attendance;
DROP POLICY IF EXISTS "manpower_attendance_tenant_isolation" ON public.manpower_attendance;

CREATE POLICY "manpower_attendance_tenant_isolation" ON public.manpower_attendance
  FOR ALL TO authenticated
  USING (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id))
  WITH CHECK (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id));

-- 5.4 manpower_billing
ALTER TABLE public.manpower_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can delete their manpower billing" ON public.manpower_billing;
DROP POLICY IF EXISTS "Organisations can insert their manpower billing" ON public.manpower_billing;
DROP POLICY IF EXISTS "Organisations can update their manpower billing" ON public.manpower_billing;
DROP POLICY IF EXISTS "Organisations can view their manpower billing" ON public.manpower_billing;
DROP POLICY IF EXISTS "manpower_billing_tenant_isolation" ON public.manpower_billing;

CREATE POLICY "manpower_billing_tenant_isolation" ON public.manpower_billing
  FOR ALL TO authenticated
  USING (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id))
  WITH CHECK (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id));

-- 5.5 rate_cards
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organisations can delete their rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Organisations can insert their rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Organisations can update their rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "Organisations can view their rate cards" ON public.rate_cards;
DROP POLICY IF EXISTS "rate_cards_tenant_isolation" ON public.rate_cards;

CREATE POLICY "rate_cards_tenant_isolation" ON public.rate_cards
  FOR ALL TO authenticated
  USING (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id))
  WITH CHECK (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id));

-- ====================================================================
-- 6. RLS Policies for Parties & Party Roles
-- ====================================================================
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parties_tenant_isolation" ON public.parties;
CREATE POLICY "parties_tenant_isolation" ON public.parties
  FOR ALL TO authenticated
  USING (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id))
  WITH CHECK (organisation_id IS NOT NULL AND public.user_can_access_org(organisation_id));

ALTER TABLE public.party_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "party_roles_tenant_isolation" ON public.party_roles;
CREATE POLICY "party_roles_tenant_isolation" ON public.party_roles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.parties p 
    WHERE p.id = party_roles.party_id 
      AND p.organisation_id IS NOT NULL 
      AND public.user_can_access_org(p.organisation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.parties p 
    WHERE p.id = party_roles.party_id 
      AND p.organisation_id IS NOT NULL 
      AND public.user_can_access_org(p.organisation_id)
  ));

-- ====================================================================
-- 7. RBAC Permission Catalog Seed & Role Grants
-- ====================================================================
INSERT INTO public.rbac_modules (key, label, grp, sort)
VALUES ('labour', 'Labour & Subcontractor Attendance', 'Operations', 25)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label, grp = EXCLUDED.grp, sort = EXCLUDED.sort;

INSERT INTO public.permissions (key, module_key, action_key, description, is_grantable_v1)
VALUES
  ('labour.attendance.view', 'labour', 'attendance.view', 'View labour attendance records', true),
  ('labour.attendance.create', 'labour', 'attendance.create', 'Record labour attendance', true),
  ('labour.attendance.edit', 'labour', 'attendance.edit', 'Edit draft labour attendance', true),
  ('labour.attendance.approve', 'labour', 'attendance.approve', 'Approve or reject labour attendance', true),
  ('labour.attendance.reopen', 'labour', 'attendance.reopen', 'Reopen approved labour attendance', true),
  ('labour.rates.manage', 'labour', 'rates.manage', 'Manage rate cards and categories', true),
  ('labour.workers.manage', 'labour', 'workers.manage', 'Manage labour workers', true),
  ('labour.billing.view', 'labour', 'billing.view', 'View manpower billing', true),
  ('labour.billing.generate', 'labour', 'billing.generate', 'Generate manpower bills', true),
  ('labour.wages.view', 'labour', 'wages.view', 'View wage runs and payslips', true),
  ('labour.wages.run', 'labour', 'wages.run', 'Generate wage runs', true),
  ('labour.wages.pay', 'labour', 'wages.pay', 'Process wage payments', true),
  ('labour.measurement.entry', 'labour', 'measurement.entry', 'Enter measurements', true),
  ('labour.measurement.approve', 'labour', 'measurement.approve', 'Approve measurements', true),
  ('labour.share.manage', 'labour', 'share.manage', 'Manage cross-tenant attendance sharing', true)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    module_key = EXCLUDED.module_key,
    action_key = EXCLUDED.action_key,
    is_grantable_v1 = EXCLUDED.is_grantable_v1;

-- Grant all labour permissions to Admin and Owner roles
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.is_system = true 
  AND r.name IN ('Owner', 'Admin')
  AND p.module_key = 'labour'
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 8. Server-Side Rate Resolution and Modifier Calculations
-- ====================================================================
CREATE OR REPLACE FUNCTION public.resolve_labour_rate(
  p_organisation_id UUID,
  p_subcontractor_id UUID,
  p_labour_category_id UUID,
  p_project_id UUID,
  p_work_date DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- 1. Check rate_cards: vendor x trade x project
  IF p_subcontractor_id IS NOT NULL AND p_labour_category_id IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT COALESCE(negotiated_rate, base_rate) INTO v_rate
    FROM public.rate_cards
    WHERE organisation_id = p_organisation_id
      AND subcontractor_id = p_subcontractor_id
      AND labour_category_id = p_labour_category_id
      AND work_unit_id = p_project_id
      AND is_active = true
      AND (p_work_date >= effective_from OR effective_from IS NULL)
      AND (p_work_date <= effective_to OR effective_to IS NULL)
    ORDER BY effective_from DESC NULLS LAST
    LIMIT 1;

    IF v_rate IS NOT NULL AND v_rate > 0 THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- 2. Check rate_cards: vendor x trade (general/no project)
  IF p_subcontractor_id IS NOT NULL AND p_labour_category_id IS NOT NULL THEN
    SELECT COALESCE(negotiated_rate, base_rate) INTO v_rate
    FROM public.rate_cards
    WHERE organisation_id = p_organisation_id
      AND subcontractor_id = p_subcontractor_id
      AND labour_category_id = p_labour_category_id
      AND work_unit_id IS NULL
      AND is_active = true
      AND (p_work_date >= effective_from OR effective_from IS NULL)
      AND (p_work_date <= effective_to OR effective_to IS NULL)
    ORDER BY effective_from DESC NULLS LAST
    LIMIT 1;

    IF v_rate IS NOT NULL AND v_rate > 0 THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- 3. Check tenant-level labour_categories.base_rate (fallback to template if needed)
  IF p_labour_category_id IS NOT NULL THEN
    SELECT base_rate INTO v_rate
    FROM public.labour_categories
    WHERE id = p_labour_category_id
      AND (organisation_id = p_organisation_id OR organisation_id IS NULL)
      AND is_active = true
    ORDER BY (CASE WHEN organisation_id = p_organisation_id THEN 0 ELSE 1 END) ASC
    LIMIT 1;

    IF v_rate IS NOT NULL AND v_rate > 0 THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- 4. Fail-closed: raise exception when no valid rate exists
  RAISE EXCEPTION 'No rate card or base rate found for trade % (vendor %, project %)',
    p_labour_category_id, p_subcontractor_id, p_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_context_multiplier(
  p_organisation_id UUID,
  p_applied_modifiers UUID[]
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_multiplier NUMERIC := 1.0;
  v_mod RECORD;
BEGIN
  IF p_applied_modifiers IS NULL OR array_length(p_applied_modifiers, 1) IS NULL THEN
    RETURN 1.0;
  END IF;

  FOR v_mod IN 
    SELECT multiplier, is_percentage 
    FROM public.context_modifiers
    WHERE id = ANY(p_applied_modifiers)
      AND (organisation_id = p_organisation_id OR organisation_id IS NULL)
      AND is_active = true
  LOOP
    IF v_mod.is_percentage THEN
      v_multiplier := v_multiplier + (COALESCE(v_mod.multiplier, 1.0) - 1.0);
    ELSE
      v_multiplier := v_multiplier * COALESCE(v_mod.multiplier, 1.0);
    END IF;
  END LOOP;

  RETURN GREATEST(v_multiplier, 0.01);
END;
$$;

-- Helper to convert JSONB array to UUID[]
CREATE OR REPLACE FUNCTION public._parse_modifier_uuids(p_input JSONB)
RETURNS UUID[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_arr UUID[];
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) != 'array' THEN
    RETURN '{}'::UUID[];
  END IF;

  SELECT COALESCE(ARRAY_AGG(elem::TEXT::UUID), '{}'::UUID[]) INTO v_arr
  FROM jsonb_array_elements_text(p_input) elem
  WHERE elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  RETURN COALESCE(v_arr, '{}'::UUID[]);
END;
$$;

-- ====================================================================
-- 9. Hardened Attendance RPCs
-- ====================================================================

-- Drop legacy function signatures to prevent ambiguous overloading
DROP FUNCTION IF EXISTS public.record_attendance(UUID, DATE, UUID, UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.record_attendance(UUID, DATE, UUID, UUID, UUID, UUID, VARCHAR, INTEGER, NUMERIC, VARCHAR, UUID[], NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.record_attendance(UUID, DATE, UUID, UUID, UUID, UUID, VARCHAR, INTEGER, NUMERIC, VARCHAR, UUID[], NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID);
DROP FUNCTION IF EXISTS public.update_attendance(UUID, UUID, INTEGER, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_attendance(UUID, UUID, INTEGER, NUMERIC, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.update_attendance(UUID, UUID, INTEGER, NUMERIC, VARCHAR, TEXT, UUID[], UUID);
DROP FUNCTION IF EXISTS public.approve_attendance(UUID, UUID);

-- 9.1 record_attendance
CREATE OR REPLACE FUNCTION public.record_attendance(
  p_organisation_id UUID,
  p_attendance_date DATE,
  p_labour_category_id UUID,
  p_subcontractor_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_work_unit_id UUID DEFAULT NULL,
  p_work_unit_type TEXT DEFAULT 'PROJECT',
  p_workers_count INTEGER DEFAULT 1,
  p_hours_worked NUMERIC DEFAULT 8.0,
  p_supervisor_name TEXT DEFAULT NULL,
  p_applied_modifiers JSONB DEFAULT '[]'::JSONB,
  p_base_rate NUMERIC DEFAULT NULL,      -- Ignored: computed server-side
  p_adjusted_rate NUMERIC DEFAULT NULL,  -- Ignored: computed server-side
  p_original_amount NUMERIC DEFAULT NULL,-- Ignored: computed server-side
  p_adjusted_amount NUMERIC DEFAULT NULL,-- Ignored: computed server-side
  p_remarks TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_resolved_project_id UUID;
  v_base_rate NUMERIC;
  v_multiplier NUMERIC;
  v_adjusted_rate NUMERIC;
  v_hours NUMERIC;
  v_workers INTEGER;
  v_original_amount NUMERIC;
  v_adjusted_amount NUMERIC;
  v_modifiers UUID[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.create')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.create required';
  END IF;

  v_resolved_project_id := COALESCE(
    p_project_id, 
    CASE WHEN p_work_unit_type = 'PROJECT' THEN p_work_unit_id ELSE NULL END
  );

  v_hours := COALESCE(p_hours_worked, 8.0);
  v_workers := GREATEST(COALESCE(p_workers_count, 1), 1);
  v_modifiers := public._parse_modifier_uuids(p_applied_modifiers);

  -- Server-side money computation
  v_base_rate := public.resolve_labour_rate(
    p_organisation_id,
    p_subcontractor_id,
    p_labour_category_id,
    v_resolved_project_id,
    p_attendance_date
  );

  v_multiplier := public.calculate_context_multiplier(
    p_organisation_id,
    v_modifiers
  );

  v_adjusted_rate := ROUND(v_base_rate * v_multiplier, 2);
  v_original_amount := ROUND(v_base_rate * (v_hours / 8.0) * v_workers, 2);
  v_adjusted_amount := ROUND(v_adjusted_rate * (v_hours / 8.0) * v_workers, 2);

  INSERT INTO public.manpower_attendance (
    organisation_id, subcontractor_id, client_id, project_id, work_unit_id, work_unit_type,
    attendance_date, labour_category_id, workers_count, hours_worked, supervisor_name,
    applied_modifiers, base_rate, adjusted_rate, original_amount, adjusted_amount, remarks,
    status
  ) VALUES (
    p_organisation_id, p_subcontractor_id, p_client_id, v_resolved_project_id, p_work_unit_id, p_work_unit_type,
    p_attendance_date, p_labour_category_id, v_workers, v_hours, p_supervisor_name,
    v_modifiers, v_base_rate, v_adjusted_rate, v_original_amount, v_adjusted_amount, p_remarks,
    'DRAFT'
  )
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object(
    'status', 'success',
    'attendance_id', v_entry.id,
    'base_rate', v_base_rate,
    'adjusted_rate', v_adjusted_rate,
    'original_amount', v_original_amount,
    'adjusted_amount', v_adjusted_amount
  );
END;
$$;

-- 9.2 update_attendance
CREATE OR REPLACE FUNCTION public.update_attendance(
  p_attendance_id UUID,
  p_organisation_id UUID,
  p_workers_count INTEGER DEFAULT NULL,
  p_hours_worked NUMERIC DEFAULT NULL,
  p_supervisor_name TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_applied_modifiers JSONB DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_workers INTEGER;
  v_hours NUMERIC;
  v_modifiers UUID[];
  v_proj_id UUID;
  v_base_rate NUMERIC;
  v_multiplier NUMERIC;
  v_adjusted_rate NUMERIC;
  v_original_amount NUMERIC;
  v_adjusted_amount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.edit')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.edit required';
  END IF;

  SELECT * INTO v_entry 
  FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id 
  FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  IF v_entry.status NOT IN ('DRAFT', 'REJECTED') THEN
    RAISE EXCEPTION 'Cannot edit attendance entry in % status. Must be DRAFT or REJECTED.', v_entry.status;
  END IF;

  v_workers := GREATEST(COALESCE(p_workers_count, v_entry.workers_count), 1);
  v_hours := COALESCE(p_hours_worked, v_entry.hours_worked);
  v_modifiers := CASE 
    WHEN p_applied_modifiers IS NOT NULL THEN public._parse_modifier_uuids(p_applied_modifiers)
    ELSE COALESCE(v_entry.applied_modifiers, '{}'::UUID[])
  END;
  v_proj_id := COALESCE(p_project_id, v_entry.project_id);

  -- Recompute rates and amounts server-side
  v_base_rate := public.resolve_labour_rate(
    p_organisation_id,
    v_entry.subcontractor_id,
    v_entry.labour_category_id,
    v_proj_id,
    v_entry.attendance_date
  );

  v_multiplier := public.calculate_context_multiplier(
    p_organisation_id,
    v_modifiers
  );

  v_adjusted_rate := ROUND(v_base_rate * v_multiplier, 2);
  v_original_amount := ROUND(v_base_rate * (v_hours / 8.0) * v_workers, 2);
  v_adjusted_amount := ROUND(v_adjusted_rate * (v_hours / 8.0) * v_workers, 2);

  UPDATE public.manpower_attendance SET
    workers_count = v_workers,
    hours_worked = v_hours,
    supervisor_name = COALESCE(p_supervisor_name, supervisor_name),
    remarks = COALESCE(p_remarks, remarks),
    applied_modifiers = v_modifiers,
    project_id = v_proj_id,
    base_rate = v_base_rate,
    adjusted_rate = v_adjusted_rate,
    original_amount = v_original_amount,
    adjusted_amount = v_adjusted_amount,
    updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'attendance_id', p_attendance_id,
    'base_rate', v_base_rate,
    'adjusted_rate', v_adjusted_rate,
    'original_amount', v_original_amount,
    'adjusted_amount', v_adjusted_amount
  );
END;
$$;

-- 9.3 approve_attendance
CREATE OR REPLACE FUNCTION public.approve_attendance(
  p_attendance_id UUID,
  p_organisation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.approve')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.approve required';
  END IF;

  SELECT * INTO v_entry 
  FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id 
  FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  IF v_entry.status = 'APPROVED' THEN
    RETURN jsonb_build_object('status', 'already_approved', 'attendance_id', p_attendance_id);
  END IF;

  UPDATE public.manpower_attendance SET
    status = 'APPROVED',
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('status', 'success', 'attendance_id', p_attendance_id);
END;
$$;

-- 9.4 reject_attendance
CREATE OR REPLACE FUNCTION public.reject_attendance(
  p_attendance_id UUID,
  p_organisation_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.approve')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.approve required';
  END IF;

  SELECT * INTO v_entry 
  FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id 
  FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  UPDATE public.manpower_attendance SET
    status = 'REJECTED',
    approved_by = auth.uid(),
    approved_at = NOW(),
    remarks = CASE 
      WHEN p_rejection_reason IS NOT NULL AND length(trim(p_rejection_reason)) > 0 
      THEN COALESCE(remarks || ' | Rejected: ' || trim(p_rejection_reason), 'Rejected: ' || trim(p_rejection_reason))
      ELSE remarks 
    END,
    updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('status', 'success', 'attendance_id', p_attendance_id);
END;
$$;

-- 9.5 reopen_attendance
CREATE OR REPLACE FUNCTION public.reopen_attendance(
  p_attendance_id UUID,
  p_organisation_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.reopen')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.reopen required';
  END IF;

  SELECT * INTO v_entry 
  FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id 
  FOR UPDATE;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Attendance entry not found or unauthorized';
  END IF;

  IF v_entry.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Only approved attendance entries can be reopened (current status: %)', v_entry.status;
  END IF;

  UPDATE public.manpower_attendance SET
    status = 'DRAFT',
    approved_by = NULL,
    approved_at = NULL,
    remarks = CASE 
      WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0 
      THEN COALESCE(remarks || ' | Reopened: ' || trim(p_reason), 'Reopened: ' || trim(p_reason))
      ELSE remarks 
    END,
    updated_at = NOW()
  WHERE id = p_attendance_id;

  RETURN jsonb_build_object('status', 'success', 'attendance_id', p_attendance_id);
END;
$$;

-- ====================================================================
-- 10. Fix get_subcontractor_wo_rollup (total_amount instead of contract_value)
-- ====================================================================
DROP FUNCTION IF EXISTS public.get_subcontractor_wo_rollup(UUID);
CREATE OR REPLACE FUNCTION public.get_subcontractor_wo_rollup(p_wo_id UUID)
RETURNS TABLE (
  work_order_id UUID,
  contract_value NUMERIC,
  committed_value NUMERIC,
  gross_certified NUMERIC,
  retention_held NUMERIC,
  advance_paid NUMERIC,
  advance_recovered NUMERIC,
  measurement_paid NUMERIC,
  net_payable NUMERIC,
  outstanding NUMERIC,
  remaining_advance NUMERIC,
  wo_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Base WO record using total_amount (contract_value column does not exist)
  wo_base AS (
    SELECT
      wo.id AS wo_id,
      COALESCE(wo.total_amount, 0) AS cv,
      wo.status AS wstatus
    FROM public.subcontractor_work_orders wo
    WHERE wo.id = p_wo_id
  ),

  -- Independent aggregation: approved amendments
  amendment_agg AS (
    SELECT
      a.work_order_id AS wo_id,
      COALESCE(SUM(a.difference_amount), 0) AS total_amendment
    FROM public.subcontractor_work_order_amendments a
    WHERE a.work_order_id = p_wo_id
      AND a.status = 'Approved'
    GROUP BY a.work_order_id
  ),

  -- Independent aggregation: approved measurement sheets
  measurement_agg AS (
    SELECT
      m.work_order_id AS wo_id,
      COALESCE(SUM(m.actual_value), 0) AS gross_cert_val
    FROM public.subcontractor_measurement_sheets m
    WHERE m.work_order_id = p_wo_id
      AND m.status = 'Approved'
    GROUP BY m.work_order_id
  ),

  -- Independent aggregation: held retention
  retention_agg AS (
    SELECT
      r.work_order_id AS wo_id,
      COALESCE(SUM(r.retention_amount), 0) AS retention_val
    FROM public.subcontractor_retention r
    WHERE r.work_order_id = p_wo_id
      AND r.status = 'Held'
    GROUP BY r.work_order_id
  ),

  -- Independent aggregation: payments split by type
  payment_agg AS (
    SELECT
      p.work_order_id AS wo_id,
      COALESCE(SUM(
        CASE WHEN p.payment_type = 'advance'
        THEN COALESCE(p.net_amount, p.amount, 0)
        ELSE 0 END
      ), 0) AS advance_val,
      COALESCE(SUM(
        CASE WHEN p.payment_type IN ('measurement', 'final')
        THEN COALESCE(p.net_amount, p.amount, 0)
        ELSE 0 END
      ), 0) AS measurement_val
    FROM public.subcontractor_payments p
    WHERE p.work_order_id = p_wo_id
    GROUP BY p.work_order_id
  ),

  -- Combine independent aggregations
  combined AS (
    SELECT
      b.wo_id,
      b.cv AS contract_value,
      b.cv + COALESCE(a.total_amendment, 0) AS committed_value,
      COALESCE(m.gross_cert_val, 0) AS gross_certified,
      COALESCE(r.retention_val, 0) AS retention_held,
      COALESCE(p.advance_val, 0) AS advance_paid,
      LEAST(
        COALESCE(p.advance_val, 0),
        GREATEST(COALESCE(m.gross_cert_val, 0) - COALESCE(r.retention_val, 0), 0)
      ) AS advance_recovered,
      COALESCE(p.measurement_val, 0) AS measurement_paid,
      b.wstatus
    FROM wo_base b
    LEFT JOIN amendment_agg a ON a.wo_id = b.wo_id
    LEFT JOIN measurement_agg m ON m.wo_id = b.wo_id
    LEFT JOIN retention_agg r ON r.wo_id = b.wo_id
    LEFT JOIN payment_agg p ON p.wo_id = b.wo_id
  )

  SELECT
    c.wo_id AS work_order_id,
    c.contract_value,
    c.committed_value,
    c.gross_certified,
    c.retention_held,
    c.advance_paid,
    c.advance_recovered,
    c.measurement_paid,
    c.gross_certified - c.retention_held - c.advance_recovered AS net_payable,
    (c.gross_certified - c.retention_held - c.advance_recovered) - c.measurement_paid AS outstanding,
    c.advance_paid - c.advance_recovered AS remaining_advance,
    c.wstatus::TEXT AS wo_status
  FROM combined c;
END;
$$;

-- ====================================================================
-- ROLLBACK SECTION (Documented instructions for reverting this migration)
-- ====================================================================
/*
-- 1. Drop audit trigger and table
DROP TRIGGER IF EXISTS trg_audit_manpower_attendance ON public.manpower_attendance;
DROP TRIGGER IF EXISTS trg_audit_rate_cards ON public.rate_cards;
DROP TRIGGER IF EXISTS trg_audit_labour_categories ON public.labour_categories;
DROP TRIGGER IF EXISTS trg_audit_manpower_billing ON public.manpower_billing;
DROP FUNCTION IF EXISTS public.trg_labour_audit_record();
DROP TABLE IF EXISTS public.labour_audit_log CASCADE;

-- 2. Drop reopen and reject RPCs
DROP FUNCTION IF EXISTS public.reopen_attendance(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_attendance(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.resolve_labour_rate(UUID, UUID, UUID, UUID, DATE);
DROP FUNCTION IF EXISTS public.calculate_context_multiplier(UUID, UUID[]);

-- 3. Remove column
ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS project_id;
*/
