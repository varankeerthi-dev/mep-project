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

/* STEP 1 — fail closed when required tenant columns or helpers are absent. */
do $$
declare
  t text;
begin
  foreach t in array array[
    'subcontractor_work_orders', 'purchase_vendors', 'purchase_orders',
    'purchase_order_items', 'purchase_bills', 'purchase_bill_items',
    'purchase_payments', 'purchase_payment_bills', 'payment_requests',
    'subcontractor_payments', 'subcontractor_invoices'
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
  if to_regprocedure('public.app_is_org_member(uuid)') is null
     or to_regprocedure('public.app_has_org_permission(uuid,text)') is null then
    raise exception 'COMMON_WO_RLS_PREFLIGHT_FAILED: bridge membership/RBAC helpers are missing';
  end if;
end $$;

/* STEP 2 — remove only the known unrestricted policy names. */
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

/* STEP 3 — tenant-scoped policies. Sensitive Work Order mutations are intentionally
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

/* STEP 4 — post-run verification. These should return no unrestricted policies. */
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
