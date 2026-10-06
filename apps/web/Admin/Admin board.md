# PRD — Multi-Tenant SaaS Admin Dashboard ("SaaS Admin Console")

Version: 1.0 · Status: Draft · Owner: Platform Team
Stack: React 19 + TypeScript (strict) · Vite · Tailwind CSS · shadcn/ui · Recharts · TanStack Table · Retool serverless RPC backend

---

## 1. Overview

### 1.1 Problem

We run a multi-tenant, multi-organization SaaS platform with tiered plans (Free → Enterprise) and
purchasable modules. Today, plan management, module entitlements, billing, support-requested
overrides, dunning/reminders and security response are handled ad hoc. The admin console
centralizes all of it behind one interface.

### 1.2 Goals

- Single console for **platform health** (tenants, orgs, users, engagement, MRR)
- **Entitlement control**: bundle modules into plans, or open individual modules to individual
  customers (support-request driven) with explicit validity
- **Billing operations**: see who paid today, chase unpaid invoices via payment-link emails
- **Lifecycle comms**: boilerplate reminder emails for plan expiry, plan extension, module access
  expiry, and payment due
- **Security response**: detect compromise indicators per account, inspect login audit trails,
  ban/suspend accounts, revoke sessions

### 1.3 Non-goals (for this phase)

- End-customer-facing self-serve billing portal
- Actual email delivery / real payment processing (stubbed by design — see §8 Roadmap)
- Per-seat metering or usage-based billing

### 1.4 Users

| Persona | Uses |
|---|---|
| Platform admin | Everything |
| Support agent | Module Grants (new override), Organizations, Security triage |
| Finance / Billing | Payments, Reminders, Plans |
| Security on-call | Security page, org Security log, Ban / Reset sessions |

---

## 2. Architecture

### 2.1 Pattern

- **Single RPC endpoint**: `/backend/rpc/index.ts` receives
  `{ action: "<namespace>.<verb>", payload: {...} }` and returns
  `{ ok: true, data }` or `{ ok: false, error }`.
- **Handlers** live in `/backend/rpc/handlers/*` as plain async functions grouped by domain.
- **Frontend RPC client**: `/frontend/hooks/useRpcApi.ts` wraps the generated `useIndex` hook and
  exposes `call<T>(action, payload)`.
- **Data layer**: `/backend/data/mockDb.ts` + `types.ts` currently produce deterministic mock
  data shaped exactly like the target Supabase (Postgres) schema. Each handler carries a
  `TODO(supabase)` comment with the SQL that replaces the mock call.

### 2.2 File map

```
backend/
  data/types.ts                  # all entity types (mirrors Supabase schema)
  data/mockDb.ts                 # deterministic mock dataset (swap for SQL)
  rpc/index.ts                   # RPC dispatcher (single entry point)
  rpc/handlers/overview.ts       # overview.get
  rpc/handlers/organizations.ts  # orgs.list | orgs.get | orgs.updatePlan | orgs.setStatus
  rpc/handlers/grants.ts         # grants.list | grants.create | grants.extend | grants.end
  rpc/handlers/plans.ts          # plans.get | plans.toggleModule
  rpc/handlers/modules.ts        # modules.get
  rpc/handlers/users.ts          # users.analytics
  rpc/handlers/payments.ts       # payments.summary | payments.list | payments.createLink | payments.draft
  rpc/handlers/reminders.ts      # reminders.preview | reminders.renewalNotice | reminders.send (stub)
  rpc/handlers/security.ts       # security.list | security.updateStatus | security.resetSessions | security.audit
frontend/
  hooks/useRpcApi.ts             # typed RPC client
  lib/appTypes.ts                # frontend mirrors of RPC payloads
  lib/shadcn/*                   # UI primitives
  pages/Dashboard.tsx            # Overview
  pages/Organizations.tsx        # org table
  pages/OrganizationDetail.tsx   # org detail (users, modules, security log, ban)
  pages/Users.tsx                # user analytics
  pages/Plans.tsx                # plans + module matrix
  pages/Modules.tsx              # module catalog
  pages/Grants.tsx               # module overrides
  pages/Payments.tsx             # billing
  pages/Reminders.tsx            # email drafts queue
  pages/Security.tsx             # compromise flags
  pages/ui/bits.tsx              # KpiCard, ChartCard, badges, formatters
```

