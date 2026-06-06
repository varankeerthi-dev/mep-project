# Payments Hub — UX Design Brief

> Status: Draft v1 · Author: UX pass on existing Payment Queue + Subcontractor Payments + Approvals flow
> Scope: UX/architecture redesign only. No code changes yet. Visual mockup at `docs/mockups/payments-hub.html`.

---

## 1. Problem Statement

Today the system has **three disconnected payment surfaces** stitched together by approvals routing:

| Surface | Lives in | What it shows | Who acts |
|---|---|---|---|
| Purchase → Payments | Purchase module | Vendor payment history + "Submit Request" form | Anyone with purchase access |
| Purchase → **Payment Queue** | Purchase module | Due/overdue **bills** + count of pending requests | Anyone with purchase access |
| Purchase → Accountant Queue | Purchase module (route) | Approved purchase payments waiting for release | Accountant/Finance only |
| Sub-Contractor → Payments | Subcontractor module | Subcontractor payment history + "record payment" | Anyone with sub access; release queue is hidden inside the same screen |
| /approvals | Global | Pending approvals across all types | Approvers |

**The five concrete UX failures users hit:**

1. **Module mismatch on approval.** Approving a *subcontractor* payment routes "Open original" to `/purchase/payments`. Brain says "this isn't a purchase" → trust drops.
2. **"Payment Queue" is mis-named.** It does not show the queue of *payments awaiting release*. It shows *bills* (procurement obligations). Two different concepts share one label.
3. **Release UI is hidden.** The Subcontractor release queue is buried inside `SubcontractorPayments` as a section toggle. The Purchase AccountantQueue exists as a separate component but isn't routed in the sidebar.
4. **No single inbox for Finance.** An accountant who runs end-of-day payments must visit Purchase, then Sub-Contractor, then maybe Approvals — three separate screens to do one job.
5. **Status is fragmented.** A payment can be *Requested / Pending Approval / Approved / Released / Paid* — but the visual treatment for each state differs by module.

---

## 2. Target Architecture

**Hybrid model — one global hub + module-scoped lenses, all reading the same data.**

```
┌─────────────────────────────────────────────────────────────┐
│                  Sidebar (new section)                      │
│                                                             │
│   FINANCE                                                   │
│     └─ Payments Hub        ← NEW. Unified for accountants   │
│     └─ Payment Calendar    ← future                         │
│                                                             │
│   PURCHASE                                                  │
│     └─ … existing items                                     │
│     └─ Payments            (record vendor payment / request)│
│     └─ Payment Queue       ← VENDOR-only lens of the hub    │
│                                                             │
│   SUB-CONTRACTOR                                            │
│     └─ … existing items                                     │
│     └─ Payments            (record sub payment / request)   │
│     └─ Payment Queue       ← SUBCONTRACTOR-only lens (NEW)  │
└─────────────────────────────────────────────────────────────┘
```

**Single source of truth.** Marking a payment as Released/Paid from the Finance Hub OR from a module's lens updates the same underlying row. Both views auto-refresh via React Query invalidation. Users can work from whichever surface fits their mental model.

**Rename the existing "Purchase → Payment Queue"** (the due-bills screen) to **"Bills Due"** to remove the name collision. The new "Payment Queue" is the vendor-filtered lens of the Hub.

---

## 3. Primary User & Job

**Persona:** Accounts Manager / Accountant. Runs daily ~15min: "who do I need to pay today, in what order, how much, from which bank, and clear them all in one pass."

**Secondary persona:** Project Manager / Purchase Manager. Wants to *check status* of a payment they submitted ("did Finance pay XYZ Vendor for last week's bill?"). They use the per-module lens, not the Hub.

**Primary task flow (the one we optimise for):**

```
Approvals queue → action in drawer → payment lands in Hub
   → Hub sorted by due date / priority → Accountant clicks "Release"
   → Modal confirms bank + reference no → Released → Vendor ledger updated
```

End-to-end target: **under 8 seconds per payment** for a Finance user clearing 30 payments.

---

## 4. Design Direction

**Tone:** Calm, dense, trustworthy. This is a money screen — no animation flourishes that imply playfulness. Treat it the way Stripe treats payouts: a scannable ledger with one obvious next action per row.

**Key principles:**
- **Comfortable density for high row counts.** Row cells use `py-3` (12px top/bottom padding). Content is readable for 30–80 rows without feeling cramped. Headers get `py-2` (8px) for visual hierarchy.
- **Inline action, not nested click.** "Release" is a button in the row, not a "View → then act" pattern.
- **Type is visible, not hidden.** Vendor vs Subcontractor must be glanceable via an icon + 1-letter pill, not a column you have to read.
- **Status is the centre.** A vertical status pipeline (Requested → Approved → Released → Paid) shown as a 4-dot progress strip per row.
- **Money lives on the right.** All amounts right-aligned, tabular nums, currency prefix muted, value bold.
- **Columns are properly aligned.** Text columns left-aligned, numbers right-aligned, actions centered. No misaligned content within columns.
- **Active & hover states.** Rows have distinct hover (`bg-blue-100/80`) and active/selected (`bg-indigo-50/50 border-l-blue-600`) states for clear interaction feedback.

