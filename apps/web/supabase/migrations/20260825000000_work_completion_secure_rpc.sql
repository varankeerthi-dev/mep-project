-- Work Completion Certificate: zero-trust RPC boundary
-- Apply this migration to the live Supabase database before deploying the updated clients.

DO $$
DECLARE
  required_table TEXT;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'organisations', 'clients', 'projects', 'client_purchase_orders', 'invoices',
    'user_organisations', 'org_members', 'role_permissions', 'permissions'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'WCC_MIGRATION_PREFLIGHT_FAILED: missing public.%', required_table;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'organisation_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'client_name')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'organisation_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'client_id')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_purchase_orders' AND column_name IN ('po_number', 'order_number'))
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name IN ('invoice_no', 'invoice_number'))
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_members' AND column_name = 'role_id')
  THEN
    RAISE EXCEPTION 'WCC_MIGRATION_PREFLIGHT_FAILED: required tenant, client, project, PO, invoice, or RBAC columns are missing';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.work_completion_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  certificate_no VARCHAR(80) NOT NULL,
  certificate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completion_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  po_id UUID NULL REFERENCES public.client_purchase_orders(id) ON DELETE SET NULL,
  invoice_id UUID NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  work_name TEXT NOT NULL,
  po_number VARCHAR(120),
  invoice_number VARCHAR(120),
  client_address TEXT,
  client_gstin VARCHAR(40),
  client_state VARCHAR(120),
  body_intro TEXT NOT NULL,
  clauses JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  output_format VARCHAR(20) NOT NULL DEFAULT 'letterhead' CHECK (output_format IN ('letterhead', 'simple_a4')),
  show_logo BOOLEAN NOT NULL DEFAULT TRUE,
  footer_text TEXT,
  left_signature_label VARCHAR(160) NOT NULL DEFAULT 'For Customer',
  right_signature_label VARCHAR(160) NOT NULL DEFAULT 'For Organisation',
  company_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_by UUID NULL,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, certificate_no)
);

ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS project_id UUID NULL;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS po_id UUID NULL;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS invoice_id UUID NULL;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS certificate_no VARCHAR(80);
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS certificate_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS completion_date DATE;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS client_gstin VARCHAR(40);
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS client_state VARCHAR(120);
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS body_intro TEXT;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS clauses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS output_format VARCHAR(20) DEFAULT 'letterhead';
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT TRUE;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS left_signature_label VARCHAR(160) DEFAULT 'For Customer';
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS right_signature_label VARCHAR(160) DEFAULT 'For Organisation';
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS company_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS client_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'draft';
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS updated_by UUID;
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.work_completion_certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.work_completion_certificate_counters (
  organisation_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  next_number INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wcc_organisation ON public.work_completion_certificates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_wcc_client ON public.work_completion_certificates(organisation_id, client_id);
CREATE INDEX IF NOT EXISTS idx_wcc_po ON public.work_completion_certificates(organisation_id, po_id);
CREATE INDEX IF NOT EXISTS idx_wcc_invoice ON public.work_completion_certificates(organisation_id, invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS work_completion_certificates_org_no_uidx ON public.work_completion_certificates(organisation_id, certificate_no);

CREATE OR REPLACE FUNCTION public.wcc_is_org_member(p_organisation_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.user_organisations uo
      WHERE uo.user_id = auth.uid()
        AND uo.organisation_id = p_organisation_id
        AND LOWER(COALESCE(uo.status, 'active')) = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.organisation_id = p_organisation_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.wcc_has_org_permission(p_organisation_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.user_organisations uo
      WHERE uo.user_id = auth.uid()
        AND uo.organisation_id = p_organisation_id
        AND LOWER(COALESCE(uo.status, 'active')) = 'active'
        AND LOWER(COALESCE(uo.role, 'member')) = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.organisation_id = p_organisation_id
        AND (
          LOWER(COALESCE(om.role, 'member')) = 'admin'
          OR EXISTS (
            SELECT 1
            FROM public.role_permissions rp
            WHERE rp.role_id = om.role_id
              AND rp.permission_key = p_permission_key
          )
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.wcc_is_org_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wcc_has_org_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wcc_is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wcc_has_org_permission(UUID, TEXT) TO authenticated;

INSERT INTO public.permissions (key, description)
VALUES
  ('work_completion.read', 'View Work Completion Certificates'),
  ('work_completion.create', 'Create Work Completion Certificates'),
  ('work_completion.update', 'Edit draft Work Completion Certificates'),
  ('work_completion.delete', 'Delete draft Work Completion Certificates')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.work_completion_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_completion_certificate_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_completion_certificate_counters FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "work_completion_certificates_org_access" ON public.work_completion_certificates;
DROP POLICY IF EXISTS work_completion_select ON public.work_completion_certificates;
DROP POLICY IF EXISTS work_completion_insert ON public.work_completion_certificates;
DROP POLICY IF EXISTS work_completion_update ON public.work_completion_certificates;
DROP POLICY IF EXISTS work_completion_delete ON public.work_completion_certificates;

CREATE POLICY work_completion_select
  ON public.work_completion_certificates FOR SELECT TO authenticated
  USING (public.wcc_has_org_permission(organisation_id, 'work_completion.read'));

-- Direct table writes are deliberately denied. The RPCs below are the only write boundary.
REVOKE INSERT, UPDATE, DELETE ON public.work_completion_certificates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.work_completion_certificates TO authenticated;

CREATE OR REPLACE FUNCTION public.wcc_validate_clauses(p_clauses JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clause JSONB;
BEGIN
  IF p_clauses IS NULL OR jsonb_typeof(p_clauses) <> 'array' OR jsonb_array_length(p_clauses) > 25 THEN
    RETURN FALSE;
  END IF;
  FOR v_clause IN SELECT value FROM jsonb_array_elements(p_clauses) LOOP
    IF jsonb_typeof(v_clause) <> 'string' OR length(v_clause #>> '{}') > 2000 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.wcc_validate_clauses(JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_work_completion_certificate(
  p_organisation_id UUID,
  p_client_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_po_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_certificate_date DATE DEFAULT CURRENT_DATE,
  p_completion_date DATE DEFAULT CURRENT_DATE,
  p_work_name TEXT DEFAULT NULL,
  p_po_number TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_body_intro TEXT DEFAULT NULL,
  p_clauses JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_output_format TEXT DEFAULT 'letterhead',
  p_show_logo BOOLEAN DEFAULT TRUE,
  p_footer_text TEXT DEFAULT NULL,
  p_left_signature_label TEXT DEFAULT 'For Customer',
  p_right_signature_label TEXT DEFAULT 'For Organisation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_client RECORD;
  v_project RECORD;
  v_po RECORD;
  v_invoice RECORD;
  v_org RECORD;
  v_next_number INTEGER;
  v_certificate_id UUID;
  v_certificate_no TEXT;
  v_client_snapshot JSONB;
  v_company_snapshot JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.wcc_has_org_permission(p_organisation_id, 'work_completion.create') THEN
    RAISE EXCEPTION 'Work Completion create permission required';
  END IF;
  IF p_client_id IS NULL THEN RAISE EXCEPTION 'Client is required'; END IF;
  IF p_work_name IS NULL OR length(btrim(p_work_name)) = 0 OR length(p_work_name) > 500 THEN
    RAISE EXCEPTION 'Work name is required and must be at most 500 characters';
  END IF;
  IF p_completion_date IS NULL OR p_certificate_date IS NULL THEN RAISE EXCEPTION 'Certificate and completion dates are required'; END IF;
  IF p_output_format NOT IN ('letterhead', 'simple_a4') THEN RAISE EXCEPTION 'Invalid output format'; END IF;
  IF NOT public.wcc_validate_clauses(p_clauses) THEN RAISE EXCEPTION 'Invalid certificate clauses'; END IF;
  IF length(COALESCE(p_body_intro, '')) > 5000 OR length(COALESCE(p_notes, '')) > 5000 OR length(COALESCE(p_footer_text, '')) > 2000 THEN
    RAISE EXCEPTION 'Certificate text exceeds allowed length';
  END IF;
  IF length(COALESCE(p_po_number, '')) > 120 OR length(COALESCE(p_invoice_number, '')) > 120 THEN
    RAISE EXCEPTION 'Reference number exceeds allowed length';
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found in organisation'; END IF;

  IF p_project_id IS NOT NULL THEN
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id AND organisation_id = p_organisation_id;
    IF v_project IS NULL THEN RAISE EXCEPTION 'Project not found in organisation'; END IF;
    IF v_project.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'Project does not belong to selected client'; END IF;
  END IF;

  IF p_po_id IS NOT NULL THEN
    SELECT * INTO v_po FROM public.client_purchase_orders WHERE id = p_po_id AND organisation_id = p_organisation_id;
    IF v_po IS NULL THEN RAISE EXCEPTION 'Purchase order not found in organisation'; END IF;
    IF v_po.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'Purchase order does not belong to selected client'; END IF;
  END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND organisation_id = p_organisation_id;
    IF v_invoice IS NULL THEN RAISE EXCEPTION 'Invoice not found in organisation'; END IF;
    IF v_invoice.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'Invoice does not belong to selected client'; END IF;
  END IF;

  SELECT * INTO v_org FROM public.organisations WHERE id = p_organisation_id;
  v_client_snapshot := jsonb_build_object(
    'id', v_client.id,
    'name', v_client.client_name,
    'gstin', v_client.gstin,
    'state', v_client.state,
    'address1', v_client.address1,
    'address2', v_client.address2,
    'city', v_client.city,
    'pincode', v_client.pincode,
    'contact', v_client.contact,
    'email', v_client.email
  );
  v_company_snapshot := to_jsonb(v_org) - ARRAY['bank_account_name', 'bank_account_number', 'bank_ifsc', 'bank_name', 'upi_id'];

  INSERT INTO public.work_completion_certificate_counters (organisation_id, next_number)
  VALUES (p_organisation_id, 1)
  ON CONFLICT (organisation_id) DO NOTHING;
  UPDATE public.work_completion_certificate_counters
  SET next_number = next_number + 1, updated_at = NOW()
  WHERE organisation_id = p_organisation_id
  RETURNING next_number - 1 INTO v_next_number;
  v_certificate_no := 'WCC-' || EXTRACT(YEAR FROM p_certificate_date)::TEXT || '-' || lpad(v_next_number::TEXT, 5, '0');

  INSERT INTO public.work_completion_certificates (
    organisation_id, certificate_no, certificate_date, completion_date, client_id, project_id, po_id, invoice_id,
    work_name, po_number, invoice_number, client_address, client_gstin, client_state, body_intro, clauses, notes,
    output_format, show_logo, footer_text, left_signature_label, right_signature_label, company_snapshot, client_snapshot,
    status, created_by, updated_by
  ) VALUES (
    p_organisation_id, v_certificate_no, p_certificate_date, p_completion_date, v_client.id, p_project_id, p_po_id, p_invoice_id,
    btrim(p_work_name), NULLIF(btrim(p_po_number), ''), NULLIF(btrim(p_invoice_number), ''),
    concat_ws(', ', NULLIF(v_client.address1, ''), NULLIF(v_client.address2, ''), NULLIF(v_client.city, ''), NULLIF(v_client.state, ''), NULLIF(v_client.pincode, '')),
    v_client.gstin, v_client.state, COALESCE(p_body_intro, ''), p_clauses, p_notes,
    p_output_format, COALESCE(p_show_logo, TRUE), p_footer_text, COALESCE(NULLIF(btrim(p_left_signature_label), ''), 'For Customer'),
    COALESCE(NULLIF(btrim(p_right_signature_label), ''), 'For Organisation'), v_company_snapshot, v_client_snapshot,
    'draft', v_user_id, v_user_id
  ) RETURNING id INTO v_certificate_id;

  RETURN jsonb_build_object('certificate_id', v_certificate_id, 'certificate_no', v_certificate_no, 'status', 'draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_work_completion_certificate(
  p_certificate_id UUID,
  p_client_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_po_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_certificate_date DATE DEFAULT NULL,
  p_completion_date DATE DEFAULT NULL,
  p_work_name TEXT DEFAULT NULL,
  p_po_number TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_body_intro TEXT DEFAULT NULL,
  p_clauses JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_output_format TEXT DEFAULT 'letterhead',
  p_show_logo BOOLEAN DEFAULT TRUE,
  p_footer_text TEXT DEFAULT NULL,
  p_left_signature_label TEXT DEFAULT 'For Customer',
  p_right_signature_label TEXT DEFAULT 'For Organisation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_client RECORD;
  v_project RECORD;
  v_po RECORD;
  v_invoice RECORD;
  v_org RECORD;
  v_client_snapshot JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_existing FROM public.work_completion_certificates WHERE id = p_certificate_id FOR UPDATE;
  IF v_existing IS NULL THEN RAISE EXCEPTION 'Certificate not found'; END IF;
  IF NOT public.wcc_has_org_permission(v_existing.organisation_id, 'work_completion.update') THEN
    RAISE EXCEPTION 'Work Completion update permission required';
  END IF;
  IF v_existing.status <> 'draft' THEN RAISE EXCEPTION 'Only draft certificates can be updated'; END IF;
  IF p_work_name IS NULL OR length(btrim(p_work_name)) = 0 OR length(p_work_name) > 500 THEN RAISE EXCEPTION 'Work name is required and must be at most 500 characters'; END IF;
  IF p_certificate_date IS NULL OR p_completion_date IS NULL THEN RAISE EXCEPTION 'Certificate and completion dates are required'; END IF;
  IF p_output_format NOT IN ('letterhead', 'simple_a4') THEN RAISE EXCEPTION 'Invalid output format'; END IF;
  IF NOT public.wcc_validate_clauses(p_clauses) THEN RAISE EXCEPTION 'Invalid certificate clauses'; END IF;
  IF length(COALESCE(p_body_intro, '')) > 5000 OR length(COALESCE(p_notes, '')) > 5000 OR length(COALESCE(p_footer_text, '')) > 2000 THEN RAISE EXCEPTION 'Certificate text exceeds allowed length'; END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = v_existing.organisation_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found in organisation'; END IF;
  IF p_project_id IS NOT NULL THEN
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id AND organisation_id = v_existing.organisation_id;
    IF v_project IS NULL THEN RAISE EXCEPTION 'Project not found in organisation'; END IF;
    IF v_project.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'Project does not belong to selected client'; END IF;
  END IF;
  IF p_po_id IS NOT NULL THEN
    SELECT * INTO v_po FROM public.client_purchase_orders WHERE id = p_po_id AND organisation_id = v_existing.organisation_id;
    IF v_po IS NULL OR v_po.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'Purchase order does not belong to selected client'; END IF;
  END IF;
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND organisation_id = v_existing.organisation_id;
    IF v_invoice IS NULL OR v_invoice.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'Invoice does not belong to selected client'; END IF;
  END IF;

  SELECT * INTO v_org FROM public.organisations WHERE id = v_existing.organisation_id;
  v_client_snapshot := jsonb_build_object(
    'id', v_client.id, 'name', v_client.client_name, 'gstin', v_client.gstin, 'state', v_client.state,
    'address1', v_client.address1, 'address2', v_client.address2, 'city', v_client.city, 'pincode', v_client.pincode,
    'contact', v_client.contact, 'email', v_client.email
  );

  UPDATE public.work_completion_certificates
  SET client_id = v_client.id,
      project_id = p_project_id,
      po_id = p_po_id,
      invoice_id = p_invoice_id,
      certificate_date = p_certificate_date,
      completion_date = p_completion_date,
      work_name = btrim(p_work_name),
      po_number = NULLIF(btrim(p_po_number), ''),
      invoice_number = NULLIF(btrim(p_invoice_number), ''),
      client_address = concat_ws(', ', NULLIF(v_client.address1, ''), NULLIF(v_client.address2, ''), NULLIF(v_client.city, ''), NULLIF(v_client.state, ''), NULLIF(v_client.pincode, '')),
      client_gstin = v_client.gstin,
      client_state = v_client.state,
      body_intro = COALESCE(p_body_intro, ''), clauses = p_clauses, notes = p_notes,
      output_format = p_output_format, show_logo = COALESCE(p_show_logo, TRUE), footer_text = p_footer_text,
      left_signature_label = COALESCE(NULLIF(btrim(p_left_signature_label), ''), 'For Customer'),
      right_signature_label = COALESCE(NULLIF(btrim(p_right_signature_label), ''), 'For Organisation'),
      company_snapshot = to_jsonb(v_org) - ARRAY['bank_account_name', 'bank_account_number', 'bank_ifsc', 'bank_name', 'upi_id'], client_snapshot = v_client_snapshot, updated_by = v_user_id, updated_at = NOW()
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object('certificate_id', p_certificate_id, 'certificate_no', v_existing.certificate_no, 'status', v_existing.status);
END;
$$;

REVOKE ALL ON FUNCTION public.create_work_completion_certificate(UUID, UUID, UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_work_completion_certificate(UUID, UUID, UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_work_completion_certificate(UUID, UUID, UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_work_completion_certificate(UUID, UUID, UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_work_completion_certificate_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_completion_certificates_updated_at ON public.work_completion_certificates;
CREATE TRIGGER work_completion_certificates_updated_at
BEFORE UPDATE ON public.work_completion_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_work_completion_certificate_timestamp();
