# PRD: BOQ & Estimation Module

**Status:** Final  
**Version:** 3.0  
**Target Release:** 5-week phased rollout  
**Stack:** React 19 + Vite + TanStack Query v5 + TanStack Router + Zod + Zustand + shadcn/ui (BaseUI Nova) + Supabase

---

## 1. Overview

Greenfield Bill of Quantities (BOQ) and estimation module inside the existing construction ERP. Replaces legacy BOQ functionality with a modern, rate-analysis-driven workflow: Excel import or manual entry → rate analysis → cost sheet + what-if → tender creation → win/loss tracking → project conversion.

This module lives entirely under `src/features/estimation/` and is **independent of the existing DESIGN.md**. UI is built exclusively on shadcn/ui (BaseUI Nova style). No dependency on the legacy design system.

---

## 2. Goals & Non-Goals

### Goals
- Estimators create/edit/version BOQs with sectioned line items
- Item-level **rate analysis**: break every bid rate into labour, material, equipment, overhead, subcontract
- **Cost sheet** comparing total bid vs total estimated cost, with flagging (healthy / warning / critical)
- **What-if scenarios**: markup changes, labour escalation, material variation
- **Excel import**: upload `.xlsx` → column mapping → create BOQ
- Convert BOQ → **tender record** → submit → won/lost → (if won) convert to project
- **Resource catalogues** (labour, equipment) and **rate templates** for reuse
- **Auto-save**: persist unsaved changes after 3 seconds of inactivity
- **RBAC**: permission-gated access per route and action

### Non-Goals
- Accounting or invoicing
- Real-time collaboration (single-editor at a time)
- Multi-currency (INR-only for v1)
- Mobile-first (desktop-primary; responsive breakpoints via Tailwind)

---

## 3. Architectural Rules & Conventions

### 3.1 Module Isolation
- All code under `src/features/estimation/`
- **No imports from existing DESIGN.md, design system, or legacy theme tokens**
- Only imports allowed:
  - `@/components/ui/*` (shadcn components installed fresh for this module)
  - `@/lib/utils` (cn utility)
  - `@/supabase` (Supabase client)
  - `@/queryClient` (TanStack Query client)
  - `@/rbac` (PermissionGuard, useMyPermissions)
  - `@/contexts/AuthContext`
  - Standard libs: `zod`, `@tanstack/react-query`, `@tanstack/react-router`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `date-fns`, `xlsx`, `sonner`

### 3.2 TanStack Query Patterns
- Every API call wrapped via `withSessionCheck()` from `@/queryClient`
- Custom hooks own all query keys — no raw `useQuery` in components
- Query key convention: `['estimation', resource, ...params]`
- Mutations use `useMutation` + `onSuccess` invalidates the parent list query
- Prefetch list data on route hover where feasible
- Mutations: `retry: false`, `networkMode: 'online'`

### 3.3 Zod Validation
- Every database entity has a Zod schema in `model/schemas/`
- Every API input (create, update) validated client-side before send
- Forms use `react-hook-form` + `@hookform/resolvers/zod`
- Generated columns (`amount`, `total_amount`) excluded from input schemas

### 3.4 Auto-Save Logic
- Per-edit-session: BOQ header, sections, items, rate analysis all have auto-save
- Implementation: `useAutoSave(dirtyFields, saveFn, delay = 3000)`
  - Starts a debounce timer on every field change
  - Resets timer if new change arrives within delay
  - Fires `saveFn` with accumulated dirty data after inactivity
  - Shows a subtle "Saving..." / "Saved" indicator via sonner toast
- Manual "Save" button still present for explicit saves
- On unmount with unsaved changes: show browser `beforeunload` prompt

### 3.5 State Management
- **Server state**: TanStack Query (BOQ items, rate analysis, tenders, catalogues)
- **UI/Form state**: Zustand stores for:
  - `useEstimationDraftStore` — pending BOQ edits before auto-save
  - `useWhatIfStore` — what-if panel adjustments (ephemeral, not persisted)
  - `useExcelImportStore` — column mapping state during import flow
