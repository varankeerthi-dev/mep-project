-- Migration: 20261103020000_phase1_parties_workers_planning.sql
-- Description: Phase 1 — Unified Parties, Worker Models, and Planned-vs-Actual Attendance
-- Rollback Instructions:
--   DROP VIEW IF EXISTS public.v_planned_vs_actual;
--   DROP FUNCTION IF EXISTS public.convert_plan_to_actual(uuid, uuid, integer, numeric, text, jsonb, text);
--   DROP FUNCTION IF EXISTS public.confirm_plan_with_client(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.plan_labour(uuid, date, uuid, integer, uuid, uuid, uuid, text, text, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.quick_add_worker(uuid, text, uuid, numeric, text, text, text, text, uuid);
--   DROP FUNCTION IF EXISTS public.resolve_legacy_ids(uuid, text);
--   DROP TABLE IF EXISTS public.labour_workers CASCADE;
--   ALTER TABLE public.clients DROP COLUMN IF EXISTS party_id;
--   ALTER TABLE public.purchase_vendors DROP COLUMN IF EXISTS party_id;
--   ALTER TABLE public.subcontractors DROP COLUMN IF EXISTS party_id;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS worker_id;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS employee_id;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS entry_kind;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS client_confirmation;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS planned_from_id;

DO $$
BEGIN
  -- =========================================================================
  -- 1. UNIFIED PARTIES (D3)
  -- =========================================================================

  -- Add party_id to legacy master tables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'party_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'purchase_vendors' AND column_name = 'party_id'
  ) THEN
    ALTER TABLE public.purchase_vendors ADD COLUMN party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subcontractors' AND column_name = 'party_id'
  ) THEN
    ALTER TABLE public.subcontractors ADD COLUMN party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL;
  END IF;

END $$;