---

## 3. Dependencies

### 3.1 Installed (all free/open-source)

| Package | Version | Used for |
|---|---|---|
| react / react-dom | 19.2.x | UI |
| react-router-dom | 7.14.x | routing (`/`, `/organizations/:orgId`, …) |
| @tanstack/react-table | 8.21.x | sortable/filterable/paginated tables |
| recharts | 3.8.x | area/bar/pie charts |
| lucide-react | 0.577.x | icons |
| tailwindcss | 3.4.x | styling (semantic tokens, dark-mode aware) |
| shadcn/ui + Radix primitives | preinstalled | dialogs, selects, switches, badges, tables |
| sonner | 1.7.x | (available) toasts |

No paid dependencies. No external fetch from the frontend (CSP-safe).

### 3.2 Planned (future integrations)

| Concern | Candidate | Note |
|---|---|---|
| Database | Supabase (Postgres resource) | replaces `data/mockDb.ts`; schema in §4 |
| Payments | Stripe (or Razorpay/Paddle) | replaces `payments.createLink` stub + transaction source |
| Email | Resend / SendGrid / SES | replaces `reminders.send` stub |
| Cron/scheduler | Supabase pg_cron / Retool jobs | nightly expiry scan → reminder queue |

---

## 4. Data model

All tables below are the target Supabase schema; `data/types.ts` matches 1:1. `org_id` and
`tenant_id` are the multi-tenancy keys; `org_code` is the human-readable external identifier
(`ORG-1004`) used in search, emails and invoices.

### 4.1 tenants
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| name | text | root customer account |
| country | text | |
| created_at | timestamptz | |

### 4.2 organizations
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| org_code | text unique | `ORG-1004`, searchable, printed on invoices/emails |
| tenant_id | int FK → tenants | multi-org under one tenant |
| name / slug | text | |
| plan_id | int FK → plans | |
| status | enum | `active \| trial \| suspended \| banned \| churned` |
| seats | int | |
| created_at | timestamptz | |
| plan_ends_at | timestamptz null | null for Free; drives expiry reminders |
| ban_reason | text null | required when status = banned |

### 4.3 plans
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| name / tier | text | Free, Starter, Growth, Premium, Enterprise |
| price_monthly | numeric | 0 for Free |
| description | text | |
| max_users | int null | null = unlimited |
| includes_module_ids | int[] | modules bundled with the plan |
| is_active | bool | |

### 4.4 modules
| Column | Type | Notes |
|---|---|---|
| id / key / name / description | | catalog entry (CRM, Inventory, HR & Payroll, Analytics, Audit Logs, Automation, Support Desk, E-Signature, API & Webhooks, Field Service) |
| tier | enum | `core \| premium \| addon` |
| price_monthly | numeric | 0 = free/core |
| is_active | bool | |

### 4.5 org_modules (entitlements / overrides)
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| org_id / module_id | FK | |
| status | enum | `active \| trial \| revoked` |
| source | enum | `plan` (bundled) \| `purchase` \| `grant` |
| granted_at | timestamptz | |
| expires_at | timestamptz null | **validity of the override**; null = no expiry |
| created_by | text null | support agent who opened it |
| note | text null | reason captured from the support request |

### 4.6 users
| Column | Type | Notes |
|---|---|---|
| id / org_id | | |
| full_name / email / role | | role: owner \| admin \| member \| viewer |
| status | enum | `active \| inactive \| onboarding \| left` |
| created_at | timestamptz | onboarding date (cohort analytics) |
| last_active_at | timestamptz | |
| minutes_30d | int | active time spent, last 30 days |
| module_ids | int[] | modules the user actually touches |

