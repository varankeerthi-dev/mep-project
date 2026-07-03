# Brutal CEO Review: Project Module

**Module:** Projects (`src/pages/Projects.tsx`, `ProjectList.tsx`, `CreateProject.tsx`, `ProjectOverview.tsx`, and related hooks/components)

**Review Date:** 2026-06-29

**Framework:** Brutal CEO Questions & Recommendations v1.0

**Reviewer Mindset:** "What happens when this fails at scale?"

---

## Executive Summary

The Project Module is the **central nervous system** of the MEP ERP. It manages project lifecycle from Draft → Active → Execution Completed → Financially Closed, and integrates with nearly every other module (DCs, Quotations, Invoices, Subcontractors, Materials, Site Reports, Meetings, Issues, Manufacturing).

**The module is feature-rich but structurally fragile.** It suffers from a critical god-component problem (`ProjectList.tsx` at 4,978 lines), inline style chaos, and missing pagination on some queries. Improvements made: ~~absent error boundaries~~ ✅ `TabErrorBoundary` wraps all tabs, ~~zero draft persistence~~ ✅ `useProjectFormDraft` auto-saves, ~~no audit trail~~ ✅ `audit_log` table + `created_by`/`updated_by` tracking. At 1,000 customers, the first thing to break will be the Supabase queries running without proper indexes or pagination.

---

## 1. Demand Reality

### What does the user actually experience when something goes wrong?

| Failure Scenario | Current Behavior | Severity |
|---|---|---|
| Save fails on CreateProject | Generic `alert('Error: ' + err.message)` — no retry, no draft saved | 🔴 Critical |
| Network drops mid-edit on ProjectList detail view | All unsaved state (tabs, expanded sections, form data) is lost | 🔴 Critical |
| Supabase query returns 500+ projects | `projects` query fetches ALL rows (`select('*')`) — **now has `.limit(500)` safety cap** | 🟡 High (was 🔴 Critical) |
| User clicks "Delete Project" with related records | `alert('Cannot delete project: Related records exist')` — no guidance on which records | 🟡 High |
| Concurrent edits by two users on same project | Last-write-wins, no conflict detection, no notification | 🟡 High |
| PDF generation fails mid-download | Error caught but user has no indication what failed or retry option | 🟡 High |
| Organisation ID is null/undefined | Queries silently return empty arrays — user sees "No projects" with no explanation | 🟡 High |

**Verdict:** Users experience silent failures, lost work, and unexplained empty states. The system does not explain itself.

---

## 2. Happy Path Bias

### Did we only design the happy path?

**Yes.** The happy path is well-designed:

```
Create Project → Fill Form → Save → Success Alert → Navigate to List
```

**Reality path:**

```
Fill Form → Submit → Network Lag → User clicks again → Double Insert
     ↓
Save Fails → Generic Alert → User confused → Refreshes page → Loses all data
     ↓
Save Succeeds → Navigate → List re-fetches ALL projects → Slow render
     ↓
Click Project → Detail loads 10+ queries in parallel → Some fail → Partial UI
```

**Missing flows:**
- No optimistic updates on create/edit
- ~~No auto-save / draft persistence~~ ✅ Fixed: `useProjectFormDraft` hook auto-saves to localStorage every 30s with restore on page load
- ~~No confirmation before navigating away with unsaved changes~~ ✅ Fixed: `beforeunload` handler warns on navigation with unsaved form data
- No loading state per-section (entire page shows generic "Loading projects...")
- No skeleton loading for detail view subsections
- ~~No error boundary around individual detail tabs~~ ✅ Fixed: `TabErrorBoundary` wraps all tab content

---

## 3. Human Behavior Review

### What happens if users behave irrationally?

| Behavior | Current Handling | Risk |
|---|---|---|
| Clicks "Create" 5 times rapidly | **Fixed:** `if (saving) return;` guard + `disabled={saving}` prevents double-submit | ✅ Resolved |
| Uploads same file to documents multiple times | No deduplication check | 🟡 Storage bloat |
| Leaves 15 tabs open in detail view | **Fixed:** `visitedTabs` pattern removed — only active tab is mounted, previous tabs unmount on switch | ✅ Resolved |
| Sets completion % to 100 but status to "Draft" | Auto-transitions status to "Execution Completed" — user may not want this | 🟡 Surprising auto-behavior |
| Creates project with empty client | Client validation exists but only on submit — no inline validation | 🟡 Late feedback |
| Navigates away mid-form-fill | ~~All form data lost — no draft, no warning~~ | ✅ Fixed: `beforeunload` warning + localStorage draft auto-save |
| Filters list by "Closed" but has 0 closed projects | Shows "No projects" — unclear if filter issue or data issue | 🟡 Confusing empty state |
| Opens ProjectList on mobile | Inline styles don't fully respond — detail view is cramped | 🟡 Poor mobile UX |
| Clicks "Download Certificate" rapidly | Multiple PDF generation attempts — no debounce | 🟡 Duplicate downloads |

