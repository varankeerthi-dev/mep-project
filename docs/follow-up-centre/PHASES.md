# Follow-Up Centre Module — Phased Implementation Plan

**Document Version:** 1.0  
**Date:** 2026-05-20  
**Status:** Phases 1–11 implemented (Supabase + app); Phase 12 (mobile) pending  
**Platform:** MEP / EPC ERP (Industrial Piping, Fabrication, Utility Lines, MEP)  
**Stack (this repo):** React 19 + Vite + TypeScript + Tailwind + Supabase + TanStack Query

---

## 1. Executive Summary

The **Follow-Up Centre** is an operational command module for sales, procurement, accounts, and site teams to track:

1. **Quotation follow-up** — convert outstanding quotes to work orders/projects  
2. **PO/DC backlog** — material/work delivered but client PO still pending (procurement gap)  
3. **Invoice follow-up** — overdue invoice escalation with severity-based actions  
4. **Unified activity logs** — cross-tab audit trail of reminders, responses, and escalations

### 1.1 UX Priority (Current)

| Priority | Target |
|----------|--------|
| **Primary** | Desktop / laptop / large tablet webview (1280px+, 1440px+) |
| **Secondary** | Responsive tablet; layouts must not break |
| **Deferred** | Mobile-first, swipe, bottom sheets, thumb-zone UX (separate phase) |

The experience should feel like **Linear**, **Jira**, **ERPNext**, or **Zoho Inventory** — dense, scannable, spreadsheet-like efficiency.

### 1.2 Stack Note (PRD vs Repo)

