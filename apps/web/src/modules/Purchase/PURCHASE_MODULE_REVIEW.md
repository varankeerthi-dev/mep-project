# Purchase Module — Review Report

> 14 components reviewed | 11 route tabs | 1711 lines in hooks | 92 lines validation utils | 341 lines ledger utils

---

## CRITICAL BUGS

### 1. Debit Notes — stale closure in `convert-to-dn` event handler
**File:** `DebitNotes.tsx:108-169`

The `useEffect` listening for `convert-to-dn` captures `materialOptions` in its closure but the dependency array is `[]`. Since `materialOptions` is populated asynchronously (via `Promise.all` in a separate `useEffect` at line 212), the handler may see an empty array when it fires, **silently skipping rate difference alerts**.

```
Fix: add materialOptions to deps, or move materials into React Query.
```

### 2. No server-side pagination anywhere
All queries fetch **the entire dataset** — `purchase_orders`, `purchase_bills`, `debit_notes`, `payment_requests`, `purchase_vendors`. The `AppTable` has `defaultPageSize` but it only truncates client-side. With 500+ POs or 1000+ bills this will cause:
- Slow initial page loads
- Memory pressure on low-end devices
- Unnecessary bandwidth usage

```
Fix: add Supabase .range()/.limit() + count to all list queries.
```

### 3. `updateVendorBalance()` runs client-side aggregation
**File:** `usePurchaseQueries.ts:1077-1123`

Every balance recalibration queries ALL bills, payments, and debit notes for a vendor, sums them in JS, then writes back. This is:
- **Slow** — grows linearly with transaction volume
- **Race-prone** — concurrent mutations can produce wrong balances
- **Unnecessary** — should be a PostgreSQL function or a triggered materialized view

### 4. Stock deduction errors silently swallowed in DebitNotes
**File:** `DebitNotes.tsx:371-377`

```ts
try { await adjustCNStock(...) }
catch (stockErr) { console.error('DN stock deduction failed:', stockErr) }
```

If stock adjustment fails, the DN saves successfully but **inventory goes out of sync** with zero user visibility. Should surface the error to the user.

### 5. DebitNotes: `handleConvert` missing dependencies
The effect at line 108 references `materialOptions` (used in rate alert calculation at line 147) but has `[]` as dependency. This is the same issue as #1 — when the event fires before materials load, alerts are silently hidden.

### 6. `Math.random()` for document numbering
**File:** `PurchaseOrders.tsx` and `usePurchaseQueries.ts:9-14`

PO numbers and payment voucher numbers include `Math.random().toString(36)` — collision-prone under concurrent creates. Should use DB sequence or UUID.

---

## LATENCY / PERFORMANCE

| Issue | Location | Impact |
|-------|----------|--------|
| No staleTime on queries | All `useQuery` calls | Refetches on every mount |
| No debounced search | All search inputs | Re-render on every keystroke |
| No optimistic updates | All mutations | UI waits for server on save |
| Inline `Promise.all` for master data | `DebitNotes.tsx:214` | Materials/variants fetched outside React Query |
| No query prefetching | None | Tab switches always show loading |
| Client-side sort/filter | All tables | Doesn't scale past ~200 rows |

---

## MISSING FEATURES

### Purchase Orders
- PO amendment workflow (revised PO with versioning history)
- Partial receipt tracking against PO lines
- PO closure/cancellation with mandatory reason
- Budget check against project allocation
- Approval workflow (has status field but no multi-step UI)
- Email PO to vendor

### Vendors
- Multiple contacts per vendor
- Vendor document upload (GST cert, bank proof, agreements)
- Vendor category/service type classification
- Performance metrics (on-time %, quality rating, price competitiveness)
- Blacklist/whitelist with hold reason
- Bulk vendor import from Excel

### Bills
- Bill cancellation workflow
- Reverse charge mechanism (RCM) handling for GST
- E-invoice / e-waybill number fields
- TDS certificate tracking against bills
- Credit note from supplier (separate from Debit Note)

### Requisitions
- Emergency/critical PR flag (different approval routing)
- PR→PO conversion tracking (age of unconverted PRs, conversion ratio)
- Material substitution workflow

### Debit Notes
- **No DN approval UI** — `approval_status` field exists but no approve/reject action
- Credit note from supplier (reverse DN)
- RMA / return tracking
- DN amendment

### Payments
- Payment schedule / installment planning
- Early payment discount tracking
- TDS deduction at payment time
- Payment batch processing
- Bulk payment file generation (NEFT/RTGS)

### Invoice Verification (3-way matching)
- Tolerance override with approval trail
- Discrepancy resolution workflow (raise ticket → assign to buyer)
- Historical matching comparison per vendor/items

### Availability Inquiry
- Vendor auto-suggest based on material-vendor mapping
- Lead time tracking
- Side-by-side quote comparison
- Auto-create PO from best quote

