# MEP performance audit — source/business

This is a **read-only source audit**, not a runtime performance test. Every landing request count below is **source-inferred, not an observed runtime count**. No performance claim is based on measured TTFB, download time, query duration, CPU, React commit time, heap, or row counts. Cache hits, RLS/session behavior, StrictMode remounts, and omitted hook branches can change runtime behavior. No business-record responses, secrets, login, authenticated assets, API responses, or database query plans were accessed.

Current-workspace evidence is cited inline. Dist byte sizes are raw local `dist` file bytes, not compressed transfer sizes. Public deployed comparisons used unauthenticated static HTML/assets only.

## Concise findings

1. Several lists and master-data reads fetch unbounded collections, then filter, sort, aggregate, or paginate in the browser. The highest-risk examples are quotations, sales orders, accounting journal entries, HR employees/attendance, settings catalogs, reports, expenses, and advance expenses.
2. Several detail/report landings duplicate reads or create dependency waterfalls: sales-order detail loads a full summary pane; quotation view loads a full sidebar; reports call summary helpers that re-fetch datasets; payroll waits for an RPC before seven reads; edit sales orders load header then items serially.
3. Render cost is potentially unbounded where every returned row/tree node/table employee is rendered, especially accounting account trees, salary slips, sidebar/list panes, and client-filtered report data.
4. Caching is inconsistent: React Query defaults generally mean 5m stale/30m GC, no focus refetch, mount/reconnect refetch; direct Supabase/effect reads have no cache. Explicit exceptions are noted per route.
5. Static/placeholder report routes and hard-coded report dashboard values are correctness/product findings, not measured performance findings.

## Sales: Quotations and Sales Orders

### Findings

#### `/quotation` — unbounded quotation list plus client work
- **Evidence:** `QuotationList.tsx:386-400` selects `*` with no range/limit; `:419-456` filters/sorts and slices 20 rows in memory; `:458-465` recomputes four status totals over the full array; shell renders at `:785-918`.
- **Budget/cache:** Source-inferred, not measured: 1 unconditional list read; status changes alter key `['quotations',statusFilter,organisation.id]` (`:386-388`) and can cause another read. Explicit stale 5m, GC 10m; inherited `refetchOnWindowFocus:false`, mount/reconnect true (`queryClient.ts:129-145`). Search/status/sub-tab filtering is client-side.
- **Impact hypothesis:** Payload, server work, JS filtering/sorting, totals, and retained memory scale with all quotations although only 20 are visible.
- **Confirm:** Cold landing trace: count `quotation_header` requests; measure TTFB, bytes, duration, rows versus 20 visible rows; profile filter/sort/totals at 100/1,000/10,000 rows.
- **Route evidence/bundle:** `App.tsx:84,484-491` → `QuotationList.tsx:111`; `dist/assets/QuotationList-9A0WApAT.js` 26,627 bytes; source map maps `QuotationList.tsx`. Tabs: All Quotes, Drafts, All/Sent/Under Negotiation/Approved/Rejected/Converted/Cancelled/Expired.

#### `/sales-orders` — unbounded list and client filtering
- **Evidence:** `hooks.ts:44-63` selects `sales_orders *` with client/project relations, organisation filter/order only; `SalesOrderList.tsx:100-112` filters all results; `:257` passes filtered orders to the shell.
- **Budget/cache:** Source-inferred, not measured: 1 unconditional list read, key `['sales-orders','list',orgId]` (`hooks.ts:14-18`), inherited stale 5m/GC 30m, no focus refetch, mount/reconnect refetch; no server pagination.
- **Impact hypothesis:** Order history size drives response, parse, filter, and initial render work; status/search cannot reduce server work.
- **Confirm:** Trace requests/rows/bytes/duration and React commit time as row counts grow.
- **Route/bundle:** `App.tsx:88,488` → `SalesOrderList.tsx:74`; `SalesOrderList--Ys_cral.js` 15,790 bytes. Tabs: All, Draft, Waiting Approval, Open, Completed, Cancelled; also in_production and partially_shipped status filter.

