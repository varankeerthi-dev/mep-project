-- ====================================================================
-- PHASE 4: CROSS-TENANT SHARING & TENANT LINKING
-- ====================================================================
-- Migration: 20261103050000_phase4_cross_tenant_sharing.sql
-- Purpose:
--   1. Bilateral tenant linking (labour_tenant_links) between labour contractor (Org B)
--      and client / EPC tenant (Org A), requiring mutual acceptance.
--   2. Attendance submission batch (labour_attendance_shares) & inbox (labour_share_inbox).
--   3. Data sanitization: only date, trade, headcount, hours, worker names, project ref.
--      Never leaks rates, wages, margin, other clients' data, or payout_ref.
--   4. RLS scoping: strictly isolated by tenant; receiver sees items ONLY when link is accepted.
--      Revoking the link stops submissions and hides inbox from receiver.
--   5. Review RPC: review_shared_attendance approves or disputes with reason.
--      Approving automatically creates an attendance row in receiver's manpower_attendance
--      with receiver's own server-resolved rate card for vendor (zero re-entry).
--   6. Full audit logging on all link and share actions.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.v_labour_share_inbox CASCADE;
--   DROP FUNCTION IF EXISTS public.review_shared_attendance(uuid, uuid, text, text, uuid, uuid) CASCADE;
--   DROP FUNCTION IF EXISTS public.submit_shared_attendance(uuid, uuid, uuid[], text) CASCADE;
--   DROP FUNCTION IF EXISTS public.revoke_tenant_link(uuid, uuid, text) CASCADE;
--   DROP FUNCTION IF EXISTS public.accept_tenant_link(uuid, uuid, uuid) CASCADE;
--   DROP FUNCTION IF EXISTS public.request_tenant_link(uuid, uuid, uuid) CASCADE;
--   DROP TABLE IF EXISTS public.labour_share_inbox CASCADE;
--   DROP TABLE IF EXISTS public.labour_attendance_shares CASCADE;
--   DROP TABLE IF EXISTS public.labour_tenant_links CASCADE;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS shared_ref;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS source_share_item_id;
-- ====================================================================

-- 1. Extend manpower_attendance with shared_ref and source_share_item_id
ALTER TABLE public.manpower_attendance
  ADD COLUMN IF NOT EXISTS shared_ref uuid,
  ADD COLUMN IF NOT EXISTS source_share_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_manpower_attendance_shared_ref
  ON public.manpower_attendance(shared_ref)
  WHERE shared_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manpower_attendance_source_share_item
  ON public.manpower_attendance(source_share_item_id)
  WHERE source_share_item_id IS NOT NULL;

-- 2. Create labour_tenant_links table
CREATE TABLE IF NOT EXISTS public.labour_tenant_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  receiver_org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  initiator_party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
  receiver_party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT chk_diff_tenants CHECK (initiator_org_id != receiver_org_id),
  CONSTRAINT uq_tenant_links_pair UNIQUE (initiator_org_id, receiver_org_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_links_initiator ON public.labour_tenant_links(initiator_org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_links_receiver ON public.labour_tenant_links(receiver_org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_links_status ON public.labour_tenant_links(status);

-- Enable RLS on labour_tenant_links
ALTER TABLE public.labour_tenant_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_tenant_links FORCE ROW LEVEL SECURITY;
GRANT ALL ON public.labour_tenant_links TO authenticated;

DROP POLICY IF EXISTS p_tenant_links_select ON public.labour_tenant_links;
CREATE POLICY p_tenant_links_select ON public.labour_tenant_links
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_org(initiator_org_id) OR
    public.user_can_access_org(receiver_org_id)
  );

DROP POLICY IF EXISTS p_tenant_links_insert ON public.labour_tenant_links;
CREATE POLICY p_tenant_links_insert ON public.labour_tenant_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_org(initiator_org_id)
  );

DROP POLICY IF EXISTS p_tenant_links_update ON public.labour_tenant_links;
CREATE POLICY p_tenant_links_update ON public.labour_tenant_links
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_org(initiator_org_id) OR
    public.user_can_access_org(receiver_org_id)
  );