### 4.7 transactions (payments)
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| org_id | FK | |
| invoice_no | text | `INV-10042` |
| description | text | "Premium plan — monthly subscription" / module add-on |
| amount | numeric | |
| status | enum | `paid \| failed \| pending \| refunded` |
| method | enum | card \| bank_transfer \| upi |
| transacted_at | timestamptz | |

### 4.8 security_flags
| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| org_id / user_id | FK | user null = org-level signal |
| type | enum | `impossible_travel \| brute_force \| credential_leak \| token_reuse \| data_exfiltration \| off_hours_anomaly` |
| severity | enum | high \| medium \| low |
| status | enum | `open \| investigating \| resolved \| false_positive` |
| risk_score | int 0–100 | |
| signals | jsonb | evidence lines |
| detected_at | timestamptz | |

### 4.9 login_events (audit)
| Column | Type | Notes |
|---|---|---|
| id / org_id / user_id | | |
| at | timestamptz | |
| ip / country / device | text | device = browser/OS string |
| method | enum | password \| oauth \| api_key |
| result | enum | success \| failed |

Source in production: Supabase Auth audit events.

### 4.10 email_drafts (planned persistence)
kind (`plan_expiry | plan_expired | plan_renewed | module_expiry | module_expired | payment_due`),
org_id, to, subject, body, trigger_at, sent_at, provider_message_id.

---

## 5. Module specs (pages)

Every page shares: `PageHeader` (title + description + action button), loading skeleton text,
error banner, KPI card row, chart cards (`ChartCard`) and tables on `bg-card` with
`shadow-retool-sm`, all colors via semantic tokens (dark-mode safe).

### 5.1 Overview (`/`)

- **KPI cards (8)**: Tenants (sub: orgs) · Active orgs (sub: trial/suspended) · Users (sub: active
  now) · MRR (sub: paying orgs) · Avg time/user (30d) · Active overrides (modules beyond plan) ·
  Plans ending (30d) · Paid modules (active entitlements)
- **Charts**: Active users area (30d, + new users line) · Time-spent area (30d, hours) ·
  Plan-distribution donut (orgs per plan) · Module-adoption horizontal bars (top 6 paid modules)
- **Table/feed**: Recent module purchases & grants — module, org, date, source badge, amount
- **RPC**: `overview.get`

### 5.2 Organizations (`/organizations`)

- **KPIs (filtered)**: Organizations · MRR (filtered) · Users · Time spent (30d)
- **Filters**: search (org/tenant/`org_code`/slug), plan select, status select
  (`all | active | trial | suspended | banned | churned`)
- **Table (TanStack, sortable, paginated ×15)** — columns:
  1. Organization — name; sub-line: `org_code` (mono) · tenant · user count
  2. Status — colored badge (banned = solid red)
  3. Plan — name + monthly price
  4. Active / Seats
  5. Time (30d) — hours
  6. Modules — count (+N paid)
  7. Plan ends — clock icon, `Nd left` (amber ≤14d) / `Expired Nd ago`
  8. MRR — bold
- Row click → `/organizations/:orgId`. RPC: `orgs.list`

### 5.3 Organization detail (`/organizations/:orgId`)

- Header: name, `org_code`, tenant, created date; actions: **Open paid module** · **Change plan** ·
  **Ban account** / **Unban account** (banned shows destructive alert with reason)
- Status strip: status badge, plan + base price + MRR, plan-expiry chip (date + days left, amber
  when ≤14d; "Free plan — no expiry")
- **KPIs**: Seats · Users (sub: active) · Modules enabled · MRR
- Sibling orgs (same tenant) chips linking to their pages
- **Modules card**: each entitlement — name, "Since/Valid until/Expired + days left", price or
  "Included", source badge (plan/purchase/grant), support note + created_by, lock button (end)
- **Users table**: user (name/email), role, status badge, time (30d), last active, modules used
  (chips)
- **Security log card**: rollup line (logins 7d · failed 24h [red when >0] · countries · IPs) +
  "Failed only" switch; table — user, time, IP (mono), country, device, method, result badge,
  "flagged" badge when user has an open security flag; failed rows tinted red