#### `/sales-orders/view?id=<id>` — duplicate summary read and fan-out
- **Evidence:** Detail loads at `SalesOrderDetail.tsx:141-142`; items `:318-320`; POs `:339-355`; activity `:358`; invoices `:365-377`; attachments `:71-82`; templates `:277-290`. Embedded pane at `SalesOrderListPane.tsx:45` invokes summary query (`hooks.ts:65-80`)—another full sales-order read. Job cards `:322-335` and invoices `:365-377` wait for items; PO vendor `:154-168` waits for dialog; delivery challans `:391-401` are in detail budget, but exact select text is outside the inspected excerpt.
- **Budget/cache:** Source-inferred, not measured: practical baseline 8 reads/chains including delivery challans (7 unconditional listed reads plus that query), plus up to 2 item-dependent reads and user-action vendor read. Inherited stale 5m/GC 30m; templates stale 10m; attachment storage list limit 100, other selects unbounded.
- **Impact hypothesis:** Sidebar/history/template/linkage work and duplicated full-list work can delay useful preview content and increase bandwidth; item-dependent waterfalls add tail latency.
- **Confirm:** Request waterfall with initiators, overlap, rows, bytes, timestamps; compare preview first-content/commit with pane enabled/disabled.
- **Route/bundle:** `App.tsx:91,491`; `SalesOrderDetail-BGaKP8oU.js` 52,165 bytes; source map maps detail and pane. Tabs include Preview/document tabs, items/job cards/POs/invoices/delivery challans, and pane filters/sorts.

#### `/quotation/view?id=<id>` — full sidebar plus history chains
- **Evidence:** Detail `QuotationView.tsx:152-172`; templates `:174-189`; terms `:195-211`; full sidebar `:213-227`; variants `:230`; approvals `:245-264`; approval actions depend on IDs `:271-289`; activity `:291-309`; profiles depend on combined IDs `:311-345`; suggestions can perform up to two serial reads `:399-425`. Sidebar/item filtering is client-side at `:232-243,390-397`.
- **Budget/cache:** Source-inferred, not measured: 6 unconditional reads (detail, templates, terms, sidebar, variants, approvals), plus up to 3 gated/serial chains (approval actions, profiles, suggestions). No range/limit on detail/sidebar. Templates stale 10m; other queries inherit 5m stale/30m GC/no focus refetch.
- **Impact hypothesis:** Opening one quotation may download the organisation list and history work before History is requested; dependent chains add tail latency.
- **Confirm:** Trace each request, rows/bytes/timing and History visibility/commit time while varying approval/message counts.
- **Route/bundle:** `App.tsx:87,486`; `QuotationView-DAgvu8xc.js` 128,257 bytes; source map maps `QuotationView.tsx`. Tabs: Preview, History timeline/feedback, item filter, sidebar All/Draft/Sent/Approved/Pending/Expired.

#### `/quotation/create` — multiple full collection reads
- **Evidence:** `CreateQuotation/index.tsx:124-127` calls materials/clients/projects/variants; profile effect `:108-122`; init query `:272-313` Promise.all reads full item pricing, discount settings, default template, categories; dependent rates `:345`; arc pricing gated `:324-332`; conversion can be active at `:318`.
- **Budget/cache:** Source-inferred, not measured: up to 9 unconditional reads (profile + 4 resource hooks + 4 parallel init reads), subject to shared-cache hits; conditional conversion/last-rates/shipping reads. Init key `['quotationInit',org]`, stale 30m, mount/focus refetch false (`:272-276`). No pagination evidence.
- **Impact hypothesis:** Large master/pricing tables impose payload, parse, and render cost before item selection; concurrency reduces wall time, not bytes/CPU.
- **Confirm:** Cold trace request count/overlap/duration/rows/bytes; time-to-interactive, commit and heap with large materials/clients/pricing.
- **Route/bundle:** `App.tsx:85,485`; base `index-gl5i4-sQ.js` 163,757 bytes, plus SaveStatusIndicator 1,675 and AddShippingAddressModal 8,247. Tabs Items (default), Approvals.

