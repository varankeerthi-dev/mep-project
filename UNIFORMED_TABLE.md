# UNIFORMED TABLE DESIGN — Master Plan

## Current State
- **60 table instances** across 40 files
- 5 different table technologies (raw HTML, MUI DataGrid, shadcn Table, TanStack Table, custom grid-table)
- No consistent design, no shared component
- Tables touch sidebar edge — no breathing room
- No column filters, inconsistent pagination, direct delete icons in action columns

## Target State
- One `<AppTable>` component powered by TanStack Table + your tabledesign.md spec
- Column filters per column (text/select/date — configurable per page)
- Pagination with page size selector
- 3-dot action menu (dropdown, not contained modal) with Edit/Download/Preview etc
- Row selection with checkbox
- Sorting indicators
- Consistent spacing: content area has proper padding from sidebar
- Empty state + loading skeleton

---

## Phases

### Phase 0: Fix global content padding (tables touching sidebar)
- [ ] Fix `.main-content` padding in `src/index.css` so all pages have breathing room from sidebar
- [ ] Verify page-header, cards, tables all have uniform inner spacing

### Phase 1: Build `<AppTable>` component
- [ ] Create `src/components/ui/AppTable.tsx` — reusable TanStack Table wrapper
- [ ] Implement tabledesign.md styles (zinc-50/80 header, text-xs, border-zinc-200, shadow-sm container)
- [ ] Add column sorting with visual indicators
- [ ] Add per-column filters (text input, select dropdown, date range — type per column config)
- [ ] Add pagination component (page numbers, prev/next, page size selector)
- [ ] Add row selection with header checkbox (select all) + row checkboxes
- [ ] Add 3-dot action menu dropdown (configurable actions: Edit, Download, Preview, Delete etc)
- [ ] Add loading skeleton state
- [ ] Add empty state
- [ ] Add responsive horizontal scroll

### Phase 2: Migrate list/dashboard pages (high-visibility)
- [ ] `src/pages/DCList.tsx` — MUI DataGrid → AppTable
- [x] `src/pages/NonBillableDCList.tsx` — useReactTable → AppTable
- [ ] `src/pages/MaterialsList.tsx` — useReactTable → AppTable (main items list only)
- [x] `src/pages/BOQList.tsx` — raw table → AppTable
- [ ] `src/pages/QuotationView.tsx` — raw table → AppTable
- [ ] `src/invoices/pages/InvoiceListPage.tsx` — raw table → AppTable
- [x] `src/pages/POList.tsx` — raw table → AppTable
- [ ] `src/pages/ProjectList.tsx` — raw table → AppTable (5 tab tables)

### Phase 6: Migrate CRM / operations pages
- [x] `src/pages/Meetings.tsx` — raw table → AppTable
- [x] `src/pages/ClientRequests.tsx` — raw table → AppTable
- [x] `src/pages/DailyUpdates.tsx` — raw table → AppTable
- [x] `src/pages/RemindMe.tsx` — raw table → AppTable
- [ ] `src/pages/TodoList.tsx` — raw tables × 2 → AppTable
- [ ] `src/pages/SiteReport.tsx` — shadcn Table × 2 → AppTable
- [ ] `src/pages/ReceiveMaterial.tsx` — shadcn Table → AppTable

### Phase 3: Migrate store/inventory pages
- [ ] `src/pages/MaterialInward.tsx` — shadcn Table list → AppTable
- [ ] `src/pages/StockTransfer.tsx` — raw table list view → AppTable
- [x] `src/pages/QuickStockCheckList.tsx` — raw table → AppTable
- NOTE: `MaterialOutward.tsx`, `DateWiseConsolidation.tsx`, `MaterialWiseConsolidation.tsx` are FORM/PIVOT tables - NOT suitable for AppTable migration

### Phase 4: Migrate subcontractor module
- [ ] `src/pages/Subcontractors.tsx` — Dashboard DataGrid → AppTable
- [ ] `src/pages/Subcontractors.tsx` — View sub-tables (WOs, Attendance, DailyLogs, Payments, Invoices, Documents) × 6 → AppTable
- [ ] `src/pages/Subcontractors.tsx` — Tab tables (Attendance, WorkOrders, DailyLogs, Payments, Invoices) × 5 → AppTable
- [ ] `src/pages/SubcontractorWorkOrderProfessional.tsx` — DataGrid → AppTable
- [ ] `src/pages/WorkOrderDetailView.tsx` — raw tables × 2 → AppTable
- [ ] `src/components/SubcontractorLedger.tsx` — raw tables × 2 → AppTable

