begin;

create or replace function public.ensure_ledger_client_org_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_org_id uuid;
  v_new_org_id uuid;
begin
  -- Safely extract org_id or organisation_id from the NEW record
  if to_jsonb(new) ? 'organisation_id' then
    v_new_org_id := (to_jsonb(new)->>'organisation_id')::uuid;
  elsif to_jsonb(new) ? 'org_id' then
    v_new_org_id := (to_jsonb(new)->>'org_id')::uuid;
  end if;

  if v_new_org_id is null then
    raise exception 'org_id or organisation_id is required.';
  end if;

  if new.client_id is null then
    raise exception 'client_id is required.';
  end if;

  -- Extract the organisation_id or org_id from the client safely
  select coalesce(
    (to_jsonb(c)->>'organisation_id')::uuid,
    (to_jsonb(c)->>'org_id')::uuid
  ) into v_client_org_id
  from public.clients c
  where c.id = new.client_id
  limit 1;

  if v_client_org_id is null then
    raise exception 'Selected client is not linked to any organisation.';
  end if;

  if v_client_org_id <> v_new_org_id then
    raise exception 'Selected client does not belong to the provided organisation.';
  end if;

  return new;
end;
$$;

commit;