#### `/sales-orders/create` — unbounded master collections
- **Evidence:** `SalesOrderCreateV2.tsx:232-271` reads clients, materials, discount categories, variants, variant pricing; `:333-348` defaults; projects/mappings gated by client; number RPC `:331` gated to create; conversion loads up to three serial reads `:293-329`; dropdown arrays/filtering `:126-132,273-285`.
- **Budget/cache:** Source-inferred, not measured: 6 unconditional reads plus gated number RPC; client project/mapping reads after selection. Separate keys, mostly inherited stale 5m/GC 30m; defaults stale 10m; no range/limit.
- **Impact hypothesis:** Large master collections increase payload/parse/render cost before interaction; repeated per-line variant filtering adds render work.
- **Confirm:** Measure bytes/rows/overlap and profile initial render and edits at 100/1,000/10,000 rows.
- **Route/bundle:** Active V2 selected by `App.tsx:90,489`; `SalesOrderCreateV2-DtDIo1Fp.js` 52,951 bytes; legacy SalesOrderCreate is lazy at `App.tsx:89` but not active. Single-document editor.

#### `/sales-orders/edit?id=<id>` — serial unbounded loader
- **Evidence:** `SalesOrderCreateV2.tsx:356-365` reads `sales_orders *`, then after resolution `:381-385` reads `sales_order_items *` with material join; effect `:356-402` has no React Query key.
- **Budget/cache:** Source-inferred, not measured: 6 baseline org reads + 2 serial edit reads, then possible gated project/mapping reads; number RPC disabled by edit mode. Edit reads can refire on effect dependency changes without shared cache/coalescing.
- **Impact hypothesis:** Avoidable header→items waterfall delays readiness and effect-local reads can repeat.
- **Confirm:** Trace initiators/timestamps/rows/bytes; compare readiness with parallelized loading and React Profiler.
- **Route/bundle:** `App.tsx:90,490`; same 52,951-byte V2 chunk; populated existing SO lines.

### Deployed comparison (Sales)

Unauthenticated `https://mep-project-drab.vercel.app/` returned 200 and referenced `index-D2r6k0ho.js` (442,285 bytes), vendor-react, vendor-data, vendor-ui, vendor-icons, and CSS. Public index map (`index-D2r6k0ho.js.map`, 1,821,662 bytes) had 385 bundled/minified sources without domain filenames; no defensible deployed per-route mapping or workspace hash comparison is possible. No API/business data/login/secrets were requested.

## Invoices, Accounting, and Finance

### Findings and route variants

