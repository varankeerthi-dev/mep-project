# COMMUNICATION LOG ACTIONABLE WORKFLOWS AND APPROVALS PRD

**Module:** Communication Log (`client_communication`)
**Status:** ACCEPTED (Owner-requested 2026-10-19)
**Priority:** P1 High
**Target:** `apps/web/src/pages/ClientCommunication.tsx` and `apps/mobile/src/screens/ClientCommunication.tsx`
**Database Authority:** Supabase project `rujqejtisqermjyqqgoj` (verified via Supabase MCP)

---

## 1. OBJECTIVE

Transform the Communication Log from a passive recording tool into an active MEP operational command center.

The module must support five real-world MEP interaction scenarios:
1. Quotation discount and price negotiations requiring PM or MD authorization.
2. Out-of-scope work and variation orders requiring commercial sign-off before site execution.
3. Site tool retention disputes and demobilization impasses requiring executive MD intervention.
4. Site visit and shutdown scheduling with live conflict detection and VIP priority preemption.
5. Site measurement bookings with engineer availability checks and slot reservation.

Unresolved actions, pending approvals, and scheduled calls must roll over into an alert category so unhandled tasks do not disappear tomorrow.

---

## 2. DATA SHAPE AND DOMAIN MODEL

### 2.1 Core Action Intent Enum
The system introduces an explicit `action_intent` state:
- `general`: Standard call log without downstream approval or scheduling.
- `discount_request`: Client requests price concession on an active quotation.
- `variation_request`: Client requests extra work outside initial scope.
- `md_escalation`: High-urgency dispute or block requiring MD phone intervention.
- `site_visit`: Site inspection or client meeting request.
- `site_measurement`: Dimension verification for fabrication or BOQ.
- `manpower_request`: Client requests on-site technicians or tradesmen.

### 2.2 Approval State Machine
- `not_required`: Default for informational communications.
- `pending`: Awaiting decision by the designated authority.
- `approved`: Formally authorized by the assigned role.
- `rejected`: Declined with recorded reasoning.
- `counter_offered`: Conditional approval with revised terms.

### 2.3 Approver Role Hierarchy
- `PROJECT_MANAGER`: Discretion for discounts up to 5 percent, minor schedule shifts, and standard measurements.
- `ESTIMATION_HEAD`: Technical scope review and chargeable variation order pricing.
- `MD`: Commercial discounts over 5 percent, goodwill zero-cost variations, emergency manpower deployment, and site disputes.

---

## 3. DATABASE SCHEMA ENHANCEMENT

Target table is `public.client_communication`.

```sql
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS action_intent VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS requested_discount_percent NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requested_discount_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_quotation_id UUID REFERENCES quotation_header(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variation_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_variation_cost NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_severity VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS md_intervention_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manpower_trade VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requested_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS required_approver_role VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_discussion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS discussion_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rolled_over_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_action_intent ON client_communication(action_intent);
CREATE INDEX IF NOT EXISTS idx_comm_approval_status ON client_communication(approval_status);
CREATE INDEX IF NOT EXISTS idx_comm_needs_discussion ON client_communication(needs_discussion);
CREATE INDEX IF NOT EXISTS idx_comm_requested_date ON client_communication(requested_date);
```

---

## 4. UI SPECIFICATION (WEB & MOBILE)

### 4.1 Header KPI Summary Cards
Four live metrics:
1. Today's Calls: Total communications logged today.
2. Pending Approvals: Calls with `approval_status = 'pending'`.
3. Needs Discussion: Calls with `needs_discussion = true` and unresolved.
4. Rollover Alerts: Unresolved communications from yesterday or earlier with open next actions or pending approvals.

### 4.2 Tab Layout
1. All Communications: Chronological list of all logged interactions.
2. Needs Attention & Alerts: Filtered view of unresolved rollovers and overdue actions.
3. Approvals & Discussion: Dedicated queue for MD and managers with quick action buttons.
4. Site & Measurements: Direct view of scheduled visits, measurements, and manpower requests.
5. My Action Items: Personal queue for current authenticated user.

### 4.3 Log Modal Workflow
- Top selection for Action Intent buttons.
- Dynamic input panels tailored to the selected intent.
- Engineer availability lookup when selecting visit dates.
- Approval routing radio buttons defaulting to appropriate authority based on user role.

---

## 5. VERIFICATION REQUIREMENTS

1. Supabase schema migration executes cleanly on project `rujqejtisqermjyqqgoj`.
2. Web application compiles without TypeScript errors.
3. Mobile application compiles and passes Capacitor sync (`pnpm --filter=mobile build && pnpm --filter=mobile exec cap sync`).
4. Rollover logic correctly identifies records created before current local date.
