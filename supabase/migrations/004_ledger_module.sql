begin;

alter table public.clients
  add column if not exists org_id uuid references public.organisations(id) on delete restrict;

do $$
declare
  v_org_count int;
  v_single_org_id uuid;
begin
  select count(*) into v_org_count
  from public.organisations;

  select id into v_single_org_id
  from public.organisations
  order by id
  limit 1;

  if v_org_count = 1 then
    update public.clients
    set org_id = v_single_org_id
    where org_id is null;
  end if;
end $$;

create unique index if not exists clients_id_org_id_unique
  on public.clients(id, org_id);

create index if not exists clients_org_id_idx
  on public.clients(org_id);

alter table public.invoices
  add column if not exists org_id uuid references public.organisations(id) on delete restrict,
  add column if not exists invoice_no text,
  add column if not exists invoice_date date,
  add column if not exists due_date date,
  add column if not exists remarks text;

update public.invoices i
set
  org_id = c.org_id,
  invoice_date = coalesce(i.invoice_date, i.created_at::date, current_date),
  due_date = coalesce(i.due_date, i.invoice_date, i.created_at::date, current_date)
from public.clients c
where i.client_id = c.id
  and (i.org_id is null or i.invoice_date is null or i.due_date is null);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_id uuid null references public.invoices(id) on delete set null,
  receipt_no text,
  amount numeric(15,2) not null check (amount > 0),
  receipt_date date not null default current_date,
  payment_type text,
  remarks text,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.receipts add column if not exists payment_type text;

create index if not exists invoices_org_id_idx
  on public.invoices(org_id);

create index if not exists invoices_org_client_due_idx
  on public.invoices(org_id, client_id, due_date);

create index if not exists receipts_org_id_idx
  on public.receipts(org_id);

create index if not exists receipts_org_client_date_idx
  on public.receipts(org_id, client_id, receipt_date desc);

create or replace function public.user_can_access_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members m
    where m.organisation_id = p_org_id
      and m.user_id = auth.uid()
      and coalesce(lower(m.status), 'active') = 'active'
  );
$$;

create or replace function public.ensure_ledger_client_org_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_org_id uuid;
begin
  if new.org_id is null then
    raise exception 'org_id is required.';
  end if;

  if new.client_id is null then
    raise exception 'client_id is required.';
  end if;

  select c.org_id into v_client_org_id
  from public.clients c
  where c.id = new.client_id
  limit 1;

  if v_client_org_id is null then
    raise exception 'Selected client is not linked to any organisation.';
  end if;

  if v_client_org_id <> new.org_id then
    raise exception 'Selected client does not belong to the provided organisation.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_validate_client_org on public.invoices;
create trigger trg_invoices_validate_client_org
before insert or update on public.invoices
for each row execute function public.ensure_ledger_client_org_match();

drop trigger if exists trg_receipts_validate_client_org on public.receipts;
create trigger trg_receipts_validate_client_org
before insert or update on public.receipts
for each row execute function public.ensure_ledger_client_org_match();

alter table public.invoices enable row level security;
alter table public.receipts enable row level security;

drop policy if exists invoices_tenant_select on public.invoices;
create policy invoices_tenant_select
on public.invoices
for select
to authenticated
using (public.user_can_access_org(org_id));

drop policy if exists invoices_tenant_insert on public.invoices;
create policy invoices_tenant_insert
on public.invoices
for insert
to authenticated
with check (public.user_can_access_org(org_id));

drop policy if exists invoices_tenant_update on public.invoices;
create policy invoices_tenant_update
on public.invoices
for update
to authenticated
using (public.user_can_access_org(org_id))
with check (public.user_can_access_org(org_id));

drop policy if exists invoices_tenant_delete on public.invoices;
create policy invoices_tenant_delete
on public.invoices
for delete
to authenticated
using (public.user_can_access_org(org_id));

drop policy if exists receipts_tenant_select on public.receipts;
create policy receipts_tenant_select
on public.receipts
for select
to authenticated
using (public.user_can_access_org(org_id));

drop policy if exists receipts_tenant_insert on public.receipts;
create policy receipts_tenant_insert
on public.receipts
for insert
to authenticated
with check (public.user_can_access_org(org_id));

drop policy if exists receipts_tenant_update on public.receipts;
create policy receipts_tenant_update
on public.receipts
for update
to authenticated
using (public.user_can_access_org(org_id))
with check (public.user_can_access_org(org_id));

drop policy if exists receipts_tenant_delete on public.receipts;
create policy receipts_tenant_delete
on public.receipts
for delete
to authenticated
using (public.user_can_access_org(org_id));

commit;