- **`/invoices` (All/Drafts/Unpaid/Paid/other):** `useInvoices` (`src/invoices/hooks.ts:28-36`) calls one organisation-enabled `getInvoices`; API selects explicit invoice columns plus client (`src/invoices/api.ts:84-110`) but no range/limit evidence. `InvoiceListPage.tsx:223-230,490-555` filters and paginates locally. Source-inferred budget: 1 read. Bundle `InvoiceListPage-D0CvL1R5.js`, 26,578 bytes. **Impact:** full history payload/parse despite one page/status/search. **Confirm:** cold network rows/bytes/duration and React commit as invoices grow.
- **`/invoices/create; /invoices/edit`:** `InvoiceEditorPage`, bundle 43,789 bytes. Route dispatch `App.tsx:495-497`, registry `src/features/invoices/routes.ts:21-53`; detail/source/template/client reads are conditional and treated as gated, not a fixed count. Source-inferred budget: 0 unconditional list reads; typically 1+ gated reads. **Confirm:** cold editor trace by create/edit/source branch.
- **`/invoices/view`:** `InvoiceView`, bundle 45,020 bytes; `useInvoice` key `['invoices','detail',id]`, gated by id/org (`hooks.ts:39-45`), full nested `INVOICE_SELECT` (`api.ts:52-82`). Source-inferred budget: 1 gated detail read; no pagination. **Confirm:** measure nested rows/bytes and detail commit.
- **`/proforma-invoices`:** `ProformaListPage`; source `src/proforma-invoices/hooks.ts` and `:219-240+` filters/sorts/pages locally, no server range evidence. No separately mappable local chunk. Source-inferred: 1 org-ready list read. **Confirm:** trace API rows/bytes and page size.
- **`/site-expenses`:** `useExpenseEntries` key `['expense-entries',filters]`, `useExpenseEntries.ts:16-58`; `buildQuery` selects `*` plus project/client/consumable/material relations, no range (`:17-46`), SiteExpenses filters/renders locally. Bundle `SiteExpenses-DVWhF16w.js`, 28,110 bytes. Source-inferred: 1 read. **Impact:** wide historical relation payload and render scale with all entries. **Confirm:** rows/bytes/TTFB and commit at scale.
- **`/advances-expenses` (All/Advances/Expenses/Reimbursements):** AdvanceExpenseModule maps tabs (`:11-19,29-40,89-98`); list uses `useAdvanceExpenses` plus `useAeKpis` (`AdvanceExpenseList.tsx:47`). Bundle `AdvanceExpenseModule-1O7Mvpe1.js`, 40,852 bytes. Source-inferred: 2 gated reads per list tab; no range evidence. **Impact:** full records and KPI work scale with history. **Confirm:** request count/rows/bytes and list commit by tab.
- **`/advances-expenses/reports`:** records + KPIs plus category and employee lookup if enabled; employee helper is serial `org_members` then employees (`useAdvanceExpense.ts:40-61`). Source-inferred at least 2 gated reads plus conditional lookups. **Confirm:** trace exact branch.
- **`/advances-expenses/petty-cash`:** `usePettyCashFloats` gives 1 gated float read; employee/project reads form-gated. Same 40,852-byte chunk. **Confirm:** cold tab trace.
- **`/advances-expenses/ceo-dashboard`:** `CeoDashboard.tsx:22-35` loads all advance expenses + KPIs, filters pending/groups all records in `useMemo`; source-inferred 2 reads. **Impact:** full-record client grouping. **Confirm:** records/bytes/useMemo/commit at 1k/10k.
- **`/finance/payments`:** `PaymentsHub.tsx:105-109` mounts five hooks: approved accountant, subcontractor, approved requests, released, released subcontractor; definitions `usePurchaseQueries.ts:1279,1301,1326,1391,1476`. Bundle 25,451 bytes. Source-inferred: 5 unconditional org-gated reads, likely parallel; no range evidence. **Impact:** five round trips/full datasets before unified table. **Confirm:** cold trace, rows/bytes/overlap and unified-table commit.
- **`/accounting/day-book`:** `useDayBook` reads nested journal entries/lines/accounts all ordered, no range (`useAccounting.ts:74-89`); accounts query `:12-16`; DayBook filters/renders locally. Bundle 13,844 bytes. Source-inferred: 2 reads (journal + accounts). **Impact:** payload/DOM scales with journal history. **Confirm:** rows/bytes and commit at 1k/10k.
- **`/accounting/chart-of-accounts`:** accounts `select('*')`, organisation filter/order (`useAccounting.ts:12-16`), recursive rollups `:20-58`, recursive rows `ChartOfAccounts.tsx:16-58,184-195`; bundle 6,912 bytes. Source-inferred: 1 read. **Impact:** large all-expanded tree increases transform/DOM. **Confirm:** account count, DOM nodes, commit.
- **`/accounting/trial-balance`:** date/org-gated accounting read; rows grouped client-side (`TrialBalance.tsx:242-260`), no range evidence; bundle 10,523 bytes. Source-inferred: 1 gated read; exact RPC/table branch requires trace. **Confirm:** network and grouped commit.
- **`/reports/invoices` (summary/list/HSN):** `InvoiceReports.tsx:79-108` calls invoices and summary; `invoiceApi.ts:247+` summary calls invoices again; HSN `:266-292` calls HSN data again and reduces it. Bundle 30,697 bytes. Source-inferred summary/list up to 3 top-level reads; HSN 3 serial reads (clients, HSN, repeated HSN), conditional by tab. **Impact:** duplicate transfer plus client HSN aggregation. **Confirm:** request initiators, rows/bytes, CPU and commit.

### Domain-level findings

- **Unbounded nested journal read/client list work:** evidence `useAccounting.ts:74-89`, `DayBook.tsx:20-28`; confirm request rows/bytes and React commit at 1k/10k.
- **Unbounded recursive account tree:** evidence `useAccounting.ts:12-58`, `ChartOfAccounts.tsx:16-58,184-195`; confirm payload, transform, DOM, commit.
- **Wide expense read:** evidence `useExpenseEntries.ts:17-46`; confirm rows/bytes/duration/render.
- **Potential duplicate invoice reads/client HSN aggregation:** evidence above; confirm with network instrumentation.

