CREATE TABLE public.quotation_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    communication_id UUID NOT NULL REFERENCES public.client_communication(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id),
    original_owner_id UUID NOT NULL REFERENCES public.user_profiles(user_id),
    current_owner_id UUID NOT NULL REFERENCES public.user_profiles(user_id),
    status TEXT NOT NULL CHECK (status IN ('pending_approval', 'approved', 'in_progress', 'completed', 'rejected')),
    approval_request_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.quotation_revision_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    revision_id UUID NOT NULL REFERENCES public.quotation_revisions(id) ON DELETE CASCADE,
    action_taken TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES public.user_profiles(user_id),
    previous_assignee_id UUID REFERENCES public.user_profiles(user_id),
    new_assignee_id UUID REFERENCES public.user_profiles(user_id),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quotation_revisions_org ON public.quotation_revisions(organisation_id);
CREATE INDEX idx_quotation_revisions_comm ON public.quotation_revisions(communication_id);
CREATE INDEX idx_quotation_revisions_owner ON public.quotation_revisions(current_owner_id);
CREATE INDEX idx_quotation_revision_audit_rev ON public.quotation_revision_audit_logs(revision_id);

ALTER TABLE public.quotation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_revision_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_select" ON public.quotation_revisions
    FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "qr_insert" ON public.quotation_revisions
    FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "qr_update" ON public.quotation_revisions
    FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id())
    WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "qr_delete" ON public.quotation_revisions
    FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());

CREATE POLICY "qral_select" ON public.quotation_revision_audit_logs
    FOR SELECT TO authenticated USING (organisation_id = public.current_organisation_id());
CREATE POLICY "qral_insert" ON public.quotation_revision_audit_logs
    FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "qral_update" ON public.quotation_revision_audit_logs
    FOR UPDATE TO authenticated USING (organisation_id = public.current_organisation_id())
    WITH CHECK (organisation_id = public.current_organisation_id());
CREATE POLICY "qral_delete" ON public.quotation_revision_audit_logs
    FOR DELETE TO authenticated USING (organisation_id = public.current_organisation_id());