Consistent with existing system: zinc grays, indigo-600 primary, Inter font, shadcn AppTable, sticky header pattern from FollowUpCentre.

---

## 5. Layout Strategy — Payments Hub

```
┌──────────────────────────────────────────────────────────────────────┐
│ Payments Hub                                          [+ New Payment]│
│ Finance treasury · pay vendors, subcontractors, advances             │
├──────────────────────────────────────────────────────────────────────┤
│  ₹4.82L     ₹1.23L      28          12          ₹85K                 │
│  Total      Overdue     Awaiting    Scheduled   Released today       │
│  Payable                Release     Today                            │
├──────────────────────────────────────────────────────────────────────┤
│ [All 42] [Vendor 28] [Subcontractor 12] [Advance 2]   🔍 search...   │
├──────────────────────────────────────────────────────────────────────┤
│ ☐ Type │ Voucher │ Payee          │ Project │ Approved │ ₹ Amount │ ●●●○ │ [Release] │
│ ☐  V   │ PR-104  │ Acme Supplies  │ Tower A │ Today    │  45,000  │ ●●●○ │ [Release] │
│ ☐  S   │ SP-022  │ Ravi Crew      │ Tower B │ 2d ago   │  18,500  │ ●●●○ │ [Release] │
│ ☐  V   │ PR-103  │ Bharat Steel   │ Plot 9  │ 4d ago   │ 2,40,000 │ ●●●○ │ [Release] │
│ ──────────────────────────────────────────────                       │
│                                          [Bulk Release ↑ 3 selected] │
└──────────────────────────────────────────────────────────────────────┘
```

**Notes:**
- **Row density**: cells use `py-3` (12px padding top/bottom). Headers use `py-2` (8px). This keeps rows compact enough for 30-80 items while giving each cell breathing room and clear click targets.
- **Column alignment**: text columns left-aligned, number/amount columns right-aligned (`tabular-nums` font), action buttons centered. No mixed alignment within a column.
- **Active & hover**: rows show `hover:bg-blue-100/80` on hover and `bg-indigo-50/50 border-l-[3px] border-l-blue-600` when selected/active.
- **Single icon column** carries the type (V/S/A) with a tooltip; saves 80px of horizontal real estate
- **Status pipeline** (`●●●○`) replaces the "Approved on" date — shows where in the workflow the row sits, hover reveals timeline
- **Right rail** — selecting any row opens a side panel with full context (no navigation)
- **Bulk release** appears as a floating action bar when rows are selected
- **No nested dropdowns** in the row — every primary action is a flat button

---

## 6. Layout Strategy — Per-Module Lens (Vendor Payment Queue)

Same component, two props different:

```tsx
<PaymentsHub scope="vendor" showOnlyMyProject={false} />
```

- **Hides** the type tabs (always Vendor)
- **Adds** vendor-specific summary card ("Bills overdue by vendor: top 3")
- **Same row component, same drawer** — guarantees consistency
- Header reads "Vendor Payment Queue" instead of "Payments Hub"

Subcontractor lens mirrors exactly with scope="subcontractor".

This is the lever that keeps per-module workflows alive without rebuilding everything.

---

## 7. Approval Drawer Pattern (the surface that fixes complaint #1)

Replace the broken "Open original → wrong module" navigation with a **right-side drawer** opened from any approval row.

```
                                  ┌─────────────────────────────────┐
                                  │ ← Subcontractor Payment   ✕     │
                                  │                                 │
                                  │ ₹18,500 to Ravi Crew            │
                                  │ Voucher SP-022 · Tower B        │
                                  │                                 │
                                  │ ─── Context ───                 │
                                  │ Work Order: WO-1142             │
                                  │ Contract value: ₹4,50,000       │
                                  │ Paid so far:   ₹1,20,000 (27%)  │
                                  │ This payment:    ₹18,500 (4%)   │
                                  │ Remaining:    ₹3,11,500         │
                                  │                                 │
                                  │ ─── Justification ───           │
                                  │ "Weekly progress payment for    │
                                  │  electrical conduiting at L4-L6"│
                                  │                                 │
                                  │ ─── Attachments ───             │
                                  │ 📎 site-photo-jun02.jpg         │
                                  │ 📎 daily-log-week22.pdf         │
                                  │                                 │
                                  │ ─── Approval chain ───          │
                                  │ ✓ Submitted by Suresh · Jun 4   │
                                  │ ✓ PM approved · Anita · Jun 5   │
                                  │ ◯ You (Finance) — pending       │
                                  │                                 │
                                  │ [💬 Add note]                   │
                                  │                                 │
                                  │ ──────────────────────────────  │
                                  │ [Reject]              [Approve] │
                                  └─────────────────────────────────┘
```