### Deployed comparison (Invoices/Finance)

Public HTML was fetched unauthenticated. It referenced `index-D2r6k0ho.js` and vendors. Guessed route chunk names returned the 1,693-byte app HTML fallback (HTTP 200, `text/html`), so deployed route chunks could not safely be mapped from HTML alone. Local dist/maps exist for InvoiceListPage, InvoiceView, InvoiceEditorPage, DayBook, ChartOfAccounts, TrialBalance, SiteExpenses, InvoiceReports, AdvanceExpenseModule, and PaymentsHub. No API/business data/login/secrets accessed.

## Human Resources

### Findings

- **`/hr/employees` Directory/Birthdays:** `useEmployees.ts:83-93` selects a wide employee projection plus `default_site:sites`, no range; `EmployeeDirectory.tsx:90-114,299-317` filters/groups and maps every visible employee; birthdays sorts all active DOB employees then slices five (`EmployeeBirthday.tsx:12-36`). Source-inferred Directory budget: 2 reads (employees + organisation settings); Birthdays: 1 employees read. Bundle `EmployeeTab-DX0IMRxd.js` 41,896 bytes/map 117,625. **Impact:** payload and client CPU/memory scale with all employees. **Confirm:** rows/bytes and Profiler at 10/100/1000, including typing and Birthdays.
- **Employee Details:** `useEmployees.ts:108-113` employee plus `default_site:sites(*)`; attendance `:132-139` selects `*`; leave `useLeaveRequests.ts:25-35` orders with no range. Details also calls `useEmployees`, attendance, leave (`EmployeeDetails.tsx:13-14,95,131`). Source-inferred up to 4 reads if employee list cold (3 if warm). **Impact:** broad site and unbounded history payload. **Confirm:** cold direct detail request rows/bytes/commit.
- **`/hr/planning`:** `AttendancePlanning.tsx:232-236` runs plan/sites/employees; attendance `useAttendance.ts:34-41` selects `*` with employee/site `*`; sites `:129-136` selects `*` with only `is_active`, no organisation predicate; employees unbounded. Bundle 16,222 bytes/map 48,512. Source-inferred: 3 parallel reads. **Impact:** full employee/site payload and possible RLS-wide active sites. **Confirm:** request scope, rows/bytes and board commit.
- **`/hr/entry`:** imports same plan/sites/employees (`AttendanceEntry.tsx:3-4`); source-inferred 3 parallel reads, no pagination. Bundle 13,657 bytes/map 36,881. **Impact:** date entry carries wide employee/site objects. **Confirm:** cold load/date switch rows/bytes/cache status and commit.
- **`/hr/employees` Salary Slip and `/hr/salary-slip`:** `useSalarySlip.ts:20-25` awaits `list_payroll_inputs`, then `:29-84` Promise.all of seven broad monthly reads, mostly `*`; salary overview maps every employee (`SalarySlipOverview.tsx:135-150`) with ~23 columns. Bundle 24,921 bytes/map 68,500. Source-inferred: 1 gated RPC, then 7 parallel reads only if nonempty; no reads if RPC returns zero. **Impact:** RPC waterfall, broad monthly payload, unbounded DOM/commit. **Confirm:** instrument RPC and seven reads; rows/bytes/overlap, React commit, DOM/scroll at 50/500/2000 employees.

### Deployed comparison (HR)

Unauthenticated deployed HTML referenced HR assets. Deployed and workspace assets/maps matched for: EmployeeTab 41,896 bytes, SHA-256 `7aa84ef61f766269005cb3506aa6218251426e51e25e97ee3461536877498b6b`; AttendancePlanning 16,222, SHA `db95ed5b36b4a5ca3465b9337e12f89ce61545381925e1ff9a9792b3a568ec86`; AttendanceEntry 13,657, SHA `34611180ceeede0450c73014ca4a6239c86bbd3fb8b8e0a55535bda57ccabb1b`; SalarySlipDashboard 24,921, SHA `a2de62e4678daf4ee77e666f4eecaa546f371a1d16c74c04a63828534051e1c2`; useEmployees 3,301, SHA `25f0daa0dbd9d413995912b359e0f601e0fe449bd3970751c2e67d2b4001cfdf`. All maps returned 200 (117,625; 48,512; 36,881; 68,500; 10,177 respectively). This indicates no source/bundle drift for these mappable HR assets; it is not a runtime performance measurement.