-- 3. Create labour_attendance_shares (Submission batch)
CREATE TABLE IF NOT EXISTS public.labour_attendance_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  receiver_org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.labour_tenant_links(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'partially_reviewed', 'reviewed', 'cancelled')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_shares_sender ON public.labour_attendance_shares(sender_org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shares_receiver ON public.labour_attendance_shares(receiver_org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shares_link ON public.labour_attendance_shares(link_id);

-- Enable RLS on labour_attendance_shares
ALTER TABLE public.labour_attendance_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_attendance_shares FORCE ROW LEVEL SECURITY;
GRANT ALL ON public.labour_attendance_shares TO authenticated;

DROP POLICY IF EXISTS p_attendance_shares_select ON public.labour_attendance_shares;
CREATE POLICY p_attendance_shares_select ON public.labour_attendance_shares
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_org(sender_org_id) OR (
      public.user_can_access_org(receiver_org_id) AND
      EXISTS (
        SELECT 1 FROM public.labour_tenant_links l
        WHERE l.id = labour_attendance_shares.link_id
          AND l.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS p_attendance_shares_insert ON public.labour_attendance_shares;
CREATE POLICY p_attendance_shares_insert ON public.labour_attendance_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_org(sender_org_id)
  );

DROP POLICY IF EXISTS p_attendance_shares_update ON public.labour_attendance_shares;
CREATE POLICY p_attendance_shares_update ON public.labour_attendance_shares
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_org(sender_org_id) OR
    public.user_can_access_org(receiver_org_id)
  );

-- 4. Create labour_share_inbox (Individual shared rows, strictly sanitized)
CREATE TABLE IF NOT EXISTS public.labour_share_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.labour_attendance_shares(id) ON DELETE CASCADE,
  sender_org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  receiver_org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.labour_tenant_links(id) ON DELETE CASCADE,
  sender_attendance_id uuid NOT NULL REFERENCES public.manpower_attendance(id) ON DELETE CASCADE,
  
  -- Sanitized payload: NO financial or wage data
  attendance_date date NOT NULL,
  project_name_ref text,
  trade text NOT NULL,
  headcount integer NOT NULL CHECK (headcount > 0),
  hours_worked numeric(6,2) NOT NULL DEFAULT 8.0 CHECK (hours_worked > 0),
  worker_names text[] DEFAULT '{}'::text[],
  supervisor_notes text,
  
  -- Receiver review state
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disputed')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  receiver_attendance_id uuid REFERENCES public.manpower_attendance(id) ON DELETE SET NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_share_inbox_item UNIQUE (share_id, sender_attendance_id)
);

CREATE INDEX IF NOT EXISTS idx_share_inbox_receiver ON public.labour_share_inbox(receiver_org_id);
CREATE INDEX IF NOT EXISTS idx_share_inbox_sender ON public.labour_share_inbox(sender_org_id);
CREATE INDEX IF NOT EXISTS idx_share_inbox_status ON public.labour_share_inbox(status);
CREATE INDEX IF NOT EXISTS idx_share_inbox_date ON public.labour_share_inbox(attendance_date);

-- Enable RLS on labour_share_inbox
ALTER TABLE public.labour_share_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_share_inbox FORCE ROW LEVEL SECURITY;
GRANT ALL ON public.labour_share_inbox TO authenticated;
GRANT SELECT ON public.v_labour_share_inbox TO authenticated;

DROP POLICY IF EXISTS p_share_inbox_select ON public.labour_share_inbox;
CREATE POLICY p_share_inbox_select ON public.labour_share_inbox
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_org(sender_org_id) OR (
      public.user_can_access_org(receiver_org_id) AND
      EXISTS (
        SELECT 1 FROM public.labour_tenant_links l
        WHERE l.id = labour_share_inbox.link_id
          AND l.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS p_share_inbox_insert ON public.labour_share_inbox;
CREATE POLICY p_share_inbox_insert ON public.labour_share_inbox
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_org(sender_org_id)
  );

DROP POLICY IF EXISTS p_share_inbox_update ON public.labour_share_inbox;
CREATE POLICY p_share_inbox_update ON public.labour_share_inbox
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_org(sender_org_id) OR
    public.user_can_access_org(receiver_org_id)
  );

-- 5. Helper View for Inbox Display
CREATE OR REPLACE VIEW public.v_labour_share_inbox AS
SELECT
  i.id,
  i.share_id,
  i.sender_org_id,
  o_sender.name AS sender_org_name,
  i.receiver_org_id,
  o_receiver.name AS receiver_org_name,
  i.link_id,
  i.attendance_date,
  i.project_name_ref,
  i.trade,
  i.headcount,
  i.hours_worked,
  i.worker_names,
  i.supervisor_notes,
  i.status,
  i.review_notes,
  i.reviewed_by,
  i.reviewed_at,
  i.receiver_attendance_id,
  i.created_at
FROM public.labour_share_inbox i
JOIN public.organisations o_sender ON o_sender.id = i.sender_org_id
JOIN public.organisations o_receiver ON o_receiver.id = i.receiver_org_id;

-- 6. RPC: request_tenant_link
CREATE OR REPLACE FUNCTION public.request_tenant_link(
  p_initiator_org_id uuid,
  p_receiver_org_id uuid,
  p_initiator_party_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link_id uuid;
  v_existing record;
BEGIN
  IF p_initiator_org_id = p_receiver_org_id THEN
    RAISE EXCEPTION 'Cannot link an organisation to itself';
  END IF;

  IF NOT public.user_can_access_org(p_initiator_org_id) THEN
    RAISE EXCEPTION 'Access denied to initiator organisation %', p_initiator_org_id;
  END IF;

  SELECT * INTO v_existing
  FROM public.labour_tenant_links
  WHERE initiator_org_id = p_initiator_org_id AND receiver_org_id = p_receiver_org_id;

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', true, 'link_id', v_existing.id, 'status', 'accepted', 'message', 'Link already accepted');
    END IF;

    UPDATE public.labour_tenant_links
    SET status = 'pending',
        initiator_party_id = COALESCE(p_initiator_party_id, initiator_party_id),
        created_by = auth.uid(),
        created_at = now(),
        revoked_at = NULL,
        revoke_reason = NULL
    WHERE id = v_existing.id
    RETURNING id INTO v_link_id;
  ELSE
    INSERT INTO public.labour_tenant_links (
      initiator_org_id,
      receiver_org_id,
      initiator_party_id,
      status,
      created_by
    ) VALUES (
      p_initiator_org_id,
      p_receiver_org_id,
      p_initiator_party_id,
      'pending',
      auth.uid()
    )
    RETURNING id INTO v_link_id;
  END IF;

  INSERT INTO public.labour_audit_log (
    organisation_id,
    table_name,
    row_id,
    action,
    old_data,
    new_data,
    actor_id
  ) VALUES (
    p_initiator_org_id,
    'labour_tenant_links',
    v_link_id,
    'LINK_REQUEST',
    NULL,
    jsonb_build_object('link_id', v_link_id, 'receiver_org_id', p_receiver_org_id),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'link_id', v_link_id, 'status', 'pending');
END;
$$;

-- 7. RPC: accept_tenant_link
CREATE OR REPLACE FUNCTION public.accept_tenant_link(
  p_link_id uuid,
  p_receiver_org_id uuid,
  p_receiver_party_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link record;
BEGIN
  SELECT * INTO v_link
  FROM public.labour_tenant_links
  WHERE id = p_link_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant link % not found', p_link_id;
  END IF;

  IF v_link.receiver_org_id != p_receiver_org_id THEN
    RAISE EXCEPTION 'Organisation % is not the receiver for this link', p_receiver_org_id;
  END IF;

  IF NOT public.user_can_access_org(p_receiver_org_id) THEN
    RAISE EXCEPTION 'Access denied to receiver organisation %', p_receiver_org_id;
  END IF;

  UPDATE public.labour_tenant_links
  SET status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      receiver_party_id = COALESCE(p_receiver_party_id, receiver_party_id)
  WHERE id = p_link_id;

  INSERT INTO public.labour_audit_log (
    organisation_id,
    table_name,
    row_id,
    action,
    old_data,
    new_data,
    actor_id
  ) VALUES (
    p_receiver_org_id,
    'labour_tenant_links',
    p_link_id,
    'LINK_ACCEPT',
    jsonb_build_object('status', v_link.status),
    jsonb_build_object('status', 'accepted', 'receiver_party_id', p_receiver_party_id),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'link_id', p_link_id, 'status', 'accepted');
END;
$$;

-- 8. RPC: revoke_tenant_link
CREATE OR REPLACE FUNCTION public.revoke_tenant_link(
  p_link_id uuid,
  p_org_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link record;
BEGIN
  SELECT * INTO v_link
  FROM public.labour_tenant_links
  WHERE id = p_link_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant link % not found', p_link_id;
  END IF;

  IF v_link.initiator_org_id != p_org_id AND v_link.receiver_org_id != p_org_id THEN
    RAISE EXCEPTION 'Organisation % is not a participant in this link', p_org_id;
  END IF;

  IF NOT public.user_can_access_org(p_org_id) THEN
    RAISE EXCEPTION 'Access denied to organisation %', p_org_id;
  END IF;

  UPDATE public.labour_tenant_links
  SET status = 'revoked',
      revoked_by = auth.uid(),
      revoked_at = now(),
      revoke_reason = p_reason
  WHERE id = p_link_id;

  INSERT INTO public.labour_audit_log (
    organisation_id,
    table_name,
    row_id,
    action,
    old_data,
    new_data,
    actor_id
  ) VALUES (
    p_org_id,
    'labour_tenant_links',
    p_link_id,
    'LINK_REVOKE',
    jsonb_build_object('status', v_link.status),
    jsonb_build_object('status', 'revoked', 'reason', p_reason),
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'link_id', p_link_id, 'status', 'revoked');
END;
$$;

-- 9. RPC: submit_shared_attendance
CREATE OR REPLACE FUNCTION public.submit_shared_attendance(
  p_link_id uuid,
  p_sender_org_id uuid,
  p_attendance_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link record;
  v_receiver_org_id uuid;
  v_share_id uuid;
  v_att record;
  v_trade text;
  v_proj_name text;
  v_worker_names text[];
  v_w_name text;
  v_item_count integer := 0;
BEGIN
  IF NOT public.user_can_access_org(p_sender_org_id) THEN
    RAISE EXCEPTION 'Access denied to sender organisation %', p_sender_org_id;
  END IF;

  SELECT * INTO v_link
  FROM public.labour_tenant_links
  WHERE id = p_link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant link % not found', p_link_id;
  END IF;

  IF v_link.status != 'accepted' THEN
    RAISE EXCEPTION 'Tenant link is not active (current status: %)', v_link.status;
  END IF;

  IF v_link.initiator_org_id = p_sender_org_id THEN
    v_receiver_org_id := v_link.receiver_org_id;
  ELSIF v_link.receiver_org_id = p_sender_org_id THEN
    v_receiver_org_id := v_link.initiator_org_id;
  ELSE
    RAISE EXCEPTION 'Organisation % is not part of this tenant link', p_sender_org_id;
  END IF;

  IF p_attendance_ids IS NULL OR cardinality(p_attendance_ids) = 0 THEN
    RAISE EXCEPTION 'No attendance IDs provided for submission';
  END IF;

  -- Create batch header
  INSERT INTO public.labour_attendance_shares (
    sender_org_id,
    receiver_org_id,
    link_id,
    status,
    submitted_by,
    notes
  ) VALUES (
    p_sender_org_id,
    v_receiver_org_id,
    p_link_id,
    'submitted',
    auth.uid(),
    p_notes
  )
  RETURNING id INTO v_share_id;

  -- Process each attendance row
  FOR v_att IN
    SELECT a.*
    FROM public.manpower_attendance a
    WHERE a.id = ANY(p_attendance_ids)
      AND a.organisation_id = p_sender_org_id
    FOR UPDATE
  LOOP
    IF v_att.status != 'APPROVED' THEN
      RAISE EXCEPTION 'Attendance record % is not APPROVED (status: %)', v_att.id, v_att.status;
    END IF;

    -- Resolve trade name
    SELECT name INTO v_trade
    FROM public.labour_categories
    WHERE id = v_att.labour_category_id;
    IF v_trade IS NULL THEN
      v_trade := 'General Labour';
    END IF;

    -- Resolve project name ref
    v_proj_name := NULL;
    IF v_att.project_id IS NOT NULL THEN
      SELECT COALESCE(project_name, name, 'Project Site') INTO v_proj_name
      FROM public.projects
      WHERE id = v_att.project_id;
    END IF;

    -- Resolve worker display names (NEVER ids, bank details or payout refs)
    v_worker_names := '{}'::text[];
    IF v_att.worker_id IS NOT NULL THEN
      SELECT name INTO v_w_name FROM public.labour_workers WHERE id = v_att.worker_id;
      IF v_w_name IS NOT NULL THEN v_worker_names := ARRAY[v_w_name]; END IF;
    ELSIF v_att.employee_id IS NOT NULL THEN
      SELECT name INTO v_w_name FROM public.employees WHERE id = v_att.employee_id;
      IF v_w_name IS NOT NULL THEN v_worker_names := ARRAY[v_w_name]; END IF;
    END IF;

    -- Insert sanitized row into inbox
    INSERT INTO public.labour_share_inbox (
      share_id,
      sender_org_id,
      receiver_org_id,
      link_id,
      sender_attendance_id,
      attendance_date,
      project_name_ref,
      trade,
      headcount,
      hours_worked,
      worker_names,
      supervisor_notes,
      status
    ) VALUES (
      v_share_id,
      p_sender_org_id,
      v_receiver_org_id,
      p_link_id,
      v_att.id,
      v_att.attendance_date,
      v_proj_name,
      v_trade,
      v_att.workers_count,
      COALESCE(v_att.hours_worked, 8.0),
      v_worker_names,
      v_att.remarks,
      'pending'
    )
    ON CONFLICT (share_id, sender_attendance_id) DO NOTHING;

    -- Mark shared_ref on sender row
    UPDATE public.manpower_attendance
    SET shared_ref = v_share_id
    WHERE id = v_att.id;

    v_item_count := v_item_count + 1;
  END LOOP;

  INSERT INTO public.labour_audit_log (
    organisation_id,
    table_name,
    row_id,
    action,
    old_data,
    new_data,
    actor_id
  ) VALUES (
    p_sender_org_id,
    'labour_attendance_shares',
    v_share_id,
    'SHARE_SUBMIT',
    NULL,
    jsonb_build_object('share_id', v_share_id, 'receiver_org_id', v_receiver_org_id, 'items_count', v_item_count),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'share_id', v_share_id,
    'items_count', v_item_count,
    'receiver_org_id', v_receiver_org_id
  );
END;
$$;

-- 10. RPC: review_shared_attendance
CREATE OR REPLACE FUNCTION public.review_shared_attendance(
  p_item_id uuid,
  p_receiver_org_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_work_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_link record;
  v_subcontractor_id uuid;
  v_category_id uuid;
  v_resolved_rate numeric(12,2);
  v_total_amount numeric(12,2);
  v_new_att_id uuid;
  v_base_hours numeric(6,2);
BEGIN
  IF NOT public.user_can_access_org(p_receiver_org_id) THEN
    RAISE EXCEPTION 'Access denied to receiver organisation %', p_receiver_org_id;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'disputed') THEN
    RAISE EXCEPTION 'Invalid decision %. Must be approved, rejected, or disputed', p_decision;
  END IF;

  IF p_decision IN ('rejected', 'disputed') AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'A reason is required when rejecting or disputing attendance';
  END IF;

  SELECT * INTO v_item
  FROM public.labour_share_inbox
  WHERE id = p_item_id AND receiver_org_id = p_receiver_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared inbox item % not found for receiver org %', p_item_id, p_receiver_org_id;
  END IF;

  IF v_item.status = 'approved' THEN
    RAISE EXCEPTION 'Shared inbox item % has already been approved', p_item_id;
  END IF;

  SELECT * INTO v_link
  FROM public.labour_tenant_links
  WHERE id = v_item.link_id;

  IF NOT FOUND OR v_link.status != 'accepted' THEN
    RAISE EXCEPTION 'Tenant link is no longer active';
  END IF;

  IF p_decision = 'approved' THEN
    -- 1. Resolve subcontractor record for sender inside receiver org
    IF v_link.receiver_party_id IS NOT NULL THEN
      SELECT id INTO v_subcontractor_id
      FROM public.subcontractors
      WHERE organisation_id = p_receiver_org_id
        AND (party_id = v_link.receiver_party_id OR id = v_link.receiver_party_id);
    END IF;

    -- If not linked by party, find first matching subcontractor or create a proxy
    IF v_subcontractor_id IS NULL THEN
      SELECT s.id INTO v_subcontractor_id
      FROM public.subcontractors s
      JOIN public.organisations o ON o.id = v_item.sender_org_id
      WHERE s.organisation_id = p_receiver_org_id
        AND LOWER(s.company_name) = LOWER(o.name)
      LIMIT 1;
    END IF;

    IF v_subcontractor_id IS NULL THEN
      -- Find any active subcontractor or create default proxy
      SELECT id INTO v_subcontractor_id
      FROM public.subcontractors
      WHERE organisation_id = p_receiver_org_id
      ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 2. Resolve labour category in receiver org matching trade
    SELECT id INTO v_category_id
    FROM public.labour_categories
    WHERE organisation_id = p_receiver_org_id
      AND LOWER(name) = LOWER(v_item.trade)
      AND is_active = true
    LIMIT 1;

    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id
      FROM public.labour_categories
      WHERE organisation_id = p_receiver_org_id
        AND is_active = true
      ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 3. Resolve rate strictly server-side using receiver org's rate card!
    v_resolved_rate := NULL;
    IF v_category_id IS NOT NULL THEN
      BEGIN
        v_resolved_rate := public.resolve_labour_rate(
          p_receiver_org_id,
          v_subcontractor_id,
          v_category_id,
          p_project_id,
          v_item.attendance_date
        );
      EXCEPTION WHEN OTHERS THEN
        v_resolved_rate := NULL;
      END;

      IF v_resolved_rate IS NULL THEN
        SELECT base_rate INTO v_resolved_rate
        FROM public.labour_categories
        WHERE id = v_category_id;
      END IF;
    END IF;

    IF v_resolved_rate IS NULL OR v_resolved_rate <= 0 THEN
      RAISE EXCEPTION 'Could not resolve rate in receiver organisation for trade %', v_item.trade;
    END IF;

    v_base_hours := COALESCE(v_item.hours_worked, 8.0);
    v_total_amount := ROUND((v_item.headcount * (v_base_hours / 8.0) * v_resolved_rate), 2);

    -- 4. Create approved attendance row in receiver's manpower_attendance
    INSERT INTO public.manpower_attendance (
      organisation_id,
      subcontractor_id,
      project_id,
      labour_category_id,
      attendance_date,
      workers_count,
      hours_worked,
      base_rate,
      original_amount,
      adjusted_rate,
      adjusted_amount,
      status,
      approved_by,
      approved_at,
      source,
      source_share_item_id,
      remarks
    ) VALUES (
      p_receiver_org_id,
      v_subcontractor_id,
      p_project_id,
      v_category_id,
      v_item.attendance_date,
      v_item.headcount,
      v_base_hours,
      v_resolved_rate,
      v_total_amount,
      v_resolved_rate,
      v_total_amount,
      'APPROVED',
      auth.uid(),
      now(),
      'shared_inbox',
      v_item.id,
      COALESCE(v_item.supervisor_notes, 'Approved from shared contractor attendance')
    )
    RETURNING id INTO v_new_att_id;

    -- Update inbox item
    UPDATE public.labour_share_inbox
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_reason,
        receiver_attendance_id = v_new_att_id,
        updated_at = now()
    WHERE id = p_item_id;

    INSERT INTO public.labour_audit_log (
      organisation_id,
      table_name,
      row_id,
      action,
      old_data,
      new_data,
      actor_id
    ) VALUES (
      p_receiver_org_id,
      'manpower_attendance',
      v_new_att_id,
      'SHARE_REVIEW_APPROVE',
      jsonb_build_object('inbox_item_id', p_item_id),
      jsonb_build_object('created_attendance_id', v_new_att_id, 'amount', v_total_amount, 'rate', v_resolved_rate),
      auth.uid()
    );

  ELSIF p_decision = 'disputed' THEN
    UPDATE public.labour_share_inbox
    SET status = 'disputed',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_reason,
        updated_at = now()
    WHERE id = p_item_id;

    INSERT INTO public.labour_audit_log (
      organisation_id,
      table_name,
      row_id,
      action,
      old_data,
      new_data,
      actor_id
    ) VALUES (
      p_receiver_org_id,
      'labour_share_inbox',
      p_item_id,
      'SHARE_REVIEW_DISPUTE',
      jsonb_build_object('inbox_item_id', p_item_id),
      jsonb_build_object('status', 'disputed', 'reason', p_reason),
      auth.uid()
    );

  ELSIF p_decision = 'rejected' THEN
    UPDATE public.labour_share_inbox
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_reason,
        updated_at = now()
    WHERE id = p_item_id;

    INSERT INTO public.labour_audit_log (
      organisation_id,
      table_name,
      row_id,
      action,
      old_data,
      new_data,
      actor_id
    ) VALUES (
      p_receiver_org_id,
      'labour_share_inbox',
      p_item_id,
      'SHARE_REVIEW_REJECT',
      jsonb_build_object('inbox_item_id', p_item_id),
      jsonb_build_object('status', 'rejected', 'reason', p_reason),
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'item_id', p_item_id,
    'decision', p_decision,
    'receiver_attendance_id', v_new_att_id
  );
END;
$$;

-- Grant execute permissions to authenticated
GRANT EXECUTE ON FUNCTION public.request_tenant_link(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_link(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_link(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shared_attendance(uuid, uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_shared_attendance(uuid, uuid, text, text, uuid, uuid) TO authenticated;

