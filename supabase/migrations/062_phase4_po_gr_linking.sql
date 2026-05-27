-- Phase 4: Harden PO/GR line linking

alter table public.purchase_order_items
  add column if not exists requisition_line_id uuid null references public.purchase_requisition_lines(id) on delete set null,
  add column if not exists inquiry_line_id uuid null references public.availability_inquiry_lines(id) on delete set null;

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  gr_number text not null,
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  vendor_id uuid null references public.purchase_vendors(id) on delete set null,
  receipt_date date not null default current_date,
  remarks text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique (organisation_id, gr_number)
);

create table if not exists public.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  po_item_id uuid not null references public.purchase_order_items(id) on delete cascade,
  requisition_line_id uuid null references public.purchase_requisition_lines(id) on delete set null,
  received_qty numeric(14,3) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_poi_req_line on public.purchase_order_items(requisition_line_id);
create index if not exists idx_poi_inquiry_line on public.purchase_order_items(inquiry_line_id);
create index if not exists idx_gr_org_po on public.goods_receipts(organisation_id, po_id);
create index if not exists idx_grl_po_item on public.goods_receipt_lines(po_item_id);

alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_lines enable row level security;

drop policy if exists "goods_receipts_org_access" on public.goods_receipts;
create policy "goods_receipts_org_access" on public.goods_receipts
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

drop policy if exists "goods_receipt_lines_org_access" on public.goods_receipt_lines;
create policy "goods_receipt_lines_org_access" on public.goods_receipt_lines
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

create or replace function public.post_goods_receipt(
  p_organisation_id uuid,
  p_po_id uuid,
  p_po_item_id uuid,
  p_received_qty numeric,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_gr_id uuid;
  v_po_item record;
  v_req_line_id uuid;
  v_total_received numeric;
  v_gr_no text;
begin
  select * into v_po_item
  from public.purchase_order_items
  where id = p_po_item_id and organisation_id = p_organisation_id;

  if v_po_item.id is null then
    raise exception 'PO item not found';
  end if;

  v_req_line_id := v_po_item.requisition_line_id;
  v_gr_no := 'GR-' || to_char(now(), 'YYMMDD-HH24MISSMS');

  insert into public.goods_receipts (
    organisation_id, gr_number, po_id, vendor_id, created_by
  )
  values (
    p_organisation_id, v_gr_no, p_po_id, null, p_created_by
  )
  returning id into v_gr_id;

  insert into public.goods_receipt_lines (
    organisation_id, goods_receipt_id, po_item_id, requisition_line_id, received_qty
  )
  values (
    p_organisation_id, v_gr_id, p_po_item_id, v_req_line_id, p_received_qty
  );

  if v_req_line_id is not null then
    select coalesce(sum(received_qty), 0) into v_total_received
    from public.goods_receipt_lines
    where requisition_line_id = v_req_line_id
      and organisation_id = p_organisation_id;

    update public.purchase_requisition_lines
    set
      received_qty = v_total_received,
      open_qty = greatest(coalesce(requested_qty, 0) - v_total_received, 0),
      status = case
        when v_total_received <= 0 then 'Open'
        when v_total_received < coalesce(requested_qty, 0) then 'Partially Fulfilled'
        else 'Fulfilled'
      end
    where id = v_req_line_id;
  end if;

  return v_gr_id;
end;
$$;

revoke all on function public.post_goods_receipt(uuid, uuid, uuid, numeric, uuid) from public;
grant execute on function public.post_goods_receipt(uuid, uuid, uuid, numeric, uuid) to authenticated;

