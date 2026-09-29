-- ============================================================================
-- SaaS Admin Console — Supabase (Postgres) schema, `admin` schema variant
-- Namespaced so it NEVER collides with the live ERP tables:
--   ERP lives in  public.*  (organisations, org_modules feature toggles, ...)
--   Console lives in admin.* (organizations, org_modules entitlements, ...)
-- Run once in the Supabase SQL editor. Safe re-run: tables/seeds are
-- IF NOT EXISTS / ON CONFLICT DO NOTHING; views/policies are replaced.
-- ============================================================================

create schema if not exists admin;
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (admin schema, so they can't clash with any ERP types)
-- ---------------------------------------------------------------------------
do $$ begin create type admin.org_status as enum ('active', 'trial', 'suspended', 'banned', 'churned'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.plan_tier as enum ('free', 'starter', 'growth', 'premium', 'enterprise'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.module_tier as enum ('core', 'premium', 'addon'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.entitlement_status as enum ('active', 'trial', 'revoked'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.entitlement_source as enum ('plan', 'purchase', 'grant'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.user_status as enum ('active', 'inactive', 'onboarding', 'left'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.user_role as enum ('owner', 'admin', 'member', 'viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.payment_status as enum ('paid', 'failed', 'pending', 'refunded', 'void'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.payment_method as enum ('card', 'bank_transfer', 'upi'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.currency_code as enum ('USD', 'EUR', 'GBP', 'INR', 'AED'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.refund_status as enum ('requested', 'processed', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.security_flag_type as enum ('impossible_travel', 'brute_force', 'credential_leak', 'token_reuse', 'data_exfiltration', 'off_hours_anomaly'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.security_severity as enum ('high', 'medium', 'low'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.security_flag_status as enum ('open', 'investigating', 'resolved', 'false_positive'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.login_method as enum ('password', 'oauth', 'api_key'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.login_result as enum ('success', 'failed'); exception when duplicate_object then null; end $$;
do $$ begin create type admin.email_kind as enum ('plan_expiry', 'plan_expired', 'plan_renewed', 'module_expiry', 'module_expired', 'payment_due'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists admin.tenants (
  id          bigint generated always as identity primary key,
  name        text not null,
  country     text not null default 'US',
  created_at  timestamptz not null default now()
);

create table if not exists admin.plans (
  id                  bigint generated always as identity primary key,
  name                text not null unique,
  tier                admin.plan_tier not null,
  price_monthly       numeric(10,2) not null default 0,
  description         text not null default '',
  max_users           integer,
  includes_module_ids integer[] not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists admin.modules (
  id            bigint generated always as identity primary key,
  key           text not null unique,
  name          text not null,
  description   text not null default '',
  tier          admin.module_tier not null default 'addon',
  price_monthly numeric(10,2) not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists admin.organizations (
  id           bigint generated always as identity primary key,
  org_code     text not null unique,
  tenant_id    bigint not null references admin.tenants(id) on delete cascade,
  name         text not null,
  slug         text not null unique,
  plan_id      bigint not null references admin.plans(id),
  status       admin.org_status not null default 'active',
  seats        integer not null default 5,
  created_at   timestamptz not null default now(),
  plan_ends_at timestamptz,
  ban_reason   text
);
create index if not exists organizations_tenant_idx on admin.organizations (tenant_id);
create index if not exists organizations_status_idx on admin.organizations (status);
create index if not exists organizations_plan_expiry_idx on admin.organizations (plan_ends_at)
  where plan_ends_at is not null;

create table if not exists admin.org_modules (
  id          bigint generated always as identity primary key,
  org_id      bigint not null references admin.organizations(id) on delete cascade,
  module_id   bigint not null references admin.modules(id) on delete cascade,
  status      admin.entitlement_status not null default 'active',
  source      admin.entitlement_source not null default 'plan',
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  created_by  text,
  note        text,
  unique (org_id, module_id, granted_at)
);
create index if not exists org_modules_org_idx on admin.org_modules (org_id);
create index if not exists org_modules_expiry_idx on admin.org_modules (expires_at)
  where status <> 'revoked' and expires_at is not null;

create table if not exists admin.users (
  id             bigint generated always as identity primary key,
  org_id         bigint not null references admin.organizations(id) on delete cascade,
  auth_user_id   uuid references auth.users(id) on delete set null,
  full_name      text not null,
  email          text not null,
  role           admin.user_role not null default 'member',
  status         admin.user_status not null default 'onboarding',
  created_at     timestamptz not null default now(),
  last_active_at timestamptz,
  minutes_30d    integer not null default 0,
  module_ids     integer[] not null default '{}'
);
create index if not exists users_org_idx on admin.users (org_id);
create index if not exists users_status_idx on admin.users (status);
create unique index if not exists users_auth_id_idx on admin.users (auth_user_id) where auth_user_id is not null;

create table if not exists admin.transactions (
  id            bigint generated always as identity primary key,
  org_id        bigint not null references admin.organizations(id) on delete cascade,
  invoice_no    text not null unique,
  description   text not null,
  amount        numeric(10,2) not null,
  currency      admin.currency_code not null default 'USD',
  status        admin.payment_status not null default 'pending',
  method        admin.payment_method not null default 'card',
  transacted_at timestamptz not null default now(),
  provider          text,
  provider_ref      text,
  refunded_amount   numeric(10,2) not null default 0
);
create index if not exists transactions_org_idx on admin.transactions (org_id);
create index if not exists transactions_status_idx on admin.transactions (status);
create index if not exists transactions_date_idx on admin.transactions (transacted_at desc);

create table if not exists admin.refund_requests (
  id           bigint generated always as identity primary key,
  txn_id       bigint not null references admin.transactions(id),
  org_id       bigint not null references admin.organizations(id) on delete cascade,
  amount       numeric(10,2) not null,
  currency     admin.currency_code not null,
  reason       text not null,
  status       admin.refund_status not null default 'requested',
  requested_by text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  note         text,
  provider_refund_id text
);
create index if not exists refund_requests_status_idx on admin.refund_requests (status);

create table if not exists admin.security_flags (
  id           bigint generated always as identity primary key,
  org_id       bigint not null references admin.organizations(id) on delete cascade,
  user_id      bigint references admin.users(id) on delete set null,
  type         admin.security_flag_type not null,
  severity     admin.security_severity not null default 'medium',
  status       admin.security_flag_status not null default 'open',
  risk_score   integer not null default 0 check (risk_score between 0 and 100),
  signals      jsonb not null default '[]'::jsonb,
  detected_at  timestamptz not null default now(),
  triage_note  text
);
create index if not exists security_flags_org_idx on admin.security_flags (org_id);
create index if not exists security_flags_status_idx on admin.security_flags (status);

create table if not exists admin.login_events (
  id       bigint generated always as identity primary key,
  org_id   bigint not null references admin.organizations(id) on delete cascade,
  user_id  bigint not null references admin.users(id) on delete cascade,
  at       timestamptz not null default now(),
  ip       inet,
  country  text,
  device   text,
  method   admin.login_method not null default 'password',
  result   admin.login_result not null default 'success'
);
create index if not exists login_events_org_idx on admin.login_events (org_id, at desc);
create index if not exists login_events_user_idx on admin.login_events (user_id, at desc);
create index if not exists login_events_failed_idx on admin.login_events (at desc)
  where result = 'failed';

create table if not exists admin.email_drafts (
  id           bigint generated always as identity primary key,
  kind         admin.email_kind not null,
  org_id       bigint not null references admin.organizations(id) on delete cascade,
  to_email     text not null,
  subject      text not null,
  body         text not null,
  trigger_at   timestamptz not null default now(),
  sent_at      timestamptz,
  provider_message_id text,
  created_by   text not null default 'system'
);
create index if not exists email_drafts_kind_idx on admin.email_drafts (kind, trigger_at desc);

create table if not exists admin.payment_links (
  id           bigint generated always as identity primary key,
  org_id       bigint not null references admin.organizations(id) on delete cascade,
  link_id      text not null unique,
  url          text not null,
  amount       numeric(10,2) not null,
  currency     admin.currency_code not null default 'USD',
  items        jsonb not null default '[]'::jsonb,
  description  text,
  expires_at   timestamptz not null,
  created_by   text not null default 'admin-console',
  created_at   timestamptz not null default now()
);

create table if not exists admin.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_email text not null,
  action      text not null,
  payload     jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index if not exists admin_audit_action_idx on admin.admin_audit_log (action, at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (service role bypasses; anon respects policies below)
-- ---------------------------------------------------------------------------
alter table admin.tenants         enable row level security;
alter table admin.plans           enable row level security;
alter table admin.modules         enable row level security;
alter table admin.organizations   enable row level security;
alter table admin.org_modules     enable row level security;
alter table admin.users           enable row level security;
alter table admin.transactions    enable row level security;
alter table admin.refund_requests enable row level security;
alter table admin.security_flags  enable row level security;
alter table admin.login_events    enable row level security;
alter table admin.email_drafts    enable row level security;
alter table admin.payment_links   enable row level security;

create or replace function admin.current_org_id() returns bigint as $$
  select u.org_id
  from admin.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

drop policy if exists "plans_read" on admin.plans;
create policy "plans_read" on admin.plans for select to authenticated using (true);
drop policy if exists "modules_read" on admin.modules;
create policy "modules_read" on admin.modules for select to authenticated using (true);

drop policy if exists "org_read_own" on admin.organizations;
create policy "org_read_own" on admin.organizations
  for select to authenticated using (id = admin.current_org_id());
drop policy if exists "entitlements_read_own" on admin.org_modules;
create policy "entitlements_read_own" on admin.org_modules
  for select to authenticated using (org_id = admin.current_org_id());
drop policy if exists "users_read_own" on admin.users;
create policy "users_read_own" on admin.users
  for select to authenticated using (org_id = admin.current_org_id());
drop policy if exists "transactions_read_own" on admin.transactions;
create policy "transactions_read_own" on admin.transactions
  for select to authenticated using (org_id = admin.current_org_id());
drop policy if exists "login_events_read_own" on admin.login_events;
create policy "login_events_read_own" on admin.login_events
  for select to authenticated using (org_id = admin.current_org_id());

-- NOTE: platform admins list ALL orgs via the anon key, which own-org
-- policies above would block (0 rows). Next step after this file runs:
-- add an allowlist policy (admin.admin_users table or JWT claim check).
-- Until then the UI falls back to public.organisations names (see banner).

-- ---------------------------------------------------------------------------
-- Seed data (idempotent)
-- ---------------------------------------------------------------------------
insert into admin.plans (name, tier, price_monthly, description, max_users, includes_module_ids) values
  ('Free',       'free',       0,   'Core platform for evaluation',          5,   '{9}'),
  ('Starter',    'starter',    49,  'Small teams getting started',           15,  '{9,1}'),
  ('Growth',     'growth',     149, 'Growing companies',                     50,  '{9,1,6}'),
  ('Premium',    'premium',    299, 'Full suite with priority support',      200, '{9,1,2,3,6,4}'),
  ('Enterprise', 'enterprise', 799, 'Unlimited users, SSO and SLA',          null,'{1,2,3,4,5,6,7,8,9,10}')
on conflict (name) do nothing;

insert into admin.modules (key, name, description, tier, price_monthly) values
  ('crm',        'CRM Pipeline',             'Leads, deals and sales pipeline management',        'premium', 99),
  ('inventory',  'Inventory & Warehouse',    'Stock levels, transfers and warehouse ops',         'premium', 129),
  ('payroll',    'HR & Payroll',             'Employee records, leave and payroll runs',          'premium', 149),
  ('analytics',  'Advanced Analytics',       'Custom reports, BI dashboards and exports',         'addon',   79),
  ('audit',      'Audit Logs & Compliance',  'Immutable activity trails and SOC2 reports',        'addon',   59),
  ('automation', 'Automation Workflows',     'Triggers, actions and workflow builder',            'addon',   89),
  ('desk',       'Support Desk',             'Ticketing, SLAs and customer portal',               'addon',   69),
  ('esign',      'E-Signature',              'Document signing and template library',             'addon',   49),
  ('api',        'API & Webhooks',           'REST API access and outbound webhooks',             'core',    0),
  ('field',      'Field Service',            'Scheduling, dispatch and mobile checklists',        'addon',   119)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create or replace view admin.v_outstanding_invoices as
select t.*, o.org_code, o.name as org_name, p.name as plan_name
from admin.transactions t
join admin.organizations o on o.id = t.org_id
join admin.plans p on p.id = o.plan_id
where t.status = 'pending';

create or replace view admin.v_module_grants as
select e.*, o.org_code, o.name as org_name, p.name as plan_name, m.name as module_name,
       m.tier as module_tier, m.price_monthly
from admin.org_modules e
join admin.organizations o on o.id = e.org_id
join admin.plans p on p.id = o.plan_id
join admin.modules m on m.id = e.module_id
where e.source <> 'plan';

create or replace view admin.v_plan_expiry_warnings as
select o.id, o.org_code, o.name, o.plan_id, o.plan_ends_at,
       (o.plan_ends_at::date - now()::date) as days_left,
       p.name as plan_name
from admin.organizations o
join admin.plans p on p.id = o.plan_id
where o.status in ('active', 'trial', 'suspended')
  and o.plan_id <> (select id from admin.plans where tier = 'free')
  and o.plan_ends_at is not null
  and o.plan_ends_at <= now() + interval '30 days';
