-- RBAC + employee-first access requests
-- Notes:
-- - Users may authenticate (Google/email) but cannot access org data until approved.
-- - Admins manage employees/roles/requests.

begin;

-- Organisations: allow controlled discovery for request-access.
alter table public.organisations
  add column if not exists allow_access_requests boolean not null default true;

alter table public.organisations
  add column if not exists is_listed boolean not null default false;

-- Employees: HR record. This is the gate for access requests.
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create index if not exists employees_org_id_idx on public.employees(organisation_id);
create index if not exists employees_org_email_idx on public.employees(organisation_id, lower(email));

-- RBAC tables
create table if not exists public.permissions (
  key text primary key,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organisation_id, name)
);

create index if not exists roles_org_id_idx on public.roles(organisation_id);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);

-- Access requests
create table if not exists public.org_access_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid null,
  reviewed_at timestamptz null,
  review_note text null
);

create unique index if not exists org_access_requests_unique on public.org_access_requests(organisation_id, user_id);
create index if not exists org_access_requests_org_status_idx on public.org_access_requests(organisation_id, status);

-- org_members extensions (keep existing `role` string for backward compatibility)
alter table public.org_members
  add column if not exists employee_id uuid null references public.employees(id) on delete set null;

alter table public.org_members
  add column if not exists role_id uuid null references public.roles(id) on delete set null;

-- Helpers
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_members m
    where m.organisation_id = p_org_id
      and m.user_id = auth.uid()
      and coalesce(lower(m.status), 'active') = 'active'
      and lower(m.role) = 'admin'
  );
$$;

create or replace function public.employee_exists(p_org_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.organisation_id = p_org_id
      and lower(trim(e.email)) = lower(trim(p_email))
      and lower(e.status) = 'active'
  );
$$;

create or replace function public.has_permission(p_org_id uuid, p_permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member public.org_members%rowtype;
  v_has boolean := false;
begin
  select *
    into v_member
  from public.org_members m
  where m.organisation_id = p_org_id
    and m.user_id = auth.uid()
    and coalesce(lower(m.status), 'active') = 'active'
  limit 1;

  if not found then
    return false;
  end if;

  -- Back-compat superuser flag.
  if lower(coalesce(v_member.role, '')) = 'admin' then
    return true;
  end if;

  if v_member.role_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.role_permissions rp
    where rp.role_id = v_member.role_id
      and rp.permission_key = p_permission_key
  )
  into v_has;

  return coalesce(v_has, false);
end;
$$;

-- Prevent removing/demoting the last active admin in an org.
create or replace function public.prevent_last_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_is_admin boolean;
  v_old_active boolean;
  v_new_active boolean;
  v_new_is_admin boolean;
  v_other_admins int;
begin
  v_org_id := coalesce(old.organisation_id, new.organisation_id);
  v_is_admin := lower(coalesce(old.role, '')) = 'admin';
  v_old_active := coalesce(lower(old.status), 'active') = 'active';

  if tg_op = 'DELETE' then
    if v_is_admin and v_old_active then
      select count(*)
        into v_other_admins
      from public.org_members m
      where m.organisation_id = v_org_id
        and m.id <> old.id
        and lower(coalesce(m.role, '')) = 'admin'
        and coalesce(lower(m.status), 'active') = 'active';

      if v_other_admins = 0 then
        raise exception 'Cannot remove the last admin for this organisation.';
      end if;
    end if;
    return old;
  end if;

  v_new_active := coalesce(lower(new.status), 'active') = 'active';
  v_new_is_admin := lower(coalesce(new.role, '')) = 'admin';

  if v_is_admin and v_old_active and (not v_new_is_admin or not v_new_active) then
    select count(*)
      into v_other_admins
    from public.org_members m
    where m.organisation_id = v_org_id
      and m.id <> old.id
      and lower(coalesce(m.role, '')) = 'admin'
      and coalesce(lower(m.status), 'active') = 'active';

    if v_other_admins = 0 then
      raise exception 'Cannot demote/deactivate the last admin for this organisation.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_last_admin_change on public.org_members;
create trigger trg_prevent_last_admin_change
before update or delete on public.org_members
for each row execute function public.prevent_last_admin_change();

-- Default permission catalog (extend later)
insert into public.permissions(key, description) values
  ('org.manage_users', 'Manage employees, access requests, and members'),
  ('org.manage_roles', 'Manage roles and role permissions'),
  ('clients.read', 'View clients'),
  ('clients.create', 'Create clients'),
  ('clients.update', 'Edit clients'),
  ('clients.delete', 'Delete clients'),
  ('quotations.read', 'View quotations'),
  ('quotations.create', 'Create quotations'),
  ('quotations.update', 'Edit quotations'),
  ('quotations.delete', 'Delete quotations'),
  ('quotations.approve', 'Approve quotations'),
  ('delivery_challans.read', 'View delivery challans'),
  ('delivery_challans.create', 'Create delivery challans'),
  ('delivery_challans.update', 'Edit delivery challans'),
  ('delivery_challans.delete', 'Delete delivery challans'),
  ('delivery_challans.approve', 'Approve delivery challans'),
  ('invoices.read', 'View invoices'),
  ('invoices.create', 'Create invoices'),
  ('invoices.update', 'Edit invoices'),
  ('invoices.delete', 'Delete invoices'),
  ('invoices.approve', 'Approve invoices'),
  ('site_visits.read', 'View site visits'),
  ('site_visits.create', 'Create site visits'),
  ('site_visits.update', 'Edit site visits'),
  ('site_visits.delete', 'Delete site visits'),
  ('site_visits.approve', 'Approve site visits'),
  ('materials.read', 'View materials'),
  ('materials.create', 'Create materials'),
  ('materials.update', 'Edit materials'),
  ('materials.delete', 'Delete materials')