The original PRD references **Next.js App Router**. This codebase uses **Vite + `react-router-dom`** with routing in `App.tsx`. Implementation paths are mapped in [§10 File Structure](#10-file-structure-repo-mapping).

---

## 2. Module Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FOLLOW-UP CENTRE (Top Level)                       │
├──────────────┬──────────────┬──────────────┬──────────────────────────┤
│  Tab A       │  Tab B       │  Tab C       │  Tab D                    │
│  Quotation   │  PO/DC       │  Invoice     │  Activity Logs            │
│  Follow-Up   │  Backlog     │  Follow-Up   │  (Unified)                │
├──────────────┴──────────────┴──────────────┴──────────────────────────┤
│  Per-tab layout (same hierarchy):                                        │
│    1. Metrics cards (horizontal, compact)                                │
│    2. Sticky search + filters (URL search params)                        │
│    3. Dense table / list rows (+ optional right detail drawer)           │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Mock → Supabase      Mock → Supabase      Escalation engine
   (Phase 1–2)          (Phase 3–4)          (Phase 5–6)
```

### 2.1 Shared Technical Rules

| Rule | Requirement |
|------|-------------|
| Server state | TanStack Query only |
| Forms | React Hook Form + Zod |
| Search | Debounced 300ms |
| Filters | Stored in URL search params |
| Lists >100 rows | Virtualized table (`@tanstack/react-virtual`) |
| Pagination | Server-side when on Supabase |
| Modals | Lazy-loaded where heavy |
| Optimistic UI | Log response, flag issue, reminder sent |

---

## 3. Phase Overview

| Phase | Name | Goal | Deliverable | Depends On |
|-------|------|------|-------------|------------|
| **0** | Documentation & scaffolding | Align team on scope, paths, phases | This document + folder structure | — |
| **1** | Foundation & mock UI | Desktop shell, tabs, types, mock data, all four tabs visible | Routable page, no backend | Phase 0 |
| **2** | Core libs & hooks | Escalation engine, WhatsApp builder, filters, formatters | Pure TS + hooks tested in UI | Phase 1 |
| **3** | Tab A — Quotation follow-up | Full quotation tab UX + actions | Filters, table, reminder, log response | Phase 2 |
| **4** | Tab B — PO/DC backlog | Procurement-gap workflow | Table, share DC pack, flag issue | Phase 2 |
| **5** | Tab C — Invoice follow-up | Escalation matrix UI + detail drawer | Severity bands, sortable table | Phase 2 |
| **6** | Tab D — Activity logs | Unified timeline | Dense log, grouping, cross-tab icons | Phase 1–2 |
| **7** | Supabase schema & RLS | Persistent follow-up data | Migrations + types | Phase 1–6 UX stable |
| **8** | API integration | Replace mocks with real queries | TanStack Query hooks → Supabase | Phase 7 |
| **9** | Performance hardening | 500+ rows, virtualization, SSR pagination | Production table performance | Phase 8 |
| **10** | RBAC & org tenancy | Permission gates per role | `organisation_id` enforcement | Phase 8 |
| **11** | Polish & QA | Accessibility, keyboard, empty states | Ship-ready desktop module | Phase 9–10 |
| **12** | Mobile adaptation (future) | Android WebView / field usage | Bottom sheets, compact cards | Phase 11 |

---

## 4. Phase 0 — Documentation & Scaffolding

**Status:** In progress (this file)

### Objectives

- Freeze phased plan before code churn  
- Map PRD paths to repo paths  
- Define acceptance criteria per phase  

### Tasks

- [x] Create `docs/follow-up-centre/PHASES.md` (this document)  
- [ ] Create `docs/follow-up-centre/PRD.md` (full product spec snapshot)  
- [x] Add sidebar entry: **Tasks → Follow-Up Centre** → `/follow-up`  
- [x] Register route in `App.tsx`  

### Exit Criteria

- Team agrees on phase order and desktop-first scope  
- No implementation blocked on ambiguous requirements  

---

## 5. Phase 1 — Foundation & Mock UI

### Objectives

Ship a **routable, desktop-dense** Follow-Up Centre with all four subtabs using **mock data only**.

### Scope

| Item | Detail |
|------|--------|
| Page shell | Page title, org context, horizontal subtab nav |
| Layout | Metrics → sticky filters → virtualized-ready table shell |
| Tabs | Quotation \| PO/DC Backlog \| Invoice \| Activity Logs |
| Data | `src/mock/followup-data.ts` |
| Types | `src/types/followup.ts` |

### File Checklist (Phase 1)

```
src/pages/FollowUpCentre.tsx
src/types/followup.ts
src/mock/followup-data.ts
src/components/follow-up/followup-tabs.tsx
src/components/follow-up/metrics-cards.tsx
src/components/follow-up/followup-filter-bar.tsx
src/components/follow-up/followup-search.tsx
```

### Mock Data Requirements

**Quotation clients:** Rosti, Sancraft, Ashok Leyland, Flowserve  

**Projects:** Utility Air Line Expansion, SS304 Process Piping, Cooling Tower Utility Header, Boiler Feed Water Pipeline  

**PO/DC backlog:** Sujo Plast, Cooling Tower Piping Work Order, Rajesh Kumar, Utility Expansion Package  

### Exit Criteria

- `/follow-up` loads without errors  
- Tab switch updates URL (`?tab=quotation|podc|invoice|activity`)  
- Each tab shows metrics + filter bar + placeholder rows from mock  
- Layout usable at 1280px and 1440px  

---

## 6. Phase 2 — Core Libraries & Hooks

### Objectives

Implement **business logic** independent of UI so tabs share one engine.

### Libraries (`src/lib/followup/`)

| File | Responsibility |
|------|----------------|
| `escalation-engine.ts` | `getReminderStage(daysOverdue)` — exact matrix below |
| `whatsapp-builder.ts` | Deep links for quote reminder & signed DC pack |
| `followup-utils.ts` | Filter predicates, sort keys, validity helpers |
| `followup-formatters.ts` | Display labels for status, dispute, delivery proof |
| `currency-format.ts` | INR / org currency formatting |
| `date-format.ts` | Relative aging, due labels |

### Escalation Engine (Must Match Exactly)

```typescript
export function getReminderStage(daysOverdue: number): number {
  if (daysOverdue < 0) return 0;
  if (daysOverdue >= 0 && daysOverdue < 7) return 1;
  if (daysOverdue >= 7 && daysOverdue < 15) return 2;
  if (daysOverdue >= 15 && daysOverdue < 30) return 3;
  return 4;
}
```

| Stage | Days Overdue | Label | Action Theme |
|-------|--------------|-------|----------------|
| 0 | Pre-due (&lt; 0) | Pre-Due | Friendly: payment link, measurement sheets, docs |
| 1 | 0–6 | Due / Tier 1 | Professional balance reminder |
| 2 | 7–14 | Tier 2 | Soft escalation: internal hold? expected date? |
| 3 | 15–29 | Tier 3 | Firm: explicit payment date, email/SMS |
| 4 | 30+ | Tier 4 Critical | Phone call, hold dispatches, pause site support |

### Hooks (`src/hooks/`)

| Hook | Responsibility |
|------|----------------|
| `use-followup-filters.ts` | Sync filters ↔ URL search params |
| `use-followup-search.ts` | 300ms debounced client search |
| `use-invoice-escalation.ts` | Stage + severity colors + recommended actions |
| `use-whatsapp-share.ts` | Build + open WhatsApp URLs |

### Exit Criteria

- Unit-testable pure functions for escalation stages  
- WhatsApp URLs encode quote/DC context per PRD  
- Filters read/write `URLSearchParams` without full page reload  

---

## 7. Phase 3 — Tab A: Quotation Follow-Up

### Objectives

Track outstanding quotations; drive conversion to confirmed work orders.

### UI Pattern

- Compact **table rows** (not oversized cards)  
- **Sticky** filter header  
- **Inline** status dropdown + reminder button  
- Optional **right detail drawer** (desktop)

### Filters

| Filter | Type |
|--------|------|
| Validity expiring soon | Toggle / preset |
| Value high-to-low | Sort |
| Client name | Debounced search |
| Status | Multi or single select |
| Submission date range | Date range |

### Quick Actions

| Action | Behavior |
|--------|----------|
| **Send Reminder** | WhatsApp: quote no, PDF link, project, total, client |
| **Log Response** | Modal/dropdown: Under Review, In Negotiation, Lost to Competitor, Pending |

### Components

```
quotation-followup-row.tsx
reminder-action-sheet.tsx   (desktop: dropdown/dialog; not mobile sheet yet)
escalation-badge.tsx        (reuse where applicable)
```

### Exit Criteria

- All filters functional on mock data  
- Reminder opens WhatsApp with correct payload  
- Log response updates row optimistically + activity log entry (local until Phase 7)  

---

## 8. Phase 4 — Tab B: PO/DC Backlog

### Objectives

Surface **procurement gap**: DC signed / work done / material delivered but **client PO pending** — blocks invoicing.

### Required Columns

| Field | Notes |
|-------|-------|
| DC / WO Number | Primary identifier |
| Client Name | |
| Project Name | |
| Estimated Value | Currency formatted |
| Days Pending PO | Sortable, color by age |
| Site Engineer | |
| Client Coordinator | |
| Delivery Proof Status | Badge |
| Dispute Status | Badge |

### Quick Actions

| Action | Behavior |
|--------|----------|
| **Share Signed DC Pack** | WhatsApp: signed DC link, delivery photos, completion photos, PO reminder |
| **Flag Issue** | Internal: quantity mismatch, damaged material, incomplete delivery, disputed execution |

### Components

```
podc-backlog-row.tsx
```

### Exit Criteria

- Backlog table sortable by days pending and value  
- Dispute indicators visible inline  
- Flag issue writes to local activity + optimistic row state  

---

## 9. Phase 5 — Tab C: Invoice Follow-Up

### Objectives

Automated overdue tracking with **severity-based** operational follow-up.

### UI Pattern

- **Escalation color bands** on rows  
- **Aging columns** (due date, days overdue, stage)  
- **Sortable** table  
- **Right-side detail preview** panel (amount, history, next action)

### Visual Requirements

- Escalation severity at a glance  
- Collection risk indicator (optional score from rules)  
- Payment urgency badge via `escalation-badge.tsx`

### Components

```
invoice-escalation-card.tsx   (detail panel / expanded row)
escalation-badge.tsx
```

### Exit Criteria

- Every mock invoice maps to correct stage 0–4  
- Detail panel shows recommended action copy per stage  
- Sort by overdue days, amount, client name  

---

## 10. Phase 6 — Tab D: Unified Activity Logs

### Objectives

Single timeline of follow-up events across quotations, PO/DC, and invoices.

### UI Pattern

- **Dense timeline** (not chat-style bubbles)  
- **Grouped timestamps** (Today, Yesterday, date groups)  
- **Inline icons** by event type (reminder, response, escalation, flag)

### Event Types

| Type | Source Tab |
|------|------------|
| `quotation_reminder_sent` | A |
| `quotation_response_logged` | A |
| `podc_pack_shared` | B |
| `podc_issue_flagged` | B |
| `invoice_reminder_sent` | C |
| `invoice_escalation_changed` | C |

### Components

```
activity-log-item.tsx
```

### Exit Criteria

- Logs filterable by tab source and date  
- Clicking log optionally highlights related row in other tab (stretch)  

---

## 11. Phase 7 — Supabase Schema & RLS

### Objectives

Persist follow-up state; multi-tenant safe.

### Proposed Tables (Draft)

```sql
-- follow_up_quotation_events
-- follow_up_podc_backlog (+ dispute flags)
-- follow_up_invoice_escalations
-- follow_up_activity_log (unified)
```

### Requirements

- `organisation_id` on all tables  
- RLS via `org_members` pattern (match existing migrations)  
- FK to `quotation_headers`, `delivery_challans`, `invoices` where applicable  
- Indexes: `(organisation_id, status)`, `(organisation_id, days_overdue)`  

### Migration Location

```
supabase/migrations/0XX_follow_up_centre.sql
```

### Exit Criteria

- Migration applies cleanly on dev Supabase  
- Generated TypeScript types or hand-written interfaces aligned with DB  

---

## 12. Phase 8 — API Integration

### Objectives

Replace mock layer with Supabase + TanStack Query.

### Query Keys (Suggested)

```
['follow-up', orgId, 'quotations', filters]
['follow-up', orgId, 'podc-backlog', filters]
['follow-up', orgId, 'invoices', filters]
['follow-up', orgId, 'activity', filters]
```

### Mutations

| Mutation | Optimistic |
|----------|------------|
| Log quotation response | Yes |
| Flag PO/DC issue | Yes |
| Record reminder sent | Yes |
| Update invoice escalation note | Yes |

### Data Sources (Existing Tables)

| Tab | Likely Source |
|-----|----------------|
| Quotation | `quotation_headers` + clients |
| PO/DC | `delivery_challans`, work orders, projects |
| Invoice | Invoice module tables + payments |
| Activity | `follow_up_activity_log` |

### Exit Criteria

- Mock flag removable via env or feature flag  
- All four tabs load real org-scoped data  
- Errors show toast + retry  

---

## 13. Phase 9 — Performance Hardening

### Objectives

**500+ rows** smooth on desktop.

### Tasks

- [ ] `@tanstack/react-virtual` on all main tables  
- [ ] Server-side pagination + sort  
- [ ] Skeleton loaders per tab  
- [ ] Memoized row components (`React.memo`)  
- [ ] Lazy-load heavy modals (`React.lazy`)  
- [ ] Infinite scroll OR page size 50/100 selector  

### Exit Criteria

- Scroll 500 mock rows at 60fps on mid-range laptop  
- Filter/search &lt;100ms perceived on client; server debounced  

---

## 14. Phase 10 — RBAC & Tenancy

### Objectives

Restrict actions by role (site engineer vs accounts vs sales).

### Permission Matrix (Draft)

| Action | Site Eng | PM | Sales | Accounts | Admin |
|--------|----------|-----|-------|----------|-------|
| View all tabs | ✓ | ✓ | ✓ | ✓ | ✓ |
| Send quotation reminder | — | ✓ | ✓ | — | ✓ |
| Log quote response | — | ✓ | ✓ | — | ✓ |
| Share DC pack | ✓ | ✓ | — | — | ✓ |
| Flag PO/DC issue | ✓ | ✓ | — | — | ✓ |
| Invoice escalation actions | — | ✓ | — | ✓ | ✓ |

Integrate with `src/rbac/` hooks.

### Exit Criteria

- Unauthorized actions hidden or disabled with tooltip  
- All queries scoped by `organisation_id`  

---

## 15. Phase 11 — Polish & QA

### Objectives

Production-ready **desktop** module.

### Checklist

- [ ] Keyboard: tab through filters, Enter on actions  
- [ ] Empty states per tab with CTA  
- [ ] Loading / error boundaries  
- [ ] Consistent status colors (semantic tokens)  
- [ ] `typecheck` + `lint` clean  
- [ ] Manual test matrix (see §16)  

### Exit Criteria

- Sign-off from PM + accounts stakeholder on desktop flows  
- Documented in `docs/follow-up-centre/TEST-PLAN.md` (optional)  

---

## 16. Phase 12 — Mobile Adaptation (Future)

**Explicitly out of scope for Phases 1–11.**

When started:

| Pattern | Implementation |
|---------|----------------|
| Bottom sheets | `reminder-action-sheet.tsx`, `mobile-bottom-actions.tsx` |
| Swipe actions | Reminder snooze / complete |
| Horizontal metric scroll | `metrics-cards.tsx` variant |
| 44px touch targets | Mobile breakpoint only |
| Single-thumb layout | Stack cards, reduce columns |

Components listed in PRD for mobile should be built in this phase, not Phase 1.

---

## 17. File Structure (Repo Mapping)

PRD Next.js paths → this repo:

| PRD Path | Repo Path |
|----------|-----------|
| `/app/follow-up/page.tsx` | `src/pages/FollowUpCentre.tsx` |
| `/components/follow-up/*` | `src/components/follow-up/*` |
| `/hooks/use-*.ts` | `src/hooks/use-followup-*.ts` |
| `/lib/*` | `src/lib/followup/*` |
| `/types/followup.ts` | `src/types/followup.ts` |
| `/mock/followup-data.ts` | `src/mock/followup-data.ts` |

### Full Component List (All Phases)

```
src/components/follow-up/
  metrics-cards.tsx
  followup-filter-bar.tsx
  quotation-followup-row.tsx
  podc-backlog-row.tsx
  invoice-escalation-card.tsx
  activity-log-item.tsx
  reminder-action-sheet.tsx
  escalation-badge.tsx
  mobile-bottom-actions.tsx      # Phase 12 only
  followup-tabs.tsx
  followup-search.tsx
```

---

## 18. Design System (Desktop-First)

| Token | Usage |
|-------|--------|
| Corners | `rounded-xl` on cards, `rounded-lg` on rows |
| Palette | Neutral zinc/slate; semantic status colors |
| Shadows | Minimal (`shadow-sm` on sticky bars only) |
| Typography | `text-xs` / `text-sm` operational density |
| Spacing | Tight vertical rhythm (`py-1.5`, `gap-2`) |
| Tables | Sticky header, zebra optional, hover row highlight |

**Avoid in Phases 1–11:** oversized padding, mobile-only bottom nav, swipe gestures.

---

## 19. Test Plan Summary

| Phase | Test Focus |
|-------|------------|
| 1 | Route, tabs, mock render |
| 2 | Escalation stage boundaries (−1, 0, 6, 7, 14, 15, 29, 30) |
| 3 | WhatsApp URL encoding; filter combinations |
| 4 | Flag issue types; days pending sort |
| 5 | Stage colors match matrix |
| 6 | Activity grouping and filters |
| 8 | Org isolation; mutation rollback |
| 9 | 500-row scroll benchmark |
| 10 | Role matrix |

---

## 20. Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| PRD assumes Next.js | Map routes in `App.tsx`; no App Router |
| Invoice/DC schema drift | Phase 8 spike: confirm column names before queries |
| Duplicate follow-up in TodoList | Follow-Up Centre is operational ERP; TodoList stays personal tasks |
| Mobile scope creep | Lock desktop in Phases 1–11; Phase 12 separate PR |

---

## 21. Implementation Order (Quick Reference)

```
Phase 0  →  Docs (this file)
Phase 1  →  Page + tabs + mock + shell
Phase 2  →  Libs + hooks
Phase 3  →  Quotation tab complete
Phase 4  →  PO/DC tab complete
Phase 5  →  Invoice tab complete
Phase 6  →  Activity logs complete
Phase 7  →  Supabase migration
Phase 8  →  Wire Supabase
Phase 9  →  Virtualization + perf
Phase 10 →  RBAC
Phase 11 →  Polish + ship desktop
Phase 12 →  Mobile (later)
```

---

## 22. Sign-Off Checklist

| Stakeholder | Phase to Review |
|-------------|-----------------|
| Sales Coordinator | 3 |
| Procurement | 4 |
| Accounts | 5 |
| Project Manager | 1, 6 |
| Engineering Lead | 7, 8, 9 |

---

**Next step after Phase 0:** Begin **Phase 1** — scaffold `FollowUpCentre.tsx`, types, mock data, and register `/follow-up` route.