**Uncovered HR items:** `EmployeeCheckIn` and `HRAdminDashboard` are lazy-declared (`App.tsx:230-231`) but have no active HR switch case; not route variants. Module registry exposes category metadata only.

## Reports

### Findings and route variants

- **`/reports` dashboard:** `ReportsDashboard.tsx:22-45` hard-codes groups, recent reports and KPIs; no hook/Supabase call. Bundle 8,459 bytes/map 19,503. Source-inferred: 0 reads. **Impact:** stale/fictitious values (correctness/product, not performance). **Confirm:** route DOM assertion plus authenticated metadata/spec comparison without reading business records.
- **`/reports/financial`:** `FinancialReports.tsx:46-61` serially calls unfiltered reports, filtered reports, then summary; `reportsApi.ts:24-37,65-75` shows projects `*` + nested materials and summary re-calls dataset. Bundle 10,691 bytes/map 25,170. Source-inferred: 3 serial reads. **Impact:** duplicate unbounded project payload and render work. **Confirm:** network count/bytes/rows/timing and compare summary derived from first response.
- **`/reports/projects`:** `ProjectReports.tsx:49-55` serial dataset then summary; `reportsApi.ts:106+` has no range/limit. Bundle 4,282/map 13,699. Source-inferred: 2 serial reads. **Impact:** likely duplicate project work. **Confirm:** same trace and row/byte comparison.
- **`/reports/inventory`:** `InventoryReports.tsx:36-64` calls dataset and summary; API inventory section around `reportsApi.ts:214-310`, no pagination. Bundle 7,001/map 15,766. Source-inferred: 2 serial reads. **Impact:** duplicate unbounded inventory payload. **Confirm:** request count/rows/bytes.
- **`/reports/compliance`:** `ComplianceReports.tsx:38-64` dataset+summary; generate action `:66-80` repeats both. Bundle 6,963/map 17,552. Source-inferred: 2 serial landing reads; generate is gated and adds 2. **Impact:** duplicate report work. **Confirm:** cold and generate traces.
- **`/reports/invoices` list/line-items/HSN:** `InvoiceReports.tsx:59-125` direct effect, clients then datasets; `invoiceApi.ts:53-121,203-233,247+,266-292` uses wide nested invoice/line-item selects, summary re-fetches, HSN summary re-fetches. Bundle 30,697/map 75,391. Source-inferred list 3 serial reads; line-items 2+ branch-dependent; HSN 3 serial reads. **Impact:** nested payload, duplicate transfer, client aggregation. **Confirm:** request initiators/rows/bytes and CPU/commit; exact line-item branch count remains to verify.
- **`/reports/profit`:** `ProfitReport.tsx:45-55,57-124` materials plus purchase and invoice items in parallel, no range; `:90-111,145-225` client filtering/grouping. Bundle 14,187/map 38,638. Source-inferred: 3 reads (materials + 2 parallel transactions), filters rerun transaction reads. **Impact:** broad full-year payload and repeated client CPU. **Confirm:** bytes/rows/duration and Profiler at scale.
- **Legacy `/reports/stock`, `/reports/purchase`, `/reports/sales`:** `src/pages/Reports.tsx:1-4`, `App.tsx:149-153,636-638`; static placeholders, bundle 1,313 bytes/map 2,229 each. Source-inferred: 0 reads. **Impact:** functional gap, not performance. **Confirm:** route smoke test and zero report requests.

### Deployed comparison (Reports)

