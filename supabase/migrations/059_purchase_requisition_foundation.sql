-- Phase 1: Unified Requisition Foundation (additive)

create table if not exists public.purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  requisition_number text not null,
  purpose_type text not null check (purpose_type in ('PROJECT', 'SITE_WORK', 'COMPANY_EXPENSE', 'MAINTENANCE', 'CAPEX', 'OTHER')),
  project_id uuid null,
  site_id uuid null,
  cost_center_id uuid null,
  work_order_id uuid null,
  required_date date null,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Emergency')),
  status text not null default 'Draft' check (status in ('Draft', 'Pending', 'Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled', 'Cancelled')),
  notes text null,
  requested_by uuid null,
  requested_by_name text null,
  source_context text not null default 'CENTRAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, requisition_number)
);

create table if not exists public.purchase_requisition_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  requisition_id uuid not null references public.purchase_requisitions(id) on delete cascade,
  line_no int not null,
  item_id uuid null,
  variant_id uuid null,
  item_name text not null,
  variant_name text null,
  uom text null,
  requested_qty numeric(14,3) not null default 0,
  store_allocated_qty numeric(14,3) not null default 0,
  po_qty numeric(14,3) not null default 0,
  received_qty numeric(14,3) not null default 0,
  open_qty numeric(14,3) not null default 0,
  source_type text null check (source_type in ('FULFILL_FROM_STORE', 'PROCURE')),
  status text not null default 'Open' check (status in ('Open', 'Partially Fulfilled', 'Fulfilled', 'Cancelled')),
  required_date date null,
  notes text null,
  -- Existing PO tables will be extended with these links instead of recreation
  purchase_order_line_id uuid null,
  availability_inquiry_line_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requisition_id, line_no)
);

create index if not exists idx_purchase_requisitions_org_status on public.purchase_requisitions(organisation_id, status);
create index if not exists idx_purchase_requisitions_org_project on public.purchase_requisitions(organisation_id, project_id);
create index if not exists idx_purchase_requisition_lines_req on public.purchase_requisition_lines(requisition_id);
create index if not exists idx_purchase_requisition_lines_open on public.purchase_requisition_lines(organisation_id, status, open_qty);

create or replace function public.set_updated_at_purchase_requisitions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_requisitions_updated_at on public.purchase_requisitions;
create trigger trg_purchase_requisitions_updated_at
before update on public.purchase_requisitions
for each row execute function public.set_updated_at_purchase_requisitions();

drop trigger if exists trg_purchase_requisition_lines_updated_at on public.purchase_requisition_lines;
create trigger trg_purchase_requisition_lines_updated_at
before update on public.purchase_requisition_lines
for each row execute function public.set_updated_at_purchase_requisitions();

alter table public.purchase_requisitions enable row level security;
alter table public.purchase_requisition_lines enable row level security;

drop policy if exists "purchase_requisitions_org_access" on public.purchase_requisitions;
create policy "purchase_requisitions_org_access" on public.purchase_requisitions
for all
using (
  organisation_id in (
    select organisation_id from public.organisation_members where user_id = auth.uid()
  )
)
with check (
  organisation_id in (
    select organisation_id from public.organisation_members where user_id = auth.uid()
  )
);

drop policy if exists "purchase_requisition_lines_org_access" on public.purchase_requisition_lines;
create policy "purchase_requisition_lines_org_access" on public.purchase_requisition_lines
for all
using (
  organisation_id in (
    select organisation_id from public.organisation_members where user_id = auth.uid()
  )
)
with check (
  organisation_id in (
    select organisation_id from public.organisation_members where user_id = auth.uid()
  )
);