- **Dialogs**: Change plan (plan select, extends `plan_ends_at` 365d) · Open paid module (module
  select, mode = free grant / trial / purchase, validity 7/14/30/90 days or none, reason textarea)
  · Ban (reason required; "Suspend instead" alternative)
- **RPC**: `orgs.get`, `orgs.updatePlan`, `grants.create`, `grants.end`, `orgs.setStatus`,
  `security.audit`

### 5.4 Users (`/users`)

- **KPI cards (7)**: Total · Active · Inactive · Onboarding · Left · Onboarded yesterday (sub: this
  week) · Avg time (30d, sub: total)
- **Charts**: Onboarding cohorts (8 weeks, onboarded vs still active) · Time-spent by module
  (horizontal bars, hours)
- **Filters**: search (name/email/org) + status chip group (All/Active/Inactive/Onboarding/Left)
- **Table (TanStack)**: User · Organization (sub: plan) · Status · Time (30d) · Onboarded · Last
  active · Modules used. RPC: `users.analytics`

### 5.5 Plans (`/plans`)

- **KPIs**: Plans · Total MRR · Subscribed orgs · Users covered
- **Plan cards** (grid): name, tier badge, price `/mo per org`, seat limit, orgs/active/MRR,
  bundled-module chips
- **Module access matrix table**: rows = paid modules (name, tier, price, "orgs using" ✓ count);
  columns = plans; **Switch** per cell toggles the module into/out of the plan bundle (opens the
  module to every org on that plan)
- **RPC**: `plans.get`, `plans.toggleModule`

### 5.6 Modules (`/modules`)

- **KPIs**: Modules · Paid modules · Add-on revenue (monthly) · Active trials
- **Catalog table**: Module (name + description) · Tier badge · Price · Orgs (sub: trials) · Users
  using · Revenue · Recent orgs chips
- **Purchases by organization**: per-org blocks listing each add-on (module, source badge, date,
  price) + monthly add-on spend. RPC: `modules.get`

### 5.7 Module Grants (`/grants`) — the override console

- **KPIs (5)**: Total overrides · Active · Expiring ≤7d · Expired · Ended
- **Filters**: All/Active/Expired/Ended chips + search (org/`org_code`/module)
- **Table**: Organization (name + mono `org_code`, links to detail) · Plan · Module (sub: monthly
  value) · Type (source badge + Trial badge) · Granted date · **Validity** (badge: "No expiry" /
  "Nd left" amber ≤7d / "Expired Nd ago" red, sub: until date) · Requested via (note + created_by)
  · Actions (**+30d** extend, **End**)
- **New override dialog**: search customer → org select (mono code shown) → module select → mode
  (free grant / trial / purchase) → validity select → reason textarea. Created rows appear
  instantly (optimistic).
- **RPC**: `grants.list`, `grants.create`, `grants.extend`, `grants.end`, `orgs.list` (picker)

### 5.8 Payments (`/payments`)

- **Boilerplate banner**: links point to placeholder checkout domain; sender is stub
- **KPIs (5)**: Collected today (sub: X of Y transactions) · Failed today · Outstanding (sub: N
  unpaid) · Collected (14d) · Failed (14d)
- **Chart**: daily collections area (14d)
- **Outstanding invoices card**: per row — org (+`org_code`), invoice no, description, issue date,
  amount, **Send payment mail** button → creates payment link → builds email draft → sends via
  stub → row shows green "Payment mail sent"
- **History table (TanStack)**: Customer (name + `org_code` + invoice) · Item · Amount · Status
  badge (paid green/failed red/pending amber/refunded gray) · Method · Time; status chips + search;
  pagination
- **Create payment link dialog**: org select (amount prefilled from plan price) → amount +
  description → **Generate link** → shows URL (copy button) + "Send payment mail with this link"
- **RPC**: `payments.summary`, `payments.list`, `payments.createLink`, `payments.draft`,
  `reminders.send`