### Phase 5: Migrate purchase module
- [ ] `src/modules/Purchase/components/Vendors.tsx` — DataGrid → AppTable
- [ ] `src/modules/Purchase/components/PurchaseOrders.tsx` — DataGrid → AppTable
- [ ] `src/modules/Purchase/components/Bills.tsx` — DataGrid → AppTable
- [ ] `src/modules/Purchase/components/Payments.tsx` — DataGrid × 2 → AppTable
- [ ] `src/modules/Purchase/components/PaymentQueue.tsx` — DataGrid → AppTable
- [ ] `src/modules/Purchase/components/DebitNotes.tsx` — DataGrid → AppTable

### Phase 6: Migrate CRM / operations pages
- [ ] `src/pages/Meetings.tsx` — raw table → AppTable
- [ ] `src/pages/ClientRequests.tsx` — raw table → AppTable
- [ ] `src/pages/DailyUpdates.tsx` — raw table → AppTable
- [ ] `src/pages/RemindMe.tsx` — raw table → AppTable
- [ ] `src/pages/TodoList.tsx` — raw tables × 2 → AppTable
- [ ] `src/pages/SiteReport.tsx` — shadcn Table × 2 → AppTable
- [ ] `src/pages/ReceiveMaterial.tsx` — shadcn Table → AppTable

### Phase 7: Migrate settings pages
- [ ] `src/pages/Settings.tsx` — raw table → AppTable
- [ ] `src/pages/TransactionNumberSeries.tsx` — raw table → AppTable
- [ ] `src/pages/DiscountSettings.tsx` — raw tables × 2 → AppTable
- [ ] `src/pages/QuickQuoteSettings.tsx` — raw table → AppTable
- [ ] `src/pages/Organisation.tsx` — raw table → AppTable

### Phase 8: Migrate ledger + HR + dashboard widgets
- [ ] `src/ledger/LedgerDashboard.tsx` — shadcn Table × 2 → AppTable
- [ ] `src/ledger/OpeningBalanceTab.tsx` — shadcn Table → AppTable
- [ ] `src/pages/HRAdminDashboard.tsx` — shadcn Table → AppTable
- [ ] `src/pages/Dashboard.tsx` — shadcn Table × 2 (widget tables — may keep compact)

### Phase 9: Migrate remaining form-embedded tables
- [x] `src/pages/MaterialsList.tsx` — sub-tables (stock, pricing, categories, units, variants, warehouses) × 10 → DONE (Units, Warehouse, Category, Variants tabs)
- [ ] `src/pages/MaterialInward.tsx` — grid-table form rows
- [ ] `src/pages/CreateQuotation.tsx` — grid-table item rows + picker table
- [ ] `src/invoices/components/InvoiceItemsEditor.tsx` — inline styled table
- [ ] `src/invoices/components/InvoiceMaterialsEditor.tsx` — inline styled table
- [ ] `src/modules/Purchase/components/PurchaseOrders.tsx` — MUI Table form items
- [ ] `src/modules/Purchase/components/Bills.tsx` — MUI Table form items
- [ ] `src/pages/ProjectMaterialDashboard.tsx` — shadcn Table × 3

### Phase 10: Cleanup
- [ ] Remove MUI DataGrid dependency (`@mui/x-data-grid`) from package.json
- [ ] Remove unused MUI Table imports
- [ ] Remove old `.table`, `.table-container`, `.grid-table`, `.il-table`, `.po-table`, `.pl-table` CSS classes from index.css
- [ ] Verify bundle size reduction
- [ ] Final visual audit across all pages

---

## NOT in scope
- **Client Dashboard** (`src/pages/ClientList.tsx`) — excluded per request
- **BOQ spreadsheet editor** (`src/pages/BOQ.tsx`) — special-purpose grid, keep as-is
- **Ledger PDF modal** (`src/ledger/LedgerModal.tsx`) — print-only table
- **Template preview tables** (`src/pages/TemplateSettings.tsx`) — HTML template strings
- **CreateDC / CreateNonBillableDC item rows** — inline editable grid-table, Phase 9