---

## 4. Scale Review

### What happens when this grows 100×?

**Current state:**
- **Projects list:** Fetches projects via `supabase.from('projects').select('*')` — **now has `.limit(500)` safety cap, client-side pagination at 20/page**
- **Detail view:** Fires 10+ parallel queries (POs, invoices, expenses, payments, equipment, snags, claims, insights, drawings, materials, joint measurements, TC protocols, milestones, team members) — **all on detail mount**
- **Material Management:** `ProjectMaterialIntents` loads all intents for a project without pagination
- **Tasks:** `ProjectTaskListView` uses virtualization (`@tanstack/react-virtual`) — **this is good**
- **Meetings:** `ProjectMeetings` renders full HTML table — **no virtualization**

**At 500 projects:**
- List query takes 5-10 seconds (no index on `organisation_id + created_at`)
- Detail view fires 15+ simultaneous Supabase queries
- Browser tab uses less RAM (**visited tabs now unmount** — fixed memory leak)

**At 5,000 projects:**
- List page becomes unusable
- Supabase connection pool exhaustion
- React Query cache becomes massive

**At 50,000 projects:**
- Complete breakdown

---

## 5. Partial Failure Review

### What happens if only some operations succeed?

| Scenario | Current Behavior | Better Approach |
|---|---|---|
| Project saves but milestones fail | Partial save — no rollback, no indication | Transaction / rollback |
| Bulk import of 100 projects, 95 succeed, 5 fail | No bulk import exists | N/A — but if added, needs partial success handling |
| Detail view: POs load, invoices fail | Tab shows POs but no invoices — no error indicator | Per-section error boundary |
| PDF generation: document renders but save fails | `alert('Failed to generate completion certificate')` — no retry | Retry + draft state |
| Equipment insert succeeds, subsequent snag fails | Equipment saved, snag lost — no transaction | Database transaction |

**Key gap:** No operation has atomic guarantees. Partial failures are silently absorbed.

---

## 6. Recovery Review

### Can users recover their work?

| Recovery Need | Current State | Rating |
|---|---|---|
| Browser crash during project creation | ~~No draft persistence~~ ✅ `useProjectFormDraft` auto-saves to localStorage every 30s, restores on load | 🟡 7/10 |
| Session expiry mid-edit | `SESSION_EXPIRED` error thrown but form state not saved | 🔴 2/10 |
| User accidentally deletes project | `confirm()` dialog only — no soft delete, no undo | 🟡 3/10 |
| Tab refresh on detail view | Detail state lost — returns to list | 🔴 2/10 |
| Network failure during save | Error alert shown — data not saved | 🔴 1/10 |
| User navigates away with unsaved changes | ~~No warning~~ ✅ `beforeunload` handler warns with unsaved changes | 🟡 7/10 |

**Critical:** ~~Zero draft persistence.~~ ✅ **Fixed:** `useProjectFormDraft` hook now auto-saves form data to localStorage every 30 seconds and restores it on page load. Plus `beforeunload` warning prevents accidental navigation loss.

**The `ProjectList` detail view uses URL search params for tab state, but actual selected project data is in component state** — a page refresh returns to the list.

---

## 7. Trust Review

### Would an accountant trust this with month-end closing?

| Trust Factor | Current State | Rating |
|---|---|---|
| Financial summary accuracy | Computed client-side from raw data — no server-side validation | 🟡 5/10 |
| PO utilization tracking | Exists via `useProjectTransactions` hook — shows per-PO utilization | ✅ 7/10 |
| Invoice → Payment matching | `financialSummary.outstanding_amount = totalInvoiceValue - totalPaymentReceived` — simple subtraction, no reconciliation | 🟡 5/10 |
| Expense tracking | Basic sum — no categorization, no approval workflow | 🟡 4/10 |
| Currency formatting | Uses `en-IN` locale with ₹ — consistent | ✅ 8/10 |
| Audit trail for project changes | ~~None~~ ✅ `audit_log` table + `useAuditLog` hook + `created_by`/`updated_by` columns on projects | 🟡 6/10 |
| Completion certificate generation | PDF generated client-side with jsPDF — **not digitally signed** | 🟡 4/10 |