- **No lifting server state into Zustand** — Query client is the single source of truth

### 3.6 Custom Hooks Convention
Every hook file in `hooks/` mirrors a domain entity:

| Hook | Responsibility |
|---|---|
| `useBOQ` | CRUD + list for BOQ headers |
| `useBOQSections` | Sections within a BOQ |
| `useBOQItems` | Line items within a section |
| `useRateAnalysis` | Rate analysis per BOQ item |
| `useRateResources` | Resource breakdown inside analysis |
| `useResourceCatalogs` | Labour + equipment catalogues |
| `useRateTemplates` | Named rate templates |
| `useTenders` | Tender CRUD + bid tracking |
| `useTenderDocuments` | Document uploads per tender |

Pattern:
```ts
// hooks/useBOQ.ts
export function useBOQList(filters: BOQFilterParams) {
  return useQuery({
    queryKey: ['estimation', 'boq', 'list', filters],
    queryFn: withSessionCheck(() => boqApi.list(filters)),
  });
}

export function useBOQ(id: string) {
  return useQuery({
    queryKey: ['estimation', 'boq', id],
    queryFn: withSessionCheck(() => boqApi.getById(id)),
    enabled: !!id,
  });
}

export function useCreateBOQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck((data: BOQCreateInput) => boqApi.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimation', 'boq', 'list'] });
    },
  });
}
```

### 3.7 RBAC Integration

New permission keys added to `src/rbac/permission-catalog.ts`:

```ts
{
  id: 'estimation',
  label: 'Estimation & BOQ',
  actions: [
    { key: make('estimation', 'read'), label: 'View BOQs & Tenders' },
    { key: make('estimation', 'create'), label: 'Create BOQ & Tender' },
    { key: make('estimation', 'update'), label: 'Edit BOQ, Rate Analysis, Cost Sheet' },
    { key: make('estimation', 'delete'), label: 'Delete BOQ & Tender' },
    { key: make('estimation', 'approve'), label: 'Approve BOQ (Final → Approved)' },
    { key: make('estimation', 'convert'), label: 'Convert Tender to Project' },
    { key: make('estimation', 'manage_catalog'), label: 'Manage Resource Catalogues & Templates' },
  ],
},
```

Route configs carry `permission: 'estimation.read'` etc. Components wrap guarded actions with `<PermissionGuard permission="estimation.update">`.

---

## 4. Module File Structure

```
src/features/estimation/
├── index.ts                          # barrel export
├── routes.ts                         # RouteConfig[] for registry
├── model/
│   ├── schemas/
│   │   ├── boq.ts                    # Zod: BOQHeader, BOQSection, BOQItem
│   │   ├── rate-analysis.ts          # Zod: RateAnalysis, RateResource
│   │   ├── resource-catalog.ts       # Zod: LabourCatalog, EquipmentCatalog, RateTemplate
│   │   └── tender.ts                 # Zod: Tender, TenderDocument
│   ├── types.ts                      # inferred TS types from Zod schemas
│   └── defaults.ts                   # default values for forms
├── api/
│   ├── boq.ts                        # Supabase queries for BOQ
│   ├── rate-analysis.ts
│   ├── resources.ts
│   └── tenders.ts
├── hooks/
│   ├── useBOQ.ts
│   ├── useRateAnalysis.ts
│   ├── useResourceCatalogs.ts
│   ├── useTenders.ts
│   ├── useAutoSave.ts                # generic auto-save hook
│   └── useEstimationPermissions.ts   # convenience wrapper over RBAC
├── stores/
│   ├── estimationDraftStore.ts       # Zustand: pending edits
│   ├── whatIfStore.ts                # Zustand: what-if adjustments
│   └── excelImportStore.ts           # Zustand: column mapping state
├── components/
│   ├── BOQEditor/
│   │   ├── index.tsx
│   │   ├── SheetTable.tsx
│   │   ├── ItemRow.tsx
│   │   └── HeaderForm.tsx
│   ├── RateAnalysis/
│   │   ├── index.tsx
│   │   ├── ResourceBreakdown.tsx
│   │   ├── ResourceSelector.tsx
│   │   └── RateSummary.tsx
│   ├── CostSheet/
│   │   ├── index.tsx
│   │   ├── MarginRow.tsx
│   │   └── WhatIfPanel.tsx
│   ├── Tender/
│   │   ├── TenderList.tsx
│   │   ├── TenderForm.tsx
│   │   ├── TenderDetail.tsx
│   │   └── WinLossDialog.tsx
│   ├── ExcelImport/
│   │   ├── index.tsx
│   │   ├── FileUpload.tsx
│   │   ├── ColumnMapper.tsx
│   │   └── ImportPreview.tsx
│   ├── Settings/
│   │   ├── LabourRatesPage.tsx
│   │   ├── EquipmentRatesPage.tsx
│   │   └── RateTemplatesPage.tsx
│   └── Shared/
│       ├── ResourceCatalogSelect.tsx
│       ├── MarginBadge.tsx
│       └── AutoSaveIndicator.tsx
├── lib/
│   ├── calculations.ts              # rate calc, cost sheet, what-if
│   ├── excel-import.ts              # xlsx parse + column inference
│   └── validation.ts                # cross-field validation rules
└── constants.ts
```

