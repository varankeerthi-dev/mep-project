begin;

-- Update trigger to auto-assign org_id to clients without one when creating invoices/receipts
create or replace function public.ensure_ledger_client_org_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_org_id uuid;
  v_client_record record;
begin
  if new.org_id is null then
    raise exception 'org_id is required.';
  end if;

  if new.client_id is null then
    raise exception 'client_id is required.';
  end if;

  -- Get client info
  select c.id, c.org_id into v_client_record
  from public.clients c
  where c.id = new.client_id
  limit 1;

  if v_client_record is null then
    raise exception 'Selected client does not exist.';
  end if;

  v_client_org_id := v_client_record.org_id;

  -- If client has no org_id, auto-assign it to the receipt/invoice org_id
  if v_client_org_id is null then
    update public.clients
    set org_id = new.org_id
    where id = new.client_id;
    v_client_org_id := new.org_id;
  end if;

  -- Now verify the org_id matches
  if v_client_org_id <> new.org_id then
    raise exception 'Selected client does not belong to the provided organisation.';
  end if;

  return new;
end;
$$;

commit;