**Key rules:**
- Drawer opens **over** the approvals queue — no page navigation, no module switch
- Width: 480px desktop, full-screen on tablet/mobile
- Approve/Reject is **always visible** at the bottom (sticky)
- "Open in source module" link in header for power users who need it
- After action, drawer closes, the row in the queue updates in place with a brief fade

---

## 8. Key States

| State | Treatment |
|---|---|
| Default (rows present) | Dense table, status pipeline visible |
| Empty (no pending) | Centred message "Nothing waiting on you. ₹3.2L released this week." + sparkline |
| Loading | Skeleton rows (no spinner) |
| Error | Inline banner top of table, retains last-good data below |
| Bulk select | Floating action bar slides up from bottom |
| Released (row state) | Row dims to 60%, removes action button, shows ✓ + released timestamp |
| Permission denied | Replaces table with permission card (existing AccountantQueue pattern) |
| Filter applied | Pill above table shows "3 filters · clear" |

---

## 9. Interaction Model

| Trigger | Result |
|---|---|
| Click row body | Opens detail drawer (read + actions) |
| Click [Release] inline | Confirm modal → release → row updates in place |
| Shift-click checkbox | Range select |
| Click voucher number | New tab to source document (PO, work order) |
| Hover status pipeline | Tooltip with full timeline + actors |
| `R` keyboard | Release first selected row |
| `J` / `K` | Move row focus down/up (power-user nav) |

---

## 10. Content Requirements

| Surface | Old copy | New copy |
|---|---|---|
| Sidebar | Payment Queue | **Bills Due** (Purchase) + **Payments Hub** (Finance, new) + **Payment Queue** (per module, new) |
| Hub header | n/a | "Payments Hub" / "Treasury — pay vendors, subcontractors & advances" |
| Empty state | n/a | "Nothing waiting on you. ₹{released} released this week." |
| Release confirm | n/a | "Release ₹{amount} to {payee} from {bank}? This will mark the bill paid and update the vendor ledger." |
| Approval drawer header | n/a | "{Type} Payment · ₹{amount} to {payee}" |

---

## 11. Data Model — No Schema Change Needed

This works on the **existing** schema (`purchase_payments` + `subcontractor_payments`). The Hub is a **union view** on the frontend:

```ts
const useUnifiedPaymentsQueue = (orgId, filters) => {
  const vendor = useApprovedPaymentsForAccountant(orgId);
  const sub = useSubcontractorPaymentsForAccountant(orgId);
  return useMemo(() =>
    [...vendor.data.map(r => ({...r, _type: 'vendor'})),
     ...sub.data.map(r => ({...r, _type: 'subcontractor'}))]
    .filter(applyFilters(filters))
    .sort(byPriority),
    [vendor.data, sub.data, filters]
  );
};
```

The per-module lens is the same hook with `_type` filter pre-applied. Marking released calls the same `useReleasePayment` or `useReleaseSubcontractorPayment` mutation — both already invalidate their own + cross queries.

---

## 12. Migration Plan (incremental, ship in 3 PRs)

**PR 1 — Routing fix + drawer (1 day, no breaking changes)**
- Fix `/approvals` "Open original" routes: subcontractor → drawer, not new tab
- Implement `<ApprovalDetailDrawer />` reusing existing approval data hooks
- Acceptance: an approver can approve a subcontractor payment without leaving `/approvals`

**PR 2 — Unified Payments Hub at `/finance/payments` (2–3 days)**
- New `<PaymentsHub />` component (the design above)
- New sidebar section "Finance"
- Reuses existing hooks + AppTable
- Hub coexists with old AccountantQueue (don't delete yet)
- Acceptance: Accounts Manager can clear vendor + sub payments from one screen

**PR 3 — Rename + per-module lens (1 day)**
- Rename Purchase "Payment Queue" → "Bills Due" in sidebar + header
- Add per-module "Payment Queue" (scoped lens of Hub) to Purchase + Subcontractor sidebars
- Delete the orphan `AccountantQueue.tsx` (replaced by Hub)
- Acceptance: PM can still check their payment status inside Purchase module

---

## 13. Anti-Goals

- ❌ Do **not** build a new finance/accounting subsystem — this is a re-skin + re-route of existing tables
- ❌ Do **not** require a schema migration
- ❌ Do **not** add another approval layer — the existing `approvals` system stays untouched
- ❌ Do **not** redirect mid-flow — drawer over modal over modal kills the user's spatial memory
- ❌ Do **not** make the Hub a "dashboard with charts" — it is a **work surface**, charts go to Reports

---

## 14. Open Questions for Implementation

1. Bank account selection — is there a `bank_accounts` table per org or do we keep free-text bank name?
2. "Released today" stat — does the role permission allow seeing org-wide or only own?
3. Bulk release — single bank or per-row bank?
4. Payment Calendar (future) — confirm out of scope for v1

---

## 15. Visual Mockup

See `docs/mockups/payments-hub.html` — open in any browser. Shows:
- Sidebar with new Finance section
- Payments Hub default state (vendor + subcontractor rows together)
- Per-module Vendor Payment Queue lens
- Approval drawer (open state)
- Empty state
- Bulk release floating bar