Public HTML returned 200 (1,693 bytes; SHA-256 prefix `c3fad8c882fd15f6`) and referenced the deployed index. `ReportsDashboard-DvVM4RCQ.js` returned 8,459 bytes (SHA prefix `0804ff5d0b22f7cc`) matching local exactly; map returned 19,503 bytes. Legacy `Reports-DkO2PF7g.js` matched at 1,313 bytes. Guessed Financial/Project/Inventory/Compliance/Invoice/Profit asset names returned root HTML fallback, so no valid deployed hash comparison for those assets; this may be manifest/hash drift or SPA fallback. No API/business data/login/secrets accessed.

**Uncovered Reports items:** exact InvoiceReports line-item branch counts were not fully observable from the bounded source dump; confirm with Network instrumentation. No failed domain.

## Settings

### Findings and route variants

Settings routing sends `/settings`, `/settings-v2`, and `/settings/*` aliases to the same `SettingsV2Page` (`src/App.tsx:666-684`); the default tab is `general` and aliases map to tabs in `src/features/settings-v2/SettingsV2Page.tsx:61-94`.

- **`/settings` general:** `useOrganisationSettings.ts:10-32` reads organisations.settings; `GeneralTab.tsx:33-54` independently reads organisations for round_off_enabled. Bundle base `SettingsV2Page-DVgGN6N5.js` 135,676 bytes. Source-inferred: 2 reads. **Impact:** duplicate organisation read. **Confirm:** cold trace count/overlap/bytes/paint.
- **`/settings/organisation`:** same settings read; Team Members separate. Bundle `Organisation-CkqXWVKf.js` 25,712. Source-inferred: 1 read. **Confirm:** trace.
- **`/settings/access-control` and legacy `/approval-settings`:** AccessControl is lazy; no wrapper-owned read inferred. ApprovalSettings has workflows (`useApprovals.ts:25-36`), `approval_settings.select('*')` (`ApprovalSettings.tsx:730-752`), and org members (`:157-168`), with possible profile fallback (`supabase.ts:254-326`). Bundle ApprovalSettings 38,287; useApprovals 2,420. Source-inferred approvals: 3 org-gated parallel reads plus conditional member/profile reads. AccessControl exact count intentionally not asserted. **Impact:** multiple reads and possible serial fallback. **Confirm:** cold trace, rows/bytes/overlap and fallback.
- **`/settings/document-series` (numbering):** `NumberingTab.tsx:179-198` Promise.all of document_settings and settings reads. Bundle TransactionNumberSeries 10,684. Source-inferred: 2 parallel reads. **Confirm:** trace.
- **`/settings/template`:** `TemplatesTab.tsx:241-276,1006-1009` selects document_templates `*`; `:211-230` repeats filter/map/group passes. Bundle base; legacy TemplateSettings 56,603. Source-inferred: 1 unbounded read. **Impact:** payload and repeated client work. **Confirm:** rows/bytes/self-time/commit.
- **`/settings/checklist-groups`:** `ChecklistGroupsTab.tsx:53-87,257-311` renders local draft groups/items; no direct Supabase call visible. Source-inferred: 0 directly evidenced reads. **Confirm:** trace omitted utility/API paths.
- **`/settings/print`, `/settings/discounts`, `/settings/quick-quote`, `/settings/terms-conditions`:** lazy components (Print 4,877; Discount 9,159; QuickQuote 5,653; Terms 19,686 bytes); wrapper-owned reads not evidenced and component-specific counts intentionally not inferred. Source-inferred wrapper budget: 0. **Confirm:** inspect component source/runtime.
- **`/settings/sales-orders`:** SalesOrdersTab has no direct query evidence in inspected trace; source-inferred 0 directly evidenced reads. **Confirm:** component/runtime trace.
- **`/settings/modules`:** `useOrgModules.ts:13-47` RPC `get_org_modules`, stale 2m; save RPCs mutation-only. Bundle 12,317. Source-inferred: 1 org-gated RPC read. **Confirm:** trace.
- **`/settings/categories`:** `CategoryTab.tsx:26-38` `item_categories.select('*')`; local page size/filter `:20-22,89-117`. Bundle 6,807. Source-inferred: 1 unbounded read. **Impact:** full catalog for 10-row page. **Confirm:** rows/bytes/commit.
- **`/settings/units`:** `useUnits.ts:12-17` selects all units; `UnitTab.tsx:102-132` filters/pages. Bundle 6,217. Source-inferred likely 1 org-gated read; verify query use. **Confirm:** cold/remount/focus trace.
- **`/settings/variants`:** `useVariants.ts:13-18` active variants `*` scoped to org; local filter/page `VariantsTab.tsx:102-130`. Bundle 5,989. Source-inferred: 1 read. **Confirm:** rows/bytes/commit.
- **`/settings/warehouses`:** `useWarehouses.ts:12-17` active warehouses `*`; local filter/page `WarehouseTab.tsx:115-145`. Bundle 7,681. Source-inferred: 1 read. **Confirm:** cold/tab/remount/focus trace.