---

## 5. Routes

### Route Prefix: `/new-boq/*`

```
/new-boq                              →  BOQ list           (permission: estimation.read)
/new-boq/create                       →  Create BOQ         (permission: estimation.create)
/new-boq/:id/edit                     →  Edit BOQ           (permission: estimation.update)
/new-boq/:id/rate-analysis            →  Rate analysis      (permission: estimation.update)
/new-boq/:id/cost-sheet               →  Cost sheet         (permission: estimation.read)
/new-boq/:id/export                   →  Export BOQ         (permission: estimation.read)
/new-boq/:id/create-tender            →  Convert to tender  (permission: estimation.create)
/tenders                              →  Tender register    (permission: estimation.read)
/tenders/create?boqId=:id             →  Create tender      (permission: estimation.create)
/tenders/:id                          →  Tender detail      (permission: estimation.read)
/tenders/history                      →  Win/loss history   (permission: estimation.read)
/settings/labour-rates                →  Labour catalogue   (permission: estimation.manage_catalog)
/settings/equipment-rates             →  Equipment catalogue(permission: estimation.manage_catalog)
/settings/rate-templates              →  Rate templates     (permission: estimation.manage_catalog)
```

Route registration via `src/features/estimation/routes.ts` exporting `RouteConfig[]`. Consumed by the app routing registry (`combineRoutes`).

---

## 6. Database Schema

All new tables prefixed `est_`. See architecture plan for full DDL. Key tables:

- `est_boq_headers` / `est_boq_sections` / `est_boq_items`
- `est_rate_analysis` / `est_rate_resources`
- `est_labour_catalog` / `est_equipment_catalog`
- `est_rate_templates` / `est_rate_template_resources`
- `est_tenders` / `est_tender_documents`

Generated columns for `amount` and `total_amount`. RLS policies scoped to `organisation_id`.

---

## 7. Calculation Engine (`lib/calculations.ts`)

Three pure functions, fully tested (Vitest):

```ts
calculateRate(resources: RateResource[], markupPercent: number): CalculatedRate
buildCostSheet(boqId: string): CostSheetResult
simulateWhatIf(baseSheet: CostSheetResult, adjustments: WhatIfAdjustments): CostSheetResult
```

Flag thresholds for margin: `> 15%` green, `5-15%` amber, `< 5%` red.

---

## 8. Auto-Save Hook Spec

```ts
// hooks/useAutoSave.ts
function useAutoSave<T extends Record<string, unknown>>(
  dirtyFields: T,
  saveFn: (data: T) => Promise<void>,
  options?: { delay?: number; onError?: (err: Error) => void }
): { isSaving: boolean; isSaved: boolean; forceSave: () => void }
```

