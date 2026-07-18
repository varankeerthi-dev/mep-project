# PRD: Partner Allocation Module

## 1. Problem Statement

### Today's Gap
The existing **Leads module** captures inquiries and tracks them through statuses (New → Contacted → Qualified → Converted/Lost), but **stops at conversion**. When the organisation cannot or does not want to execute the work themselves, there is no structured way to hand the lead off to an external party.

### Real-World Scenarios
| Scenario | Originator | Executor | Current Workaround |
|---|---|---|---|
| Pipe manufacturer gets an installation inquiry | Manufacturer's sales team | Small piping installation contractor | Manual WhatsApp/email |
| AC dealer sells a unit but doesn't install | AC dealer | Independent HVAC technician | Word-of-mouth, no tracking |
| Large MEP contractor wins a job, subcontracts portions | Project management team | Niche subcontractor (insulation, testing, etc.) | Separate subcontractor PO system |
| Company gets a lead in a region they don't serve | HQ sales | Regional partner/franchisee | Lost lead |

### Key Insight
The originating entity (Dispatcher) and executing entity (Partner) are **decoupled**:
- Partner may buy materials from the dispatcher — or not
- Partner may use their own labour — or the dispatcher's
- The dispatcher may charge a referral fee/commission — or not

The system must be **flexible** enough to support all these variations without forcing a rigid process.

---

## 2. Existing System Analysis

### Leads Module (current)
- **Tables**: `leads`, `lead_statuses`, `lead_industries`, `lead_history`, `lead_assignment_rules`, `win_loss_reasons`, `cadence_rules`, `site_visits`
- **Architecture**: Types → API (`follow-up/leads-api.ts`) → Hooks (`use-leads.ts`) → UI (`modules/Leads/`)
- **Key UI**: List table, Kanban board, Detail drawer, Capture modal
- **Owner field**: `owner_user_id` points to an internal `employees` record

### Subcontractor Module (current)
- **Tables**: `subcontractors`, `subcontractor_work_orders`, `subcontractor_invoices`, `subcontractor_payments`
- **Architecture**: Types (`types/subcontractor.ts`), but API calls are **inline** in page components — no dedicated API layer
- **Focus**: Heavy operational tracking (work orders, invoices, payments, TDS, retention)
- **Size**: 30+ fields per subcontractor, complex financial tracking

### Gap Analysis
| Capability | Exists? | Notes |
|---|---|---|
| Lead capture | ✅ | Full-featured |
| Lead-to-partner assignment | ❌ | No junction table or UI |
| Partner registry | Partial | `subcontractors` is too heavy for "assign a lead" |
| Partner mobile view | ❌ | No mobile-first interface |
| Acceptance/rejection workflow | ❌ | No status model for allocations |
| Commission/referral fee tracking | ❌ | No field for this |

---

## 3. Proposed Solution: Partner Allocation Module

### 3.1 Core Concept

We introduce two new entities:

1. **Partner** — A lightweight profile for anyone who can receive a lead allocation (subcontractor, independent technician, internal team, franchisee). Reuses the existing `subcontractors` table when applicable via optional `subcontractor_id` link.

2. **Lead Allocation** — A junction record connecting a lead to a partner, with its own lifecycle.

### 3.2 Data Model

```
leads (existing)
  │
  └── lead_allocations (NEW)
       ├── partner_id ────────────► partners (NEW)
       ├── status: Pending → Accepted → In Progress → Completed → Verified
       ├── commission/fee (optional)
       └── partner_notes, timeline
```

**partners table** (lightweight, not replacing subcontractors):
```
id, organisation_id
partner_type:       enum('subcontractor', 'individual', 'internal_team', 'franchisee')
business_name, contact_person, phone, email
address, city, state, pincode, gstin
subcontractor_id:   uuid? (nullable FK to existing subcontractors)
categories:         text[] (e.g. ['HVAC Installation', 'Piping', 'Electrical'])
service_areas:      text[] (e.g. ['Mumbai', 'Thane', 'Navi Mumbai'])
is_active:          boolean
max_active_jobs:    int (0 = unlimited)
created_by, created_at, updated_at
```

**lead_allocations table**:
```
id, organisation_id, lead_id, partner_id
status:             enum('Pending', 'Accepted', 'Rejected', 'In Progress', 'Completed', 'Verified', 'Reassigned')
assigned_at, responded_at, completed_at
dispatcher_notes:   text
partner_notes:      text
commission_type:    enum('fixed', 'percentage')?
commission_value:   numeric?
estimated_value:    numeric (the partner's expected payout)
created_by, created_at, updated_at
```

### 3.3 State Machine

