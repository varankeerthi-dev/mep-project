-- Fix invoice table to use organisation_id instead of org_id
-- This ensures consistency with the trigger function and other tables

-- Rename org_id to organisation_id in invoices table
ALTER TABLE public.invoices RENAME COLUMN org_id TO organisation_id;

-- Update the trigger function to use organisation_id
CREATE OR REPLACE FUNCTION public.ensure_ledger_client_org_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_org_id uuid;
begin
  if new.organisation_id is null then
    raise exception 'organisation_id is required.';
  end if;

  if new.client_id is null then
    raise exception 'client_id is required.';
  end if;

  select c.organisation_id into v_client_org_id
  from public.clients c
  where c.id = new.client_id
  limit 1;

  if v_client_org_id is null then
    raise exception 'Selected client is not linked to any organisation.';
  end if;

  if v_client_org_id <> new.organisation_id then
    raise exception 'Selected client does not belong to the provided organisation.';
  end if;

  return new;
end;
$$;

-- Update the index
DROP INDEX IF EXISTS public.invoices_org_id_idx;
CREATE INDEX IF NOT EXISTS public.invoices_organisation_id_idx
  ON public.invoices(organisation_id);

DROP INDEX IF EXISTS public.invoices_org_client_due_idx;
CREATE INDEX IF NOT EXISTS public.invoices_organisation_client_due_idx
  ON public.invoices(organisation_id, client_id, due_date);

-- Update RLS policies to use organisation_id
DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
CREATE POLICY invoices_tenant_select
ON public.invoices
for select
to authenticated
using (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS invoices_tenant_insert ON public.invoices;
CREATE POLICY invoices_tenant_insert
ON public.invoices
for insert
to authenticated
with check (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS invoices_tenant_update ON public.invoices;
CREATE POLICY invoices_tenant_update
ON public.invoices
for update
to authenticated
using (public.user_can_access_org(organisation_id))
with check (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS invoices_tenant_delete ON public.invoices;
CREATE POLICY invoices_tenant_delete
ON public.invoices
for delete
to authenticated
using (public.user_can_access_org(organisation_id));
