-- Site Expenses Module: expense_entries + consumable_catalog

-- Consumable catalog (org-wide, pre-seeded categories)
create table if not exists consumable_catalog (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  category text not null,
  preferred_brand text,
  typical_unit text default 'piece',
  created_at timestamptz not null default now(),
  unique(organisation_id, name, category)
);

alter table consumable_catalog enable row level security;

create policy "consumable_catalog_select" on consumable_catalog
  for select using (true);

create policy "consumable_catalog_insert" on consumable_catalog
  for insert with check (
    organisation_id = (select (current_setting('request.jwt.claims', true)::json->>'organisation_id')::uuid)
  );

-- Expense entries
create type expense_entry_type as enum (
  'SITE_EXPENSE_REQUEST',
  'SITE_EXPENSE_POST_PURCHASE'
);

create type expense_item_type as enum (
  'CONSUMABLE',
  'MATERIAL',
  'BILLABLE'
);

create type expense_category as enum (
  'CONSUMABLES',
  'CRANE_CHARGES',
  'LABOUR',
  'LOCAL_PURCHASE',
  'OTHER_CHARGES'
);

create type expense_status as enum (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PAID'
);

create table if not exists expense_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  entry_type expense_entry_type not null default 'SITE_EXPENSE_REQUEST',
  category expense_category not null,
  item_type expense_item_type not null default 'CONSUMABLE',
  consumable_id uuid references consumable_catalog(id) on delete set null,
  material_id uuid references materials(id) on delete set null,
  description text not null,
  quantity numeric(12,2) default 1,
  unit_price numeric(12,2),
  amount numeric(12,2) not null,
  gst_amount numeric(12,2) default 0,
  total_amount numeric(12,2) not null,
  required_date date,
  paid_date date,
  payment_method text,
  vendor_name text,
  vendor_invoice_ref text,
  notes text,
  status expense_status not null default 'DRAFT',

  -- Denormalised for convenience
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  requested_by uuid not null references auth.users(id),
  approval_id uuid references approvals(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table expense_entries enable row level security;

create policy "expense_entries_select" on expense_entries
  for select using (
    organisation_id = (select (current_setting('request.jwt.claims', true)::json->>'organisation_id')::uuid)
  );

create policy "expense_entries_insert" on expense_entries
  for insert with check (
    organisation_id = (select (current_setting('request.jwt.claims', true)::json->>'organisation_id')::uuid)
  );

create policy "expense_entries_update" on expense_entries
  for update using (
    organisation_id = (select (current_setting('request.jwt.claims', true)::json->>'organisation_id')::uuid)
  );

-- Update approval_type check constraint to include site expense types
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_name = 'approvals' and table_schema = 'public'
  ) then
    alter table approvals
      drop constraint if exists approvals_approval_type_check;
    alter table approvals
      add constraint approvals_approval_type_check
        check (approval_type = any (array[
          'PURCHASE_ORDER',
          'WORK_ORDER',
          'QUOTATION',
          'INVOICE',
          'PROFORMA_INVOICE',
          'PAYMENT_REQUEST',
          'PURCHASE_PAYMENT',
          'SUBCONTRACTOR_PAYMENT',
          'MATERIAL_DISPATCH',
          'SITE_VISIT',
          'EXPENSE_CLAIM',
          'SITE_REPORT_REQUEST',
          'SITE_EXPENSE_REQUEST',
          'SITE_EXPENSE_POST_PURCHASE'
        ]));
  end if;
end $$;