```
                  ┌──────────────┐
                  │   Pending    │
                  └──────┬───────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
      ┌──────────────┐     ┌──────────────┐
      │   Accepted   │     │   Rejected   │
      └──────┬───────┘     └──────┬───────┘
             │                    │ (can reassign)
             ▼                    ▼
      ┌──────────────┐     ┌──────────────┐
      │ In Progress  │     │  Reassigned  │
      └──────┬───────┘     └──────────────┘
             │
             ▼
      ┌──────────────┐
      │  Completed   │
      └──────┬───────┘
             │
             ▼
      ┌──────────────┐
      │   Verified   │
      └──────────────┘
```

- **Dispatcher** controls: Assign, Reassign, Mark Verified
- **Partner** controls: Accept, Reject, Mark In Progress, Mark Completed
- **Admin/System** controls: Archive/Cancel

### 3.4 Architecture

```
src/
  features/
    partner-allocation/
      model/
        schemas.ts          ← Zod schemas for partners + lead_allocations
        index.ts            ← re-exports
      api/
        partners.ts         ← Supabase queries for partners CRUD
        allocations.ts      ← Supabase queries for lead allocations
      hooks/
        usePartners.ts      ← TanStack hooks for partners
        useAllocations.ts   ← TanStack hooks for lead allocations
      pages/
        partners/
          PartnerListPage.tsx
          PartnerFormPage.tsx
        allocations/
          AllocationsListPage.tsx    ← Dispatcher view: all allocations
          PartnerInboxPage.tsx       ← Partner view: mobile-first inbox
      components/
        AllocatePartnerModal.tsx     ← Shown inside LeadDetailDrawer
        AllocationStatusBadge.tsx
        PartnerSelector.tsx          ← Dropdown/modal to pick a partner
```

### 3.5 Integration with Existing Leads

The entry point is the **LeadDetailDrawer**. When viewing a lead:
- A new "Allocations" tab or section shows current/previous allocations
- An "Allocate to Partner" button opens `AllocatePartnerModal` where the dispatcher selects a partner and adds notes
- The allocation status timeline is visible

### 3.6 UI Design

#### Dispatcher Views

**Partner List** — Table view of all registered partners:
- Columns: Business name, Contact, Categories, Service areas, Active jobs count, Status
- Search + filter by category/area
- Create/Edit partner buttons

**Lead Allocation Dashboard** — Table/grid of all allocations:
- Columns: Lead info, Partner, Status (colored badge), Assigned date, Actions
- Filter by status, partner, date range
- Click to view allocation detail

**Allocation Detail** — A card view showing:
- Lead summary (linked)
- Partner info
- Status timeline
- Actions: Reassign, Mark Verified, Cancel

#### Partner View (Mobile-First)

**Partner Inbox** — A clean, minimal list:
- Each card shows: Customer name, Location, Brief description, Status badge
- Tapping opens the allocation detail

**Job Action Card**:
- Customer details (name, phone, location)
- Scope of work (from lead)
- [Accept Job] / [Decline] buttons (when Pending)
- Status update buttons (when accepted): "Site Visited", "Work Started", "Completed"
- Notes field for partner to add updates

### 3.7 State Management

- **Server state**: TanStack Query for all data (standard project pattern)
  - Query keys: `['partner-allocations', orgId, filters]`, `['partners', orgId]`
  - Mutations invalidate relevant query groups
- **URL state**: Search params for filters, tabs, selected allocation
- **UI state**: React `useState` for modals, form state

### 3.8 RBAC Permissions

```
partners.read          → View partner list
partners.create        → Add new partners
partners.update        → Edit partner details
partners.delete        → Remove partners

allocations.read       → View allocations dashboard
allocations.create     → Assign leads to partners (dispatcher)
allocations.update     → Update allocation status (partner)
allocations.verify     → Mark allocation as verified (dispatcher)
```

### 3.9 Migration Steps

1. Create `partners` and `lead_allocations` tables in Supabase
2. Add RLS policies scoped to `organisation_id`
3. Create the feature module files (types → API → hooks → pages)
4. Register routes in App.tsx under `/partner-allocation/*`
5. Add RBAC permission keys to permission-catalog
6. Add the "Allocate" action button in `LeadDetailDrawer`
7. Add sidebar menu entry
8. Add partner-facing route for mobile inbox

### 3.10 Open Questions

| Question | Decision Needed |
|---|---|
| Should partners log in? | If yes, we need auth + a separate portal. MVP: public link or WhatsApp-based |
| Commission calculation? | Post-MVP. First version just records the value |
| Should allocation create a subcontractor work order? | Optional link. Only if the partner is also a subcontractor in our system |
| How does the partner get notified? | MVP: dispatcher shares a link manually. Future: WhatsApp API, SMS |
| Multiple partners per lead? | MVP: one active allocation. Future: split lead across multiple partners |

---

## 4. Success Criteria

1. Dispatcher can register a partner (lightweight, not full subcontractor)
2. Dispatcher can assign any lead to a partner from the lead detail view
3. Partner can accept/reject the assignment
4. Partner can update job status (In Progress → Completed)
5. Dispatcher can see all allocations in a dashboard
6. Dispatcher can verify completion
7. The allocation chain is visible in lead history
