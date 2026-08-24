/*
  COMMON WORK ORDER / BILLS / PAYMENT REQUEST BRIDGE
  Repository: varankeerthi-dev/mep-project

  IMPORTANT:
  - This file is a reviewed migration draft. The agent did not connect to or execute SQL.
  - Do not run the whole file as one blind paste. Run Step 0 first, inspect the result,
    then run each numbered transaction only after confirming the prerequisite names/types.
  - This migration is additive. It does not rename, drop, or delete legacy business data.
  - The relation tables below are authoritative for normalized links. Legacy direct columns
    such as purchase_bills.work_order_id remain compatibility-only.
  - The existing legacy migrations contain permissive USING (true) policies. They are not
    copied here. Existing policy hardening is a separate controlled cut-over step.
*/

/* ============================================================================
   STEP 0 — READ-ONLY PREFLIGHT. RUN THIS FIRST AND SAVE THE RESULT.
   Stop if a required table, column, UUID type, or membership/RBAC table differs.
   ========================================================================== */

-- Required table inventory.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'organisations', 'org_members', 'role_permissions',
    'subcontractor_work_orders', 'subcontractors',
    'purchase_orders', 'purchase_vendors', 'purchase_bills',
    'purchase_bill_items', 'subcontractor_invoices',
    'purchase_payments', 'subcontractor_payments',
    'payment_requests', 'document_templates'
  )
order by table_name;

-- Required column inventory. Confirm organisation_id and source primary keys are UUIDs.
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'org_members', 'role_permissions', 'subcontractor_work_orders',
    'subcontractors', 'purchase_vendors', 'purchase_bills',
    'subcontractor_invoices', 'payment_requests', 'document_templates'
  )
order by table_name, ordinal_position;

-- Confirm current RBAC column names used by the application.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('org_members', 'role_permissions')
  and column_name in ('organisation_id', 'user_id', 'role', 'role_id', 'permission_key')
order by table_name, column_name;

-- Review existing policies before any hardening decision.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'subcontractor_work_orders', 'purchase_bills', 'purchase_bill_items',
    'payment_requests', 'purchase_payments', 'subcontractor_payments'
  )
order by tablename, policyname;

/* ============================================================================
   STEP 1 — PREREQUISITES AND COMPATIBILITY COLUMNS
   ========================================================================== */

begin;

create extension if not exists pgcrypto;

-- Fail closed instead of silently creating a bridge against a different schema.
do $$
begin
  if to_regclass('public.organisations') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.organisations is missing';
  end if;
  if to_regclass('public.org_members') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.org_members is missing; review user_organisations alternative before continuing';
  end if;
  if to_regclass('public.role_permissions') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.role_permissions is missing';
  end if;
  if to_regclass('public.subcontractor_work_orders') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.subcontractor_work_orders is missing';
  end if;
  if to_regclass('public.payment_requests') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.payment_requests is missing';
  end if;
  if to_regclass('public.purchase_bills') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.purchase_bills is missing';
  end if;
  if to_regclass('public.purchase_vendors') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.purchase_vendors is missing';
  end if;
  if to_regclass('public.subcontractors') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.subcontractors is missing';
  end if;
  if to_regclass('public.subcontractor_invoices') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.subcontractor_invoices is missing';
  end if;
  if to_regclass('public.purchase_payments') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.purchase_payments is missing';
  end if;
  if to_regclass('public.subcontractor_payments') is null then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: public.subcontractor_payments is missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'user_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'organisation_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'role')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'org_members' and column_name = 'role_id') then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: org_members must expose user_id, organisation_id, role, and role_id';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'role_permissions' and column_name = 'role_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'role_permissions' and column_name = 'permission_key') then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: role_permissions must expose role_id and permission_key';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subcontractors' and column_name = 'organisation_id') then
    raise exception 'COMMON_WO_PREFLIGHT_FAILED: subcontractors.organisation_id is required for tenant validation';
  end if;
end $$;

alter table public.subcontractor_work_orders
  add column if not exists document_type varchar(50) default 'Work Order',
  add column if not exists approval_status varchar(30) default 'Not Required',
  add column if not exists issuer_organisation_id uuid,
  add column if not exists principal_organisation_id uuid,
  add column if not exists recipient_organisation_id uuid,
  add column if not exists recipient_vendor_id uuid,
  add column if not exists recipient_party_type varchar(40) default 'subcontractor',
  add column if not exists client_id uuid,
  add column if not exists project_id uuid,
  add column if not exists plant_id uuid,
  add column if not exists workshop_id uuid,
  add column if not exists work_context varchar(50),
  add column if not exists work_order_version integer not null default 0,
  add column if not exists current_version_id uuid,
  add column if not exists discount_amount numeric(15,2) not null default 0,
  add column if not exists taxable_amount numeric(15,2) not null default 0,
  add column if not exists cess_amount numeric(15,2) not null default 0,
  add column if not exists tax_type varchar(30) default 'not_applicable',
  add column if not exists place_of_supply varchar(100),
  add column if not exists reverse_charge boolean not null default false,
  add column if not exists tds_applicable boolean not null default false,
  add column if not exists tds_section varchar(30),
  add column if not exists tds_percent numeric(5,2) not null default 0,
  add column if not exists tds_base_amount numeric(15,2) not null default 0,
  add column if not exists tds_amount numeric(15,2) not null default 0,
  add column if not exists retention_percent numeric(5,2) not null default 0,
  add column if not exists retention_amount numeric(15,2) not null default 0,
  add column if not exists retention_duration_months integer,
  add column if not exists retention_conditions text,
  add column if not exists currency varchar(3) not null default 'INR',
  add column if not exists exchange_rate numeric(10,4) not null default 1,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists approval_id uuid;

-- The legacy schema makes subcontractor_id NOT NULL. It must become nullable before
-- an internal-unit, vendor, or project-company recipient can be represented.
alter table public.subcontractor_work_orders
  alter column subcontractor_id drop not null;

alter table public.payment_requests
  alter column vendor_id drop not null;

alter table public.purchase_payments
  add column if not exists workflow_step varchar(50),
  add column if not exists approval_status varchar(30),
  add column if not exists approved_at timestamptz;

alter table public.subcontractor_payments
  add column if not exists workflow_step varchar(50),
  add column if not exists approval_status varchar(30),
  add column if not exists approved_at timestamptz;

alter table public.payment_requests
  add column if not exists subcontractor_id uuid,
  add column if not exists source_type varchar(50),
  add column if not exists source_id uuid,
  add column if not exists work_order_id uuid,
  add column if not exists work_order_version_id uuid,
  add column if not exists approval_status varchar(30) default 'Pending Approval',
  add column if not exists workflow_step varchar(50),
  add column if not exists approved_amount numeric(15,2) not null default 0,
  add column if not exists paid_amount numeric(15,2) not null default 0,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists approval_id uuid;

create index if not exists idx_common_wo_org_status
  on public.subcontractor_work_orders(organisation_id, status, issue_date desc);
create index if not exists idx_common_wo_parent
  on public.subcontractor_work_orders(organisation_id, parent_work_order_id);
create index if not exists idx_common_pmr_source
  on public.payment_requests(organisation_id, source_type, source_id);

commit;

/* ============================================================================
   STEP 2 — NORMALIZED COMMON TABLES
   ========================================================================== */

begin;

create table if not exists public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  legacy_line_id text,
  sequence integer not null default 0 check (sequence >= 0),
  item_code varchar(100),
  description text not null,
  specification text,
  drawing_reference varchar(255),
  hsn_sac varchar(30),
  quantity numeric(15,3) not null check (quantity > 0),
  unit varchar(30) not null,
  rate numeric(15,4) not null default 0 check (rate >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(15,2) not null default 0 check (discount_amount >= 0),
  taxable_amount numeric(15,2) not null default 0 check (taxable_amount >= 0),
  cgst_percent numeric(5,2) not null default 0 check (cgst_percent between 0 and 100),
  cgst_amount numeric(15,2) not null default 0 check (cgst_amount >= 0),
  sgst_percent numeric(5,2) not null default 0 check (sgst_percent between 0 and 100),
  sgst_amount numeric(15,2) not null default 0 check (sgst_amount >= 0),
  igst_percent numeric(5,2) not null default 0 check (igst_percent between 0 and 100),
  igst_amount numeric(15,2) not null default 0 check (igst_amount >= 0),
  cess_amount numeric(15,2) not null default 0 check (cess_amount >= 0),
  total_amount numeric(15,2) not null default 0 check (total_amount >= 0),
  measurement_basis text,
  acceptance_criteria text,
  milestone_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_order_id, sequence)
);

create table if not exists public.work_order_requirements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  sequence integer not null default 0 check (sequence >= 0),
  title varchar(255) not null,
  specification text not null,
  deliverable text,
  drawing_reference varchar(255),
  acceptance_criteria text,
  measurement_basis text,
  responsible_party varchar(20) not null default 'recipient' check (responsible_party in ('issuer', 'recipient', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_order_id, sequence)
);

create table if not exists public.work_order_parties (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  role varchar(30) not null check (role in ('issuer', 'principal', 'recipient', 'approver', 'site_contact')),
  party_type varchar(40) not null,
  organisation_party_id uuid references public.organisations(id),
  vendor_id uuid,
  subcontractor_id uuid,
  display_name_snapshot varchar(255) not null,
  tax_id_snapshot varchar(50),
  created_at timestamptz not null default now(),
  check (num_nonnulls(organisation_party_id, vendor_id, subcontractor_id) = 1),
  unique (work_order_id, role)
);

create table if not exists public.work_order_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  link_type varchar(40) not null check (link_type in ('project', 'task', 'milestone', 'mom', 'mom_decision', 'mom_action_item', 'plant', 'workshop', 'asset', 'issue', 'purchase_order', 'parent_work_order')),
  target_id uuid not null,
  source_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_work_order_links_identity
  on public.work_order_links (
    work_order_id,
    link_type,
    target_id,
    coalesce(source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.work_order_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  version_kind varchar(30) not null check (version_kind in ('issued', 'amendment', 'cancelled')),
  template_id uuid,
  template_code varchar(100),
  template_revision integer,
  snapshot jsonb not null,
  source_hash varchar(128),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (work_order_id, version_no)
);

create table if not exists public.work_order_audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  event_type varchar(60) not null,
  actor_id uuid,
  request_id varchar(100),
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.work_order_bill_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_order_id uuid not null references public.subcontractor_work_orders(id) on delete restrict,
  bill_source_type varchar(40) not null check (bill_source_type in ('purchase_bill', 'subcontractor_invoice')),
  bill_source_id uuid not null,
  work_order_version_id uuid references public.work_order_versions(id),
  allocation_amount numeric(15,2) not null default 0 check (allocation_amount >= 0),
  allocation_taxable_amount numeric(15,2) not null default 0 check (allocation_taxable_amount >= 0),
  allocation_tds_amount numeric(15,2) not null default 0 check (allocation_tds_amount >= 0),
  allocation_retention_amount numeric(15,2) not null default 0 check (allocation_retention_amount >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organisation_id, bill_source_type, bill_source_id, work_order_id)
);