### 5.9 Reminders (`/reminders`)

- **Stub-sender banner**
- **KPIs (5)**: Pending drafts · Plans ending · Plans expired · Module access ending · Module
  access ended
- **Queue** (left): all drafts sorted by urgency (days left), tap to preview
- **Draft preview** (right): kind badge (Plan ending / Plan expired / Plan extended / Module access
  ending / Module access ended / Payment due), recipient, subject, full body (contains plan name,
  `org_code`, valid-until date, payment link when applicable, boilerplate footer) + **Send now**
- **Sent this session** log with stub message IDs
- **RPC**: `reminders.preview`, `reminders.send`

### 5.10 Security (`/security`)

- **KPIs (4)**: Open flags · High severity · Accounts affected · Closed (7d)
- **Filters**: Open-only/All · severity chips · search (org/`org_code`/user)
- **Flag cards** (not a table — evidence-heavy rows): severity badge (solid red high) · type label
  · status badge · detected date · org link + `org_code` · affected user (name/email) · signal
  bullet list · risk bar (0–100) · actions: **Reset sessions** (stub revokes sessions + rotates
  keys) · **Ban account** (confirm dialog; reason auto: "Security incident: <type> (flag #id)"; shows
  "Account banned" badge after) · **Resolve** · **False positive**
- **Flag types**: impossible travel, brute force, credential leak, token reuse, data exfiltration,
  off-hours anomaly
- **RPC**: `security.list`, `security.updateStatus`, `security.resetSessions`,
  `orgs.setStatus`

---

## 6. Shared UI conventions

- **KpiCard**: label, big tabular value, optional sub-line and Lucide icon
- **ChartCard**: title + subtitle header, `ResponsiveContainer` body, action slot
- **Badges**: `OrgStatusBadge` (active=green, trial/suspended=amber, banned=solid red,
  churned=gray), `UserStatusBadge`, `SourceBadge` (plan/purchase/grant), status/severity maps
- **Tables**: shadcn `Table`; sortable columns use a header button with `ArrowUpDown`; pagination
  footer with Prev/Next and row count
- **Dialogs** for all mutations (plan change, grant, ban, payment link) — destructive actions are
  red-variant buttons and require explicit reason where applicable
- **Formatters** in `bits.tsx`: `formatMoney` ($1,234), `formatHours` (38.5h), `formatDate`,
  `daysSince`
- All styling via semantic tokens (`bg-card`, `text-muted-foreground`, `bg-success/15`…) with
  dark-mode parity; chart colors via `--chart-1…5`

---

## 7. RPC action catalog

| Action | Mutates | Payload | Returns |
|---|---|---|---|
| `overview.get` | no | — | kpis, users_trend, minutes_trend, plan_distribution, module_adoption, recent_purchases |
| `orgs.list` | no | search, plan_name, status | rows (org_code, plan, expiry, rollups), total |
| `orgs.get` | no | org_id | org, plans, sibling_orgs, users, entitlements, available_modules, mrr |
| `orgs.updatePlan` | **yes** | org_id, plan_id, extend_days? | new plan + plan_ends_at |
| `orgs.setStatus` | **yes** | org_id, status (banned\|suspended\|active), reason? | status + reason (reason required to ban) |
| `grants.list` | no | status, expiring_days? | rows (validity, days_remaining, created_by, note), stats |
| `grants.create` | **yes** | org_id, module_id, mode (purchase\|grant\|trial), days?, note?, created_by? | entitlement |
| `grants.extend` | **yes** | entitlement_id, days | new expires_at |
| `grants.end` | **yes** | entitlement_id | revoked |
| `plans.get` | no | — | rows, matrix (module×plan), total_mrr |
| `plans.toggleModule` | **yes** | plan_id, module_id, included | ok |
| `modules.get` | no | — | rows, by_org, total_addon_revenue |
| `users.analytics` | no | org_id?, status?, search? | segments, rows, time_by_module, onboarding_trend |
| `payments.summary` | no | — | collected_today, failures, pending, last_14d |
| `payments.list` | no | status?, search?, today_only? | transaction rows |
| `payments.createLink` | **yes** | org_id, amount?, description? | hosted link (stub), amount, expires_at |
| `payments.draft` | no | org_id, link_url, amount, description?, due_date? | EmailDraft (payment_due) |
| `reminders.preview` | no | plan_days?, module_days? | drafts + counts |
| `reminders.renewalNotice` | no | org_id, plan_name?, new_ends_at | EmailDraft (plan_renewed) |
| `reminders.send` | **yes (stub)** | to, subject, body, kind? | provider:'stub', message_id |
| `security.list` | no | status?, severity? | rows + stats |
| `security.updateStatus` | **yes** | flag_id, status, note? | ok |
| `security.resetSessions` | **yes (stub)** | org_id | revoked_sessions, rotated_api_keys |
| `security.audit` | no | org_id, user_id?, failed_only? | login rows + summary rollups |