### Dashboard
- **Very minimal** (195 lines). Missing:
  - Payment aging analysis (30/60/90+ days)
  - Vendor concentration risk
  - PR→PO cycle time
  - Budget utilization vs actual
  - Cash flow forecast (upcoming payments)
  - Pending approvals count

### Cross-cutting
- **No Excel export** on any module (only PDF on ledger + DN view)
- **No bulk operations** (bulk approve PRs, bulk pay bills)
- **No print-friendly views**
- **No keyboard shortcuts**
- **No saved filter presets**
- **No audit trail** on most modules (only PR and PO have it)
- **No notification integration** when documents need attention

---

## UX ISSUES

| Issue | Details |
|-------|---------|
| No undo for destructive actions | Delete PR/PO/DN has no confirmation undo |
| No inline editing | All edits open modals — high friction for bulk data entry |
| No skeleton loading | All tables show spinner — no perceived performance |
| Inconsistent column customizer | Only PO and PR tables have it |
| Search doesn't persist | Cleared on tab switch |
| No empty state guidance | Some tables show bare "No data" messages |
| Approval flows not unified | PRs use one path, payments use another, DNs have no UI |
| Rate alerts easily dismissed | No forced acknowledgement in DN creation |
| No mobile/tablet responsive | Tables likely overflow on smaller viewports |

---

## UI INCONSISTENCIES

| Aspect | Observation |
|--------|-------------|
| Styling approach | Mix of Tailwind classes, inline `style={}` props, and CSS variables |
| Color palette drift | Purchase module uses rose/amber/emerald; design system uses indigo/violet |
| Button styles | Some use `<ShadcnButton>`, some use raw `<button>` with inline styles |
| Dialog sizes | Range from `max-w-md` to `max-w-4xl` without clear rationale |
| Table implementation | Mix of custom `<table>` elements and `<AppTable>` component |
| Spacing | Padding/margins vary between components (px-4 vs px-6, py-3 vs py-4) |
| Dark mode | Not supported anywhere — hardcoded light colors |
| Typography | Some headers use text-xl, some text-base, some font-medium, some font-bold |
| Form label pattern | "Uppercase tracking-wider" style used inconsistently |
| Icon usage | lucide-react icons used, but sizes vary (h-3 to h-5) |

---

## CODE QUALITY

### Strengths
- Good separation of concerns (components → hooks → utils → API)
- TypeScript throughout with typed interfaces
- Consistent React Query usage for data fetching
- No class components — functional + hooks
- Validation layer via zod schemas
- Proper `useMemo`/`useCallback` usage in most places

### Weaknesses
- Components too large: `PurchaseOrders.tsx` (~2300 lines), `Payments.tsx` (~1033), `AvailabilityInquiry.tsx` (~801)
- Mix of import paths: some use `'../../../components'`, some use `'@/components'`
- No error boundaries — a crash in one component can take down the whole module
- No integration tests visible
- No Storybook stories for components
- `any` type usage in table cell renderers

---

## RECOMMENDED PRIORITY ACTIONS

### P0 — Fix now
1. **Server-side pagination** on all list queries (POs, bills, vendors, payments, DNs)
2. **Debounce search inputs** — use `useDebounce` hook
3. **Fix DebitNotes stale closure** — add `materialOptions` to effect deps
4. **Surface stock deduction errors** to user instead of swallowing
5. **Replace `Math.random()` voucher IDs** with DB sequence

### P1 — This sprint
6. **Add staleTime** (30-60s) to reduce refetch churn
7. **Move materials/variants fetch** into proper React Query hooks
8. **Add optimistic updates** on save mutations (instant UI feedback)
9. **Split large components** — PurchaseOrders, Payments, AvailabilityInquiry
10. **Unify styling** — eliminate inline styles, enforce Tailwind

### P2 — This milestone
11. **Add DN approval UI** — hook into existing approval system
12. **Vendor document upload** — GST, PAN, bank proof
13. **Payment batch processing** — select multiple payees, release together
14. **Rebuild Dashboard** with payment aging, cycle time, cash flow
15. **Dark mode support** — use CSS variables from design system

### P3 — Backlog
16. Excel export, keyboard shortcuts, saved filters, bulk operations
17. Email integration (PO to vendor, payment advice)
18. E-invoice/e-waybill integration
19. Mobile responsive layout
20. Onboarding tour / empty state guidance

---

## ARCHITECTURE NOTES

- Hooks layer at `hooks/usePurchaseQueries.ts` (1711 lines) is a **god file** — should be split by domain (vendors, POs, bills, payments, DNs)
- Utils/validation.ts is clean — consider adding vendor-type-specific validators
- Approval flow has two parallel implementations (`purchase_payments` workflow + `payment_requests` table) — consider unifying
- `updateVendorBalance` and `updateBillPaymentStatus` are scattered in hooks file — move to DB functions
- Consider Supabase Realtime subscriptions for critical status changes (approvals, payment releases)
