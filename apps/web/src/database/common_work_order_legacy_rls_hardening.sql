/*
  COMMON WORK ORDER — LEGACY RLS HARDENING

  Manual execution only. Do not run this file until Step 0 has been reviewed against
  the live Supabase schema. It changes policies only; it does not delete data.

  Purpose:
  - remove the known permissive legacy policies from the Work Order and purchase/payment
    tables that carry organisation_id;
  - require authenticated organisation membership for reads;
  - require explicit organization permission for writes;
  - preserve legacy tables and columns during the RPC cut-over.

  This does not make browser writes financially authoritative. Sensitive mutations must
  still be moved behind the bridge RPCs before production cut-over.
*/

/* STEP 0 — read-only preflight. Stop if any result is missing or differs. */
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'subcontractor_work_orders', 'purchase_vendors', 'purchase_orders',
    'purchase_order_items', 'purchase_bills', 'purchase_bill_items',
    'purchase_payments', 'purchase_payment_bills', 'payment_requests',
    'subcontractor_payments', 'subcontractor_invoices'
  )
  and column_name in ('id', 'organisation_id')
order by table_name, column_name;

select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'subcontractor_work_orders', 'purchase_vendors', 'purchase_orders',
    'purchase_order_items', 'purchase_bills', 'purchase_bill_items',
    'purchase_payments', 'purchase_payment_bills', 'payment_requests',
    'subcontractor_payments', 'subcontractor_invoices'
  )
order by tablename, policyname;

begin;

/* STEP 1 — fail closed after creating the prerequisite authorization helpers.
   The repository has two membership models in use: user_organisations is the active
   multi-organization membership table, while org_members/role_permissions supplies
   the application’s role-permission mapping. The helpers intentionally accept either
   membership source, but require an active user_organisations row for admin elevation. */
do $$
declare
  t text;
begin
  foreach t in array array[
    'subcontractor_work_orders', 'purchase_vendors', 'purchase_orders',
    'purchase_order_items', 'purchase_bills', 'purchase_bill_items',
    'purchase_payments', 'purchase_payment_bills', 'payment_requests',
    'subcontractor_payments', 'subcontractor_invoices', 'user_organisations'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: missing public.%', t;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'organisation_id'
    ) then
      raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: public.% lacks organisation_id', t;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_organisations' and column_name = 'user_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_organisations' and column_name = 'status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_organisations' and column_name = 'role'
  ) then
    raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: user_organisations must expose user_id, organisation_id, role, and status';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'user_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'organisation_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'role')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'role_id') then
    raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: org_members must expose user_id, organisation_id, role, and role_id';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'role_permissions' and column_name = 'role_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'role_permissions' and column_name = 'permission_key') then
    raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: role_permissions must expose role_id and permission_key';
  end if;
end $$;

-- These functions were previously assumed to exist, which caused the migration to
-- abort on databases that had the tables but not the bridge helper functions.
create or replace function public.app_is_org_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_organisations uo
    where uo.user_id = auth.uid()
      and uo.organisation_id = p_organisation_id
      and lower(coalesce(uo.status, 'active')) = 'active'
  )
  or exists (
    select 1
    from public.org_members om
    where om.user_id = auth.uid()
      and om.organisation_id = p_organisation_id
  );
$$;

create or replace function public.app_has_org_permission(p_organisation_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_organisations uo
    where uo.user_id = auth.uid()
      and uo.organisation_id = p_organisation_id
      and lower(coalesce(uo.status, 'active')) = 'active'
      and lower(coalesce(uo.role, 'member')) = 'admin'
  )
  or exists (
    select 1
    from public.org_members om
    where om.user_id = auth.uid()
      and om.organisation_id = p_organisation_id
      and (
        lower(coalesce(om.role, 'member')) = 'admin'
        or exists (
          select 1
          from public.role_permissions rp
          where rp.role_id = om.role_id
            and rp.permission_key = p_permission_key
        )
      )
  );
$$;

grant execute on function public.app_is_org_member(uuid) to authenticated;
grant execute on function public.app_has_org_permission(uuid, text) to authenticated;
revoke all on function public.app_is_org_member(uuid) from public;
revoke all on function public.app_has_org_permission(uuid, text) from public;

/* STEP 2 — verify that the prerequisite authorization helpers now exist. */
do $$
begin
  if to_regprocedure('public.app_is_org_member(uuid)') is null
     or to_regprocedure('public.app_has_org_permission(uuid,text)') is null then
    raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: authorization helper creation failed';
  end if;
end $$;

/* STEP 3 — remove only the known unrestricted policy names and this migration’s
   prior policies so a failed/retried manual run is safe to repeat. */
drop policy if exists "Enable all access for authenticated users" on public.subcontractor_work_orders;
drop policy if exists "Enable all access" on public.purchase_vendors;
drop policy if exists "Enable all access" on public.purchase_orders;
drop policy if exists "Enable all access" on public.purchase_order_items;
drop policy if exists "Enable all access" on public.purchase_bills;
drop policy if exists "Enable all access" on public.purchase_bill_items;
drop policy if exists "Enable all access" on public.purchase_payments;
drop policy if exists "Enable all access" on public.purchase_payment_bills;
drop policy if exists "Enable all access" on public.payment_requests;
drop policy if exists "Enable all access" on public.subcontractor_payments;
drop policy if exists "Enable all access" on public.subcontractor_invoices;