CREATE INDEX IF NOT EXISTS idx_clients_party_id ON public.clients(party_id);
CREATE INDEX IF NOT EXISTS idx_purchase_vendors_party_id ON public.purchase_vendors(party_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_party_id ON public.subcontractors(party_id);

-- Idempotent Backfill: Group legacy records by organisation_id and GSTIN (or normalized name) into parties
DO $$
DECLARE
  r RECORD;
  v_party_id uuid;
BEGIN
  -- 1a. Backfill clients with GSTIN
  FOR r IN (
    SELECT id, organisation_id, client_name, gstin, contact, email, address1
    FROM public.clients
    WHERE party_id IS NULL AND gstin IS NOT NULL AND length(trim(gstin)) > 0
  ) LOOP
    SELECT id INTO v_party_id FROM public.parties 
    WHERE organisation_id = r.organisation_id AND upper(trim(gstin)) = upper(trim(r.gstin))
    LIMIT 1;

    IF v_party_id IS NULL THEN
      INSERT INTO public.parties (organisation_id, name, gstin, phone, email, address, status)
      VALUES (r.organisation_id, trim(r.client_name), upper(trim(r.gstin)), r.contact, r.email, r.address1, 'Active')
      RETURNING id INTO v_party_id;
    END IF;

    UPDATE public.clients SET party_id = v_party_id WHERE id = r.id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (v_party_id, 'customer'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;
  END LOOP;

  -- 1b. Backfill clients without GSTIN
  FOR r IN (
    SELECT id, organisation_id, client_name, contact, email, address1
    FROM public.clients
    WHERE party_id IS NULL
  ) LOOP
    SELECT id INTO v_party_id FROM public.parties
    WHERE organisation_id = r.organisation_id AND lower(trim(name)) = lower(trim(r.client_name))
    LIMIT 1;

    IF v_party_id IS NULL THEN
      INSERT INTO public.parties (organisation_id, name, gstin, phone, email, address, status)
      VALUES (r.organisation_id, trim(r.client_name), NULL, r.contact, r.email, r.address1, 'Active')
      RETURNING id INTO v_party_id;
    END IF;

    UPDATE public.clients SET party_id = v_party_id WHERE id = r.id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (v_party_id, 'customer'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;
  END LOOP;

  -- 1c. Backfill purchase_vendors
  FOR r IN (
    SELECT id, organisation_id, company_name, gstin, phone, email, address
    FROM public.purchase_vendors
    WHERE party_id IS NULL
  ) LOOP
    v_party_id := NULL;
    IF r.gstin IS NOT NULL AND length(trim(r.gstin)) > 0 THEN
      SELECT id INTO v_party_id FROM public.parties 
      WHERE organisation_id = r.organisation_id AND upper(trim(gstin)) = upper(trim(r.gstin))
      LIMIT 1;
    END IF;

    IF v_party_id IS NULL THEN
      SELECT id INTO v_party_id FROM public.parties
      WHERE organisation_id = r.organisation_id AND lower(trim(name)) = lower(trim(r.company_name))
      LIMIT 1;
    END IF;

    IF v_party_id IS NULL THEN
      INSERT INTO public.parties (organisation_id, name, gstin, phone, email, address, status)
      VALUES (r.organisation_id, trim(r.company_name), NULLIF(upper(trim(r.gstin)), ''), r.phone, r.email, r.address, 'Active')
      RETURNING id INTO v_party_id;
    END IF;

    UPDATE public.purchase_vendors SET party_id = v_party_id WHERE id = r.id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (v_party_id, 'vendor'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;
  END LOOP;

  -- 1d. Backfill subcontractors
  FOR r IN (
    SELECT id, organisation_id, company_name, gstin, phone, email, address
    FROM public.subcontractors
    WHERE party_id IS NULL
  ) LOOP
    v_party_id := NULL;
    IF r.gstin IS NOT NULL AND length(trim(r.gstin)) > 0 THEN
      SELECT id INTO v_party_id FROM public.parties 
      WHERE organisation_id = r.organisation_id AND upper(trim(gstin)) = upper(trim(r.gstin))
      LIMIT 1;
    END IF;

    IF v_party_id IS NULL THEN
      SELECT id INTO v_party_id FROM public.parties
      WHERE organisation_id = r.organisation_id AND lower(trim(name)) = lower(trim(r.company_name))
      LIMIT 1;
    END IF;

    IF v_party_id IS NULL THEN
      INSERT INTO public.parties (organisation_id, name, gstin, phone, email, address, status)
      VALUES (r.organisation_id, trim(r.company_name), NULLIF(upper(trim(r.gstin)), ''), r.phone, r.email, r.address, 'Active')
      RETURNING id INTO v_party_id;
    END IF;

    UPDATE public.subcontractors SET party_id = v_party_id WHERE id = r.id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (v_party_id, 'subcontractor'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;
  END LOOP;

END $$;

-- Legacy Resolver RPC: resolve_legacy_ids
CREATE OR REPLACE FUNCTION public.resolve_legacy_ids(
  p_party_id uuid,
  p_role text
) RETURNS TABLE (
  legacy_id uuid,
  legacy_table text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_party RECORD;
  v_new_id uuid;
  v_norm_role text;
BEGIN
  v_norm_role := lower(trim(p_role));

  SELECT * INTO v_party FROM public.parties WHERE id = p_party_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Party % not found', p_party_id;
  END IF;

  IF NOT (public.is_org_admin(v_party.organisation_id) OR public.user_can_access_org(v_party.organisation_id)) THEN
    RAISE EXCEPTION 'Unauthorized organisation access to party %', p_party_id;
  END IF;

  IF v_norm_role IN ('customer', 'client') THEN
    SELECT id INTO legacy_id FROM public.clients WHERE party_id = p_party_id LIMIT 1;
    IF legacy_id IS NOT NULL THEN
      legacy_table := 'clients';
      RETURN NEXT;
      RETURN;
    END IF;

    -- Mirror row creation
    INSERT INTO public.clients (
      organisation_id,
      client_id,
      client_name,
      gstin,
      contact,
      email,
      address1,
      party_id,
      category
    ) VALUES (
      v_party.organisation_id,
      'C-' || UPPER(SUBSTRING(v_party.id::text, 1, 8)),
      v_party.name,
      v_party.gstin,
      v_party.phone,
      v_party.email,
      v_party.address,
      v_party.id,
      'Active'
    ) RETURNING id INTO legacy_id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (p_party_id, 'customer'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;

    legacy_table := 'clients';
    RETURN NEXT;
    RETURN;

  ELSIF v_norm_role = 'vendor' THEN
    SELECT id INTO legacy_id FROM public.purchase_vendors WHERE party_id = p_party_id LIMIT 1;
    IF legacy_id IS NOT NULL THEN
      legacy_table := 'purchase_vendors';
      RETURN NEXT;
      RETURN;
    END IF;

    INSERT INTO public.purchase_vendors (
      organisation_id,
      vendor_code,
      company_name,
      gstin,
      phone,
      email,
      address,
      party_id,
      status
    ) VALUES (
      v_party.organisation_id,
      'V-' || UPPER(SUBSTRING(v_party.id::text, 1, 8)),
      v_party.name,
      v_party.gstin,
      v_party.phone,
      v_party.email,
      v_party.address,
      v_party.id,
      'Active'
    ) RETURNING id INTO legacy_id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (p_party_id, 'vendor'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;

    legacy_table := 'purchase_vendors';
    RETURN NEXT;
    RETURN;

  ELSIF v_norm_role = 'subcontractor' THEN
    SELECT id INTO legacy_id FROM public.subcontractors WHERE party_id = p_party_id LIMIT 1;
    IF legacy_id IS NOT NULL THEN
      legacy_table := 'subcontractors';
      RETURN NEXT;
      RETURN;
    END IF;

    INSERT INTO public.subcontractors (
      organisation_id,
      company_name,
      gstin,
      phone,
      email,
      address,
      party_id,
      status
    ) VALUES (
      v_party.organisation_id,
      v_party.name,
      v_party.gstin,
      v_party.phone,
      v_party.email,
      v_party.address,
      v_party.id,
      'Active'
    ) RETURNING id INTO legacy_id;

    INSERT INTO public.party_roles (party_id, role)
    VALUES (p_party_id, 'subcontractor'::public.party_role_type)
    ON CONFLICT (party_id, role) DO NOTHING;

    legacy_table := 'subcontractors';
    RETURN NEXT;
    RETURN;

  ELSE
    RAISE EXCEPTION 'Unsupported party role for legacy resolution: %', p_role;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_legacy_ids(uuid, text) TO authenticated;

-- =========================================================================
-- 2. WORKERS MODEL (D4)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.labour_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  trade uuid REFERENCES public.labour_categories(id) ON DELETE RESTRICT,
  worker_type text NOT NULL CHECK (worker_type IN ('own_daily', 'casual', 'emergency', 'vendor_crew')),
  pay_basis text NOT NULL CHECK (pay_basis IN ('daily', 'hourly', 'per_meter', 'monthly')),
  default_rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  vendor_party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  payout_ref text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labour_workers_org ON public.labour_workers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_labour_workers_trade ON public.labour_workers(trade);
CREATE INDEX IF NOT EXISTS idx_labour_workers_employee ON public.labour_workers(employee_id);
CREATE INDEX IF NOT EXISTS idx_labour_workers_vendor ON public.labour_workers(vendor_party_id);

ALTER TABLE public.labour_workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_workers_tenant_isolation ON public.labour_workers;
CREATE POLICY labour_workers_tenant_isolation ON public.labour_workers
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_labour_workers_audit ON public.labour_workers;
CREATE TRIGGER trg_labour_workers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_workers
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

-- Add worker columns to manpower_attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN worker_id uuid REFERENCES public.labour_workers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;

  ALTER TABLE public.manpower_attendance DROP CONSTRAINT IF EXISTS chk_worker_or_employee;
  ALTER TABLE public.manpower_attendance ADD CONSTRAINT chk_worker_or_employee CHECK (worker_id IS NULL OR employee_id IS NULL);
END $$;

CREATE INDEX IF NOT EXISTS idx_manpower_attendance_worker_id ON public.manpower_attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_manpower_attendance_employee_id ON public.manpower_attendance(employee_id);

-- Quick-Add Worker RPC (Under 10s on attendance screen)
CREATE OR REPLACE FUNCTION public.quick_add_worker(
  p_organisation_id uuid,
  p_name text,
  p_trade_id uuid,
  p_default_rate numeric,
  p_phone text DEFAULT NULL,
  p_worker_type text DEFAULT 'casual',
  p_pay_basis text DEFAULT 'daily',
  p_payout_ref text DEFAULT NULL,
  p_vendor_party_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_worker_id uuid;
  v_trade RECORD;
  v_vendor_legacy_id uuid := NULL;
BEGIN
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation %', p_organisation_id;
  END IF;

  IF NOT (
    public.is_org_admin(p_organisation_id) OR
    public.has_permission(p_organisation_id, 'labour.workers.manage') OR 
    public.has_permission(p_organisation_id, 'labour.attendance.create')
  ) THEN
    RAISE EXCEPTION 'Permission denied to create labour workers';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Worker name is required';
  END IF;

  IF p_trade_id IS NOT NULL THEN
    SELECT * INTO v_trade FROM public.labour_categories WHERE id = p_trade_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Trade category % not found', p_trade_id;
    END IF;
  END IF;

  IF p_default_rate IS NULL OR p_default_rate < 0 THEN
    RAISE EXCEPTION 'Worker default rate must be >= 0';
  END IF;

  IF p_vendor_party_id IS NOT NULL THEN
    SELECT legacy_id INTO v_vendor_legacy_id FROM public.resolve_legacy_ids(p_vendor_party_id, 'subcontractor');
  END IF;

  INSERT INTO public.labour_workers (
    organisation_id,
    name,
    trade,
    default_rate,
    phone,
    worker_type,
    pay_basis,
    payout_ref,
    vendor_party_id,
    vendor_id,
    is_active
  ) VALUES (
    p_organisation_id,
    trim(p_name),
    p_trade_id,
    p_default_rate,
    trim(p_phone),
    p_worker_type,
    p_pay_basis,
    p_payout_ref,
    p_vendor_party_id,
    v_vendor_legacy_id,
    true
  ) RETURNING id INTO v_worker_id;

  RETURN v_worker_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quick_add_worker(uuid, text, uuid, numeric, text, text, text, text, uuid) TO authenticated;

-- =========================================================================
-- 3. PLANNED VS ACTUAL ATTENDANCE (D2)
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'entry_kind'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN entry_kind text NOT NULL DEFAULT 'ACTUAL';
  END IF;

  ALTER TABLE public.manpower_attendance DROP CONSTRAINT IF EXISTS chk_entry_kind;
  ALTER TABLE public.manpower_attendance ADD CONSTRAINT chk_entry_kind CHECK (entry_kind IN ('PLANNED', 'ACTUAL'));

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'client_confirmation'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN client_confirmation text DEFAULT 'planned_unconfirmed';
  END IF;

  ALTER TABLE public.manpower_attendance DROP CONSTRAINT IF EXISTS chk_client_confirmation;
  ALTER TABLE public.manpower_attendance ADD CONSTRAINT chk_client_confirmation 
    CHECK (client_confirmation IN ('confirmed', 'planned', 'planned_unconfirmed', 'rejected'));

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'planned_from_id'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN planned_from_id uuid REFERENCES public.manpower_attendance(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_manpower_attendance_entry_kind ON public.manpower_attendance(organisation_id, entry_kind, attendance_date);
CREATE INDEX IF NOT EXISTS idx_manpower_attendance_planned_from ON public.manpower_attendance(planned_from_id);

-- RPC: plan_labour
CREATE OR REPLACE FUNCTION public.plan_labour(
  p_organisation_id uuid,
  p_attendance_date date,
  p_labour_category_id uuid,
  p_workers_count integer,
  p_subcontractor_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_confirmation text DEFAULT 'planned_unconfirmed',
  p_remarks text DEFAULT NULL,
  p_worker_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id uuid;
  v_base_rate numeric := 0;
  v_adjusted_rate numeric := 0;
  v_original_amount numeric := 0;
  v_adjusted_amount numeric := 0;
  v_worker RECORD;
  v_entry RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation %', p_organisation_id;
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.create')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.create required to plan labour';
  END IF;

  IF p_workers_count <= 0 THEN
    RAISE EXCEPTION 'Planned workers count must be greater than zero';
  END IF;

  IF p_worker_id IS NOT NULL AND p_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot specify both worker_id and employee_id';
  END IF;

  IF p_worker_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.labour_workers WHERE id = p_worker_id AND organisation_id = p_organisation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Worker % not found', p_worker_id;
    END IF;
    IF p_labour_category_id IS NULL THEN
      p_labour_category_id := v_worker.trade;
    END IF;
    IF v_worker.default_rate > 0 THEN
      v_base_rate := v_worker.default_rate;
    END IF;
  END IF;

  IF v_base_rate = 0 THEN
    v_base_rate := public.resolve_labour_rate(
      p_organisation_id,
      p_subcontractor_id,
      p_labour_category_id,
      p_project_id,
      p_attendance_date
    );
  END IF;

  v_adjusted_rate := v_base_rate;
  v_original_amount := ROUND((p_workers_count * 8 * (v_base_rate / 8.0))::numeric, 2);
  v_adjusted_amount := v_original_amount;

  INSERT INTO public.manpower_attendance (
    organisation_id,
    subcontractor_id,
    client_id,
    project_id,
    work_unit_id,
    work_unit_type,
    attendance_date,
    labour_category_id,
    workers_count,
    hours_worked,
    base_rate,
    adjusted_rate,
    original_amount,
    adjusted_amount,
    remarks,
    status,
    entry_kind,
    client_confirmation,
    worker_id,
    employee_id
  ) VALUES (
    p_organisation_id,
    p_subcontractor_id,
    p_client_id,
    p_project_id,
    p_project_id,
    CASE WHEN p_project_id IS NOT NULL THEN 'PROJECT' ELSE 'GENERAL' END,
    p_attendance_date,
    p_labour_category_id,
    p_workers_count,
    8,
    v_base_rate,
    v_adjusted_rate,
    v_original_amount,
    v_adjusted_amount,
    p_remarks,
    'DRAFT',
    'PLANNED',
    COALESCE(p_confirmation, 'planned_unconfirmed'),
    p_worker_id,
    p_employee_id
  ) RETURNING * INTO v_entry;

  RETURN to_jsonb(v_entry);
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_labour(uuid, date, uuid, integer, uuid, uuid, uuid, text, text, uuid, uuid) TO authenticated;

-- RPC: confirm_plan_with_client
CREATE OR REPLACE FUNCTION public.confirm_plan_with_client(
  p_attendance_id uuid,
  p_organisation_id uuid,
  p_confirmation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation %', p_organisation_id;
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.edit')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.edit required to confirm plan';
  END IF;

  IF p_confirmation NOT IN ('confirmed', 'planned', 'planned_unconfirmed', 'rejected') THEN
    RAISE EXCEPTION 'Invalid confirmation status: %', p_confirmation;
  END IF;

  SELECT * INTO v_row FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record % not found', p_attendance_id;
  END IF;

  IF v_row.entry_kind != 'PLANNED' THEN
    RAISE EXCEPTION 'Only PLANNED attendance records can be confirmed with client';
  END IF;

  UPDATE public.manpower_attendance
  SET client_confirmation = p_confirmation,
      updated_at = NOW()
  WHERE id = p_attendance_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_plan_with_client(uuid, uuid, text) TO authenticated;

-- RPC: convert_plan_to_actual
CREATE OR REPLACE FUNCTION public.convert_plan_to_actual(
  p_plan_id uuid,
  p_organisation_id uuid,
  p_actual_headcount integer,
  p_actual_hours numeric DEFAULT 8.0,
  p_supervisor_name text DEFAULT NULL,
  p_applied_modifiers jsonb DEFAULT '[]'::jsonb,
  p_remarks text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan RECORD;
  v_actual RECORD;
  v_base_rate numeric := 0;
  v_multiplier numeric := 1.0;
  v_adjusted_rate numeric := 0;
  v_original_amount numeric := 0;
  v_adjusted_amount numeric := 0;
  v_modifiers uuid[];
  v_worker RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation %', p_organisation_id;
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.create')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.create required to convert plan';
  END IF;

  IF p_actual_headcount <= 0 THEN
    RAISE EXCEPTION 'Actual headcount must be greater than zero';
  END IF;

  SELECT * INTO v_plan FROM public.manpower_attendance
  WHERE id = p_plan_id AND organisation_id = p_organisation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan % not found in organisation %', p_plan_id, p_organisation_id;
  END IF;

  IF v_plan.entry_kind != 'PLANNED' THEN
    RAISE EXCEPTION 'Record % is not a PLANNED attendance row', p_plan_id;
  END IF;

  -- Rate resolution for the actual record
  IF v_plan.worker_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.labour_workers WHERE id = v_plan.worker_id;
    IF v_worker.default_rate > 0 THEN
      v_base_rate := v_worker.default_rate;
    END IF;
  END IF;

  IF v_base_rate = 0 THEN
    v_base_rate := public.resolve_labour_rate(
      p_organisation_id,
      v_plan.subcontractor_id,
      v_plan.labour_category_id,
      v_plan.project_id,
      v_plan.attendance_date
    );
  END IF;

  v_modifiers := public._parse_modifier_uuids(p_applied_modifiers);
  v_multiplier := public.calculate_context_multiplier(p_organisation_id, v_modifiers);
  v_adjusted_rate := ROUND((v_base_rate * v_multiplier)::numeric, 2);
  v_original_amount := ROUND((p_actual_headcount * p_actual_hours * (v_base_rate / 8.0))::numeric, 2);
  v_adjusted_amount := ROUND((p_actual_headcount * p_actual_hours * (v_adjusted_rate / 8.0))::numeric, 2);

  -- Insert the actual row
  INSERT INTO public.manpower_attendance (
    organisation_id,
    subcontractor_id,
    client_id,
    project_id,
    work_unit_id,
    work_unit_type,
    attendance_date,
    labour_category_id,
    workers_count,
    hours_worked,
    supervisor_name,
    applied_modifiers,
    base_rate,
    adjusted_rate,
    original_amount,
    adjusted_amount,
    remarks,
    status,
    entry_kind,
    planned_from_id,
    worker_id,
    employee_id
  ) VALUES (
    p_organisation_id,
    v_plan.subcontractor_id,
    v_plan.client_id,
    v_plan.project_id,
    v_plan.project_id,
    CASE WHEN v_plan.project_id IS NOT NULL THEN 'PROJECT' ELSE 'GENERAL' END,
    v_plan.attendance_date,
    v_plan.labour_category_id,
    p_actual_headcount,
    p_actual_hours,
    COALESCE(p_supervisor_name, v_plan.supervisor_name),
    v_modifiers,
    v_base_rate,
    v_adjusted_rate,
    v_original_amount,
    v_adjusted_amount,
    COALESCE(p_remarks, v_plan.remarks),
    'DRAFT',
    'ACTUAL',
    p_plan_id,
    v_plan.worker_id,
    v_plan.employee_id
  ) RETURNING * INTO v_actual;

  -- Mark the planned row as converted
  UPDATE public.manpower_attendance
  SET status = 'CONVERTED',
      updated_at = NOW()
  WHERE id = p_plan_id;

  RETURN to_jsonb(v_actual);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_plan_to_actual(uuid, uuid, integer, numeric, text, jsonb, text) TO authenticated;

-- View: v_planned_vs_actual
CREATE OR REPLACE VIEW public.v_planned_vs_actual AS
SELECT 
  p.id AS plan_id,
  p.organisation_id,
  p.attendance_date,
  p.client_id,
  p.project_id,
  p.subcontractor_id,
  p.labour_category_id,
  p.workers_count AS planned_headcount,
  p.client_confirmation,
  p.status AS plan_status,
  a.id AS actual_id,
  a.workers_count AS actual_headcount,
  a.hours_worked AS actual_hours,
  a.status AS actual_status,
  a.base_rate,
  a.adjusted_rate,
  a.adjusted_amount AS actual_amount,
  COALESCE(a.workers_count, 0) - p.workers_count AS headcount_variance
FROM public.manpower_attendance p
LEFT JOIN public.manpower_attendance a ON a.planned_from_id = p.id AND a.entry_kind = 'ACTUAL'
WHERE p.entry_kind = 'PLANNED';

GRANT SELECT ON public.v_planned_vs_actual TO authenticated;

-- Hardening update on record_attendance to accept worker_id and employee_id
DROP FUNCTION IF EXISTS public.record_attendance(UUID, DATE, UUID, UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID);
DROP FUNCTION IF EXISTS public.record_attendance(UUID, DATE, UUID, UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, UUID, UUID);

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
  p_project_id UUID DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_resolved_project_id UUID;
  v_base_rate NUMERIC := 0;
  v_multiplier NUMERIC := 1.0;
  v_adjusted_rate NUMERIC;
  v_hours NUMERIC;
  v_workers INTEGER;
  v_original_amount NUMERIC;
  v_adjusted_amount NUMERIC;
  v_modifiers UUID[];
  v_worker RECORD;
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

  IF p_worker_id IS NOT NULL AND p_employee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot specify both worker_id and employee_id';
  END IF;

  v_resolved_project_id := COALESCE(
    p_project_id, 
    CASE WHEN p_work_unit_type = 'PROJECT' THEN p_work_unit_id ELSE NULL END
  );

  v_hours := COALESCE(p_hours_worked, 8.0);
  v_workers := GREATEST(COALESCE(p_workers_count, 1), 1);
  v_modifiers := public._parse_modifier_uuids(p_applied_modifiers);

  -- Worker lookup and rate priority
  IF p_worker_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.labour_workers 
    WHERE id = p_worker_id AND organisation_id = p_organisation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Worker % not found in organisation %', p_worker_id, p_organisation_id;
    END IF;

    IF p_labour_category_id IS NULL THEN
      p_labour_category_id := v_worker.trade;
    END IF;

    IF p_subcontractor_id IS NULL AND v_worker.vendor_id IS NOT NULL THEN
      p_subcontractor_id := v_worker.vendor_id;
    END IF;

    IF v_worker.default_rate > 0 THEN
      v_base_rate := v_worker.default_rate;
    END IF;
  END IF;

  IF v_base_rate = 0 THEN
    v_base_rate := public.resolve_labour_rate(
      p_organisation_id,
      p_subcontractor_id,
      p_labour_category_id,
      v_resolved_project_id,
      p_attendance_date
    );
  END IF;

  v_multiplier := public.calculate_context_multiplier(p_organisation_id, v_modifiers);
  v_adjusted_rate := ROUND((v_base_rate * v_multiplier)::numeric, 2);
  v_original_amount := ROUND((v_workers * v_hours * (v_base_rate / 8.0))::numeric, 2);
  v_adjusted_amount := ROUND((v_workers * v_hours * (v_adjusted_rate / 8.0))::numeric, 2);

  INSERT INTO public.manpower_attendance (
    organisation_id,
    attendance_date,
    labour_category_id,
    subcontractor_id,
    client_id,
    work_unit_id,
    work_unit_type,
    project_id,
    workers_count,
    hours_worked,
    supervisor_name,
    applied_modifiers,
    base_rate,
    adjusted_rate,
    original_amount,
    adjusted_amount,
    remarks,
    status,
    source,
    entry_kind,
    worker_id,
    employee_id
  ) VALUES (
    p_organisation_id,
    p_attendance_date,
    p_labour_category_id,
    p_subcontractor_id,
    p_client_id,
    p_work_unit_id,
    p_work_unit_type,
    v_resolved_project_id,
    v_workers,
    v_hours,
    p_supervisor_name,
    v_modifiers,
    v_base_rate,
    v_adjusted_rate,
    v_original_amount,
    v_adjusted_amount,
    p_remarks,
    'DRAFT',
    'direct',
    'ACTUAL',
    p_worker_id,
    p_employee_id
  )
  RETURNING * INTO v_entry;

  RETURN to_jsonb(v_entry);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_attendance(UUID, DATE, UUID, UUID, UUID, UUID, TEXT, INTEGER, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, UUID, UUID) TO authenticated;
