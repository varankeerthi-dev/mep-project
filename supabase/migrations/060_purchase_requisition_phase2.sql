-- Phase 2: Source determination + richer requisition lines

alter table public.purchase_requisition_lines
  add column if not exists estimated_rate numeric(14,2) null,
  add column if not exists estimated_amount numeric(14,2) null,
  add column if not exists available_stock_qty numeric(14,3) not null default 0,
  add column if not exists procure_required_qty numeric(14,3) not null default 0;

create or replace function public.approve_purchase_requisition(p_requisition_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_line record;
  v_available numeric;
  v_store_alloc numeric;
  v_procure numeric;
begin
  select organisation_id into v_org_id
  from public.purchase_requisitions
  where id = p_requisition_id;

  if v_org_id is null then
    raise exception 'Requisition not found';
  end if;

  for v_line in
    select id, item_id, requested_qty
    from public.purchase_requisition_lines
    where requisition_id = p_requisition_id
    order by line_no
  loop
    -- Current stock from inventory table used in existing codebase.
    select coalesce(i.quantity, 0) into v_available
    from public.inventory i
    where i.organisation_id = v_org_id
      and i.item_id = v_line.item_id
    limit 1;

    v_store_alloc := least(coalesce(v_available, 0), coalesce(v_line.requested_qty, 0));
    v_procure := greatest(coalesce(v_line.requested_qty, 0) - v_store_alloc, 0);

    update public.purchase_requisition_lines
    set
      available_stock_qty = coalesce(v_available, 0),
      store_allocated_qty = v_store_alloc,
      procure_required_qty = v_procure,
      source_type = case when v_procure > 0 then 'PROCURE' else 'FULFILL_FROM_STORE' end,
      open_qty = coalesce(v_line.requested_qty, 0),
      status = 'Open'
    where id = v_line.id;
  end loop;

  update public.purchase_requisitions
  set status = 'Approved'
  where id = p_requisition_id;
end;
$$;

revoke all on function public.approve_purchase_requisition(uuid) from public;
grant execute on function public.approve_purchase_requisition(uuid) to authenticated;

