-- Phase 3: Availability Inquiry (non-binding)

create table if not exists public.availability_inquiries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  inquiry_number text not null,
  requisition_id uuid not null references public.purchase_requisitions(id) on delete cascade,
  status text not null default 'Open' check (status in ('Open', 'Closed', 'Cancelled')),
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, inquiry_number)
);

create table if not exists public.availability_inquiry_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  inquiry_id uuid not null references public.availability_inquiries(id) on delete cascade,
  requisition_line_id uuid not null references public.purchase_requisition_lines(id) on delete cascade,
  item_id uuid null,
  item_name text not null,
  required_qty numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_responses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  inquiry_line_id uuid not null references public.availability_inquiry_lines(id) on delete cascade,
  vendor_id uuid not null references public.purchase_vendors(id) on delete restrict,
  available_qty numeric(14,3) not null default 0,
  promise_date date null,
  valid_till date null,
  remarks text null,
  po_ready_qty numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_avail_inquiries_org on public.availability_inquiries(organisation_id, created_at desc);
create index if not exists idx_avail_inquiry_lines_inquiry on public.availability_inquiry_lines(inquiry_id);
create index if not exists idx_avail_responses_line on public.availability_responses(inquiry_line_id);

alter table public.availability_inquiries enable row level security;
alter table public.availability_inquiry_lines enable row level security;
alter table public.availability_responses enable row level security;

drop policy if exists "availability_inquiries_org_access" on public.availability_inquiries;
create policy "availability_inquiries_org_access" on public.availability_inquiries
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

drop policy if exists "availability_inquiry_lines_org_access" on public.availability_inquiry_lines;
create policy "availability_inquiry_lines_org_access" on public.availability_inquiry_lines
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

drop policy if exists "availability_responses_org_access" on public.availability_responses;
create policy "availability_responses_org_access" on public.availability_responses
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