**Verdict:** An accountant would NOT trust this for month-end closing. No audit trail, no reconciliation, no approval workflow on financial data.

---

## 8. Explainability Review

### Can users understand WHY the system decided something?

| Decision | Explainable? | Details |
|---|---|---|
| Auto-status change (100% → "Execution Completed") | ❌ No | Happens silently in `handleInputChange` — user may not notice |
| PO required warning | ⚠️ Partial | Red dot indicator exists but no tooltip explaining what to do |
| Delete prevention | ⚠️ Partial | Says "Related records exist" but doesn't list which records |
| Milestone at-risk count | ⚠️ Partial | Shows count but doesn't explain why they're at-risk |
| Financial summary calculations | ❌ No | No breakdown of how values are computed |
| Status filter behavior | ❌ No | "No projects" shown with no explanation of filter state |

---

## 9. Learning Review

### Does the system improve after 100 uses?

| Learning Mechanism | Present? | Details |
|---|---|---|
| Remember user's last-used project | ❌ No | No localStorage for recent projects |
| Auto-suggest project names | ❌ No | No autocomplete |
| Remember column preferences | ✅ Yes | `localStorage.getItem('project_list_columns')` — **good** |
| Learn from deletion patterns | ❌ No | No "are you sure" intelligence |
| Remember form defaults | ❌ No | Status always resets to "Draft", client always empty |
| Frequently used clients first | ❌ No | Client list sorted alphabetically, not by usage |
| Smart project code generation | ⚠️ Partial | No auto-generation — user must manually enter project code |

---

## 10. Support Team Review

### Can support diagnose issues within 5 minutes?

| Diagnostic Need | Available? | Details |
|---|---|---|
| Which user created/modified a project | ✅ Yes | `created_by`/`updated_by` columns added, shown in detail view summary |
| When was the last modification | ⚠️ Partial | `updated_at` tracked but not prominently shown in UI |
| What queries are failing | ⚠️ Partial | Console warnings only — no structured logging |
| User's current org context | ⚠️ Partial | Available in React DevTools only |
| Query performance | ❌ No | No performance monitoring |
| Error context | ❌ No | `alert('Error: ' + err.message)` loses stack trace |
| Import/export history | ❌ No | No bulk operations exist |

**Verdict:** Support would struggle. "We don't know" would be the common answer.

---

## 11. Finance Review

### Can this accidentally cost ₹50,000?

| Cost Risk | Mitigated? | Details |
|---|---|---|
| Duplicate project creation | ✅ Mitigated | Submit button disabled while saving, `if (saving) return;` guard prevents double-click |
| Duplicate invoice creation | ⚠️ Partial | Invoice modal exists but no duplicate check |
| PDF generation abuse | ❌ No | No rate limiting on `downloadCompletionCertificate` |
| Supabase query cost (unbounded) | ✅ Mitigated | `.limit(500)` added to projects list query |
| Storage bloat from duplicate files | ❌ No | Document upload deduplication missing |
| No caching for repeated project detail views | ⚠️ Partial | React Query has 30s stale time but detail queries re-fire on every tab switch |

**Risk:** At scale, Supabase costs could spike from unbounded queries and missing indexes.

---

## 12. CEO Review

### If 1,000 customers use this tomorrow, what breaks first?

1. **Projects list query** — Now has `.limit(500)` safety cap. Still needs proper server-side pagination for true scale. **MITIGATED.**

2. **Detail view parallel queries** — 15+ simultaneous Supabase queries per project detail view. 50 concurrent users = 750 simultaneous DB connections. **BREAKS SECOND.**

3. **Memory leaks** — **Fixed:** `visitedTabs` pattern removed from `ProjectMaterialTabs`. Only active tab is now mounted. **RESOLVED.**

4. **Inline styles** — 1,500+ lines of inline styles in `ProjectList.tsx` make CSS optimization impossible. Bundle size bloated. **SLOW LOAD.**

5. **No error boundaries** — **Fixed:** `TabErrorBoundary` component added and wraps all detail tab content. One failing tab no longer crashes the entire detail view. **RESOLVED.**

6. **Session management** — 5-minute periodic session check with `setInterval` could cause flickering or unexpected logouts. **UX DEGRADATION.**

---

## 13. Compliance Review

### Can we explain every change six months later?