create table if not exists public.payment_request_source_links (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  payment_request_id uuid not null references public.payment_requests(id) on delete restrict,
  source_type varchar(50) not null check (source_type in ('purchase_bill', 'subcontractor_invoice', 'purchase_order_advance', 'work_order_advance', 'retention_release', 'other_approved_claim')),
  source_id uuid not null,
  purchase_order_id uuid,
  work_order_id uuid references public.subcontractor_work_orders(id) on delete set null,
  work_order_version_id uuid references public.work_order_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organisation_id, payment_request_id, source_type, source_id)
);

-- PostgreSQL does not allow a subquery in an index predicate. The trigger below
-- enforces the active-source rule under an advisory transaction lock instead.
create or replace function public.common_bridge_guard_active_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_type in ('purchase_bill', 'subcontractor_invoice') then
    perform pg_advisory_xact_lock(hashtext(new.organisation_id::text || ':' || new.source_type || ':' || new.source_id::text));
    if exists (
      select 1
      from public.payment_request_source_links l
      join public.payment_requests pr on pr.id = l.payment_request_id
      where l.organisation_id = new.organisation_id
        and l.source_type = new.source_type
        and l.source_id = new.source_id
        and pr.status not in ('Paid', 'Cancelled', 'Rejected')
        and l.payment_request_id <> new.payment_request_id
    ) then
      raise exception using message = 'DUPLICATE_REQUEST', errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists common_bridge_guard_active_payment_request on public.payment_request_source_links;
create trigger common_bridge_guard_active_payment_request
before insert or update on public.payment_request_source_links
for each row execute function public.common_bridge_guard_active_payment_request();

create table if not exists public.domain_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  operation varchar(80) not null,
  client_request_id varchar(100) not null,
  actor_id uuid,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (organisation_id, operation, client_request_id)
);

create table if not exists public.domain_number_series (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  series_key varchar(50) not null,
  prefix varchar(30) not null,
  padding integer not null default 4 check (padding between 1 and 12),
  next_number bigint not null default 1 check (next_number > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (organisation_id, series_key)
);

create table if not exists public.document_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  document_type varchar(50) not null,
  document_id uuid not null,
  document_version integer not null check (document_version > 0),
  template_id uuid,
  template_code varchar(100) not null,
  template_revision integer not null default 0,
  source_hash varchar(128) not null,
  snapshot_hash varchar(128) not null,
  content_type varchar(100) not null default 'application/pdf' check (content_type = 'application/pdf'),
  storage_path text not null,
  signed_url text,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid,
  unique (organisation_id, document_type, document_id, document_version)
);

create index if not exists idx_work_order_items_org_wo on public.work_order_items(organisation_id, work_order_id);
create index if not exists idx_work_order_requirements_org_wo on public.work_order_requirements(organisation_id, work_order_id);
create index if not exists idx_work_order_parties_org_wo on public.work_order_parties(organisation_id, work_order_id);
create index if not exists idx_work_order_links_org_target on public.work_order_links(organisation_id, link_type, target_id);
create index if not exists idx_work_order_versions_org_wo on public.work_order_versions(organisation_id, work_order_id, version_no desc);
create index if not exists idx_work_order_audit_org_wo on public.work_order_audit_events(organisation_id, work_order_id, created_at desc);
create index if not exists idx_work_order_bill_links_org_wo on public.work_order_bill_links(organisation_id, work_order_id);
create index if not exists idx_work_order_bill_links_source on public.work_order_bill_links(organisation_id, bill_source_type, bill_source_id);
create index if not exists idx_payment_request_source_org_source on public.payment_request_source_links(organisation_id, source_type, source_id);
create index if not exists idx_document_snapshots_org_doc on public.document_snapshots(organisation_id, document_type, document_id, document_version desc);

-- Optional compatibility fields. The relation table remains authoritative.
do $$
begin
  if to_regclass('public.purchase_bills') is not null then
    alter table public.purchase_bills
      add column if not exists work_order_id uuid,
      add column if not exists work_order_version_id uuid;
    create index if not exists idx_purchase_bills_common_wo
      on public.purchase_bills(organisation_id, work_order_id);
  end if;
  if to_regclass('public.subcontractor_invoices') is not null then
    alter table public.subcontractor_invoices
      add column if not exists work_order_version_id uuid;
  end if;
end $$;

commit;

/* ============================================================================
   STEP 3 — MEMBERSHIP/RBAC HELPERS AND RLS FOR NEW TABLES
   ========================================================================== */

begin;

create or replace function public.app_is_org_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.org_members m
       where m.user_id = auth.uid()
         and m.organisation_id = p_organisation_id
     );
$$;

create or replace function public.app_has_org_permission(p_organisation_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.org_members m
       where m.user_id = auth.uid()
         and m.organisation_id = p_organisation_id
         and (
           m.role = 'admin'
           or exists (
             select 1
             from public.role_permissions rp
             where rp.role_id = m.role_id
               and rp.permission_key = p_permission_key
           )
         )
     );
$$;

create or replace function public.app_require_org_permission(p_organisation_id uuid, p_permission_key text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'UNAUTHENTICATED', errcode = 'P0001';
  end if;
  if not public.app_has_org_permission(p_organisation_id, p_permission_key) then
    raise exception using message = 'PERMISSION_DENIED', errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.app_next_number(p_organisation_id uuid, p_series_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series public.domain_number_series%rowtype;
  v_number bigint;
begin
  insert into public.domain_number_series (organisation_id, series_key, prefix, padding, next_number)
  values (
    p_organisation_id,
    p_series_key,
    case p_series_key when 'work_order' then 'WO-' when 'payment_request' then 'PMR-' else 'DOC-' end,
    4,
    1
  )
  on conflict (organisation_id, series_key) do nothing;

  select * into v_series
  from public.domain_number_series
  where organisation_id = p_organisation_id
    and series_key = p_series_key
    and active = true
  for update;

  if not found then
    raise exception using message = 'NUMBER_SERIES_NOT_CONFIGURED', errcode = 'P0001';
  end if;

  v_number := v_series.next_number;
  update public.domain_number_series
  set next_number = v_number + 1, updated_at = now()
  where id = v_series.id;

  return v_series.prefix || lpad(v_number::text, v_series.padding, '0');
end;
$$;

create or replace function public.app_canonical_work_order_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'draft'))
    when 'draft' then 'Draft'
    when 'pending' then 'In Review'
    when 'in review' then 'In Review'
    when 'approved' then 'Approved'
    when 'issued' then 'Issued'
    when 'acknowledged' then 'Acknowledged'
    when 'in progress' then 'In Progress'
    when 'partially completed' then 'Partially Completed'
    when 'completed' then 'Completed'
    when 'on hold' then 'On Hold'
    when 'cancelled' then 'Cancelled'
    when 'canceled' then 'Cancelled'
    else 'Draft'
  end;
$$;

create or replace function public.app_canonical_approval_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'not required'))
    when 'not required' then 'Not Required'
    when 'pending' then 'Pending Approval'
    when 'pending approval' then 'Pending Approval'
    when 'in review' then 'Pending Approval'
    when 'approved' then 'Approved'
    when 'rejected' then 'Rejected'
    when 'returned' then 'Returned'
    when 'on hold' then 'On Hold'
    else 'Not Required'
  end;
$$;

create or replace function public.app_canonical_bill_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, 'submitted'))
    when 'draft' then 'Draft'
    when 'submitted' then 'Submitted'
    when 'pending' then 'Submitted'
    when 'unpaid' then 'Submitted'
    when 'under verification' then 'Submitted'
    when 'matched' then 'Approved'
    when 'verified' then 'Approved'
    when 'approved' then 'Approved'
    when 'query' then 'Disputed'
    when 'disputed' then 'Disputed'
    when 'rejected' then 'Disputed'
    when 'posted' then 'Approved'
    when 'partially paid' then 'Partially Paid'
    when 'paid' then 'Paid'
    when 'cancelled' then 'Cancelled'
    when 'canceled' then 'Cancelled'
    else 'Submitted'
  end;
$$;

alter table public.work_order_items enable row level security;
alter table public.work_order_requirements enable row level security;
alter table public.work_order_parties enable row level security;
alter table public.work_order_links enable row level security;
alter table public.work_order_versions enable row level security;
alter table public.work_order_audit_events enable row level security;
alter table public.work_order_bill_links enable row level security;
alter table public.payment_request_source_links enable row level security;
alter table public.domain_idempotency_keys enable row level security;
alter table public.domain_number_series enable row level security;
alter table public.document_snapshots enable row level security;

-- Remove only policies owned by this bridge so the migration is repeatable.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'work_order_items', 'work_order_requirements', 'work_order_parties',
        'work_order_links', 'work_order_versions', 'work_order_audit_events',
        'work_order_bill_links', 'payment_request_source_links',
        'domain_idempotency_keys', 'domain_number_series', 'document_snapshots'
      )
      and policyname like 'common_bridge_%'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy common_bridge_items_read on public.work_order_items for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_requirements_read on public.work_order_requirements for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_parties_read on public.work_order_parties for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_links_read on public.work_order_links for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_versions_read on public.work_order_versions for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_audit_read on public.work_order_audit_events for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_bill_links_read on public.work_order_bill_links for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_pmr_links_read on public.payment_request_source_links for select using (public.app_is_org_member(organisation_id));
create policy common_bridge_snapshots_read on public.document_snapshots for select using (public.app_is_org_member(organisation_id));

-- Append-only and internal tables intentionally have no browser INSERT/UPDATE/DELETE policies.
-- Controlled SECURITY DEFINER RPCs write them after explicit authorization.

commit;

/* ============================================================================
   STEP 4 — ORDERED BACKFILL OF EXISTING WORK ORDERS
   ========================================================================== */

begin;

-- Populate normalized parties using JSON extraction for the display-name fallback;
-- this avoids assuming whether subcontractors uses name or company_name.
insert into public.work_order_parties (
  organisation_id, work_order_id, role, party_type,
  organisation_party_id, display_name_snapshot
)
select wo.organisation_id, wo.id, 'issuer', 'internal_unit', wo.organisation_id,
       coalesce((to_jsonb(o)->>'name'), 'Organisation')
from public.subcontractor_work_orders wo
left join public.organisations o on o.id = wo.organisation_id
on conflict (work_order_id, role) do nothing;

insert into public.work_order_parties (
  organisation_id, work_order_id, role, party_type,
  subcontractor_id, display_name_snapshot
)
select wo.organisation_id, wo.id, 'recipient', 'subcontractor', wo.subcontractor_id,
       coalesce(to_jsonb(s)->>'company_name', to_jsonb(s)->>'name', 'Subcontractor')
