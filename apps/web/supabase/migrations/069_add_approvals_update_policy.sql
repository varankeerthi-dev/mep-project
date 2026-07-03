-- Add missing UPDATE/DELETE policies for approvals table.
-- Without these, rejecting/approving from the UI silently fails
-- because RLS blocks the status update but the frontend gets no error.

create policy "approval_users_update_org_approvals" on public.approvals
  for update using (organisation_id = public.current_org_id())
  with check (organisation_id = public.current_org_id());

create policy "approval_users_delete_org_approvals" on public.approvals
  for delete using (organisation_id = public.current_org_id());
