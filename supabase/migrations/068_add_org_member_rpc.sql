create or replace function public.add_org_member(
  p_organisation_id uuid,
  p_user_id uuid,
  p_role text default 'Employee',
  p_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_members(organisation_id, user_id, role, status)
  values (p_organisation_id, p_user_id, p_role, p_status)
  on conflict (organisation_id, user_id)
  do update set
    role = excluded.role,
    status = excluded.status;
end;
$$;