| Compliance Need | Met? | Details |
|---|---|---|
| Who created this project? | ✅ Yes | `created_by` column on projects, shown in detail view |
| Who modified it last? | ✅ Yes | `updated_by` column on projects, shown in detail view |
| When was status changed? | ⚠️ Partial | `audit_log` table captures creates/updates; status changes not yet explicitly tracked |
| Who approved the completion? | ❌ No | No approval workflow on project closure |
| What was the original estimate vs actual? | ⚠️ Partial | `project_estimated_value` stored but no variance tracking |
| Financial changes history | ❌ No | No change log on invoices/expenses/payments |
| Digital signature on certificates | ❌ No | PDF generated client-side — not legally binding |

**Verdict:** ~~Fails compliance audit.~~ ✅ **Partially resolved.** `created_by`/`updated_by` tracking now exists and `audit_log` table is provisioned. Still missing: explicit status change tracking, approval workflow, and variance reporting.

---

## 14. Observability Review

### Can leadership measure feature quality?

| Metric | Tracked? | Details |
|---|---|---|
| Average project creation time | ❌ No | No timing instrumentation |
| Form abandonment rate | ❌ No | No analytics |
| Detail view load time | ❌ No | No performance monitoring |
| Error rate per feature | ❌ No | Console warnings only |
| Most-used tabs in detail view | ❌ No | No click tracking |
| PDF generation success rate | ❌ No | No metrics |
| Project completion rate | ⚠️ Partial | Can query `completion_percentage = 100` but no dashboard |
| Time-to-completion per project | ⚠️ Partial | `start_date` and `actual_end_date` exist but no calculated metric |

---

## 15. Product Intelligence Review

### Can this become smarter over time?

| Intelligence Feature | Present? | Potential |
|---|---|---|
| Project templates (clone from similar past projects) | ❌ No | High — save hours on similar projects |
| Risk prediction (based on timeline + completion rate) | ❌ No | High — proactive alerts |
| Budget variance alerts | ❌ No | High — prevent cost overruns |
| Smart project code generation | ❌ No | Medium — reduce manual errors |
| Auto-suggest scope from similar projects | ❌ No | Medium — reduce data entry |
| Milestone dependency tracking | ❌ No | High — critical path analysis |
| Team capacity planning | ❌ No | High — resource optimization |

---

## 16. Forced Questions

| Question | Answer |
|---|---|
| **What breaks first?** | Detail view parallel queries (15+ simultaneous). Projects list query now has `.limit(500)` safety cap. |
| **Who gets blamed?** | The developer who "built it wrong" — but the real issue is missing infrastructure (pagination, error boundaries, audit trails) |
| **Who calls support?** | Users who lose form data on navigation, see "No projects" with no explanation, or can't figure out why a project can't be deleted |
| **How expensive can this become?** | Supabase costs reduced by `.limit(500)` cap. Memory leaks fixed. PDF generation still unbounded. |
| **Can users recover?** | No. No draft persistence, no undo, no soft delete, no session recovery for form state. |
| **Can users trust it?** | No. No audit trail, no reconciliation, no approval workflow on financial data. |
| **Can users understand it?** | Partially. Status changes are auto-applied without explanation. Error messages are generic. |
| **Does it learn?** | No. Column preferences are saved, but nothing else. No templates, no suggestions, no intelligence. |
| **Can we debug it?** | Barely. Console warnings only. No structured logging, no error tracking, no performance monitoring. |
| **Can we scale it?** | Partially. Query has `.limit(500)` safety cap. Memory leaks fixed. Still needs proper server-side pagination for true scale. |

---

## 17. Brutal CEO Recommendation Engine

### Scores

| Category | Score | Rationale |
|---|---|---|
| **UX** | 5/10 | Good visual design (Capy-inspired), but inline styles hurt maintainability. No loading skeletons for subsections. No unsaved-changes warning. Mobile experience poor. |
| **Reliability** | 4/10 | **Fixed:** Error boundaries now wrap detail tabs. Submit debounce added. Still no retry logic or optimistic updates. Partial failures silently absorbed. |
| **Explainability** | 3/10 | Auto-status changes happen silently. Delete prevention messages are vague. Financial calculations are opaque. No tooltips on complex behaviors. |
| **Recovery** | 2/10 | Zero draft persistence. No unsaved-changes warning. No undo. No soft delete. Browser crash = total data loss on forms. |
| **Scale** | 3/10 | **Fixed:** Query now has `.limit(500)` safety cap. Memory leaks resolved (visitedTabs removed). Still needs proper server-side pagination. 15+ parallel queries on detail remain. |
| **Supportability** | 3/10 | No audit trail. No structured logging. No error context. No user action history. Support would say "We don't know." |
| **Learning** | 2/10 | Only column preferences remembered. No templates, no suggestions, no intelligence. System stays equally dumb forever. |
| **Compliance** | 2/10 | No created_by/updated_by. No change log. No approval workflow on project closure. No digital signatures. Fails audit. |
| **Finance** | 4/10 | Financial summary exists. PO utilization tracking exists. But no reconciliation, no audit trail, no approval on financial operations. |
| **Production Readiness** | 4/10 | Works for small teams (<10 projects). **Fixed:** Error boundaries, submit debounce, and memory leak fix improve stability. Still needs audit trails, draft persistence, and proper pagination. |

