begin;

-- Update trigger to auto-assign organisation_id to clients without one when creating invoices/receipts
create or replace function public.ensure_ledger_client_org_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_org_id uuid;
  v_client_record record;
begin
  if new.organisation_id is null then
    raise exception 'organisation_id is required.';
  end if;

  if new.client_id is null then
    raise exception 'client_id is required.';
  end if;

  -- Get client info
  select c.id, c.organisation_id into v_client_record
  from public.clients c
  where c.id = new.client_id
  limit 1;

  if v_client_record is null then
    raise exception 'Selected client does not exist.';
  end if;

  v_client_org_id := v_client_record.organisation_id;

  -- If client has no organisation_id, auto-assign it to the receipt/invoice organisation_id
  if v_client_org_id is null then
    update public.clients
    set organisation_id = new.organisation_id
    where id = new.client_id;
    v_client_org_id := new.organisation_id;
  end if;

  -- Now verify the organisation_id matches
  if v_client_org_id <> new.organisation_id then
    raise exception 'Selected client does not belong to the provided organisation.';
  end if;

  return new;
end;
$$;

commit;
