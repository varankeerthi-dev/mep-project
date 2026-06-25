# Leads Module PRD — Full CRM for MEP ERP

## 1) Objective
Build a standalone, action-oriented Leads module following the Zoho CRM lead model — with org-configurable statuses/industries, Kanban pipeline view, activity history, and round-robin assignment.

Primary outcome:
- Dedicated `/leads` route (list + Kanban views) replacing the current embedded leads inside Follow-Up Centre
- Zoho-style lead statuses (Attempted to Contact, Contact in Future, Contacted, Junk Lead, Lost Lead, Not Contacted, Pre-Qualified, Not Qualified) plus legacy statuses, all org-configurable
- Org-configurable industry picklist
- Slide-over lead detail drawer with Details/History/Activities tabs
- Activity history log tracking all mutations
- Round-robin lead assignment rules per org
- Kanban drag-drop pipeline view
- Admin settings for statuses, industries, and assignment rules

## 2) Scope

In scope:
- Standalone `/leads` route with List and Kanban views
- Org-configurable `lead_statuses` table (replaces hardcoded enum)
- Org-configurable `lead_industries` table
- `lead_history` table for full audit trail
- `lead_assignment_rules` table for round-robin config
- New fields: `industry_id`, `referred_by`, `remarks` on leads table
- Slide-over detail drawer with 3 tabs (Details, History, Activities)
- Lead create/edit forms with all new fields
- Kanban board with drag-drop status changes
- Admin settings pages for status, industry, assignment configuration
- RBAC: `leads.read`, `leads.manage`, `leads.settings`, `leads.auto_assign`
- Migration path: existing leads keep their statuses (legacy + new statuses coexist)

Out of scope (Phase 4):
- Lead scoring / predictive analytics
- Email integration (send/receive from lead record)
- Bulk import/export
- Lead duplication detection
- Web-to-lead forms