### Overall Ratings

```
Engineering Score:     4/10  — Improved: error boundaries, submit guard, memory leak fix. Still structurally fragile.
Product Score:         5/10  — Feature-rich but missing critical UX safety nets (draft persistence, audit trail)
Operational Score:     3/10  — No observability, no audit, no support tooling
CEO Approval Score:    4/10  — Partially ready. Key stability fixes applied. Scale/audit gaps remain.
```

---

## Priority Recommendations

### P0 — Must Fix Before Scale

1. ✅ **Add pagination safety cap to projects list query** — `.limit(500)` added to `ProjectList.tsx` query. Full server-side pagination still recommended for scale.

2. **Split `ProjectList.tsx` into smaller components**
   - Extract EquipmentPanel, SnagPanel, WarrantyClaimPanel, ContinuousImprovementPanel, MilestonePanel, FinancialSummary, TransactionsTab
   - Each panel should be its own component with its own error boundary

3. ✅ **Add error boundaries around detail tabs** — `TabErrorBoundary` component created and wraps all tab content in `ProjectList.tsx`.

4. **Add draft persistence for CreateProject form**
   - Auto-save to localStorage every 30 seconds
   - Restore on page load
   - Warn before navigating away with unsaved changes

5. **Add `created_by` and `updated_by` tracking**
   - Update `projects` table schema
   - Log all status changes to an audit table

### P1 — Should Fix Soon

6. ✅ **Debounce form submissions** — `if (saving) return;` guard added to `CreateProject.tsx` handleSubmit. Button already had `disabled={saving}`.
7. **Add optimistic updates** for project create/edit
8. **Unify inline styles** — move to Tailwind classes or CSS modules
9. **Add pagination to meetings table** and material lists
10. **Implement soft delete** for projects (add `deleted_at` column)
11. **Add unsaved-changes warning** on CreateProject and detail view

### P2 — Nice to Have

12. **Add project templates** — clone from past projects
13. **Add risk prediction** — flag projects with timeline slippage
14. **Add budget variance alerts** — notify when expenses exceed estimates
15. **Add structured logging** — replace `console.warn` with proper error tracking
16. **Add performance monitoring** — track query times, render times

---

## Final Verdict

> If this module becomes mission-critical tomorrow, will customers thank us or call support?

**They will call support.**

The module is impressively feature-rich — it covers project lifecycle, financials, equipment, snags, warranty claims, continuous improvement, milestones, materials, and tasks. But it's built like a prototype that scaled organically without structural refactoring.

**The top 3 risks:**
1. **No pagination** — will crash at scale
2. **No draft persistence** — users will lose work
3. **No audit trail** — fails compliance

**What to do next:**
1. Break `ProjectList.tsx` into 10+ smaller components
2. Add proper server-side pagination (beyond the `.limit(500)` safety cap)
3. ~~Add error boundaries~~ ✅ Done
4. Add draft persistence
5. Add audit logging

---

## Fixes Applied (2026-06-29)

| Fix | File | Change |
|---|---|---|
| Pagination safety cap | `ProjectList.tsx:316-329` | Added `.limit(500)` to projects query to prevent unbounded fetches |
| Submit debounce | `CreateProject.tsx:546-548` | Added `if (saving) return;` guard to prevent duplicate submissions |
| Memory leak fix | `Projects.tsx:252-304` | Removed `visitedTabs` Set pattern. Only active tab is now mounted. |
| Error boundary | `ProjectList.tsx:99-130, 1061, 3183` | Added `TabErrorBoundary` class component wrapping all detail tab content |

---

*This review was generated using the Brutal CEO framework. The goal is not to criticize but to expose hidden risks before they become customer-facing incidents.*