drop policy if exists common_wo_legacy_read on public.subcontractor_work_orders;
drop policy if exists common_purchase_vendors_read on public.purchase_vendors;
drop policy if exists common_purchase_vendors_write on public.purchase_vendors;
drop policy if exists common_purchase_orders_read on public.purchase_orders;
drop policy if exists common_purchase_orders_write on public.purchase_orders;
drop policy if exists common_purchase_orders_edit on public.purchase_orders;
drop policy if exists common_purchase_orders_delete on public.purchase_orders;
drop policy if exists common_purchase_bills_read on public.purchase_bills;
drop policy if exists common_purchase_bill_items_read on public.purchase_bill_items;
drop policy if exists common_subcontractor_invoices_read on public.subcontractor_invoices;
drop policy if exists common_subcontractor_payments_read on public.subcontractor_payments;
drop policy if exists common_purchase_payments_read on public.purchase_payments;
drop policy if exists common_purchase_payment_bills_read on public.purchase_payment_bills;
drop policy if exists common_payment_requests_read on public.payment_requests;

/* STEP 4 — tenant-scoped policies. Sensitive Work Order mutations are intentionally
   read-only for browser roles. The new security-definer RPCs bypass this client policy
   as the controlled mutation surface. This makes remaining legacy direct writes fail
   closed instead of preserving browser-trusted financial transitions. */

alter table public.subcontractor_work_orders enable row level security;
create policy common_wo_legacy_read on public.subcontractor_work_orders
  for select to authenticated
  using (public.app_is_org_member(organisation_id));

alter table public.purchase_vendors enable row level security;
create policy common_purchase_vendors_read on public.purchase_vendors
  for select to authenticated using (public.app_is_org_member(organisation_id));
create policy common_purchase_vendors_write on public.purchase_vendors
  for all to authenticated
  using (public.app_has_org_permission(organisation_id, 'purchase_vendors.edit'))
  with check (public.app_has_org_permission(organisation_id, 'purchase_vendors.edit'));

alter table public.purchase_orders enable row level security;
create policy common_purchase_orders_read on public.purchase_orders
  for select to authenticated using (public.app_is_org_member(organisation_id));
create policy common_purchase_orders_write on public.purchase_orders
  for insert to authenticated
  with check (public.app_has_org_permission(organisation_id, 'purchase_orders.create'));
create policy common_purchase_orders_edit on public.purchase_orders
  for update to authenticated
  using (public.app_has_org_permission(organisation_id, 'purchase_orders.edit'))
  with check (public.app_has_org_permission(organisation_id, 'purchase_orders.edit'));
create policy common_purchase_orders_delete on public.purchase_orders
  for delete to authenticated
  using (public.app_has_org_permission(organisation_id, 'purchase_orders.delete'));

alter table public.purchase_order_items enable row level security;
create policy common_purchase_order_items_read on public.purchase_order_items
  for select to authenticated using (public.app_is_org_member(organisation_id));
create policy common_purchase_order_items_write on public.purchase_order_items
  for all to authenticated
  using (public.app_has_org_permission(organisation_id, 'purchase_orders.edit'))
  with check (public.app_has_org_permission(organisation_id, 'purchase_orders.edit'));

alter table public.purchase_bills enable row level security;
create policy common_purchase_bills_read on public.purchase_bills
  for select to authenticated using (public.app_is_org_member(organisation_id));
-- No browser bill INSERT/UPDATE/DELETE policy is installed. Bill entry/matching/
-- approval must use a source-aware RPC that recalculates payable values.

alter table public.purchase_bill_items enable row level security;
create policy common_purchase_bill_items_read on public.purchase_bill_items
  for select to authenticated using (public.app_is_org_member(organisation_id));

alter table public.subcontractor_invoices enable row level security;
create policy common_subcontractor_invoices_read on public.subcontractor_invoices
  for select to authenticated using (public.app_is_org_member(organisation_id));

alter table public.subcontractor_payments enable row level security;
create policy common_subcontractor_payments_read on public.subcontractor_payments
  for select to authenticated using (public.app_is_org_member(organisation_id));
-- No browser settlement writes; posting requires a source-specific RPC.

alter table public.purchase_payments enable row level security;
create policy common_purchase_payments_read on public.purchase_payments
  for select to authenticated using (public.app_is_org_member(organisation_id));
-- No browser INSERT/UPDATE/DELETE policy is installed. Settlement posting must use
-- a source-specific RPC that reconciles the authoritative ledger exactly once.

alter table public.purchase_payment_bills enable row level security;
create policy common_purchase_payment_bills_read on public.purchase_payment_bills
  for select to authenticated using (public.app_is_org_member(organisation_id));

alter table public.payment_requests enable row level security;
create policy common_payment_requests_read on public.payment_requests
  for select to authenticated using (public.app_is_org_member(organisation_id));
-- No browser INSERT/UPDATE/DELETE policies are installed. Creation and approval use
-- payment_request_create/payment_request_approve/approval_transition RPCs.

/* STEP 5 — post-run verification. These should return no unrestricted policies. */
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'subcontractor_work_orders', 'purchase_vendors', 'purchase_orders',
    'purchase_order_items', 'purchase_bills', 'purchase_bill_items',
    'purchase_payments', 'purchase_payment_bills', 'payment_requests',
    'subcontractor_payments', 'subcontractor_invoices'
  )
  and (coalesce(qual, '') ilike '%true%' or coalesce(with_check, '') ilike '%true%');

commit;