## 3) Design Principles
0. All pages must follow `DESIGN.md` — card body padding (24px), form field row pattern (70px labels, 8px gap, 11px label font, 12px input font), button system (primary #185FA5, secondary white, destructive black-text + red confirmation modal), compact typography, uppercase section headers (11px/600/0.05em), and searchable dropdown pattern for all selects.
1. Org-configurable first — statuses, industries configurable per org from day one
2. Additive migration — no breaking changes to existing leads data
3. Audit everything — every status change, field edit, assignment recorded in lead_history
4. Action-oriented — follows Zoho CRM paradigm where lead status tracks contact progression
5. Follow existing patterns — mirrors PurchaseModule architecture (module directory, entry point, sub-components)

## 4) Users
- Sales / BD team (primary — create, qualify, convert leads)
- Operations managers (assign leads, review pipeline)
- Org admins (configure statuses, industries, assignment rules)
- Follow-Up Centre consumers (leads still surface there with updated statuses)

## 5) Functional Requirements

### FR-1 Standalone Leads Route
- `/leads` — List view (default)
- `/leads/kanban` — Kanban pipeline view
- `/leads/settings` — Admin configuration
- Sidebar entry under Sales & Finance

### FR-2 Lead Statuses (Org-Configurable)
- `lead_statuses` table per org with: name, color, sort_order, category (open/won/lost/junk), is_default
- Default seed for new orgs: Attempted to Contact, Contact in Future, Contacted, Junk Lead, Lost Lead, Not Contacted, Pre-Qualified, Not Qualified
- Legacy statuses (New, Qualified, Converted, Disqualified, On Hold) preserved in config
- Admin UI to add/reorder/rename/disable statuses

### FR-3 Lead Industries (Org-Configurable)
- `lead_industries` table per org
- Default seed: ASP, Data/Telecom OEM, ERP, Government/Military, Large Enterprise, Management ISV, MSP, Network Equipment Enterprise, Non-management ISV, Optical Networking, Service Provider, Small/Medium Enterprise, Storage Equipment, Storage Service Provider, Systems Integrator, Wireless Industry, ERP, Management ISV
- Admin UI to manage industry list

### FR-4 Lead Fields
| Field | Type | Notes |
|---|---|---|
| contact_name | text (required) | |
| company_name | text | |
| contact_phone | text | |
| contact_email | text | |
| source | text (picklist) | Referral, Trade Show, Cold Call, Website, etc. |
| status | FK → lead_statuses.id | Org-configurable |
| industry_id | FK → lead_industries.id | Org-configurable picklist |
| referred_by | text | Name of referrer |
| remarks | text | Free text |
| project_name | text | |
| requirement_summary | text | |
| estimated_value | numeric | |
| expected_close_date | date | |
| owner_user_id | FK → users | Assigned sales rep |
| next_action_at | timestamptz | Follow-up cadence |
| client_id | FK → clients | Linked existing client |

### FR-5 Lead History / Activity Log
- `lead_history` table records: action type, field_name, old_value, new_value, performed_by, timestamp
- Actions tracked: created, status_changed, field_changed, note_added, assigned, converted
- History tab in lead detail drawer shows timeline of all changes

### FR-6 Lead Assignment
- `lead_assignment_rules` table per org
- Round-robin method: cycles through designated user_ids
- Manual assignment also supported (pick from user list)
- Auto-assign on lead creation if round-robin enabled

### FR-7 List View
- Table with columns: contact, company, status, industry, source, owner, estimated value, next action, created date
- Filters: status, source, industry, owner, date range
- Search by contact name, company, email, phone
- Bulk actions: assign, change status, delete
- Sortable columns

### FR-8 Kanban View
- Columns dynamically rendered from org's lead_statuses
- Drag-and-drop cards between columns triggers status change + history record
- Card shows: contact, company, estimated value, owner, next action chip
- Quick-edit on card click (inline modal)
- Column counts (lead count per status)

### FR-9 Lead Detail Drawer
- Slide-over panel from list/Kanban
- Tab 1 — Details: all lead fields in read-only + inline edit
- Tab 2 — History: chronological activity timeline
- Tab 3 — Activities: follow-up actions, next action scheduling
- Convert button: Convert to Client + Quotation
- Delete / Disqualify actions

### FR-10 Follow-Up Centre Integration
- Existing lead rows in Follow-Up Centre continue to work
- Lead rows reflect new statuses
- Clicking a lead row navigates to /leads (not inside Follow-Up)

## 6) Data Model

### New Tables
```sql
lead_statuses (id, org_id, name, color, sort_order, is_default, category, created_at)
lead_industries (id, org_id, name, sort_order, created_at)
lead_history (id, lead_id, org_id, action, field_name, old_value, new_value, performed_by, notes, created_at)
lead_assignment_rules (id, org_id, method, user_ids, is_active, last_assigned_index, created_at, updated_at)
```

### Modified Tables
```sql
leads (+ industry_id FK, + referred_by text, + remarks text, + lead_status_id FK)
```

## 7) Module Architecture

```
src/modules/Leads/
  LeadsModule.tsx           # Entry — tabs: List, Kanban, Settings
  components/
    LeadsListView.tsx       # Table + filters + search
    LeadsKanbanView.tsx     # Drag-drop Kanban
    LeadDetailDrawer.tsx    # Slide-over detail (3 tabs)
    LeadCreateForm.tsx      # Create lead form
    LeadEditForm.tsx        # Inline edit in drawer
    LeadHistoryTab.tsx      # Activity timeline
    LeadActivitiesTab.tsx   # Follow-up actions
    LeadStatusConfig.tsx    # Admin: manage statuses
    LeadIndustryConfig.tsx  # Admin: manage industries
    LeadAssignmentConfig.tsx # Admin: assignment rules
```

## 8) Routes
- `/leads` → LeadsModule (List tab)
- `/leads/kanban` → LeadsModule (Kanban tab)
- `/leads/settings` → LeadsModule (Settings tab)

## 9) Effort Estimate
| Phase | Scope | Estimate |
|---|---|---|
| Phase 1 | Standalone module, DB migration, list view, detail drawer, create form, history | 3-4 days |
| Phase 2 | Kanban view with drag-drop | 2 days |
| Phase 3 | Admin settings + round-robin assignment | 2 days |
| Phase 4 | Reports & analytics | 2 days |
| **Total** | | **9-10 days** |
