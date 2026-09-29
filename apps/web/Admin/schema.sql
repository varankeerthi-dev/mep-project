-- ============================================================================
-- SaaS Admin Console — Supabase (Postgres) schema
-- Matches /backend/data/types.ts 1:1 and the PRD (PRD-saas-admin.md §4).
-- Run in the Supabase SQL editor. Admin console access is service-role only;
-- end users get RLS-scoped reads of their own org where noted.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type org_status          as enum ('active', 'trial', 'suspended', 'banned', 'churned');
create type plan_tier           as enum ('free', 'starter', 'growth', 'premium', 'enterprise');
create type module_tier         as enum ('core', 'premium', 'addon');
create type entitlement_status  as enum ('active', 'trial', 'revoked');
create type entitlement_source  as enum ('plan', 'purchase', 'grant');
create type user_status         as enum ('active', 'inactive', 'onboarding', 'left');
create type user_role           as enum ('owner', 'admin', 'member', 'viewer');
create type payment_status      as enum ('paid', 'failed', 'pending', 'refunded', 'void');
create type payment_method      as enum ('card', 'bank_transfer', 'upi');
create type currency_code       as enum ('USD', 'EUR', 'GBP', 'INR', 'AED');
create type refund_status       as enum ('requested', 'processed', 'rejected');
create type security_flag_type  as enum ('impossible_travel', 'brute_force', 'credential_leak', 'token_reuse', 'data_exfiltration', 'off_hours_anomaly');
create type security_severity   as enum ('high', 'medium', 'low');
create type security_flag_status as enum ('open', 'investigating', 'resolved', 'false_positive');
create type login_method        as enum ('password', 'oauth', 'api_key');
create type login_result        as enum ('success', 'failed');
create type email_kind          as enum ('plan_expiry', 'plan_expired', 'plan_renewed', 'module_expiry', 'module_expired', 'payment_due');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tenants (
  id          bigint generated always as identity primary key,
  name        text not null,
  country     text not null default 'US',
  created_at  timestamptz not null default now()
);