---

## 8. Roadmap

### Phase 1 — Real data (Supabase)
1. Connect Supabase Postgres resource; create schema in §4 (RLS: service-role only from backend)
2. Replace `data/mockDb.ts` calls in handlers with SQL; keep payload shapes identical (frontend
   untouched)
3. Sync `users`/`orgs` with Supabase Auth (`auth.users` ↔ `users`, org membership table)
4. Login audit from Supabase Auth logs → `login_events` (refresh via scheduled job)
5. Mutations become transactions: `grants.create` inserts entitlement + audit row

### Phase 2 — Money & mail
1. Payment provider (Stripe recommended): real transactions replace `transactions` mock;
   `createLink` → Stripe Payment Links; webhook → transaction status sync
2. Email API (Resend/SendGrid): implement `reminders.send`; persist `email_drafts` with
   provider message id; add open/click tracking columns
3. Scheduled job (pg_cron or Retool scheduled run): nightly scan for `plan_ends_at` ≤ 30d,
   `expires_at` ≤ 14d, overdue `pending` invoices → auto-queue drafts (idempotent per
   org+kind+date)

### Phase 3 — Security hardening
1. Real anomaly detection: aggregate `login_events` (failed counts, geo velocity, new-device,
   off-hours) into `security_flags` via SQL views or a scoring job; HIBP check on passwords
2. `security.resetSessions` → Supabase Admin API `signOut` per user + key rotation
3. Ban enforcement: RLS policy or JWT app-claim check so banned orgs are locked out at request
   time, plus session revocation
4. Immutable admin audit trail: every RPC mutation logs (actor = `req.user`, action, payload,
   timestamp) to `admin_audit_log`; surface in UI

### Phase 4 — Scale & product
1. RBAC inside the console (admin / support / finance / security roles gate actions)
2. Per-user drill-down page (full audit trail, devices, sessions list)
3. Invoicing: PDF invoices, tax fields, credit notes; dunning ladder (D+3/D+7/D+14)
4. Usage-based billing and seat true-ups; plan change proration
5. Self-serve module marketplace for org admins (request → approval flow feeding `grants.create`)
6. Webhooks/Slack alerts for: new high-severity flag, ban, failed payment, plan expiry
7. Tenant-level rollups (billing consolidation across sibling orgs)

---

## 9. Acceptance criteria (current phase)

- Every page loads from exactly one RPC action with the documented payload/response
- Ban without a reason is rejected by the backend
- Overrides (grants) always carry: source, optional validity, created_by, note
- Banned/suspended orgs are excluded from reminder drafts
- All monetary and date formatting is locale-consistent (`en-US`)
- Both light and dark themes render correctly (semantic tokens only)
- No paid or closed-source dependency anywhere in the stack

## 10. Open questions

1. Payment provider of record (Stripe vs Razorpay) — affects link API and webhook shape
2. Should banned orgs' data be retained or purged after N days?
3. Who receives payment reminders — owner only, or all admins of the org?
4. Do module grants need approval workflow (support requests → admin approval) before activation?
