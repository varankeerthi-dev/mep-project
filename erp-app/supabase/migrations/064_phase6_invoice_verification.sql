-- Phase 6: Invoice Verification (3-way basic)

create table if not exists public.purchase_iv_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique,
  qty_tolerance_percent numeric(6,2) not null default 2.00,
  value_tolerance_percent numeric(6,2) not null default 2.00,
  date_tolerance_days int not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_invoice_verifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  bill_id uuid not null references public.purchase_bills(id) on delete cascade,
  po_id uuid null references public.purchase_orders(id) on delete set null,
  verification_status text not null default 'PENDING' check (verification_status in ('PENDING', 'PASSED', 'FAILED', 'WARN')),
  qty_variance_percent numeric(8,3) not null default 0,
  value_variance_percent numeric(8,3) not null default 0,
  date_variance_days int not null default 0,
  message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, bill_id)
);

create index if not exists idx_purchase_iv_bill on public.purchase_invoice_verifications(organisation_id, bill_id);

alter table public.purchase_iv_settings enable row level security;
alter table public.purchase_invoice_verifications enable row level security;

drop policy if exists "purchase_iv_settings_org_access" on public.purchase_iv_settings;
create policy "purchase_iv_settings_org_access" on public.purchase_iv_settings
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

drop policy if exists "purchase_iv_org_access" on public.purchase_invoice_verifications;
create policy "purchase_iv_org_access" on public.purchase_invoice_verifications
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

create or replace function public.verify_purchase_bill_3way(
  p_organisation_id uuid,
  p_bill_id uuid
)
returns text
language plpgsql
security definer
as $$
declare
  v_bill record;
  v_po record;
  v_set record;
  v_received numeric := 0;
  v_qty_variance numeric := 0;
  v_value_variance numeric := 0;
  v_date_variance int := 0;
  v_status text := 'PASSED';
  v_message text := '3-way check passed';
begin
  select * into v_bill
  from public.purchase_bills
  where id = p_bill_id and organisation_id = p_organisation_id;
  if v_bill.id is null then
    raise exception 'Bill not found';
  end if;

  select * into v_po
  from public.purchase_orders
  where id = v_bill.po_id and organisation_id = p_organisation_id;

  select * into v_set
  from public.purchase_iv_settings
  where organisation_id = p_organisation_id;
  if v_set.id is null then
    insert into public.purchase_iv_settings(organisation_id) values (p_organisation_id)
    returning * into v_set;
  end if;

  if v_po.id is not null then
    select coalesce(sum(grl.received_qty), 0) into v_received
    from public.goods_receipts gr
    join public.goods_receipt_lines grl on grl.goods_receipt_id = gr.id
    where gr.organisation_id = p_organisation_id
      and gr.po_id = v_po.id;

    if coalesce(v_bill.total_amount,0) > 0 and coalesce(v_po.grand_total,0) > 0 then
      v_value_variance := abs((v_bill.total_amount - v_po.grand_total) / nullif(v_po.grand_total,0)) * 100;
    end if;

    if coalesce(v_po.po_date, current_date) is not null and coalesce(v_bill.bill_date, current_date) is not null then
      v_date_variance := abs(v_bill.bill_date - v_po.po_date);
    end if;

    -- qty proxy: compare GR total with PO subtotal quantity proxy from items
    declare v_po_qty numeric := 0;
    begin
      select coalesce(sum(quantity),0) into v_po_qty
      from public.purchase_order_items
      where po_id = v_po.id and organisation_id = p_organisation_id;
      if v_po_qty > 0 then
        v_qty_variance := abs((v_po_qty - v_received) / v_po_qty) * 100;
      end if;
    end;
  else
    v_status := 'WARN';
    v_message := 'PO link missing for 3-way verification';
  end if;

  if v_qty_variance > v_set.qty_tolerance_percent
     or v_value_variance > v_set.value_tolerance_percent
     or v_date_variance > v_set.date_tolerance_days then
    v_status := 'FAILED';
    v_message := 'Tolerance exceeded';
  elsif v_status = 'PASSED' and (v_qty_variance > 0 or v_value_variance > 0 or v_date_variance > 0) then
    v_status := 'WARN';
    v_message := 'Within tolerance';
  end if;

  insert into public.purchase_invoice_verifications(
    organisation_id, bill_id, po_id, verification_status, qty_variance_percent, value_variance_percent, date_variance_days, message
  )
  values (
    p_organisation_id, p_bill_id, v_bill.po_id, v_status, v_qty_variance, v_value_variance, v_date_variance, v_message
  )
  on conflict (organisation_id, bill_id)
  do update set
    verification_status = excluded.verification_status,
    qty_variance_percent = excluded.qty_variance_percent,
    value_variance_percent = excluded.value_variance_percent,
    date_variance_days = excluded.date_variance_days,
    message = excluded.message,
    updated_at = now();

  return v_status;
end;
$$;

revoke all on function public.verify_purchase_bill_3way(uuid, uuid) from public;
grant execute on function public.verify_purchase_bill_3way(uuid, uuid) to authenticated;

