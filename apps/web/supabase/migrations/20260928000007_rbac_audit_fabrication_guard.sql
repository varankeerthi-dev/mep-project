-- WEL-44 Phase 5 hardening: block fabrication of RBAC audit events.
-- Applied directly to the live database via Supabase MCP on 2026-09-28.
--
-- Generic client audit writes (useAuditLog: created/updated/deleted/...)
-- keep working. The `rbac.*` namespace is reserved for trigger/RPC writers
-- (DEFINER, bypasses RLS), so a failed authorization can never be recorded
-- as a successful RBAC change, nor a fake one invented.

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (
    organisation_id IN (
      SELECT org_members.organisation_id FROM org_members
      WHERE org_members.user_id = auth.uid()
    )
    AND (action NOT LIKE 'rbac.%')
  );