Implementation:
1. Watch `dirtyFields` (shallow compare)
2. On change: clear existing timer, start new 3s timer
3. On timer fire: call `saveFn(dirtyFields)`, set `isSaving = true`
4. On success: set `isSaved = true`, emit sonner toast
5. On error: set `isSaving = false`, show error toast, preserve dirty state
6. `forceSave()` for explicit save button — fires immediately

---

## 9. RBAC Permission Keys

Added to `src/rbac/permission-catalog.ts`:

| Key | Guarded Feature |
|---|---|
| `estimation.read` | View BOQs, tenders, cost sheets |
| `estimation.create` | Create BOQ, create tender |
| `estimation.update` | Edit BOQ items, run rate analysis |
| `estimation.delete` | Delete BOQ or tender records |
| `estimation.approve` | Approve BOQ (Final → Approved) |
| `estimation.convert` | Convert won tender to project |
| `estimation.manage_catalog` | Edit labour/equipment/template catalogues |

---

## 10. User Personas

| Persona | Key Actions | Permissions Required |
|---|---|---|
| **Estimator** | Import/manual BOQ, run rate analysis, what-if, cost sheet, create tender | read, create, update |
| **Contracts Manager** | Review margin, approve BOQ, log win/loss | read, update, approve |
| **Director** | Historical win/loss view, pricing reference | read |
| **Admin (Catalog)** | Manage labour/equipment/template catalogues | manage_catalog |

---

## 11. Implementation Phases

| Phase | Duration | Deliverables |
|---|---|---|
| **1 — Core BOQ** | Week 1 | Schema + list/create/edit with sections & items + Zod schemas + API layer |
| **2 — Rate Analysis** | Week 2 | Analysis screen + catalogues + calc engine + `useAutoSave` |
| **3 — Cost Sheet** | 3 days | Cost sheet + margin indicators + what-if panel + Zustand stores |
| **4 — Excel Import** | 3 days | Upload → column mapping → preview → create BOQ |
| **5 — Tenders** | Week 4-5 | Register, submission, win/loss, history, document upload, RBAC gates |

---

## 12. "Prove It Works" Criteria

1. Create a full BOQ with 3+ sections and 20+ line items
2. Run rate analysis on 5 items with labour + material + equipment mix
3. Verify calculated rate vs bid rate with correct margin indicator
4. Generate cost sheet showing total margin
5. Import a real Excel BOQ and cross-check numbers
6. Create a tender → submit → mark Won
7. Convert won tender to a project

---

## 13. Design Decisions (Locked)

| # | Question | Decision |
|---|---|---|
| 1 | Legacy BOQ migration | **Greenfield** — no existing BOQ in this repo. Phase 6 (Migration) removed. |
| 2 | RLS policies | **Standard `org_members` isolation** on every `est_` table, matching the `bom_headers` pattern. No special rules. `estimation.*` permissions enforced in-application via `PermissionGuard`. |
| 3 | Rate analysis UX flow | **Drawer (slide-out panel from right)** — keeps BOQ table visible, enough room for resource breakdown + markup + variance. |
| 4 | What-if panel interaction | **Sliders + editable number labels** — drag or type. Recalculation debounced on input. |
| 5 | Excel import mode | **Dual mode** — downloadable template (fast path, exact match) + manual column mapping for any `.xlsx`. |
| 6 | Tender → Project field mapping | `title→project_name`, `client_id→client_id`, `award_amount→project_estimated_value`, `expected_margin→target_margin_percent`, status forced to `Active`. BOQ items summary auto-generated as contractor scope. |
| 7 | Settings route location | **Self-contained inside estimation module** — not a global settings tab. |
| 8 | BOQ status transitions | **Configurable per-organisation** via estimation settings: Loose (free movement) or Gated (Final locks items, Approved locks analysis, no rollback after Approved). |
| 9 | Testing strategy | **Vitest for calc engine only** (`lib/calculations.ts`). Component + E2E tests deferred to post-v1. |
| 10 | Error handling | **API errors**: sonner `toast.error()`. **Form validation**: `react-hook-form` + Zod inline errors. **Conflicts**: last-write-wins with stale `updated_at` detection → "Reload and retry" prompt. |