### Settings cache/deployment caveats

React Query defaults where applicable: stale 5m, GC 30m, no focus refetch, mount/reconnect refetch (`queryClient.ts:129-145`); settings/units/variants/warehouses have no explicit stale policy; modules stale 2m; organisation settings retry false. Public deployment HTML referenced only `index-D2r6k0ho.js`; guessed current-dist asset URLs returned 1,693-byte fallback HTML, so deployed hash/map comparison is unavailable. Local chunks/maps include SettingsV2Page 135,676, Settings 38,631, ApprovalSettings 38,287, ModuleSettings 12,317, Category 6,807, Unit 6,217, Variants 5,989, Warehouse 7,681, Organisation 25,712, Print 4,877, Discount 9,159, QuickQuote 5,653, Terms 19,686. No authenticated or business data accessed.

**Uncovered Settings items:** exact landing reads for lazy AccessControl, PrintSettings, DiscountSettings, QuickQuoteSettings, and TermsConditionsSettings require a separate source/runtime pass; no requests are inferred solely from component names. No failed domain.

## Coverage and uncovered domains

All supplied domain results were incorporated: **Sales: Quotations and Sales Orders; Invoices, Accounting, and Finance; Human Resources; Reports; Settings.** The supplied failure list is empty, so there is **no failed domain**. Uncovered items are partial route/component areas explicitly called out above, not omitted business domains. No runtime performance measurement was performed; all budgets are source-inferred.


## Workspace and source-map comparison

The current repository worktree contains uncommitted changes in audited files, including `src/pages/QuotationList.tsx`, `src/pages/CreateQuotation/index.tsx`, `src/pages/sales/SalesOrderCreateV2.tsx`, `src/pages/sales/SalesOrderDetail.tsx`, `src/pages/sales/SalesOrderList.tsx`, `src/invoices/editor/hooks/useSaveInvoice.ts`, `src/invoices/pages/InvoiceEditorPageV2.tsx`, and several `src/features/settings-v2/*` files. The audit did not modify repository sources. The local build-map comparison is against this worktree, not a committed revision.

I compared 136 embedded `sourcesContent` entries from local `dist` maps in the audited source areas with the corresponding current source files. All 136 matched after normalizing line endings. Deployed per-route comparison was only feasible for the HR assets/maps and the Reports dashboard/legacy assets; those matched the corresponding workspace chunks where reported above. Sales' public index map did not identify domain sources, while Finance and Settings route-chunk requests fell back to app HTML, so no per-route deployed comparison was established for those domains.

The following abbreviated citations resolve to exact source paths: Sales `hooks.ts` is `src/pages/sales/hooks.ts`; `queryClient.ts` is `src/queryClient.ts`; invoice `api.ts:52-82` is `src/invoices/api.ts`; `useAttendance.ts` is `src/hooks/useAttendance.ts`; `ApprovalSettings.tsx` is `src/components/ApprovalSettings.tsx`; `supabase.ts` is `src/supabase.ts`; `WarehouseTab.tsx` is `src/features/materials/settings/WarehouseTab.tsx`; and `CreateQuotation/index.tsx` is `src/pages/CreateQuotation/index.tsx`.


`src/invoices/hooks.ts` is the invoice `hooks.ts:39-45` reference above. The local entry in `apps/web/dist/index.html` points to `index-Rpo5wnKX.js`, while the deployed entry is `index-D2r6k0ho.js`; this is an entry-hash difference, but the available public route assets/maps only permit the per-domain comparisons stated above.
