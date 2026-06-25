-- Auto-update purchase_requisition header status based on line statuses

create or replace function public.update_purchase_requisition_header_status(
  p_requisition_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_total_lines int;
  v_fulfilled_lines int;
  v_po_released_lines int;
  v_cancelled_lines int;
begin
  select
    count(*),
    count(*) filter (where status = 'Fulfilled' or received_qty >= requested_qty),
    count(*) filter (where po_qty > 0),
    count(*) filter (where status = 'Cancelled')
  into
    v_total_lines,
    v_fulfilled_lines,
    v_po_released_lines,
    v_cancelled_lines
  from public.purchase_requisition_lines
  where requisition_id = p_requisition_id;

  if v_total_lines = 0 then
    return;
  end if;

  if v_cancelled_lines = v_total_lines then
    update public.purchase_requisitions set status = 'Cancelled' where id = p_requisition_id;
  elsif v_fulfilled_lines = v_total_lines then
    update public.purchase_requisitions set status = 'Fulfilled' where id = p_requisition_id;
  elsif v_po_released_lines > 0 or v_fulfilled_lines > 0 then
    update public.purchase_requisitions set status = 'Partially Fulfilled' where id = p_requisition_id;
  end if;
end;
$$;

revoke all on function public.update_purchase_requisition_header_status(uuid) from public;
grant execute on function public.update_purchase_requisition_header_status(uuid) to authenticated;

-- Also update post_goods_receipt to refresh header status
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
  v_requisition_id uuid;
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
    where id = v_req_line_id
    returning requisition_id into v_requisition_id;

    if v_requisition_id is not null then
      perform public.update_purchase_requisition_header_status(v_requisition_id);
    end if;
  end if;

  return v_gr_id;
end;
$$;

revoke all on function public.post_goods_receipt(uuid, uuid, uuid, numeric, uuid) from public;
grant execute on function public.post_goods_receipt(uuid, uuid, uuid, numeric, uuid) to authenticated;
