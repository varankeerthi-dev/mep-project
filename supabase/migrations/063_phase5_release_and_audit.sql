-- Phase 5: Release strategy + purchase audit log

create table if not exists public.purchase_release_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  purpose_type text null,
  min_amount numeric(14,2) not null default 0,
  max_amount numeric(14,2) null,
  required_level int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_audit_log (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_release_rules_org on public.purchase_release_rules(organisation_id, is_active);
create index if not exists idx_purchase_audit_org_entity on public.purchase_audit_log(organisation_id, entity_type, entity_id, created_at desc);

alter table public.purchase_requisitions
  add column if not exists approval_status text not null default 'Draft' check (approval_status in ('Draft', 'Pending Approval', 'Approved', 'Rejected')),
  add column if not exists current_approval_level int not null default 0,
  add column if not exists required_approval_level int not null default 1,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null;

alter table public.purchase_release_rules enable row level security;
alter table public.purchase_audit_log enable row level security;

drop policy if exists "purchase_release_rules_org_access" on public.purchase_release_rules;
create policy "purchase_release_rules_org_access" on public.purchase_release_rules
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

drop policy if exists "purchase_audit_log_org_access" on public.purchase_audit_log;
create policy "purchase_audit_log_org_access" on public.purchase_audit_log
for all
using (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()))
with check (organisation_id in (select organisation_id from public.org_members where user_id = auth.uid()));

create or replace function public.submit_purchase_requisition_for_approval(
  p_requisition_id uuid,
  p_actor_id uuid default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_org uuid;
  v_purpose text;
  v_amount numeric;
  v_required_level int := 1;
begin
  select organisation_id, purpose_type into v_org, v_purpose
  from public.purchase_requisitions
  where id = p_requisition_id;

  if v_org is null then
    raise exception 'Requisition not found';
  end if;

  select coalesce(sum(coalesce(estimated_amount,0)),0) into v_amount
  from public.purchase_requisition_lines
  where requisition_id = p_requisition_id;

  select coalesce(max(required_level), 1) into v_required_level
  from public.purchase_release_rules
  where organisation_id = v_org
    and is_active = true
    and (purpose_type is null or purpose_type = v_purpose)
    and v_amount >= min_amount
    and (max_amount is null or v_amount <= max_amount);

  update public.purchase_requisitions
  set
    approval_status = case when v_required_level > 1 then 'Pending Approval' else 'Approved' end,
    required_approval_level = v_required_level,
    current_approval_level = case when v_required_level > 1 then 1 else v_required_level end,
    approved_by = case when v_required_level > 1 then null else p_actor_id end,
    approved_at = case when v_required_level > 1 then null else now() end,
    status = case when v_required_level > 1 then 'Pending' else 'Approved' end
  where id = p_requisition_id;

  insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
  values (
    v_org, 'REQUISITION', p_requisition_id,
    case when v_required_level > 1 then 'SUBMITTED_FOR_APPROVAL' else 'AUTO_APPROVED' end,
    p_actor_id,
    jsonb_build_object('required_level', v_required_level, 'estimated_total', v_amount)
  );

  if v_required_level = 1 then
    perform public.approve_purchase_requisition(p_requisition_id);
  end if;

  return case when v_required_level > 1 then 'PENDING_APPROVAL' else 'APPROVED' end;
end;
$$;

create or replace function public.process_purchase_requisition_approval(
  p_requisition_id uuid,
  p_action text,
  p_actor_id uuid default null,
  p_comment text default null
)
returns text
language plpgsql
security definer
as $$
declare
  v_org uuid;
  v_current int;
  v_required int;
begin
  select organisation_id, current_approval_level, required_approval_level
  into v_org, v_current, v_required
  from public.purchase_requisitions
  where id = p_requisition_id;

  if v_org is null then
    raise exception 'Requisition not found';
  end if;

  if upper(p_action) = 'REJECT' then
    update public.purchase_requisitions
    set approval_status = 'Rejected', status = 'Rejected'
    where id = p_requisition_id;

    insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
    values (v_org, 'REQUISITION', p_requisition_id, 'REJECTED', p_actor_id, jsonb_build_object('comment', p_comment));
    return 'REJECTED';
  end if;

  if v_current + 1 >= v_required then
    update public.purchase_requisitions
    set approval_status = 'Approved', status = 'Approved', current_approval_level = v_required, approved_by = p_actor_id, approved_at = now()
    where id = p_requisition_id;

    perform public.approve_purchase_requisition(p_requisition_id);

    insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
    values (v_org, 'REQUISITION', p_requisition_id, 'FINAL_APPROVED', p_actor_id, jsonb_build_object('comment', p_comment));
    return 'APPROVED';
  else
    update public.purchase_requisitions
    set current_approval_level = v_current + 1
    where id = p_requisition_id;

    insert into public.purchase_audit_log(organisation_id, entity_type, entity_id, action, actor_id, details)
    values (v_org, 'REQUISITION', p_requisition_id, 'LEVEL_APPROVED', p_actor_id, jsonb_build_object('new_level', v_current + 1, 'comment', p_comment));
    return 'PENDING_APPROVAL';
  end if;
end;
$$;

revoke all on function public.submit_purchase_requisition_for_approval(uuid, uuid) from public;
revoke all on function public.process_purchase_requisition_approval(uuid, text, uuid, text) from public;
grant execute on function public.submit_purchase_requisition_for_approval(uuid, uuid) to authenticated;
grant execute on function public.process_purchase_requisition_approval(uuid, text, uuid, text) to authenticated;
