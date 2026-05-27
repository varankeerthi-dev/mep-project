# Purchase Module Upgrade PRD (SAP-Style, Contextual UX)

## 1) Objective
Upgrade the current purchase flow into a controlled Procure-to-Pay system while preserving fast project-site execution.

Primary outcome:
- Unified backend object for Indent/PR.
- Contextual entry from project/site/central views.
- End-to-end line-level traceability: PR -> Inquiry -> PO -> GR -> IV.

## 2) Scope
In scope:
- Purchase requisition unification.
- Source determination (store vs procure).
- Availability Inquiry for direct-to-site procurement.
- PO/GR/IV document linking.
- Approval workflow and audit trail.

Out of scope (for now):
- Full advanced SAP features (consignment, subcontracting valuation, vendor scorecards with weighted KPIs, contract release orders).

## 3) Design Principles
1. Contextual Entry + Unified Backend.
2. Additive migration; no disruption to existing project workflows.
3. Line-level quantity truth; all dashboards derived from open qty.
4. Every transition auditable.

## 4) Users
- Site Engineer
- Project Manager
- Procurement Buyer
- Stores Team
- Finance/AP

## 5) Functional Requirements
### FR-1 Unified Requisition
- Single requisition header + line model supporting:
  - `PROJECT`
  - `SITE_WORK`
  - `COMPANY_EXPENSE`
  - `MAINTENANCE`
  - `CAPEX`
  - `OTHER`

### FR-2 Contextual Creation
- Project module: project auto-filled (hidden selector).
- Central procurement: manual assignment allowed.
- Same table/model used by both.

### FR-3 Source Determination
- On approval, line-level stock check.
- Tag each line:
  - `FULFILL_FROM_STORE`
  - `PROCURE`

### FR-4 Availability Inquiry
- Non-binding inquiry to multiple vendors for availability/date.
- Partial availability supported.
- Remainder stays open and re-inquirable.

### FR-5 Traceability Chain
- Maintain references from requisition line to downstream documents.
- Split quantities across multiple POs/receipts supported.

### FR-6 Goods Receipt + Open Qty
- Partial receipt support.
- Real-time open quantity per line.

### FR-7 Controls
- Release strategy (approval matrix).
- Audit log for every transition/action.

## 6) Data Model (High-Level)
New core entities:
- `purchase_requisitions`
- `purchase_requisition_lines`
- `availability_inquiries`
- `availability_inquiry_lines`
- `availability_responses`
- `goods_receipts`
- `goods_receipt_lines`
- `purchase_audit_log`

Required link fields (line-level):
- `requisition_line_id`
- `inquiry_line_id`
- `po_line_id`
- `gr_line_id`
- `iv_line_id` (phase where IV is added)

## 7) UX Model
### Entry Path A: Project Context
- User enters from project screen.
- `project_id` prefilled and locked.
- No long project dropdown.

### Entry Path B: Central Procurement
- User enters from global dashboard.
- Selects assignment type and target manually.

### Entry Path C: Other Modules
- Site work/maintenance/company expense auto-context.

## 8) Non-Functional Requirements
- Multi-tenant org isolation.
- Idempotent write operations where possible.
- Observable errors and retry-safe mutations.
- Query-performance indexes for queues/open qty dashboards.

## 9) Phase Plan (Strict Gate-Based)
Rule: Start next phase only after current phase sign-off.

### Phase 0: PRD + Baseline (This phase)
Deliverables:
- This PRD committed to repository.
- Baseline architecture map + migration checklist.
Exit criteria:
- PRD reviewed and approved.
- Git commit exists before coding starts.

### Phase 1: Unified Requisition Foundation
Deliverables:
- DB schema for requisition header/lines.
- Purpose/account assignment fields.
- Project-context and central-context create flows (minimal UI).
Exit criteria:
- Requisition can be created from project and central entries.
- Existing flows unaffected.

### Phase 2: Source Determination + Open Qty Engine
Deliverables:
- Approval-time stock check.
- Line tagging (`FULFILL_FROM_STORE`/`PROCURE`).
- Open qty computed and exposed in dashboard/API.
Exit criteria:
- Mixed lines (store/procure) handled in single requisition.

### Phase 3: Availability Inquiry
Deliverables:
- Inquiry and response tables + APIs.
- Multi-vendor inquiry, partial availability capture.
- Convert partial available qty to PO.
Exit criteria:
- Buyer can split a requisition line across vendors by availability.

### Phase 4: PO/GR Link Completion
Deliverables:
- Strong line-level linking from requisition/inquiry to PO and GR.
- Partial GR updates open qty correctly.
Exit criteria:
- End-to-end quantity trace for at least 3 split scenarios.

### Phase 5: Approval Controls + Audit
Deliverables:
- Release strategy rules.
- Full transition/event log.
Exit criteria:
- Approval routing and audit replay validated.

### Phase 6: Invoice Verification (3-way Ready)
Deliverables:
- IV model and basic 3-way checks (PO/GR/Invoice).
- Tolerance settings (qty/value/date).
Exit criteria:
- Blocking/warning behavior works for mismatch cases.

## 10) Migration Strategy
- Add new schema without deleting current tables first.
- Dual-read/compat layer during transition.
- Decommission redundant fields/views only after UAT sign-off.

## 11) Risks & Mitigations
- Risk: Partial-write inconsistency across parent-child writes.
  - Mitigation: transaction-safe RPC or compensating rollback strategy.
- Risk: User confusion with new screens.
  - Mitigation: keep old entry points, introduce queue views gradually.
- Risk: Performance on open-qty dashboards.
  - Mitigation: indexed status/open fields + denormalized summary view if needed.

## 12) Success Metrics
- >95% requisitions correctly auto-classified (store/procure).
- <2% manual correction needed in open qty.
- PO cycle-time reduction for direct-to-site procurements.
- Full audit traceability for all approved requisitions.

## 13) Execution Protocol
1. Commit this `PRD.md` first.
2. Implement phase-by-phase only.
3. Do not start next phase without explicit sign-off on exit criteria.