on conflict (key) do nothing;

-- Ensure default roles exist per org.
create or replace function public.create_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_role_id uuid;
  v_member_role_id uuid;
begin
  insert into public.roles(organisation_id, name, is_system)
  values (p_org_id, 'Admin', true)
  on conflict (organisation_id, name) do nothing;

  insert into public.roles(organisation_id, name, is_system)
  values (p_org_id, 'Member', true)
  on conflict (organisation_id, name) do nothing;

  select id into v_admin_role_id from public.roles where organisation_id = p_org_id and name = 'Admin' limit 1;
  select id into v_member_role_id from public.roles where organisation_id = p_org_id and name = 'Member' limit 1;

  if v_admin_role_id is not null then
    -- Admin gets everything we know about.
    insert into public.role_permissions(role_id, permission_key)
    select v_admin_role_id, p.key from public.permissions p
    on conflict do nothing;
  end if;

  if v_member_role_id is not null then
    -- Member default: read-only on key modules.
    insert into public.role_permissions(role_id, permission_key) values
      (v_member_role_id, 'clients.read'),
      (v_member_role_id, 'quotations.read'),
      (v_member_role_id, 'delivery_challans.read'),
      (v_member_role_id, 'invoices.read'),
      (v_member_role_id, 'site_visits.read'),
      (v_member_role_id, 'materials.read')
    on conflict do nothing;
  end if;
end;
$$;

do $$
declare
  r record;
begin
  for r in select id from public.organisations loop
    perform public.create_default_roles_for_org(r.id);
  end loop;
end $$;

-- Seed role_id for existing org_members where possible.
do $$
declare
  r record;
  v_admin_id uuid;
  v_member_id uuid;
begin
  for r in select id, organisation_id, role, role_id from public.org_members loop
    select id into v_admin_id from public.roles where organisation_id = r.organisation_id and name = 'Admin' limit 1;
    select id into v_member_id from public.roles where organisation_id = r.organisation_id and name = 'Member' limit 1;

    if r.role_id is null then
      if lower(coalesce(r.role, '')) = 'admin' and v_admin_id is not null then
        update public.org_members set role_id = v_admin_id where id = r.id;
      elsif v_member_id is not null then
        update public.org_members set role_id = v_member_id where id = r.id;
      end if;
    end if;
  end loop;
end $$;

-- RPC: approve/reject access requests (keeps client logic simple and transactional)
create or replace function public.approve_access_request(p_request_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.org_access_requests%rowtype;
  v_employee_id uuid;
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
$$;

create or replace function public.reject_access_request(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.org_access_requests%rowtype;
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
    raise exception 'Not authorized to reject requests.';
  end if;

  update public.org_access_requests
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_note
  where id = v_req.id;
end;
$$;

-- RLS
alter table public.employees enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.org_access_requests enable row level security;

-- Employees: admins manage
drop policy if exists "employees_select_admin" on public.employees;
create policy "employees_select_admin"
on public.employees
for select
to authenticated
using (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_users'));

drop policy if exists "employees_write_admin" on public.employees;
create policy "employees_write_admin"
on public.employees
for all
to authenticated
using (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_users'))
with check (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_users'));

-- Permissions: readable by any authenticated user
drop policy if exists "permissions_select_auth" on public.permissions;
create policy "permissions_select_auth"
on public.permissions
for select
to authenticated
using (true);

-- Roles: members can read, admins can write
drop policy if exists "roles_select_members" on public.roles;
create policy "roles_select_members"
on public.roles
for select
to authenticated
using (
  exists (
    select 1 from public.org_members m
    where m.organisation_id = roles.organisation_id
      and m.user_id = auth.uid()
      and coalesce(lower(m.status), 'active') = 'active'
  )
);

drop policy if exists "roles_write_admin" on public.roles;
create policy "roles_write_admin"
on public.roles
for all
to authenticated
using (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_roles'))
with check (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_roles'));

-- Role permissions: members can read via roles, admins can write
drop policy if exists "role_permissions_select_members" on public.role_permissions;
create policy "role_permissions_select_members"
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.roles r
    join public.org_members m on m.organisation_id = r.organisation_id
    where r.id = role_permissions.role_id
      and m.user_id = auth.uid()
      and coalesce(lower(m.status), 'active') = 'active'
  )
);

drop policy if exists "role_permissions_write_admin" on public.role_permissions;
create policy "role_permissions_write_admin"
on public.role_permissions
for all
to authenticated
using (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (public.is_org_admin(r.organisation_id) or public.has_permission(r.organisation_id, 'org.manage_roles'))
  )
)
with check (
  exists (
    select 1
    from public.roles r
    where r.id = role_permissions.role_id
      and (public.is_org_admin(r.organisation_id) or public.has_permission(r.organisation_id, 'org.manage_roles'))
  )
);

-- Access requests
drop policy if exists "access_requests_select_self_or_admin" on public.org_access_requests;
create policy "access_requests_select_self_or_admin"
on public.org_access_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_admin(organisation_id)
  or public.has_permission(organisation_id, 'org.manage_users')
);

drop policy if exists "access_requests_insert_self" on public.org_access_requests;
create policy "access_requests_insert_self"
on public.org_access_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and lower(status) = 'pending'
  and exists (
    select 1
    from public.organisations o
    where o.id = organisation_id
      and o.allow_access_requests = true
      and o.is_listed = true
  )
  and public.employee_exists(organisation_id, email)
);

drop policy if exists "access_requests_update_admin" on public.org_access_requests;
create policy "access_requests_update_admin"
on public.org_access_requests
for update
to authenticated
using (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_users'))
with check (public.is_org_admin(organisation_id) or public.has_permission(organisation_id, 'org.manage_users'));

commit;
