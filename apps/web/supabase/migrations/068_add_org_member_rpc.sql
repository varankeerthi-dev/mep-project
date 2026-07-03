-- Allow roles used by the app (Employee, Assistant, Engineer, etc.)
-- alongside the legacy RBAC roles (admin, manager, member, viewer).
alter table public.user_organisations
  drop constraint if exists user_organisations_role_check;

alter table public.user_organisations
  add constraint user_organisations_role_check
  check (role in ('admin', 'manager', 'member', 'viewer', 'Employee', 'Assistant', 'Engineer', 'Supervisor'));

drop function if exists public.add_org_member(p_organisation_id uuid, p_user_id uuid, p_role text, p_status text);

create or replace function public.add_org_member(
  p_organisation_id uuid,
  p_user_id uuid,
  p_role text default 'Employee'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_members(organisation_id, user_id, role)
  values (p_organisation_id, p_user_id, p_role)
  on conflict (organisation_id, user_id)
  do nothing;
end;
$$;