create table public.plans (
  id                  bigint generated always as identity primary key,
  name                text not null unique,
  tier                plan_tier not null,
  price_monthly       numeric(10,2) not null default 0,
  description         text not null default '',
  max_users           integer,
  includes_module_ids integer[] not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create table public.modules (
  id            bigint generated always as identity primary key,
  key           text not null unique,
  name          text not null,
  description   text not null default '',
  tier          module_tier not null default 'addon',
  price_monthly numeric(10,2) not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.organizations (
  id           bigint generated always as identity primary key,
  org_code     text not null unique,                     -- human-readable id, e.g. ORG-1004
  tenant_id    bigint not null references public.tenants(id) on delete cascade,
  name         text not null,
  slug         text not null unique,
  plan_id      bigint not null references public.plans(id),
  status       org_status not null default 'active',
  seats        integer not null default 5,
  created_at   timestamptz not null default now(),
  plan_ends_at timestamptz,
  ban_reason   text
);
create index organizations_tenant_idx   on public.organizations (tenant_id);
create index organizations_status_idx   on public.organizations (status);
create index organizations_plan_expiry_idx on public.organizations (plan_ends_at)
  where plan_ends_at is not null;

create table public.org_modules (
  id          bigint generated always as identity primary key,
  org_id      bigint not null references public.organizations(id) on delete cascade,
  module_id   bigint not null references public.modules(id) on delete cascade,
  status      entitlement_status not null default 'active',
  source      entitlement_source not null default 'plan',
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  created_by  text,
  note        text,
  unique (org_id, module_id, granted_at)
);
create index org_modules_org_idx     on public.org_modules (org_id);
create index org_modules_expiry_idx  on public.org_modules (expires_at)
  where status <> 'revoked' and expires_at is not null;

create table public.users (
  id             bigint generated always as identity primary key,
  org_id         bigint not null references public.organizations(id) on delete cascade,
  auth_user_id   uuid references auth.users(id) on delete set null,  -- Supabase Auth linkage
  full_name      text not null,
  email          text not null,
  role           user_role not null default 'member',
  status         user_status not null default 'onboarding',
  created_at     timestamptz not null default now(),
  last_active_at timestamptz,
  minutes_30d    integer not null default 0,
  module_ids     integer[] not null default '{}'
);
create index users_org_idx        on public.users (org_id);
create index users_status_idx     on public.users (status);
create unique index users_auth_id_idx on public.users (auth_user_id) where auth_user_id is not null;

create table public.transactions (
  id            bigint generated always as identity primary key,
  org_id        bigint not null references public.organizations(id) on delete cascade,
  invoice_no    text not null unique,
  description   text not null,
  amount        numeric(10,2) not null,
  currency      currency_code not null default 'USD',
  status        payment_status not null default 'pending',
  method        payment_method not null default 'card',
  transacted_at timestamptz not null default now(),
  -- provider linkage (Stripe / Razorpay)
  provider          text,
  provider_ref      text,             -- payment_intent / invoice id
  refunded_amount   numeric(10,2) not null default 0
);
create index transactions_org_idx    on public.transactions (org_id);
create index transactions_status_idx on public.transactions (status);
create index transactions_date_idx   on public.transactions (transacted_at desc);

create table public.refund_requests (
  id           bigint generated always as identity primary key,
  txn_id       bigint not null references public.transactions(id),
  org_id       bigint not null references public.organizations(id) on delete cascade,
  amount       numeric(10,2) not null,
  currency     currency_code not null,
  reason       text not null,
  status       refund_status not null default 'requested',
  requested_by text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  note         text,
  provider_refund_id text
);
create index refund_requests_status_idx on public.refund_requests (status);

create table public.security_flags (
  id           bigint generated always as identity primary key,
  org_id       bigint not null references public.organizations(id) on delete cascade,
  user_id      bigint references public.users(id) on delete set null,
  type         security_flag_type not null,
  severity     security_severity not null default 'medium',
  status       security_flag_status not null default 'open',
  risk_score   integer not null default 0 check (risk_score between 0 and 100),
  signals      jsonb not null default '[]'::jsonb,
  detected_at  timestamptz not null default now(),
  triage_note  text
);
create index security_flags_org_idx    on public.security_flags (org_id);
create index security_flags_status_idx on public.security_flags (status);

create table public.login_events (
  id       bigint generated always as identity primary key,
  org_id   bigint not null references public.organizations(id) on delete cascade,
  user_id  bigint not null references public.users(id) on delete cascade,
  at       timestamptz not null default now(),
  ip       inet,
  country  text,
  device   text,
  method   login_method not null default 'password',
  result   login_result not null default 'success'
);
create index login_events_org_idx   on public.login_events (org_id, at desc);
create index login_events_user_idx  on public.login_events (user_id, at desc);
create index login_events_failed_idx on public.login_events (at desc)
  where result = 'failed';

create table public.email_drafts (
  id           bigint generated always as identity primary key,
  kind         email_kind not null,
  org_id       bigint not null references public.organizations(id) on delete cascade,
  to_email     text not null,
  subject      text not null,
  body         text not null,
  trigger_at   timestamptz not null default now(),
  sent_at      timestamptz,
  provider_message_id text,
  created_by   text not null default 'system'
);
create index email_drafts_kind_idx on public.email_drafts (kind, trigger_at desc);

create table public.payment_links (
  id           bigint generated always as identity primary key,
  org_id       bigint not null references public.organizations(id) on delete cascade,
  link_id      text not null unique,
  url          text not null,
  amount       numeric(10,2) not null,
  currency     currency_code not null default 'USD',
  items        jsonb not null default '[]'::jsonb,   -- [{kind, id, name, amount}]
  description  text,
  expires_at   timestamptz not null,
  created_by   text not null default 'admin-console',
  created_at   timestamptz not null default now()
);

create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_email text not null,                          -- req.user.email from the console
  action      text not null,                          -- RPC action, e.g. orgs.setStatus
  payload     jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index admin_audit_action_idx on public.admin_audit_log (action, at desc);

-- ---------------------------------------------------------------------------
-- updated_at touch trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- (tables that get an updated_at column; run these if you add the column)
-- alter table public.organizations add column if not exists updated_at timestamptz default now();
-- create trigger organizations_touch before update on public.organizations
--   for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The admin console talks through the backend (service role) which bypasses
-- RLS. End users may read only their own org's rows via a membership claim.
-- ---------------------------------------------------------------------------

alter table public.tenants        enable row level security;
alter table public.plans          enable row level security;
alter table public.modules        enable row level security;
alter table public.organizations  enable row level security;
alter table public.org_modules    enable row level security;
alter table public.users          enable row level security;
alter table public.transactions   enable row level security;
alter table public.refund_requests enable row level security;
alter table public.security_flags enable row level security;
alter table public.login_events   enable row level security;
alter table public.email_drafts   enable row level security;
alter table public.payment_links  enable row level security;

-- Helper: org membership from Supabase Auth JWT (set claim org_id on the token,
-- or fall back to the users table linkage).
create or replace function public.current_org_id() returns bigint as $$
  select u.org_id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

-- Public catalogs: readable by any authenticated user
create policy "plans_read" on public.plans for select to authenticated using (true);
create policy "modules_read" on public.modules for select to authenticated using (true);

-- Org-scoped reads for the customer's own data
create policy "org_read_own" on public.organizations
  for select to authenticated using (id = public.current_org_id());
create policy "entitlements_read_own" on public.org_modules
  for select to authenticated using (org_id = public.current_org_id());
create policy "users_read_own" on public.users
  for select to authenticated using (org_id = public.current_org_id());
create policy "transactions_read_own" on public.transactions
  for select to authenticated using (org_id = public.current_org_id());
create policy "login_events_read_own" on public.login_events
  for select to authenticated using (org_id = public.current_org_id());

-- Everything else (write access, refunds, security flags, email drafts,
-- payment links, audit log) intentionally has NO policies: only the service
-- role (the backend RPC handlers) can touch them.

-- ---------------------------------------------------------------------------
-- Seed data (matches the mock dataset)
-- ---------------------------------------------------------------------------
insert into public.plans (name, tier, price_monthly, description, max_users, includes_module_ids) values
  ('Free',       'free',       0,   'Core platform for evaluation',          5,   '{9}'),
  ('Starter',    'starter',    49,  'Small teams getting started',           15,  '{9,1}'),
  ('Growth',     'growth',     149, 'Growing companies',                     50,  '{9,1,6}'),
  ('Premium',    'premium',    299, 'Full suite with priority support',      200, '{9,1,2,3,6,4}'),
  ('Enterprise', 'enterprise', 799, 'Unlimited users, SSO and SLA',          null,'{1,2,3,4,5,6,7,8,9,10}');

insert into public.modules (key, name, description, tier, price_monthly) values
  ('crm',        'CRM Pipeline',             'Leads, deals and sales pipeline management',        'premium', 99),
  ('inventory',  'Inventory & Warehouse',    'Stock levels, transfers and warehouse ops',         'premium', 129),
  ('payroll',    'HR & Payroll',             'Employee records, leave and payroll runs',          'premium', 149),
  ('analytics',  'Advanced Analytics',       'Custom reports, BI dashboards and exports',         'addon',   79),
  ('audit',      'Audit Logs & Compliance',  'Immutable activity trails and SOC2 reports',        'addon',   59),
  ('automation', 'Automation Workflows',     'Triggers, actions and workflow builder',            'addon',   89),
  ('desk',       'Support Desk',             'Ticketing, SLAs and customer portal',               'addon',   69),
  ('esign',      'E-Signature',              'Document signing and template library',             'addon',   49),
  ('api',        'API & Webhooks',           'REST API access and outbound webhooks',             'core',    0),
  ('field',      'Field Service',            'Scheduling, dispatch and mobile checklists',        'addon',   119);

-- ---------------------------------------------------------------------------
-- Handy views for the RPC handlers
-- ---------------------------------------------------------------------------

-- Outstanding invoices (drives Payments page + dunning job)
create or replace view public.v_outstanding_invoices as
select t.*, o.org_code, o.name as org_name, p.name as plan_name
from public.transactions t
join public.organizations o on o.id = t.org_id
join public.plans p on p.id = o.plan_id
where t.status = 'pending';

-- Overrides opened beyond the plan (drives Module Grants page)
create or replace view public.v_module_grants as
select e.*, o.org_code, o.name as org_name, p.name as plan_name, m.name as module_name,
       m.tier as module_tier, m.price_monthly
from public.org_modules e
join public.organizations o on o.id = e.org_id
join public.plans p on p.id = o.plan_id
join public.modules m on m.id = e.module_id
where e.source <> 'plan';

-- Organizations with plans expiring soon (drives the reminder job)
create or replace view public.v_plan_expiry_warnings as
select o.id, o.org_code, o.name, o.plan_id, o.plan_ends_at,
       (o.plan_ends_at::date - now()::date) as days_left,
       p.name as plan_name
from public.organizations o
join public.plans p on p.id = o.plan_id
where o.status in ('active', 'trial', 'suspended')
  and o.plan_id <> (select id from public.plans where tier = 'free')
  and o.plan_ends_at is not null
  and o.plan_ends_at <= now() + interval '30 days';