from public.subcontractor_work_orders wo
left join public.subcontractors s on s.id = wo.subcontractor_id
where wo.subcontractor_id is not null
on conflict (work_order_id, role) do nothing;

update public.subcontractor_work_orders
set recipient_party_type = coalesce(recipient_party_type, 'subcontractor'),
    work_order_version = coalesce(work_order_version, 0),
    document_type = coalesce(document_type, 'Work Order'),
    approval_status = coalesce(approval_status, 'Not Required');

-- Backfill only valid JSON array line items. Numeric values are validated by the
-- predicate before casting; malformed legacy lines are left for manual review.
insert into public.work_order_items (
  organisation_id, work_order_id, legacy_line_id, sequence, description,
  quantity, unit, rate, taxable_amount, total_amount
)
select wo.organisation_id,
       wo.id,
       x.item->>'id',
       (x.ordinality - 1)::integer,
       coalesce(nullif(x.item->>'description', ''), 'Unspecified work'),
       (x.item->>'quantity')::numeric,
       coalesce(nullif(x.item->>'unit', ''), 'Nos'),
       (x.item->>'rate')::numeric,
       greatest(coalesce(nullif(x.item->>'amount', '')::numeric, 0), 0),
       greatest(coalesce(nullif(x.item->>'amount', '')::numeric, 0), 0)
from public.subcontractor_work_orders wo
cross join lateral jsonb_array_elements(coalesce(wo.line_items, '[]'::jsonb)) with ordinality as x(item, ordinality)
where jsonb_typeof(wo.line_items) = 'array'
  and coalesce(x.item->>'quantity', '') ~ '^[0-9]+(\\.[0-9]+)?$'
  and (x.item->>'quantity')::numeric > 0
  and coalesce(x.item->>'rate', '0') ~ '^[0-9]+(\\.[0-9]+)?$'
on conflict (work_order_id, sequence) do nothing;

commit;

/* ============================================================================
   STEP 5 — SERVER-AUTHORITATIVE WORK ORDER RPCs
   ========================================================================== */

create or replace function public.work_orders_list(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_page integer := greatest(coalesce((p_input->>'page')::integer, 0), 0);
  v_page_size integer := least(greatest(coalesce((p_input->>'pageSize')::integer, 25), 1), 100);
  v_search text := nullif(trim(p_input->>'search'), '');
  v_status text := nullif(p_input->>'status', '');
  v_recipient_type text := nullif(p_input->>'recipientType', '');
  v_total integer;
  v_rows jsonb;
  v_metrics jsonb;
begin
  if v_org is null then raise exception using message = 'TENANT_NOT_FOUND', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.read');

  with base as (
    select
      wo.id,
      wo.organisation_id,
      wo.work_order_no,
      wo.issue_date,
      coalesce((select p.display_name_snapshot from public.work_order_parties p where p.work_order_id = wo.id and p.role = 'issuer' limit 1), 'Organisation') as issuer_name,
      coalesce((select p.display_name_snapshot from public.work_order_parties p where p.work_order_id = wo.id and p.role = 'recipient' limit 1), 'Recipient') as recipient_name,
      coalesce(wo.recipient_party_type, 'subcontractor') as recipient_type,
      null::text as project_name,
      null::text as plant_name,
      null::text as workshop_name,
      left(wo.work_description, 240) as scope_preview,
      public.app_canonical_work_order_status(wo.status) as status,
      public.app_canonical_approval_status(wo.approval_status) as approval_status,
      coalesce(wo.total_amount, 0)::numeric as total_amount,
      coalesce((select sum(l.allocation_amount) from public.work_order_bill_links l where l.organisation_id = wo.organisation_id and l.work_order_id = wo.id), 0)::numeric as billed_amount,
      coalesce(wo.work_order_version, 0) as current_version
    from public.subcontractor_work_orders wo
    where wo.organisation_id = v_org
      and wo.archived_at is null
      and (v_status is null or coalesce(wo.status, 'Draft') = v_status)
      and (v_recipient_type is null or coalesce(wo.recipient_party_type, 'subcontractor') = v_recipient_type)
      and (
        v_search is null
        or wo.work_order_no ilike '%' || v_search || '%'
        or coalesce(wo.work_description, '') ilike '%' || v_search || '%'
        or exists (select 1 from public.work_order_parties p where p.work_order_id = wo.id and p.display_name_snapshot ilike '%' || v_search || '%')
      )
  ), counted as (select *, count(*) over () as total_count from base)
  select coalesce(max(total_count), 0)::integer into v_total from counted;

  with base as (
    select
      wo.id,
      wo.organisation_id,
      wo.work_order_no,
      wo.issue_date,
      coalesce((select p.display_name_snapshot from public.work_order_parties p where p.work_order_id = wo.id and p.role = 'issuer' limit 1), 'Organisation') as issuer_name,
      coalesce((select p.display_name_snapshot from public.work_order_parties p where p.work_order_id = wo.id and p.role = 'recipient' limit 1), 'Recipient') as recipient_name,
      coalesce(wo.recipient_party_type, 'subcontractor') as recipient_type,
      null::text as project_name,
      null::text as plant_name,
      null::text as workshop_name,
      left(wo.work_description, 240) as scope_preview,
      public.app_canonical_work_order_status(wo.status) as status,
      public.app_canonical_approval_status(wo.approval_status) as approval_status,
      coalesce(wo.total_amount, 0)::numeric as total_amount,
      coalesce((select sum(l.allocation_amount) from public.work_order_bill_links l where l.organisation_id = wo.organisation_id and l.work_order_id = wo.id), 0)::numeric as billed_amount,
      (coalesce(wo.total_amount, 0) - coalesce((select sum(l.allocation_amount) from public.work_order_bill_links l where l.organisation_id = wo.organisation_id and l.work_order_id = wo.id), 0))::numeric as balance_amount,
      coalesce(wo.work_order_version, 0) as current_version
    from public.subcontractor_work_orders wo
    where wo.organisation_id = v_org
      and wo.archived_at is null
      and (v_status is null or coalesce(wo.status, 'Draft') = v_status)
      and (v_recipient_type is null or coalesce(wo.recipient_party_type, 'subcontractor') = v_recipient_type)
      and (
        v_search is null
        or wo.work_order_no ilike '%' || v_search || '%'
        or coalesce(wo.work_description, '') ilike '%' || v_search || '%'
        or exists (select 1 from public.work_order_parties p where p.work_order_id = wo.id and p.display_name_snapshot ilike '%' || v_search || '%')
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'organisationId', organisation_id,
    'workOrderNo', work_order_no,
    'issueDate', issue_date,
    'issuerName', issuer_name,
    'recipientName', recipient_name,
    'recipientType', recipient_type,
    'projectName', project_name,
    'plantName', plant_name,
    'workshopName', workshop_name,
    'scopePreview', scope_preview,
    'status', status,
    'approvalStatus', approval_status,
    'totalAmount', total_amount,
    'billedAmount', billed_amount,
    'balanceAmount', balance_amount,
    'currentVersion', current_version
  ) order by issue_date desc, work_order_no desc), '[]'::jsonb)
  into v_rows
  from (
    select * from base
    order by issue_date desc, work_order_no desc
    offset v_page * v_page_size limit v_page_size
  ) page_rows;

  select jsonb_build_object(
    'totalCount', count(*),
    'draftCount', count(*) filter (where status = 'Draft'),
    'pendingApprovalCount', count(*) filter (where approval_status = 'Pending Approval'),
    'issuedCount', count(*) filter (where status in ('Issued', 'Acknowledged', 'In Progress', 'Partially Completed', 'Completed')),
    'openAmount', coalesce(sum(greatest(balance_amount, 0)), 0),
    'billedAmount', coalesce(sum(billed_amount), 0)
  ) into v_metrics
  from (
    select public.app_canonical_work_order_status(wo.status) as status, public.app_canonical_approval_status(wo.approval_status) as approval_status,
           coalesce(wo.total_amount, 0)::numeric as total_amount,
           coalesce((select sum(l.allocation_amount) from public.work_order_bill_links l where l.organisation_id = wo.organisation_id and l.work_order_id = wo.id), 0)::numeric as billed_amount,
           coalesce(wo.total_amount, 0) - coalesce((select sum(l.allocation_amount) from public.work_order_bill_links l where l.organisation_id = wo.organisation_id and l.work_order_id = wo.id), 0) as balance_amount
    from public.subcontractor_work_orders wo
    where wo.organisation_id = v_org and wo.archived_at is null
  ) m;

  return jsonb_build_object('rows', v_rows, 'totalCount', v_total, 'page', v_page, 'pageSize', v_page_size, 'metrics', v_metrics);
end;
$$;

grant execute on function public.work_orders_list(jsonb) to authenticated;

create or replace function public.work_order_save_draft(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_work_order_id uuid := coalesce(nullif(p_input->>'workOrderId', '')::uuid, gen_random_uuid());
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_existing public.subcontractor_work_orders%rowtype;
  v_is_new boolean;
  v_work_order_no text;
  v_subcontractor_id uuid := nullif(p_input #>> '{recipient,subcontractorId}', '')::uuid;
  v_recipient_vendor_id uuid := nullif(p_input #>> '{recipient,vendorId}', '')::uuid;
  v_recipient_org_id uuid := nullif(p_input #>> '{recipient,organisationId}', '')::uuid;
  v_items jsonb := coalesce(p_input->'items', '[]'::jsonb);
  v_item jsonb;
  v_seq integer := 0;
  v_qty numeric;
  v_rate numeric;
  v_discount_pct numeric;
  v_discount_amount numeric;
  v_taxable numeric;
  v_cgst_pct numeric;
  v_sgst_pct numeric;
  v_igst_pct numeric;
  v_cgst numeric;
  v_sgst numeric;
  v_igst numeric;
  v_cess numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_cgst_total numeric := 0;
  v_sgst_total numeric := 0;
  v_igst_total numeric := 0;
  v_cess_total numeric := 0;
  v_total numeric := 0;
  v_expected_version integer := nullif(p_input->>'expectedVersion', '')::integer;
  v_response jsonb;
begin
  if v_org is null then raise exception using message = 'TENANT_NOT_FOUND', errcode = 'P0001'; end if;
  if v_request_id is null or length(v_request_id) < 16 then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, case when p_input->>'workOrderId' is null then 'work_orders.create' else 'work_orders.edit' end);
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':work_order_save_draft:' || v_request_id));

  select response into v_response
  from public.domain_idempotency_keys
  where organisation_id = v_org and operation = 'work_order_save_draft' and client_request_id = v_request_id;
  if v_response is not null then return v_response; end if;

  select * into v_existing
  from public.subcontractor_work_orders
  where id = v_work_order_id and organisation_id = v_org
  for update;
  v_is_new := not found;

  if not v_is_new then
    if v_expected_version is not null and coalesce(v_existing.work_order_version, 0) <> v_expected_version then
      raise exception using message = 'CONCURRENT_UPDATE', errcode = 'P0001';
    end if;
    if coalesce(v_existing.status, 'Draft') not in ('Draft', 'Returned') then
      raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001';
    end if;
    v_work_order_no := coalesce(nullif(trim(p_input->>'workOrderNo'), ''), v_existing.work_order_no);
  else
    v_work_order_no := coalesce(nullif(trim(p_input->>'workOrderNo'), ''), 'DRAFT-' || substr(replace(v_work_order_id::text, '-', ''), 1, 20));
  end if;

  if v_subcontractor_id is not null and not exists (select 1 from public.subcontractors s where s.id = v_subcontractor_id) then
    raise exception using message = 'CROSS_TENANT_REFERENCE', errcode = 'P0001';
  end if;
  if v_recipient_vendor_id is not null and not exists (select 1 from public.purchase_vendors v where v.id = v_recipient_vendor_id and v.organisation_id = v_org) then
    raise exception using message = 'CROSS_TENANT_REFERENCE', errcode = 'P0001';
  end if;
  if v_recipient_org_id is not null and not exists (select 1 from public.org_members m where m.organisation_id = v_recipient_org_id and m.user_id = auth.uid()) then
    raise exception using message = 'CROSS_TENANT_REFERENCE', errcode = 'CROSS_TENANT_REFERENCE';
  end if;
  if jsonb_array_length(v_items) < 1 then raise exception using message = 'MISSING_REQUIRED_FIELD', errcode = 'P0001'; end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if coalesce(v_item->>'description', '') = '' then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
    if coalesce(v_item->>'quantity', '') !~ '^[0-9]+(\\.[0-9]+)?$' or (v_item->>'quantity')::numeric <= 0 then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
    if coalesce(v_item->>'rate', '0') !~ '^[0-9]+(\\.[0-9]+)?$' then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
    v_qty := (v_item->>'quantity')::numeric;
    v_rate := (v_item->>'rate')::numeric;
    v_discount_pct := coalesce(nullif(v_item->>'discountPercent', '')::numeric, 0);
    v_cgst_pct := coalesce(nullif(v_item->>'cgstPercent', '')::numeric, 0);
    v_sgst_pct := coalesce(nullif(v_item->>'sgstPercent', '')::numeric, 0);
    v_igst_pct := coalesce(nullif(v_item->>'igstPercent', '')::numeric, 0);
    if greatest(v_discount_pct, v_cgst_pct, v_sgst_pct, v_igst_pct) > 100 or least(v_discount_pct, v_cgst_pct, v_sgst_pct, v_igst_pct) < 0 then
      raise exception using message = 'INVALID_TAX_CONFIGURATION', errcode = 'P0001';
    end if;
    v_discount_amount := round(v_qty * v_rate * v_discount_pct / 100, 2);
    v_taxable := round(v_qty * v_rate - v_discount_amount, 2);
    v_cgst := round(v_taxable * v_cgst_pct / 100, 2);
    v_sgst := round(v_taxable * v_sgst_pct / 100, 2);
    v_igst := round(v_taxable * v_igst_pct / 100, 2);
    v_cess := greatest(coalesce(nullif(v_item->>'cessAmount', '')::numeric, 0), 0);
    v_line_total := round(v_taxable + v_cgst + v_sgst + v_igst + v_cess, 2);
    v_subtotal := v_subtotal + v_taxable;
    v_cgst_total := v_cgst_total + v_cgst;
    v_sgst_total := v_sgst_total + v_sgst;
    v_igst_total := v_igst_total + v_igst;
    v_cess_total := v_cess_total + v_cess;
    v_total := v_total + v_line_total;
  end loop;

  if v_is_new then
    insert into public.subcontractor_work_orders (
      id, organisation_id, subcontractor_id, work_order_no, issue_date, status,
      work_description, site_location, start_date, end_date, line_items,
      subtotal, cgst_amount, sgst_amount, igst_amount, total_amount,
      advance_percent, advance_amount, payment_terms, delivery_terms,
      terms_conditions, remarks, created_by, updated_by,
      document_type, approval_status, issuer_organisation_id, recipient_organisation_id,
      recipient_vendor_id, recipient_party_type, client_id, project_id, plant_id, workshop_id,
      work_context, work_order_version, discount_amount, taxable_amount, cess_amount,
      tax_type, place_of_supply, reverse_charge, tds_applicable, tds_section, tds_percent,
      tds_base_amount, tds_amount, retention_percent, retention_amount,
      retention_duration_months, retention_conditions, currency, exchange_rate
    ) values (
      v_work_order_id, v_org, v_subcontractor_id, v_work_order_no,
      (p_input->>'issueDate')::date, 'Draft', p_input->>'workDescription',
      p_input->>'siteLocation', nullif(p_input->>'startDate', '')::date,
      nullif(p_input->>'endDate', '')::date, v_items, v_subtotal,
      v_cgst_total, v_sgst_total, v_igst_total, v_total,
      coalesce((p_input #>> '{commercial,advancePercent}')::numeric, 0),
      round(v_total * coalesce((p_input #>> '{commercial,advancePercent}')::numeric, 0) / 100, 2),
      p_input->>'paymentTermsText', p_input->>'deliveryTerms', p_input->'termsConditions',
      p_input->>'remarks', auth.uid(), auth.uid(), 'Work Order', 'Not Required', v_org,
      v_recipient_org_id, v_recipient_vendor_id, coalesce(p_input #>> '{recipient,partyType}', 'subcontractor'),
      nullif(p_input->>'clientId', '')::uuid, nullif(p_input->>'projectId', '')::uuid,
      nullif(p_input->>'plantId', '')::uuid, nullif(p_input->>'workshopId', '')::uuid,
      p_input->>'workContext', 0, 0, v_subtotal, v_cess_total, coalesce(p_input #>> '{commercial,taxType}', 'not_applicable'),
      p_input #>> '{commercial,placeOfSupply}', coalesce((p_input #>> '{commercial,reverseCharge}')::boolean, false),
      coalesce((p_input #>> '{commercial,tdsApplicable}')::boolean, false), p_input #>> '{commercial,tdsSection}',
      coalesce((p_input #>> '{commercial,tdsPercent}')::numeric, 0),
      v_total, round(v_total * coalesce((p_input #>> '{commercial,tdsPercent}')::numeric, 0) / 100, 2),
      coalesce((p_input #>> '{commercial,retentionPercent}')::numeric, 0),
      round(v_subtotal * coalesce((p_input #>> '{commercial,retentionPercent}')::numeric, 0) / 100, 2),
      nullif(p_input #>> '{commercial,retentionDurationMonths}', '')::integer,
      p_input #>> '{commercial,retentionConditions}', coalesce(p_input #>> '{commercial,currency}', 'INR'),
      coalesce((p_input #>> '{commercial,exchangeRate}')::numeric, 1)
    );
  else
    update public.subcontractor_work_orders
    set work_order_no = v_work_order_no,
        issue_date = (p_input->>'issueDate')::date,
        work_description = p_input->>'workDescription',
        site_location = p_input->>'siteLocation',
        start_date = nullif(p_input->>'startDate', '')::date,
        end_date = nullif(p_input->>'endDate', '')::date,
        line_items = v_items,
        subtotal = v_subtotal, cgst_amount = v_cgst_total, sgst_amount = v_sgst_total,
        igst_amount = v_igst_total, total_amount = v_total,
        payment_terms = p_input->>'paymentTermsText', delivery_terms = p_input->>'deliveryTerms',
        terms_conditions = p_input->'termsConditions', remarks = p_input->>'remarks',
        subcontractor_id = v_subcontractor_id, recipient_vendor_id = v_recipient_vendor_id,
        recipient_organisation_id = v_recipient_org_id,
        recipient_party_type = coalesce(p_input #>> '{recipient,partyType}', recipient_party_type),
        work_order_version = coalesce(work_order_version, 0) + 1,
        updated_by = auth.uid(), updated_at = now()
    where id = v_work_order_id and organisation_id = v_org;
  end if;

  delete from public.work_order_items where work_order_id = v_work_order_id;
  insert into public.work_order_items (
    organisation_id, work_order_id, sequence, item_code, description, specification,
    drawing_reference, hsn_sac, quantity, unit, rate, discount_percent, discount_amount,
    taxable_amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent,
    igst_amount, cess_amount, total_amount, measurement_basis, acceptance_criteria, milestone_id
  )
  select v_org, v_work_order_id, x.ordinality - 1,
         x.item->>'itemCode', x.item->>'description', x.item->>'specification',
         x.item->>'drawingReference', x.item->>'hsnSac', (x.item->>'quantity')::numeric,
         x.item->>'unit', (x.item->>'rate')::numeric,
         coalesce((x.item->>'discountPercent')::numeric, 0),
         round((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric * coalesce((x.item->>'discountPercent')::numeric, 0) / 100, 2),
         round((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric * (1 - coalesce((x.item->>'discountPercent')::numeric, 0) / 100), 2),
         coalesce((x.item->>'cgstPercent')::numeric, 0), round(((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric) * coalesce((x.item->>'cgstPercent')::numeric, 0) / 100, 2),
         coalesce((x.item->>'sgstPercent')::numeric, 0), round(((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric) * coalesce((x.item->>'sgstPercent')::numeric, 0) / 100, 2),
         coalesce((x.item->>'igstPercent')::numeric, 0), round(((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric) * coalesce((x.item->>'igstPercent')::numeric, 0) / 100, 2),
         greatest(coalesce((x.item->>'cessAmount')::numeric, 0), 0),
         round(((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric) * (1 - coalesce((x.item->>'discountPercent')::numeric, 0) / 100) +
           ((x.item->>'quantity')::numeric * (x.item->>'rate')::numeric) * (coalesce((x.item->>'cgstPercent')::numeric, 0) + coalesce((x.item->>'sgstPercent')::numeric, 0) + coalesce((x.item->>'igstPercent')::numeric, 0)) / 100 + greatest(coalesce((x.item->>'cessAmount')::numeric, 0), 0), 2),
         x.item->>'measurementBasis', x.item->>'acceptanceCriteria', nullif(x.item->>'milestoneId', '')::uuid
  from jsonb_array_elements(v_items) with ordinality as x(item, ordinality);

  delete from public.work_order_requirements where work_order_id = v_work_order_id;
  insert into public.work_order_requirements (organisation_id, work_order_id, sequence, title, specification, deliverable, drawing_reference, acceptance_criteria, measurement_basis, responsible_party)
  select v_org, v_work_order_id, coalesce((x.item->>'sequence')::integer, x.ordinality - 1), x.item->>'title', x.item->>'specification', x.item->>'deliverable', x.item->>'drawingReference', x.item->>'acceptanceCriteria', x.item->>'measurementBasis', coalesce(x.item->>'responsibleParty', 'recipient')
  from jsonb_array_elements(coalesce(p_input->'requirements', '[]'::jsonb)) with ordinality as x(item, ordinality);

  insert into public.work_order_parties (organisation_id, work_order_id, role, party_type, organisation_party_id, display_name_snapshot)
  values (v_org, v_work_order_id, 'issuer', 'internal_unit', v_org, coalesce(p_input #>> '{issuer,displayNameSnapshot}', 'Organisation'))
  on conflict (work_order_id, role) do update set organisation_party_id = excluded.organisation_party_id, display_name_snapshot = excluded.display_name_snapshot;

  insert into public.work_order_parties (organisation_id, work_order_id, role, party_type, organisation_party_id, vendor_id, subcontractor_id, display_name_snapshot, tax_id_snapshot)
  values (v_org, v_work_order_id, 'recipient', coalesce(p_input #>> '{recipient,partyType}', 'subcontractor'), v_recipient_org_id, v_recipient_vendor_id, v_subcontractor_id, coalesce(p_input #>> '{recipient,displayNameSnapshot}', 'Recipient'), p_input #>> '{recipient,taxIdSnapshot}')
  on conflict (work_order_id, role) do update set party_type = excluded.party_type, organisation_party_id = excluded.organisation_party_id, vendor_id = excluded.vendor_id, subcontractor_id = excluded.subcontractor_id, display_name_snapshot = excluded.display_name_snapshot, tax_id_snapshot = excluded.tax_id_snapshot;

  v_response := jsonb_build_object('id', v_work_order_id, 'organisationId', v_org, 'workOrderNo', v_work_order_no, 'status', 'Draft', 'version', case when v_is_new then 0 else coalesce(v_existing.work_order_version, 0) + 1 end);
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
  values (v_org, 'work_order_save_draft', v_request_id, auth.uid(), v_response);
  insert into public.work_order_audit_events (organisation_id, work_order_id, event_type, actor_id, request_id, after_state)
  values (v_org, v_work_order_id, case when v_is_new then 'draft_created' else 'draft_updated' end, auth.uid(), v_request_id, v_response);
  return v_response;
exception when unique_violation then
  raise exception using message = 'DUPLICATE_DOCUMENT_NUMBER', errcode = 'P0001';
end;
$$;

grant execute on function public.work_order_save_draft(jsonb) to authenticated;

create or replace function public.work_order_detail(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_result jsonb;
begin
  if v_org is null or v_id is null then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.read');
  select jsonb_build_object(
    'id', wo.id,
    'organisationId', wo.organisation_id,
    'workOrderNo', wo.work_order_no,
    'issueDate', wo.issue_date,
    'validUntil', wo.valid_until,
    'startDate', wo.start_date,
    'endDate', wo.end_date,
    'workDescription', wo.work_description,
    'siteLocation', wo.site_location,
    'status', public.app_canonical_work_order_status(wo.status),
    'approvalStatus', public.app_canonical_approval_status(wo.approval_status),
    'totalAmount', coalesce(wo.total_amount, 0),
    'subtotal', coalesce(wo.subtotal, 0),
    'taxableAmount', coalesce(wo.taxable_amount, 0),
    'tdsAmount', coalesce(wo.tds_amount, 0),
    'retentionAmount', coalesce(wo.retention_amount, 0),
    'paymentTerms', wo.payment_terms,
    'deliveryTerms', wo.delivery_terms,
    'remarks', wo.remarks,
    'currentVersion', coalesce(wo.work_order_version, 0),
    'parties', coalesce((select jsonb_agg(to_jsonb(p) order by p.role) from public.work_order_parties p where p.organisation_id = v_org and p.work_order_id = wo.id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sequence) from public.work_order_items i where i.organisation_id = v_org and i.work_order_id = wo.id), '[]'::jsonb),
    'requirements', coalesce((select jsonb_agg(to_jsonb(r) order by r.sequence) from public.work_order_requirements r where r.organisation_id = v_org and r.work_order_id = wo.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at) from public.work_order_links l where l.organisation_id = v_org and l.work_order_id = wo.id), '[]'::jsonb)
  ) into v_result
  from public.subcontractor_work_orders wo
  where wo.id = v_id and wo.organisation_id = v_org;
  if v_result is null then raise exception using message = 'RECORD_NOT_FOUND', errcode = 'P0001'; end if;
  return v_result;
end;
$$;

grant execute on function public.work_order_detail(jsonb) to authenticated;

create or replace function public.work_order_submit_for_approval(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_status text;
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_request_id is null then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.submit');
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':work_order_submit:' || v_id::text));
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'work_order_submit' and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;
  select public.app_canonical_work_order_status(status) into v_status from public.subcontractor_work_orders where id = v_id and organisation_id = v_org for update;
  if v_status is null then raise exception using message = 'RECORD_NOT_FOUND', errcode = 'P0001'; end if;
  if v_status not in ('Draft', 'In Review') then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
  update public.subcontractor_work_orders set status = 'In Review', approval_status = 'Pending Approval', updated_by = auth.uid(), updated_at = now() where id = v_id and organisation_id = v_org;
  v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'status', 'In Review', 'approvalStatus', 'Pending Approval');
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'work_order_submit', v_request_id, auth.uid(), v_result);
  insert into public.work_order_audit_events (organisation_id, work_order_id, event_type, actor_id, request_id, after_state) values (v_org, v_id, 'submitted_for_approval', auth.uid(), v_request_id, v_result);
  return v_result;
end;
$$;

grant execute on function public.work_order_submit_for_approval(jsonb) to authenticated;

create or replace function public.work_order_bind_approval(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_approval_id uuid := nullif(p_input->>'approvalId', '')::uuid;
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_approval_id is null then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.submit');
  update public.subcontractor_work_orders
  set approval_id = v_approval_id, updated_by = auth.uid(), updated_at = now()
  where id = v_id and organisation_id = v_org and public.app_canonical_work_order_status(status) in ('Draft', 'In Review');
  if not found then raise exception using message = 'RECORD_NOT_FOUND', errcode = 'P0001'; end if;
  v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'approvalId', v_approval_id);
  insert into public.work_order_audit_events (organisation_id, work_order_id, event_type, actor_id, after_state)
  values (v_org, v_id, 'approval_bound', auth.uid(), v_result);
  return v_result;
end;
$$;

grant execute on function public.work_order_bind_approval(jsonb) to authenticated;

create or replace function public.work_order_approve(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_request_id is null or length(v_request_id) < 16 then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.approve');
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':work_order_approve:' || v_id::text));
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'work_order_approve' and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;
  update public.subcontractor_work_orders
  set status = 'Approved', approval_status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = v_id and organisation_id = v_org and public.app_canonical_work_order_status(status) = 'In Review' and public.app_canonical_approval_status(approval_status) = 'Pending Approval';
  if not found then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
  v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'status', 'Approved', 'approvalStatus', 'Approved');
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'work_order_approve', v_request_id, auth.uid(), v_result);
  insert into public.work_order_audit_events (organisation_id, work_order_id, event_type, actor_id, request_id, after_state) values (v_org, v_id, 'approved', auth.uid(), v_request_id, v_result);
  return v_result;
end;
$$;

grant execute on function public.work_order_approve(jsonb) to authenticated;

create or replace function public.work_order_issue(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_status text;
  v_approval text;
  v_no text;
  v_version integer;
  v_version_id uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_request_id is null then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.issue');
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':work_order_issue:' || v_id::text));
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'work_order_issue' and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;
  select public.app_canonical_work_order_status(status), public.app_canonical_approval_status(approval_status), work_order_no, greatest(coalesce(work_order_version, 0), 0) + 1
    into v_status, v_approval, v_no, v_version
  from public.subcontractor_work_orders where id = v_id and organisation_id = v_org for update;
  if v_status is null then raise exception using message = 'RECORD_NOT_FOUND', errcode = 'P0001'; end if;
  if v_status not in ('Approved', 'Draft') or v_approval not in ('Approved', 'Not Required') then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
  if v_no is null or v_no like 'DRAFT-%' then v_no := public.app_next_number(v_org, 'work_order'); end if;
  v_snapshot := jsonb_build_object(
    'workOrderId', v_id,
    'workOrderNo', v_no,
    'organisationId', v_org,
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sequence) from public.work_order_items i where i.organisation_id = v_org and i.work_order_id = v_id), '[]'::jsonb),
    'requirements', coalesce((select jsonb_agg(to_jsonb(r) order by r.sequence) from public.work_order_requirements r where r.organisation_id = v_org and r.work_order_id = v_id), '[]'::jsonb),
    'issuedAt', now()
  );
  insert into public.work_order_versions (id, organisation_id, work_order_id, version_no, version_kind, template_code, snapshot, source_hash, snapshot_hash, created_by)
  values (v_version_id, v_org, v_id, v_version, 'issued', 'Work Order', v_snapshot, md5(v_snapshot::text), md5(v_snapshot::text), auth.uid());
  update public.subcontractor_work_orders set work_order_no = v_no, status = 'Issued', approval_status = 'Approved', issued_at = now(), issued_by = auth.uid(), current_version_id = v_version_id, work_order_version = v_version, updated_by = auth.uid(), updated_at = now() where id = v_id and organisation_id = v_org;
  v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'workOrderNo', v_no, 'status', 'Issued', 'approvalStatus', 'Approved', 'version', v_version, 'versionId', v_version_id);
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'work_order_issue', v_request_id, auth.uid(), v_result);
  insert into public.work_order_audit_events (organisation_id, work_order_id, event_type, actor_id, request_id, after_state) values (v_org, v_id, 'issued', auth.uid(), v_request_id, v_result);
  return v_result;
exception when unique_violation then
  raise exception using message = 'DUPLICATE_DOCUMENT_NUMBER', errcode = 'P0001';
end;
$$;

grant execute on function public.work_order_issue(jsonb) to authenticated;

/* ============================================================================
   STEP 6 — COMMON BILLS INBOX AND LINK RPC
   ========================================================================== */

create or replace function public.bills_inbox(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_page integer := greatest(coalesce((p_input->>'page')::integer, 0), 0);
  v_page_size integer := least(greatest(coalesce((p_input->>'pageSize')::integer, 25), 1), 100);
  v_rows jsonb;
  v_total integer;
begin
  if v_org is null then raise exception using message = 'TENANT_NOT_FOUND', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'bills.read');

  with source_rows as (
    select pb.id as source_id, pb.organisation_id, 'purchase_bill'::text as source_type,
           pb.bill_number as bill_no, coalesce(v.company_name, 'Vendor') as supplier_name,
           pb.bill_date, pb.due_date, null::uuid as source_work_order_id,
           coalesce(pb.net_amount, pb.total_amount, 0)::numeric as payable_amount,
           coalesce(pb.paid_amount, 0)::numeric as paid_amount,
           coalesce(pb.balance_amount, greatest(coalesce(pb.net_amount, pb.total_amount, 0) - coalesce(pb.paid_amount, 0), 0))::numeric as balance_amount,
           public.app_canonical_bill_status(coalesce(pb.approval_status, pb.payment_status, 'Submitted')) as source_status
    from public.purchase_bills pb
    left join public.purchase_vendors v on v.id = pb.vendor_id
    where pb.organisation_id = v_org
    union all
    select si.id, (to_jsonb(si)->>'organisation_id')::uuid, 'subcontractor_invoice',
           coalesce(to_jsonb(si)->>'invoice_number', to_jsonb(si)->>'invoice_no', si.id::text),
           coalesce(to_jsonb(si)->>'subcontractor_name', 'Subcontractor'),
           coalesce(nullif(to_jsonb(si)->>'invoice_date', '')::date, current_date),
           nullif(to_jsonb(si)->>'due_date', '')::date,
           nullif(to_jsonb(si)->>'work_order_id', '')::uuid,
           coalesce(nullif(to_jsonb(si)->>'net_amount', '')::numeric, nullif(to_jsonb(si)->>'total_amount', '')::numeric, 0),
           coalesce(nullif(to_jsonb(si)->>'paid_amount', '')::numeric, 0),
           coalesce(nullif(to_jsonb(si)->>'balance_amount', '')::numeric, coalesce(nullif(to_jsonb(si)->>'net_amount', '')::numeric, nullif(to_jsonb(si)->>'total_amount', '')::numeric, 0) - coalesce(nullif(to_jsonb(si)->>'paid_amount', '')::numeric, 0)),
           public.app_canonical_bill_status(coalesce(to_jsonb(si)->>'status', 'Submitted'))
    from public.subcontractor_invoices si
    where (to_jsonb(si)->>'organisation_id')::uuid = v_org
  ), normalized as (
    select s.*, l.work_order_id, wo.work_order_no,
           case when count(l.id) over (partition by s.source_type, s.source_id) = 0 then 'unlinked'
                when sum(l.allocation_amount) over (partition by s.source_type, s.source_id) >= s.payable_amount then 'linked'
                else 'partially_linked' end as link_state
    from source_rows s
    left join public.work_order_bill_links l on l.organisation_id = s.organisation_id and l.bill_source_type = s.source_type and l.bill_source_id = s.source_id
    left join public.subcontractor_work_orders wo on wo.id = l.work_order_id and wo.organisation_id = s.organisation_id
    where (nullif(trim(p_input->>'search'), '') is null or s.bill_no ilike '%' || trim(p_input->>'search') || '%' or s.supplier_name ilike '%' || trim(p_input->>'search') || '%' or coalesce(wo.work_order_no, '') ilike '%' || trim(p_input->>'search') || '%')
      and (nullif(p_input->>'sourceType', '') is null or s.source_type = p_input->>'sourceType')
      and (nullif(p_input->>'status', '') is null or s.source_status = p_input->>'status')
  ), deduped as (
    select distinct on (source_type, source_id) * from normalized order by source_type, source_id, work_order_id nulls last
  )
  select count(*)::integer into v_total from deduped;

  with source_rows as (
    select pb.id as source_id, pb.organisation_id, 'purchase_bill'::text as source_type,
           pb.bill_number as bill_no, coalesce(v.company_name, 'Vendor') as supplier_name,
           pb.bill_date, pb.due_date, coalesce(pb.net_amount, pb.total_amount, 0)::numeric as payable_amount,
           coalesce(pb.paid_amount, 0)::numeric as paid_amount,
           coalesce(pb.balance_amount, greatest(coalesce(pb.net_amount, pb.total_amount, 0) - coalesce(pb.paid_amount, 0), 0))::numeric as balance_amount,
           public.app_canonical_bill_status(coalesce(pb.approval_status, pb.payment_status, 'Submitted')) as source_status
    from public.purchase_bills pb left join public.purchase_vendors v on v.id = pb.vendor_id where pb.organisation_id = v_org
    union all
    select si.id, (to_jsonb(si)->>'organisation_id')::uuid, 'subcontractor_invoice', coalesce(to_jsonb(si)->>'invoice_number', to_jsonb(si)->>'invoice_no', si.id::text), coalesce(to_jsonb(si)->>'subcontractor_name', 'Subcontractor'), coalesce(nullif(to_jsonb(si)->>'invoice_date', '')::date, current_date), nullif(to_jsonb(si)->>'due_date', '')::date, coalesce(nullif(to_jsonb(si)->>'net_amount', '')::numeric, nullif(to_jsonb(si)->>'total_amount', '')::numeric, 0), coalesce(nullif(to_jsonb(si)->>'paid_amount', '')::numeric, 0), coalesce(nullif(to_jsonb(si)->>'balance_amount', '')::numeric, coalesce(nullif(to_jsonb(si)->>'net_amount', '')::numeric, nullif(to_jsonb(si)->>'total_amount', '')::numeric, 0) - coalesce(nullif(to_jsonb(si)->>'paid_amount', '')::numeric, 0)), public.app_canonical_bill_status(coalesce(to_jsonb(si)->>'status', 'Submitted'))
    from public.subcontractor_invoices si where (to_jsonb(si)->>'organisation_id')::uuid = v_org
  ), linked as (
    select s.*, l.work_order_id, wo.work_order_no, coalesce(sum(l.allocation_amount), 0)::numeric as allocated
    from source_rows s left join public.work_order_bill_links l on l.organisation_id = s.organisation_id and l.bill_source_type = s.source_type and l.bill_source_id = s.source_id left join public.subcontractor_work_orders wo on wo.id = l.work_order_id and wo.organisation_id = s.organisation_id
    where (nullif(trim(p_input->>'search'), '') is null or s.bill_no ilike '%' || trim(p_input->>'search') || '%' or s.supplier_name ilike '%' || trim(p_input->>'search') || '%' or coalesce(wo.work_order_no, '') ilike '%' || trim(p_input->>'search') || '%')
      and (nullif(p_input->>'sourceType', '') is null or s.source_type = p_input->>'sourceType')
      and (nullif(p_input->>'status', '') is null or s.source_status = p_input->>'status')
    group by s.source_id, s.organisation_id, s.source_type, s.bill_no, s.supplier_name, s.bill_date, s.due_date, s.payable_amount, s.paid_amount, s.balance_amount, s.source_status, l.work_order_id, wo.work_order_no
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', source_id, 'organisationId', organisation_id, 'sourceType', source_type, 'sourceBillId', source_id,
    'billNo', bill_no, 'supplierName', supplier_name, 'billDate', bill_date, 'dueDate', due_date,
    'workOrderId', work_order_id, 'workOrderNo', work_order_no, 'purchaseOrderId', null,
    'grossAmount', payable_amount, 'approvedPayableAmount', payable_amount, 'paidAmount', paid_amount,
    'balanceAmount', greatest(balance_amount, 0), 'status', source_status,
    'linkState', case when allocated = 0 then 'unlinked' when allocated >= payable_amount then 'linked' else 'partially_linked' end
  ) order by bill_date desc, bill_no desc), '[]'::jsonb)
  into v_rows
  from (
    select * from linked
    order by bill_date desc, bill_no desc
    offset v_page * v_page_size limit v_page_size
  ) page_rows;

  return jsonb_build_object('rows', v_rows, 'totalCount', v_total, 'page', v_page, 'pageSize', v_page_size);
end;
$$;

grant execute on function public.bills_inbox(jsonb) to authenticated;

create or replace function public.work_order_link_bill(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_work_order_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_source_type text := p_input->>'sourceType';
  v_source_id uuid := nullif(p_input->>'sourceBillId', '')::uuid;
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_amount numeric := greatest(coalesce(nullif(p_input->>'allocationAmount', '')::numeric, 0), 0);
  v_source_org uuid;
  v_contract_amount numeric;
  v_existing_amount numeric;
  v_result jsonb;
begin
  if v_org is null or v_work_order_id is null or v_source_id is null or v_request_id is null or length(v_request_id) < 16 then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'work_orders.link');
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':work_order_link_bill:' || v_source_type || ':' || v_source_id::text));
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'work_order_link_bill' and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;
  if not exists (select 1 from public.subcontractor_work_orders where id = v_work_order_id and organisation_id = v_org) then raise exception using message = 'RECORD_NOT_FOUND', errcode = 'P0001'; end if;
  if v_source_type = 'purchase_bill' then
    select pb.organisation_id, greatest(coalesce(pb.net_amount, pb.total_amount, 0)) into v_source_org, v_contract_amount from public.purchase_bills pb where pb.id = v_source_id;
  elsif v_source_type = 'subcontractor_invoice' then
    select (to_jsonb(si)->>'organisation_id')::uuid, greatest(coalesce(nullif(to_jsonb(si)->>'net_amount', '')::numeric, nullif(to_jsonb(si)->>'total_amount', '')::numeric, 0)) into v_source_org, v_contract_amount from public.subcontractor_invoices si where si.id = v_source_id;
  else
    raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001';
  end if;
  if v_source_org is distinct from v_org or v_contract_amount is null then raise exception using message = 'CROSS_TENANT_REFERENCE', errcode = 'P0001'; end if;
  select coalesce(sum(allocation_amount), 0) into v_existing_amount from public.work_order_bill_links where organisation_id = v_org and bill_source_type = v_source_type and bill_source_id = v_source_id and work_order_id <> v_work_order_id;
  if v_existing_amount + v_amount > v_contract_amount then raise exception using message = 'OVER_BILLING', errcode = 'P0001'; end if;
  insert into public.work_order_bill_links (organisation_id, work_order_id, bill_source_type, bill_source_id, allocation_amount, created_by)
  values (v_org, v_work_order_id, v_source_type, v_source_id, v_amount, auth.uid())
  on conflict (organisation_id, bill_source_type, bill_source_id, work_order_id) do update set allocation_amount = excluded.allocation_amount;
  v_result := jsonb_build_object('workOrderId', v_work_order_id, 'sourceType', v_source_type, 'sourceBillId', v_source_id, 'allocationAmount', v_amount);
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'work_order_link_bill', v_request_id, auth.uid(), v_result);
  return v_result;
end;
$$;

grant execute on function public.work_order_link_bill(jsonb) to authenticated;

/* ============================================================================
   STEP 7 — COMMON PAYMENT REQUEST LIST/CREATE/APPROVE
   ========================================================================== */

create or replace function public.payment_requests_list(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_page integer := greatest(coalesce((p_input->>'page')::integer, 0), 0);
  v_page_size integer := least(greatest(coalesce((p_input->>'pageSize')::integer, 25), 1), 100);
  v_rows jsonb;
  v_total integer;
begin
  if v_org is null then raise exception using message = 'TENANT_NOT_FOUND', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'payment_requests.read');
  with base as (
    select pr.id, pr.organisation_id, pr.request_no,
           case when pr.source_type = 'subcontractor_invoice' then 'subcontractor_invoice' else 'purchase_bill' end as source_type,
           coalesce(pr.source_id, (pr.bill_ids)[1]) as source_id,
           pr.work_order_id, wo.work_order_no,
           coalesce(v.company_name, s.company_name, 'Payee') as payee_name,
           pr.amount_requested::numeric,
           coalesce(pr.approved_amount, 0)::numeric as approved_amount,
           coalesce(pr.paid_amount, 0)::numeric as paid_amount,
           greatest(coalesce(pr.approved_amount, pr.amount_requested, 0) - coalesce(pr.paid_amount, 0), 0)::numeric as balance_amount,
           coalesce(pr.priority, 'Normal') as priority, pr.due_date,
           coalesce(pr.status, 'Pending') as status,
           coalesce(pr.approval_status, pr.status, 'Pending Approval') as approval_status,
           pr.workflow_step,
           case when pr.source_type = 'subcontractor_invoice' then 'subcontractor' else 'purchase' end as settlement_type
    from public.payment_requests pr
    left join public.purchase_vendors v on v.id = pr.vendor_id
    left join public.subcontractors s on s.id = pr.subcontractor_id
    left join public.subcontractor_work_orders wo on wo.id = pr.work_order_id and wo.organisation_id = pr.organisation_id
    where pr.organisation_id = v_org and coalesce(pr.is_deleted, false) = false
      and (nullif(trim(p_input->>'search'), '') is null or pr.request_no ilike '%' || trim(p_input->>'search') || '%' or coalesce(v.company_name, s.company_name, '') ilike '%' || trim(p_input->>'search') || '%' or coalesce(wo.work_order_no, '') ilike '%' || trim(p_input->>'search') || '%')
      and (nullif(p_input->>'status', '') is null or coalesce(pr.status, 'Pending') = p_input->>'status')
      and (nullif(p_input->>'sourceType', '') is null or case when pr.source_type = 'subcontractor_invoice' then 'subcontractor_invoice' else 'purchase_bill' end = p_input->>'sourceType')
  )
  select count(*)::integer into v_total from base;
  with base as (
    select pr.id, pr.organisation_id, pr.request_no, case when pr.source_type = 'subcontractor_invoice' then 'subcontractor_invoice' else 'purchase_bill' end as source_type, coalesce(pr.source_id, (pr.bill_ids)[1]) as source_id, pr.work_order_id, wo.work_order_no, coalesce(v.company_name, s.company_name, 'Payee') as payee_name, pr.amount_requested::numeric, coalesce(pr.approved_amount, 0)::numeric as approved_amount, coalesce(pr.paid_amount, 0)::numeric as paid_amount, greatest(coalesce(pr.approved_amount, pr.amount_requested, 0) - coalesce(pr.paid_amount, 0), 0)::numeric as balance_amount, coalesce(pr.priority, 'Normal') as priority, pr.due_date, coalesce(pr.status, 'Pending') as status, coalesce(pr.approval_status, pr.status, 'Pending Approval') as approval_status, pr.workflow_step, case when pr.source_type = 'subcontractor_invoice' then 'subcontractor' else 'purchase' end as settlement_type
    from public.payment_requests pr left join public.purchase_vendors v on v.id = pr.vendor_id left join public.subcontractors s on s.id = pr.subcontractor_id left join public.subcontractor_work_orders wo on wo.id = pr.work_order_id and wo.organisation_id = pr.organisation_id
    where pr.organisation_id = v_org and coalesce(pr.is_deleted, false) = false and (nullif(trim(p_input->>'search'), '') is null or pr.request_no ilike '%' || trim(p_input->>'search') || '%' or coalesce(v.company_name, s.company_name, '') ilike '%' || trim(p_input->>'search') || '%' or coalesce(wo.work_order_no, '') ilike '%' || trim(p_input->>'search') || '%') and (nullif(p_input->>'status', '') is null or coalesce(pr.status, 'Pending') = p_input->>'status') and (nullif(p_input->>'sourceType', '') is null or case when pr.source_type = 'subcontractor_invoice' then 'subcontractor_invoice' else 'purchase_bill' end = p_input->>'sourceType')
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'organisationId', organisation_id, 'requestNo', request_no, 'sourceType', source_type, 'sourceBillId', source_id, 'workOrderId', work_order_id, 'workOrderNo', work_order_no, 'payeeName', payee_name, 'amountRequested', amount_requested, 'approvedAmount', approved_amount, 'paidAmount', paid_amount, 'balanceAmount', balance_amount, 'priority', priority, 'dueDate', due_date, 'status', status, 'approvalStatus', approval_status, 'workflowStep', workflow_step, 'settlementType', settlement_type) order by due_date nulls last, request_no desc), '[]'::jsonb)
  into v_rows
  from (
    select * from base
    order by due_date nulls last, request_no desc
    offset v_page * v_page_size limit v_page_size
  ) page_rows;
  return jsonb_build_object('rows', v_rows, 'totalCount', v_total, 'page', v_page, 'pageSize', v_page_size);
end;
$$;

grant execute on function public.payment_requests_list(jsonb) to authenticated;

create or replace function public.payment_request_create(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_source_type text := p_input->>'sourceType';
  v_source_id uuid := nullif(p_input->>'sourceBillId', '')::uuid;
  v_work_order_id uuid := nullif(p_input->>'workOrderId', '')::uuid;
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_amount numeric := (p_input->>'amountRequested')::numeric;
  v_balance numeric;
  v_vendor_id uuid;
  v_subcontractor_id uuid;
  v_request_no text;
  v_payment_id uuid;
  v_result jsonb;
begin
  if v_org is null or v_source_id is null or v_request_id is null or v_amount <= 0 then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'payment_requests.create');
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':payment_request_create:' || v_request_id));
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'payment_request_create' and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;

  if v_source_type = 'purchase_bill' then
    select pb.vendor_id, greatest(coalesce(pb.balance_amount, coalesce(pb.net_amount, pb.total_amount) - coalesce(pb.paid_amount, 0)), 0)
      into v_vendor_id, v_balance
    from public.purchase_bills pb where pb.id = v_source_id and pb.organisation_id = v_org;
  elsif v_source_type = 'subcontractor_invoice' then
    select nullif(to_jsonb(si)->>'subcontractor_id', '')::uuid,
           greatest(coalesce(nullif(to_jsonb(si)->>'balance_amount', '')::numeric, nullif(to_jsonb(si)->>'net_amount', '')::numeric, nullif(to_jsonb(si)->>'total_amount', '')::numeric, 0) - coalesce(nullif(to_jsonb(si)->>'paid_amount', '')::numeric, 0)), 0)
      into v_subcontractor_id, v_balance
    from public.subcontractor_invoices si
    where si.id = v_source_id and (to_jsonb(si)->>'organisation_id')::uuid = v_org;
  else
    raise exception using message = 'SOURCE_NOT_ELIGIBLE', errcode = 'P0001';
  end if;
  if v_balance is null then raise exception using message = 'CROSS_TENANT_REFERENCE', errcode = 'P0001'; end if;
  if v_amount > v_balance then raise exception using message = 'OVER_BILLING', errcode = 'P0001'; end if;
  if exists (select 1 from public.payment_request_source_links l join public.payment_requests pr on pr.id = l.payment_request_id where l.organisation_id = v_org and l.source_type = v_source_type and l.source_id = v_source_id and pr.status not in ('Paid', 'Cancelled', 'Rejected')) then raise exception using message = 'DUPLICATE_REQUEST', errcode = 'P0001'; end if;

  v_payment_id := gen_random_uuid();
  v_request_no := public.app_next_number(v_org, 'payment_request');
  insert into public.payment_requests (id, organisation_id, request_no, vendor_id, subcontractor_id, request_date, amount_requested, approved_amount, paid_amount, priority, due_date, payment_mode, bank_account_id, reason, status, approval_status, workflow_step, requested_by, source_type, source_id, work_order_id, is_deleted)
  values (v_payment_id, v_org, v_request_no, v_vendor_id, v_subcontractor_id, current_date, v_amount, 0, 0, coalesce(p_input->>'priority', 'Normal'), nullif(p_input->>'dueDate', '')::date, p_input->>'paymentMode', nullif(p_input->>'bankAccountId', '')::uuid, p_input->>'reason', 'Pending', 'Pending Approval', 'submitted', auth.uid(), v_source_type, v_source_id, v_work_order_id, false);
  insert into public.payment_request_source_links (organisation_id, payment_request_id, source_type, source_id, work_order_id) values (v_org, v_payment_id, v_source_type, v_source_id, v_work_order_id);
  v_result := jsonb_build_object('id', v_payment_id, 'organisationId', v_org, 'requestNo', v_request_no, 'status', 'Pending', 'sourceType', v_source_type, 'sourceId', v_source_id, 'amountRequested', v_amount);
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'payment_request_create', v_request_id, auth.uid(), v_result);
  return v_result;
exception when unique_violation then
  raise exception using message = 'DUPLICATE_REQUEST', errcode = 'P0001';
end;
$$;

grant execute on function public.payment_request_create(jsonb) to authenticated;

create or replace function public.payment_request_bind_approval(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'paymentRequestId', '')::uuid;
  v_approval_id uuid := nullif(p_input->>'approvalId', '')::uuid;
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_approval_id is null then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'payment_requests.create');
  update public.payment_requests
  set approval_id = v_approval_id, status = 'Pending', approval_status = 'Pending Approval', workflow_step = 'submitted', updated_at = now()
  where id = v_id and organisation_id = v_org and coalesce(is_deleted, false) = false;
  if not found then raise exception using message = 'RECORD_NOT_FOUND', errcode = 'P0001'; end if;
  v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'approvalId', v_approval_id, 'status', 'Pending', 'approvalStatus', 'Pending Approval');
  return v_result;
end;
$$;

grant execute on function public.payment_request_bind_approval(jsonb) to authenticated;

create or replace function public.payment_request_approve(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_id uuid := nullif(p_input->>'paymentRequestId', '')::uuid;
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_request_id is null or length(v_request_id) < 16 then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, 'payment_requests.approve');
  perform pg_advisory_xact_lock(hashtext(v_org::text || ':payment_request_approve:' || v_id::text));
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'payment_request_approve' and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;
  update public.payment_requests set status = 'Approved', approval_status = 'Approved', workflow_step = 'approved', approved_amount = amount_requested, approved_by = auth.uid(), approved_at = now(), updated_at = now() where id = v_id and organisation_id = v_org and status in ('Pending', 'Returned');
  if not found then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
  v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'status', 'Approved', 'approvalStatus', 'Approved');
  insert into public.domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'payment_request_approve', v_request_id, auth.uid(), v_result);
  return v_result;
end;
$$;

grant execute on function public.payment_request_approve(jsonb) to authenticated;

-- Fail closed until a source-specific posting adapter is installed and tested. This
-- prevents a common approval envelope from pretending that a purchase or subcontractor
-- settlement was posted without touching the authoritative settlement ledger.
create or replace function public.payment_request_release(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_require_org_permission(nullif(p_input->>'organisationId', '')::uuid, 'payments.post');
  raise exception using message = 'SOURCE_NOT_ELIGIBLE', errcode = 'P0001';
end;
$$;

grant execute on function public.payment_request_release(jsonb) to authenticated;

create or replace function public.approval_transition(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_type text := p_input->>'referenceType';
  v_id uuid := nullif(p_input->>'referenceId', '')::uuid;
  v_action text := lower(coalesce(p_input->>'action', ''));
  v_request_id text := nullif(trim(p_input->>'clientRequestId'), '');
  v_result jsonb;
begin
  if v_org is null or v_id is null or v_request_id is null or length(v_request_id) < 16 or v_action not in ('approve', 'return', 'resubmit') then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  select response into v_result from public.domain_idempotency_keys where organisation_id = v_org and operation = 'approval_transition_' || v_type || '_' || v_action and client_request_id = v_request_id;
  if v_result is not null then return v_result; end if;
  if v_type = 'work_orders' then
    perform public.app_require_org_permission(v_org, case v_action when 'approve' then 'work_orders.approve' else 'work_orders.submit' end);
    perform pg_advisory_xact_lock(hashtext(v_org::text || ':approval_transition:work_orders:' || v_id::text));
    if v_action = 'approve' then
      update public.subcontractor_work_orders set status = 'Approved', approval_status = 'Approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid(), updated_at = now() where id = v_id and organisation_id = v_org and public.app_canonical_work_order_status(status) = 'In Review' and public.app_canonical_approval_status(approval_status) = 'Pending Approval';
    elsif v_action = 'return' then
      update public.subcontractor_work_orders set status = 'In Review', approval_status = 'Returned', updated_by = auth.uid(), updated_at = now() where id = v_id and organisation_id = v_org and public.app_canonical_work_order_status(status) = 'In Review';
    else
      update public.subcontractor_work_orders set status = 'In Review', approval_status = 'Pending Approval', updated_by = auth.uid(), updated_at = now() where id = v_id and organisation_id = v_org and public.app_canonical_work_order_status(status) in ('Draft', 'In Review');
    end if;
    if not found then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
    v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'referenceType', v_type, 'action', v_action, 'status', case when v_action = 'approve' then 'Approved' else 'In Review' end, 'approvalStatus', case v_action when 'approve' then 'Approved' when 'return' then 'Returned' else 'Pending Approval' end);
    insert into public.work_order_audit_events (organisation_id, work_order_id, event_type, actor_id, request_id, after_state) values (v_org, v_id, 'approval_' || v_action, auth.uid(), v_request_id, v_result);
  elsif v_type = 'payment_requests' then
    perform public.app_require_org_permission(v_org, case v_action when 'approve' then 'payment_requests.approve' else 'payment_requests.create' end);
    perform pg_advisory_xact_lock(hashtext(v_org::text || ':approval_transition:payment_requests:' || v_id::text));
    if v_action = 'approve' then
      update public.payment_requests set status = 'Approved', approval_status = 'Approved', workflow_step = 'approved', approved_amount = amount_requested, approved_by = auth.uid(), approved_at = now(), updated_at = now() where id = v_id and organisation_id = v_org and status in ('Pending', 'Returned');
    elsif v_action = 'return' then
      update public.payment_requests set status = 'Returned', approval_status = 'Returned', workflow_step = 'returned', updated_at = now() where id = v_id and organisation_id = v_org and status in ('Pending', 'Returned');
    else
      update public.payment_requests set status = 'Pending', approval_status = 'Pending Approval', workflow_step = 'submitted', updated_at = now() where id = v_id and organisation_id = v_org and status in ('Returned', 'Pending');
    end if;
    if not found then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
    v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'referenceType', v_type, 'action', v_action, 'status', case when v_action = 'approve' then 'Approved' when v_action = 'return' then 'Returned' else 'Pending' end, 'approvalStatus', case when v_action = 'approve' then 'Approved' when v_action = 'return' then 'Returned' else 'Pending Approval' end);
    elsif v_type in ('purchase_payments', 'subcontractor_payments') then
    perform public.app_require_org_permission(v_org, 'payments.approve');
    perform pg_advisory_xact_lock(hashtext(v_org::text || ':approval_transition:' || v_type || ':' || v_id::text));
    if v_type = 'purchase_payments' then
      if v_action = 'approve' then
        update public.purchase_payments set workflow_step = 'approved', approval_status = 'Approved', approved_at = now(), updated_at = now() where id = v_id and organisation_id = v_org and coalesce(approval_status, 'Pending') in ('Pending', 'Pending Approval', 'Returned');
      elsif v_action = 'return' then
        update public.purchase_payments set workflow_step = 'returned', approval_status = 'Returned', updated_at = now() where id = v_id and organisation_id = v_org;
      else
        update public.purchase_payments set workflow_step = 'pending', approval_status = 'Pending', updated_at = now() where id = v_id and organisation_id = v_org;
      end if;
    else
      if v_action = 'approve' then
        update public.subcontractor_payments set workflow_step = 'approved', approval_status = 'Approved', approved_at = now(), updated_at = now() where id = v_id and organisation_id = v_org and coalesce(approval_status, 'Pending') in ('Pending', 'Pending Approval', 'Returned');
      elsif v_action = 'return' then
        update public.subcontractor_payments set workflow_step = 'returned', approval_status = 'Returned', updated_at = now() where id = v_id and organisation_id = v_org;
      else
        update public.subcontractor_payments set workflow_step = 'pending', approval_status = 'Pending', updated_at = now() where id = v_id and organisation_id = v_org;
      end if;
    end if;
    if not found then raise exception using message = 'INVALID_STATE_TRANSITION', errcode = 'P0001'; end if;
    v_result := jsonb_build_object('id', v_id, 'organisationId', v_org, 'referenceType', v_type, 'action', v_action, 'status', 'Pending', 'approvalStatus', case when v_action = 'approve' then 'Approved' when v_action = 'return' then 'Returned' else 'Pending' end);
  else
    raise exception using message = 'SOURCE_NOT_ELIGIBLE', errcode = 'P0001';
  end if;
  insert into public.domain_idempotency_keys
 (organisation_id, operation, client_request_id, actor_id, response) values (v_org, 'approval_transition_' || v_type || '_' || v_action, v_request_id, auth.uid(), v_result) on conflict do nothing;
  return v_result;
end;
$$;

grant execute on function public.approval_transition(jsonb) to authenticated;

/* ============================================================================
   STEP 8 — IMMUTABLE SNAPSHOT READ RPC
   ========================================================================== */

create or replace function public.document_snapshot_get(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid := nullif(p_input->>'organisationId', '')::uuid;
  v_type text := nullif(p_input->>'documentType', '');
  v_id uuid := nullif(p_input->>'documentId', '')::uuid;
  v_snapshot jsonb;
begin
  if v_org is null or v_type is null or v_id is null then raise exception using message = 'VALIDATION_FAILED', errcode = 'P0001'; end if;
  perform public.app_require_org_permission(v_org, case v_type when 'Work Order' then 'work_orders.read' when 'Bill' then 'bills.read' when 'Payment Request' then 'payment_requests.read' else 'work_orders.read' end);
  select jsonb_build_object('snapshotId', id, 'organisationId', organisation_id, 'documentType', document_type, 'documentId', document_id, 'documentVersion', document_version, 'templateId', template_id, 'templateCode', template_code, 'templateVersion', template_revision, 'sourceHash', source_hash, 'snapshotHash', snapshot_hash, 'contentType', content_type, 'storagePath', storage_path, 'signedUrl', signed_url, 'generatedAt', generated_at, 'expiresAt', expires_at)
  into v_snapshot
  from public.document_snapshots
  where organisation_id = v_org and document_type = v_type and document_id = v_id
  order by document_version desc
  limit 1;
  if v_snapshot is null then raise exception using message = 'TEMPLATE_NOT_FOUND', errcode = 'P0001'; end if;
  return v_snapshot;
end;
$$;

grant execute on function public.document_snapshot_get(jsonb) to authenticated;

-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by default. Revoke
-- that default explicitly; only authenticated users may reach these helpers/RPCs.
revoke all on function public.app_is_org_member(uuid) from public;
revoke all on function public.app_has_org_permission(uuid, text) from public;
revoke all on function public.app_require_org_permission(uuid, text) from public;
revoke all on function public.app_next_number(uuid, text) from public;
revoke all on function public.app_canonical_work_order_status(text) from public;
revoke all on function public.app_canonical_approval_status(text) from public;
revoke all on function public.common_bridge_guard_active_payment_request() from public;
revoke all on function public.work_orders_list(jsonb) from public;
revoke all on function public.work_order_detail(jsonb) from public;
revoke all on function public.work_order_save_draft(jsonb) from public;
revoke all on function public.work_order_submit_for_approval(jsonb) from public;
revoke all on function public.work_order_bind_approval(jsonb) from public;
revoke all on function public.work_order_approve(jsonb) from public;
revoke all on function public.work_order_issue(jsonb) from public;
revoke all on function public.bills_inbox(jsonb) from public;
revoke all on function public.work_order_link_bill(jsonb) from public;
revoke all on function public.payment_requests_list(jsonb) from public;
revoke all on function public.payment_request_create(jsonb) from public;
revoke all on function public.payment_request_bind_approval(jsonb) from public;
revoke all on function public.payment_request_approve(jsonb) from public;
revoke all on function public.payment_request_release(jsonb) from public;
revoke all on function public.document_snapshot_get(jsonb) from public;
revoke all on function public.approval_transition(jsonb) from public;

-- No helper EXECUTE grants are added. The security-definer RPC owner may invoke these
-- functions internally, while browser roles cannot call them directly.

-- The RPC grants above remain the intended caller surface.

/* ============================================================================
   STEP 9 — MANUAL VERIFICATION CHECKLIST
   ========================================================================== */

-- Run these only after the preceding steps have been reviewed and committed:
-- 1. Verify no new table has a USING (true) or WITH CHECK (true) policy.
-- 2. Verify unauthorised users cannot call each RPC or supply another organisation_id.
-- 3. Verify draft save twice with one clientRequestId returns the same id.
-- 4. Verify two concurrent app_next_number calls return distinct values.
-- 5. Verify an approved source bill cannot receive a second active Payment Request.
-- 6. Verify payment_request_release fails closed until source-specific posting adapters exist.
-- 7. Verify direct legacy writes are removed or blocked before enabling production cut-over.
-- 8. Run the application focused tests and a database transaction/concurrency test suite.
