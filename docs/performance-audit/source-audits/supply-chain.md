# MEP performance audit — source-supplied findings

> **Scope.** Source/build audit; cold landing request counts are source-inferred, not live measurements. No API/Supabase/XHR response bodies, business records, secrets, or environment files were read. **Exception:** a delegated static deployment check fetched and inspected the public app HTML shell to identify asset references, which exceeded the no-response-body instruction. After noticing, deployment checks used HTTP HEAD headers only. No source files were changed as part of this audit.

throughput checkpoint: n/a, read-only investigation

## Overview

Covered domains: **Supply Chain / legacy Procurement**, **Materials**, **Purchase**, **Warehouse**, **Manufacturing V2**, **Manufacturing legacy V0**, plus the **deployed route-chunk/source-map comparison**. No units failed. The dominant patterns are unbounded `select('*')`/full-catalog reads, client-side filtering or paging after transfer, unvirtualized list rendering, coarse or hidden-panel chunk boundaries, and conditional follow-up calls. React Query deduplicates identical in-flight keys only; direct Supabase effects and differently keyed queries are not deduplicated.

The audit preserves source evidence, inference, and hypotheses separately:

- **Code evidence** is a file/path and line citation supplied in the findings.
- **Inference** is a request count or behavior derived from those call sites and stated assumptions.
- **Unmeasured hypothesis** appears only under “Suspected issues”; each has a confirming measurement.

## Key Concepts

- **Count definition:** count source-level `.from`/`.rpc` invocations started automatically on a cache-cold landing. Supabase transport batching/ancillary calls are not represented. Conditional branches and ID-chunk fan-outs remain conditional/data-dependent.
- **Cache:** Query keys deduplicate identical observers. Defaults are domain-specific: procurement `staleTime 5m/gc 10m`; Materials page data `5m/10m`; Purchase commonly `30s/5m` (settings `60s/10m`); Warehouse generally `5m/30m`; V2 manufacturing commonly `60s` or `5m`; V0 follows `5m` global defaults unless overridden. Direct promise/effect calls have no Query cache.
- **Paging versus transfer:** AppTable/Table page sizes bound visible rows only. They do not bound an un-ranged database query, client array, parsing, filtering, or PDF/export work. Warehouse request/fulfillment pages and Purchase orders/bills use server ranges where stated.
- **Rendering:** No inspected route provides React virtualization. Several pages map full arrays; some client-slice or server-page visible rows.
- **Code boundaries:** A top-level lazy import is a chunk boundary. Static child imports keep tabs in that chunk. A local tab branch is not a lazy boundary. Warehouse and V0 mount hidden panels with `display:none`; V2 mounts only the active child.

## How It Works

### Route-to-query and render lookup

Counts below are **source-inferred** cold estimates. “Unknown” is intentional where the supplied bounded source did not safely expose the implementation.

| Route / tab row | Automatic reads / cold estimate | Cache, pagination, render, and chunk evidence |
|---|---:|---|
| `/procurement` — Sourcing Lists | **3 normal**, up to **5** with membership fallback/hydration | Key `['procurement-lists',orgId,showArchived]`; global 5m/10m, no local override; `select('*')` unbounded; AppTable visible-page bounds only; lazy page at `App.tsx:103`, Sidebar at `:46`; query `ProcurementList.tsx:67-82`, shell membership `supabase.ts:150-175`, RPC `hooks/useOrgModules.ts:13-24`. |
| `/procurement` — Dispatch Logistics | **3 normal**, same conditional up to **5** | Same unconditional hidden list query; iframe `DISPATCH_SHEET_URL`, `loading="lazy"` at `ProcurementList.tsx:29,405-411`; no local rows. Tab state/branch `:64,353-412`; same page chunk. |
| `/procurement/detail?id=<id>` | **6–8** after org context; 6 base, stock/PO follow-ups conditional | Keys `procurement-list`, `procurement-vendors`, `procurement-warehouses`, `procurement-item-stock`, `procurement-items`; no range on header/vendors/warehouses/items; stock constrained by `.in(item_id,itemIds)`, PO by `.in(id,missing)` and bypasses Query cache. Lazy detail `App.tsx:104`; reads `ProcurementDetail.tsx:204-328`; rows `:1120-1179`. |
| `/store/materials?tab=items` (Items) | **11** normal shell; **10** embed | One `['materials-page-data',orgId]`, 5m/10m, 10 parallel unbounded selects; client table page only; lazy `App.tsx:62`; `useMaterialsPageData.tsx:28-30,46-205,227-230`; tabs `MaterialsPage.tsx:29-65`. |
| `/store/materials?tab=service-rates` | **1** shell; **0** embed | Placeholder, no page query; static child `MaterialsPage.tsx:31,54`, `ServiceRatesTab.tsx:1-6`. |
| `/store/materials?tab=category` | **2** shell; **1** embed | Imperative unbounded `item_categories` select, local slice `CategoryTab.tsx:26-31,102`; static tab `MaterialsPage.tsx:32,55`. Missing org predicate is a validation concern, not a proven defect. |
| `/store/materials?tab=unit` | **1** shell; **0** page | No active mount list query in inspected component; local pagination/invalidation `UnitTab.tsx:42,56,75,117`; owner `MaterialsPage.tsx:33,56`. |
| `/store/materials?tab=warehouses` | **1** shell; **0** page | No mount query visible; local slice/invalidation around `WarehousesTab.tsx:48,62,81,130`; `MaterialsPage.tsx:34,57`. |
| `/store/materials?tab=variants` | **2 total** (1 shared shell + 1 page query) | `VariantsTab` calls `useVariants`; unbounded `company_variants.select('*')`, default 5m/10m cache, then client filter/slice to 10; `VariantsTab.tsx:15-17,101-116,212-224`, `useVariants.ts:6-22`, `MaterialsPage.tsx:35,58`. |
| `/store/materials?tab=discount-categories` | **2** shell; **1** embed | Key `['discountCategories',organisation?.id]`, default Query cache; unbounded `.select('*')`, local slice `DiscountCategoriesTab.tsx:18-30,123`; tab `MaterialsPage.tsx:36,59`. |
| `/store/materials?tab=inward` and `/store/inward` | **7** shell / **6** embed, assuming org | Pricing, inward, materials, warehouses, variants, projects; unbounded history/catalog maps (`MaterialInward.tsx:59-91,418,458,534-606`; hooks `useMaterials.ts:9-17`, `useWarehouses.ts:8-17`, `useVariants.ts:9-18`, `useProjects.ts:9-17`). Alias `App.tsx:135,622`; tab `MaterialsPage.tsx:37,60`. |
| `/store/materials?tab=outward` and `/store/outward` | **6** shell / **5** embed, assuming org | Unbounded outward/catalog reads, client filtering/map `MaterialOutward.tsx:34-39,494`; shared hooks above; alias `App.tsx:136,623`; tab `MaterialsPage.tsx:38,61`. |
| `/store/materials?tab=stock-transfer` and `/store/transfer` | **5 total** (1 shared shell + 4 page queries) | Three catalog hooks (`useMaterials`, `useWarehouses`, `useVariants`) plus transfer-list query. Stock/detail reads are disabled on the initial blank form; transfer list is unbounded and fully mapped. `StockTransfer.tsx:56-67,69-111,549`; hooks `useMaterials.ts:9-17`, `useWarehouses.ts:8-17`, `useVariants.ts:9-18`; tab `MaterialsPage.tsx:39,62`; alias `App.tsx:63,624`. |
| `/store/materials?tab=stock-balance` and `/store/stock` | **1** shell / **0** embed | Static empty-state `pages/Reports.tsx:1`; tab `MaterialsPage.tsx:40,63`; alias `App.tsx:150,625`. |
| `/store/materials?tab=stock-check` and `/quick-stock-check` | **4 total** (3 catalog queries + 1 shared permissions query) | `useMaterials`, `useWarehouses`, `useVariants`, and `useHasPermission`/`useMyPermissions`; without `id`/`intent_id`, initial-data effect adds no page read. ID/intent branches add conditional reads. `QuickStockCheck.tsx:19-65,81-116`; `useMaterials.ts:9-17`, `useWarehouses.ts:8-17`, `useVariants.ts:9-18`, `rbac/hooks.ts:54-61,169-222`; tab `MaterialsPage.tsx:41,64`; alias `App.tsx:102,627`. |
| `/store/materials?tab=stock-adjust` and `/store/adjust` | **5 base** (1 shared shell + 4 page query hooks), usually **+1** variant-name select when IDs exist | Warehouses, materials, variants, and stock all start on mount; variant fallback calls only follow errors. `item_stock` is un-ranged and has no explicit organisation filter; save RPC is user-triggered. `StockAdjustment.tsx:84-145,231-249,300-421`; tab `MaterialsPage.tsx:42,65`; alias `App.tsx:198,626`. |
| `/store/materials/items/new` (Add Item) | **13** shell / **12** embed if org | 10 page-data reads plus units, vendors, attribute definitions; unbounded lookups; eager `ItemEditorPage` (`App.tsx:23`), route `:620`; `ItemEditorPage.tsx:19-54`, `useMaterialsPageData.tsx:28-205`, `useAttributeDefinitions.tsx:5-19`. |
| `/purchase` (Dashboard initial) | **1** org-level | `['requisition-lines-sourcing',org]`, stale 30s/gc 5m, unbounded helper; `usePurchaseQueries.ts:171-181`, `purchase-inquiries/api.ts:278-301`; shell `PurchaseModule.tsx:40-49`, lazy `App.tsx:165`. |
| `/purchase/dashboard` | **1** | Same as Dashboard; `App.tsx:580-582`, `PurchaseModule.tsx:23,40-49`. |
| `/purchase/vendors` | **2** | Active vendor select unbounded, plus uncached `document_settings` effect; key stale 60s/gc 10m; `usePurchaseQueries.ts:269-287`, `Vendors.tsx:142-143,148,170-183`. Client page size 20. |
| `/purchase/requisitions` — All PRs / Drafts | **At least 5** + external hook unknowns | Requisition, materials, variants, clients, projects, pricing; unbounded; Drafts is client filtering. `Requisitions.tsx:191-219`, `usePurchaseQueries.ts:15-25`, `purchase-requisitions/api.ts:151-163`; DynamicTable no virtualization. |
| `/purchase/inquiries` — Sourcing Board | **2** plus conditional vendor-response | Lines query stale 30s/gc 5m; stock and vendor response effects after lines; no visible paging/virtualization `AvailabilityInquiry.tsx:68,82-108`, `purchase-inquiries/api.ts:416-453`. |
| `/purchase/inquiries` — Vendor Inquiries | **Conditional/unknown** | Active sibling only; hook imports/mount `AvailabilityInquiry.tsx:6-11,36-59`; lower section not line-indexed. |
| `/purchase/orders` | **At least 5** plus conditional helpers | PO page server range/page size 50; vendor lookup unbounded and helper reads conditional; `PurchaseOrders.tsx:441-467`, `usePurchaseQueries.ts:333-380`; no virtualization. |
| `/purchase/tracking` | **3** | `purchase_orders` capped 200, items/vendors unbounded in same Promise.all; `Tracking.tsx:89-96,122-130`; no virtualization. |
| `/purchase/bills` | **2** | Bills server page 25 + unbounded vendors; `Bills.tsx:200-207`, `usePurchaseQueries.ts:646-696,269-287`; AppTable no virtualization. |
| `/purchase/invoice-verification` | **3** | Bills page 25, settings, verification helper unbounded; `InvoiceVerification.tsx:14-17`, `usePurchaseQueries.ts:215-239,646-696`, API `purchase-requisitions/api.ts:165-183`. |
| `/purchase/debit-notes` | **1** | `useDebitNotes` selects a server page of 25 (`range(0,24)` on default filters), stale 30s/gc 5m; UI filters/maps only returned rows. Preview/download template read is user-triggered. `DebitNoteView.tsx:9,25-38,50-59,223-246,86-117`; `usePurchaseQueries.ts:1075-1116`. |
| `/purchase/payments` | **3** + 2 conditional | Payments, payment requests, vendors unbounded; dialog open bills/holds conditional. `Payments.tsx:90-106`, `usePurchaseQueries.ts:804-817,1348-1380`; client mapped, no virtualization. |
| `/purchase/payment-queue` — All Pending / Overdue | **2** each | Bills page 25 plus unbounded payment requests; Overdue changes server filter, All is source label; `PaymentQueue.tsx:32-51`, hook `:646-696,804-817`; AppTable no virtualization. |
| `/purchase/payment-queue` — Next 7 Days / Next 30 Days | **2** each | Same first-page bills query; date windows are client filters (`PaymentQueue.tsx:38-50,63-83`), so only first 25 are considered. |
| `/purchase/payment-accountant` | **1** | Approved-payments select, no range observed; `AccountantQueue.tsx:31,45,129`, `usePurchaseQueries.ts:1290-1345`; no paging/virtualization. |
| `/purchase/debit-notes-v2` | **1** | Vendors select unbounded, key `['vendors',orgId]`; `DebitNoteViewV2.tsx:39-57,137,180`; independent lazy `App.tsx:166`. |
| `/purchase/orders-v2` | **2 normal**; +1 vendor-search lookup after non-empty debounced search | One unbounded vendor lookup plus server-paged purchase orders (25 rows); no list virtualization. `PurchaseOrdersListV2.tsx:87-120,124-187`; `usePurchaseQueries.ts:269-287`; independent lazy `App.tsx:168`. |
| `/purchase/orders-v2/new` | **At least 4** + conditional helper reads | Vendors/projects/template/materials/pricing/variants; mostly unbounded; `PurchaseOrdersV2.tsx:80-130,246,251-255,283,303,322`; lazy `App.tsx:167`. |
| `/purchase/orders-v2/edit` | Same base + conditional PO detail | Detail key `['purchase-order',poId]`, valid UUID only; same source and `usePurchaseQueries.ts:386-405`. |
| `/purchase/purchase-returns` | **1** | `purchase_returns` direct select, no range visible; `PurchaseReturnList.tsx:18-26`; lazy `App.tsx:169`. |
| `/purchase/purchase-returns/create` | **2** + conditional 1 | Vendors and GRNs automatic; GRN items after selection; `PurchaseReturnCreate.tsx:24-59`; lazy `App.tsx:170`. |
| `/warehouse` and `/warehouse/dashboard` | **Fixed shared calls + data-dependent fan-out; exact total unknown** | All non-detail page trees mount behind CSS; shared warehouses/assignable/PO/stock/fulfillment/dashboard/bin candidates/org structure/permissions etc. Evidence `WarehouseModule.tsx:31-41,72-104`; hooks `useWarehouseData.ts:22-66,148-165,482-495`; services `warehouseService.ts:1357-1377,1857-1864`. Dashboard movement limit 300; most other reads unbounded/chunked 500 IDs. |
| `/warehouse/stock-requests` — status tabs | Same standard-shell fan-out + **1 page-1 request** | Server page size 25/range; status tabs client/query-key filters; `StockRequestListPage.tsx:39-63,188-205`, `stockRequestService.ts:50-92`. |
| `/warehouse/stock-requests/<id>` — detail tabs | **3** detail requests | Request and allocations unbounded; activity range 50; tabs client-only. `WarehouseModule.tsx:47-54,72-74`; services `stockRequestService.ts:97-155`; render `StockRequestDetailPage.tsx:413-465,490-576,589+`. |
| `/warehouse/fulfillment` — Allocation/Dispatch/Transit | Standard shell + **1 page-1 request** | Page size 25; tabs client filters over returned page; `FulfillmentQueuePage.tsx:32-58,157-239`, `stockRequestService.ts:365-385`. |
| `/warehouse/designer` / `<id>` | New: permissions only; existing: structure fan-out + permissions | Structure root/children unbounded, ID chunks of 500; `WarehouseDesignerPage.tsx:72-99`, `useWarehouseData.ts:34-39`, `warehouseService.ts:161-198`; lazy only `App.tsx:180-182`. |
| `/warehouse/viewer` / `<id>` | No-id shared baseline; id adds viewer fan-out | Viewer stale 30s, structure/bin/material data mostly unbounded/chunked; `WarehouseViewerPage.tsx:37-51,97-125`, `useWarehouseData.ts:42-49`, `warehouseService.ts:281-287`. |
| `/warehouse/inventory` / `<id>` | Shared baseline + delayed inventory fan-out | No range; full structure/bin rows and plain table; `InventoryPage.tsx:31-44,57-66,204-231`; `useWarehouseData.ts:160-165`. |
| `/warehouse/operations` — Receiving/Transfers/Dispatch/Picking/Replenishment/Cycle Count | Cold: Receiving support only; other tabs after click | Receiving support includes warehouses/candidates/assignable/PO; other tab hooks conditional; 30s refetch for some queues; `OperationsPage.tsx:118-180,152-157,772-785,1352-1360,1712-1725,2178-2187,2606-2622`, `useWarehouseData.ts:239-249,400-410,507-518`. |
| `/warehouse/reports` — five report tabs | Same dashboard fan-out, deduped | Report tabs derive dashboard VM; movement history bounded 300; no report paging/virtualization. `WarehouseReportsPage.tsx:12-20,97-119`; dashboard `warehouseService.ts:1357-1377`. |
| `/warehouse/warehouses` | Shared warehouses + **1** first-warehouse floors after resolution | All cards client mapped; only first floor count fetched; `WarehouseListPage.tsx:17-26,102-150`, `useWarehouseData.ts:51-67`. |
| `/manufacturing` and `/manufacturing/dashboard` — V2 Dashboard | **5** when org exists | Both mount Dashboard; one key, stale 60s; five `.from` calls, no range; active-only shell. `/manufacturing/dashboard` is handled specially by `ManufacturingShell.tsx:107-112`; tab default/path at `:64-79`; `ManufacturingDashboard.tsx:30-59`; App route `App.tsx:526`. |
| `/manufacturing/machines` | **1 primary**, internal fan-out unknown | No range/paging; cards map; `MachineBoardPage.tsx:21-105`; shell lazy `ManufacturingShell.tsx:57`. |
| `/manufacturing/moulds` | **At least 2** + N conditional enrichments | Tooling and job cards, async per-tooling map; `MouldList.tsx:21-46,496`; shell `:58,68,230-245`. |
| `/manufacturing/inventory` | **8 `.from` calls** (7 logical reads) | Key stale 5m; no range, client table slice 12; `InventoryReport.tsx:135-200,153-195,809-810`. |
| `/manufacturing/inventory/wip-valuation` | **1 hook; 1–3 underlying reads** | Job cards then job-card materials then material costs; second/third reads short-circuit for empty results. No range; maps computed rows. `useWIP.ts:4-13`, `wipPersistence.ts:17-60,66-100`, `WIPValuationReport.tsx:8-9`. |
| `/manufacturing/boms` | **1** | Unbounded `bom_headers`, client slice/Table; `useBoms.ts:8-17`, `bomPersistence.ts:4-17`, `BOMList.tsx:42-44`. |
| `/manufacturing/boms/create` | **6** + external units unknown | Six option reads, unbounded; `BOMEditor.tsx:257-263`, `useBoms.ts:98-142`; lazy `ManufacturingShell.tsx:27`. |
| `/manufacturing/boms/edit` | **8** when org/id | Six options + header/items sequential; no range; `useBoms.ts:32-43`, `bomPersistence.ts:19-32`; BOM tree unbounded. |
| `/manufacturing/schedules` | **1** | Unbounded schedules, client Table page; `ProductionScheduleList.tsx:21-37`. |
| `/manufacturing/schedules/create` | **1** | One BOM option read. Schedule-number RPC is save-triggered, not an initial-load request. `ProductionScheduleEditor.tsx:38-76,89-113`; lazy `ManufacturingShell.tsx:29`. |
| `/manufacturing/schedules/edit` | **3** with org/id | BOM options plus schedule header/items; same editor. `ProductionScheduleEditor.tsx:38-76,89-113`. |
| `/manufacturing/job-cards` | **1** | Unbounded select, client page 12; `JobCardList.tsx:41-49`, `useJobCards.ts:7-16`. |
| `/manufacturing/job-cards/create` | **2** + conditional BOM items | Active BOMs/materials; `JobCardCreate.tsx:51-52,147-153`, `useBoms.ts:146-154`. |
| `/manufacturing/production` / `create` | Blank **2**, selected ID up to **5** | Job cards/warehouses then selected detail/materials/entries; no virtualization; `ProductionEntryForm.tsx:82-96,368,542,623`. |
| `/manufacturing/plans` | **1** | Unbounded plans, client Table; `usePlans.ts:19-27`, `planPersistence.ts:4-18`. |
| `/manufacturing/plans/create` | **At least 1**, repository fan-out unknown | Demand repository may read BOM/sales orders; `usePlans.ts:7-15`, `planRepository.ts:31-120`. |
| `/manufacturing/work-centers` | **5 as currently routed** (Dashboard mounts) | App registers this path, but `TABS` has no Work Centers entry; `activeTab` falls back to Dashboard, so the later WorkCenterList branch under Plans is unreachable for this path. `App.tsx:541`; `ManufacturingShell.tsx:64-79,107-112,208-220`. |
| `/manufacturing/dispatch` | **1** | Unbounded dispatch orders, client page; `useDispatch.ts:7-16`, `dispatchPersistence.ts:4-18`. |
| `/manufacturing/stores` | **3** | Requisitions, GRNs, outward count; dashboard slices top five only; `StoresDashboard.tsx:20-42,136,168`. |
| `/manufacturing/stores/grn/create` | **2** + PO items conditional | Materials, POs, then selected PO items; `GRNCreate.tsx:42-80`. |
| `/manufacturing/qc` | **1** | Unbounded QC list, client Table; `useQC.ts:7-16`, `QCInspectionList.tsx:29-44`. |
| `/manufacturing/qc/create` | **2** blank, up to **4** selected | Pending entries/inspected IDs, then job card/QC params; `QCInspectionCreate.tsx:38-82`. |
| `/manufacturing/qc/parameters` | **At least 2** | Materials plus unbounded QC params; `QCParameters.tsx:21-22`, `useQC.ts:31-40`. |
| `/manufacturing/qc/ipqc` | **1** initially, up to **3** selected | Job cards then conditional checkpoints/inspections; `IPQCDashboard.tsx:33-65`, `useIPQC.ts:6-15,51-60`. |
| `/manufacturing/qc/ipqc/checkpoints` | **1** initially, up to **2** selected | BOMs then conditional checkpoints; `IPQCCheckpointConfig.tsx:36-52`. |
| `/manufacturing/activity-log` | **1** visible + permissions unknown | Activity persistence limit 100, client page; permissions external `useMyPermissions`; `ActivityLog.tsx:153-186`, `productionEntryPersistence.ts:95-101`. |
| `/manufacturing/custom-units` | **1** | Unbounded select, client slice 12; `CustomUnits.tsx:119-136`. |
| `/manufacturing/custom-fields` | **1** | Unbounded select, client paging/default cache; `CustomFields.tsx:53-69`. |
| `/parameters` (bare requested) | **0; unrouted** | No App case; implemented `/manufacturing/qc/parameters`, `App.tsx:546`. |
| `/ipqc` (bare requested) | **0; unrouted** | No App case; implemented `/manufacturing/qc/ipqc`, `App.tsx:547`. |
| `/ipqc/checkpoints` (bare requested) | **0; unrouted** | No App case; implemented `/manufacturing/qc/ipqc/checkpoints`, `App.tsx:548`. |
| `/manufacturing-v0` — Dashboard | **5** | One lazy shell; panels use `display:none`; dashboard five unbounded/list reads; `App.tsx:555,571`, `ManufacturingShell.tsx:26-28,110-112`, `ManufacturingDashboard.tsx:26-59`. |
| `/manufacturing-v0/inventory` and `/manufacturing-v0/inventory/wip-valuation` | **9** | Nine parallel calls, no range; client paging; nested valuation path shares InventoryReport. `InventoryReport.tsx:135-210`; `App.tsx:556-557`. |
| `/manufacturing-v0/boms` | **1** | Unbounded BOM headers, client slice 12; `BOMList.tsx:115-130,121,199-214`. |
| `/manufacturing-v0/boms/create` | **5** | Four option queries, pricing query may have two sequential calls; `BOMEditor.tsx:70-141`. |
| `/manufacturing-v0/boms/edit` | **7** baseline with id | Five references + header/items effect; `BOMEditor.tsx:70-141,163-181`. |
| `/manufacturing-v0/schedules/create` | **1** | Shared editor's BOM lookup; `generate_schedule_no` is called only from the explicit save mutation, not on initial mount. `pages/manufacturing/ProductionScheduleEditor.tsx:38-52,89-113`; V0 reuse `pages/manufacturing-v0/ManufacturingShell.tsx:9-10,129-137`. |
| `/manufacturing-v0/schedules/edit` | **3** with org/id | BOM + schedule header/items; `ProductionScheduleEditor.tsx:38-76`. |
| `/manufacturing-v0/schedules` | **1** | Unbounded schedule select, client page; `ProductionScheduleList.tsx:21-37`. |
| `/manufacturing-v0/job-cards` | **1** | Unbounded job cards, client slice 12; `JobCardList.tsx:104-121`. |
| `/manufacturing-v0/job-cards/create` | **2** baseline; second query line caveat | Active BOM/material lookup paths; bounded excerpt caveat `JobCardCreate.tsx:219-236,650,897`. |
| `/manufacturing-v0/production` and `/production/create` | **At least 2** | Job cards and org production entries; full arrays mapped; `ProductionEntryForm.tsx:219-236,897,1040,1118`. |
| `/manufacturing-v0/activity-log` | **2** when user/org; **1** if permissions disabled | Permissions plus unbounded activity select, client paging; `ActivityLog.tsx:146-174,258+`. |
| `/manufacturing-v0/custom-units` | **1** | Unbounded select, client page 12; `CustomUnits.tsx:119-136`. |
| `/manufacturing-v0/custom-fields` | **1** | Unbounded select, client paging; `CustomFields.tsx:29-55+`. |

### Exact request mappings retained from the source

- **Procurement:** shell membership `supabase.ts:150-157` (conditional fallback `:159-165`, organisation hydration `:168-175`); shell RPC `hooks/useOrgModules.ts:18-24,45`; list `ProcurementList.tsx:67-85`; detail header/vendors/warehouses/items `ProcurementDetail.tsx:204-328`; deferred stock `:277-291`; PO badges `:89-98`.
- **Materials:** ten shared page-data selects `useMaterialsPageData.tsx:28-205`; approvals `QuickAccessBar.tsx:41-52`; category `CategoryTab.tsx:26-31`; discount categories `DiscountCategoriesTab.tsx:18-30`; inward/outward and catalog hooks at the exact rows cited above; Item Editor vendor `ItemEditorPage.tsx:43-52`, attributes `:54`, units `:41`.
- **Purchase:** requisition helper `usePurchaseQueries.ts:15-25`; sourcing `:101-125,171-181`; vendors `:269-287`; PO page `:333-380`; bills `:646-696`; payment requests `:804-817`; payments/holds `:1348-1380`; approved payments `:1290-1345`.
- **Warehouse:** shared hooks `useWarehouseData.ts:22-66,100-165,221-249,482-495`; request/fulfillment services `stockRequestService.ts:50-92,365-385`; detail `:97-155`; structure/chunks `warehouseService.ts:119-153,161-198,203-222`; dashboard `:1357-1377`; RBAC `rbac/api.ts:44-71`.
- **Manufacturing V2/V0:** shell boundaries and mount rules `ManufacturingShell.tsx:24-79,123-127,185-310` versus V0 `ManufacturingShell.tsx:5-17,58-61,110-167`; page-specific exact mappings are retained in the lookup rows above.

## Where Things Live

- **App routing and lazy boundaries:** `apps/web/src/App.tsx` route cases and lazy declarations. Procurement `:103-104`; Materials `:62-63,101-102,135-136,150,198`; Purchase `:165-170`; Warehouse `:180-182`; Manufacturing V2 `:522-553`; V0 `:554-571`.
- **Procurement:** `pages/ProcurementList.tsx`, `pages/ProcurementDetail.tsx`, `hooks/useOrgModules.ts`, `components/ui/AppTable.tsx`, `config/queryClient.ts`.
- **Materials:** `features/materials/page/MaterialsPage.tsx`, `hooks/useMaterialsPageData.tsx`, tab components under `features/materials`, and page owners `MaterialInward.tsx`, `MaterialOutward.tsx`, `StockAdjustment.tsx`.
- **Purchase:** `modules/Purchase/PurchaseModule.tsx`, `modules/Purchase/hooks/usePurchaseQueries.ts`, `purchase-inquiries/api.ts`, `purchase-requisitions/api.ts`, and child page files named in the lookup.
- **Warehouse:** `warehouse/WarehouseModule.tsx`, `warehouse/hooks/useWarehouseData.ts`, `warehouse/services/warehouseService.ts`, `warehouse/services/stockRequestService.ts`, page files under `warehouse/`.
- **Manufacturing V2:** `ManufacturingShell.tsx` and child feature/page files; V0 shell under `pages/manufacturing-v0/` but it imports several `pages/manufacturing/` files.
- **Static deployed comparison:** local route chunks/maps include `ProcurementList-CHyHi8Uj.js` (13,057 bytes, map 31,322), `MaterialsPage-CcHtYs-q.js` (82,657, map 235,084), `PurchaseModule-s2ZcQcJC.js` (276,011, map 727,099), `WarehouseModule-Yl4Flbxz.js` (379,082, map 1,189,834), V2 shell `ManufacturingShell-Co86kLC0.js` (21,220, map 44,260), and V0 shell `ManufacturingShell-BOxsxpqK.js` (120,356, map 325,743). Local source-map `sourcesContent` matched current checked-out source for modified `AvailabilityInquiry.tsx`, `PurchaseOrders.tsx`, and `PurchaseOrdersV2.tsx`. The public HTML shell references `/assets/index-Rpo5wnKX.js` and vendor/CSS assets; HEAD for representative deployed JS and `.map` URLs returned **200 `text/html`, 1,693 bytes, same ETag as `/`**, rather than local JS/map sizes. Exact sample URLs and interpretation are in the comparison section below. Remote content therefore cannot be matched to local source from these responses.

## Gotchas

1. A shell count can be conditional on org/auth readiness. If `orgId` is not ready, enabled queries wait and later start; counts are not synchronous-render guarantees.
2. Procurement’s normal 3-call estimate excludes auth refresh and retries; membership fallback/hydration can raise it to 5. Materials’ normal-shell approval query is absent on embed routes. Warehouse totals cannot be one integer because ID-cardinality-dependent 500-chunk fan-outs and material-resolution calls vary.
3. Hidden Warehouse pages (`WarehouseModule.tsx:72-104`) are mounted with CSS hidden, unlike V2’s active-only branch (`ManufacturingShell.tsx:123-127`). V0 similarly instantiates panels under `display:none` (`ManufacturingShell.tsx:58-61,110-167`).
4. The iframe in Procurement Dispatch is external and not counted as Supabase/RPC. Its traffic was not inspected.
5. `/manufacturing/work-centers` is registered but falls through to V2 Dashboard; its WorkCenterList branch is under Plans but the tab matcher does not classify this path. `apps/web/CONTEXT.md:38` says Machine Board is the default while source maps `/manufacturing` to Dashboard (`ManufacturingShell.tsx:64-79`); treat the context note as stale unless runtime behavior proves otherwise.
6. StrictMode development duplicates, retries, auth refresh, mutations, refresh buttons, tab-switch requests, dialog opens, saves/deletes, and exports are outside the requested cold metric.
7. `select('*')` and client paging are code evidence; “large payload,” “slow render,” “N+1,” “omission,” and “poor throughput” are hypotheses until measured.

## Suspected issues (all require confirmation)

Each item states the route/tab, exact source evidence, impact hypothesis, and confirming measurement. These are **unmeasured hypotheses**, not findings of runtime failure.

### Procurement

- **Sourcing Lists — unbounded list:** Evidence `apps/web/src/pages/ProcurementList.tsx:70-74`; AppTable around `:~385-409`, `AppTable.tsx:4-8,37-75`. Hypothesis: all active lists transfer/parse into memory even though visible rows are paged. Measure cold request row count/bytes/time and compare AppTable page size.
- **Dispatch Logistics — hidden unconditional fetch:** Evidence `ProcurementList.tsx:64-85,353-412`. Hypothesis: switching to iframe still pays `procurement_lists`. Measure cold load, switch tab, and instrument query start/no second Supabase request.
- **Detail — unbounded items and rows:** Evidence `ProcurementDetail.tsx:319-323,1120-1179`. Hypothesis: transfer/render/layout/memory scale with every item. Measure response rows/bytes, DOM `<tr>` count, first contentful/render timing at large list sizes.
- **Detail — deferred follow-up calls:** Evidence `ProcurementDetail.tsx:277-291,89-98`. Hypothesis: stock and PO lookups add conditional calls and PO bypasses Query deduplication. Instrument starts after items hydration and ID-list sizes.

### Materials

- **Items/Add Item — ten-query fan-out:** Evidence `useMaterialsPageData.tsx:46-205`. Hypothesis: parallel unbounded lookups increase payload/latency as catalogs grow. Measure each request p50/p95, rows, bytes, aggregate.
- **Inward — history/catalog render growth:** Evidence `MaterialInward.tsx:59-91,418,458,534-606`. Hypothesis: full histories and catalogs make first paint/commit grow linearly. Measure rows, commit duration, and first paint across history sizes.
- **Outward — unbounded history/catalogs:** Evidence `MaterialOutward.tsx:34-39,494`; `useMaterials.ts:13-17`. Hypothesis: payload and client render scale with organisation data. Measure rows/bytes/commit duration.
- **Category — broad select and missing visible org predicate:** Evidence `CategoryTab.tsx:26-31,102`. Hypothesis: transfer/data scope may exceed intended set; pagination does not bound it. Measure actual URL row count and validate RLS/predicate behavior.
- **Discount Categories — unbounded select:** Evidence `DiscountCategoriesTab.tsx:18-30,123`. Hypothesis: client paging does not cap transfer. Measure rows/bytes versus displayed page.
- **Variants — full catalogue behind a ten-row view:** Evidence `VariantsTab.tsx:17,101-116,212-224`; `useVariants.ts:13-20`. Hypothesis: client filter/slice does not bound transfer or parse work. Measure query rows/bytes and render timing at 1k/10k variants.
- **Stock Transfer — unbounded transfer history:** Evidence `StockTransfer.tsx:56-67,549` plus three catalog hooks `useMaterials.ts:13-17`, `useWarehouses.ts:12-19`, `useVariants.ts:13-20`. Hypothesis: history bytes and DOM grow with all transfers while full catalogs load. Measure request rows/bytes, DOM rows, and commit time at increasing history sizes.
- **Quick Stock Check — full catalog reads on form landing:** Evidence `QuickStockCheck.tsx:19-65,81-116`; hooks `useMaterials.ts:13-17`, `useWarehouses.ts:12-19`, `useVariants.ts:13-20`. Hypothesis: full catalogs delay readiness even when no intent/edit ID is present; those parameters add more reads. Measure cold waterfall/bytes and compare blank, intent, and edit landings.
- **Stock Adjustment — unbounded stock preload and repeated scans:** Evidence `StockAdjustment.tsx:84-145,150-154,199-218,252-256,300-421`. Hypothesis: un-ranged `item_stock` plus per-row filter/reduce makes multi-row selection scale with the full stock array. Measure row/byte counts and profile one versus many selected items at large stock sizes.

### Purchase

- **Vendors — unbounded vendor plus settings:** Evidence `usePurchaseQueries.ts:269-287`; `Vendors.tsx:170-183`. Hypothesis: payload/latency grow with vendors and settings is an extra uncached request. Measure cold timing/bytes/rows.
- **Sourcing Board — ID fan-out:** Evidence `AvailabilityInquiry.tsx:82-108`; `purchase-inquiries/api.ts:416-453`. Hypothesis: large line sets produce large IN lists and follow-up calls. Measure line count, distinct IDs, request durations/rows.
- **Requisitions All/Drafts — client-only status filter:** Evidence `Requisitions.tsx:191-219`; `purchase-requisitions/api.ts:151-163`. Hypothesis: all statuses and nested lines transfer for Drafts. Measure rows/bytes by status and payload.
- **Tracking — PO cap does not cap children:** Evidence `Tracking.tsx:89-96`. Hypothesis: items/vendors remain unbounded beyond the 200-PO cap. Measure all three response sizes on >200-PO org.
- **Invoice Verification — unbounded verification list:** Evidence `usePurchaseQueries.ts:175-183`; `InvoiceVerification.tsx:14-17`. Hypothesis: nested verification payload grows without bound. Measure rows/bytes/first render.
- **Payments — three unbounded automatic lists:** Evidence `Payments.tsx:90-106`; `usePurchaseQueries.ts:804-817,1348-1361,1363-1380`. Hypothesis: initial payload/client mapping scales poorly. Measure waterfall, rows/bytes, commit duration.
- **Payment Queue Next 7 Days — first-page omission:** Evidence `PaymentQueue.tsx:48-83`; `usePurchaseQueries.ts:646-696`. Hypothesis: matching bills after row 25 are omitted. Seed a match on row 26+ and compare with unrestricted count.
- **Payment Queue Next 30 Days — same omission:** Evidence same `PaymentQueue.tsx:48-83`, `usePurchaseQueries.ts:646-696`. Hypothesis: first-page-only date filtering omits later matches. Seed and compare unrestricted count.
- **Payments/Accountant — unvirtualized queues:** Evidence `Payments.tsx:90-106`; `AccountantQueue.tsx:31,45,129`; query hooks `usePurchaseQueries.ts:1247-1361`. Hypothesis: large DOM/commit cost. Measure DOM rows, commit time, scroll FPS at 1k/10k.
- **Orders — search vendor lookup:** Evidence `usePurchaseQueries.ts:333-380`; `PurchaseOrders.tsx:467`. Hypothesis: bounded 50-row list plus unbounded vendor search causes search spikes. Compare typed-search waterfall, vendor rows, bytes.
- **Orders V2 — unbounded vendor preload beside 25-row list:** Evidence `PurchaseOrdersListV2.tsx:124-158,189-195`. Hypothesis: every landing transfers all vendors in addition to the server-paged orders, with a further vendor lookup after search debounce. Measure vendor rows/bytes and cold/search waterfalls on a large vendor catalogue.

### Warehouse

- **Every non-detail route — hidden-page fan-out:** Evidence `WarehouseModule.tsx:72-104`, static imports `:13-22`. Hypothesis: unrelated page queries/render work run on every landing. Count Supabase starts with empty cache and compare active-only mount.
- **Fulfillment — first-page categorization:** Evidence `stockRequestService.ts:365-385`; `FulfillmentQueuePage.tsx:42-58`. Hypothesis: category totals/tabs omit matching requests beyond 25. Seed >25 and compare full count.
- **Inventory/Viewer — large-warehouse scaling:** Evidence `warehouseService.ts:161-198,281-287,297-312`; `InventoryPage.tsx:57-66,204-231`; `WarehouseViewerPage.tsx:105-125`. Hypothesis: chunking IDs does not bound payload/DOM/canvas/client filtering. Measure bytes, commit, DOM, interaction at 10k/50k/100k bins.
- **Operations — unbounded lists and polling:** Evidence `OperationsPage.tsx:772-785,1352-1360,1712-1725,2178-2187,2606-2622`; `useWarehouseData.ts:239-249,400-410,507-518`. Hypothesis: full arrays plus 30-second refetch can be expensive. Measure rows/bytes/commit and cadence per tab.
- **Stock-request detail — unbounded lines/allocations:** Evidence `stockRequestService.ts:97-128`; `StockRequestDetailPage.tsx:413-465,490-576,589+`. Hypothesis: large requests cause payload/DOM growth; activity is bounded 50. Measure thousands-line request.

### Manufacturing V2

- **Dashboard — five parallel unbounded reads:** Evidence `ManufacturingDashboard.tsx:36-59`. Hypothesis: cold payload/CPU scales with org lists. Capture five requests, bytes/durations, rendered subset.
- **Inventory — eight `.from` calls before 12-row view:** Evidence `InventoryReport.tsx:153-195,809-810`. Hypothesis: client page size does not cap source work. HAR and commit measurement.
- **Moulds — possible N+1 enrichment:** Evidence `MouldList.tsx:45-46,496`. Hypothesis: per-tooling async enrichment scales with N. Load N toolings and plot requests.
- **BOM create/edit — eager option/detail reads:** Evidence `BOMEditor.tsx:257-263`; `useBoms.ts:98-154`. Hypothesis: six unbounded options plus two edit reads are costly. Cold capture create/edit and pricing skip behavior.
- **Production create — dependent cascade:** Evidence `ProductionEntryForm.tsx:82-96`. Hypothesis: full job-card/entry arrays and selected-ID cascade scale poorly. Compare blank/preselected loads.
- **Plans create — repository fan-out:** Evidence `usePlans.ts:7-15`; `planRepository.ts:31-120`. Hypothesis: demand calculation fans out unbounded BOM/order reads. Instrument each URL.
- **Custom Fields — unbounded/default-refetch behavior:** Evidence `CustomFields.tsx:53-69`. Hypothesis: large select plus default behavior can repeat work. Measure cold/focus/remount.

### Manufacturing V0

- **Dashboard — five parallel reads:** Evidence `pages/manufacturing/ManufacturingDashboard.tsx:36-59`. Hypothesis: unbounded job/schedule/QC payload and browser aggregation. Capture rows/bytes/commit.
- **Inventory — nine parallel reads:** Evidence `pages/manufacturing/InventoryReport.tsx:135-210`. Hypothesis: large payload/main-thread processing despite client paging. Measure every response and processing duration.
- **BOM editor — reference and edit calls:** Evidence `pages/manufacturing-v0/BOMEditor.tsx:70-141,163-181`. Hypothesis: eager full catalogs and uncached edit reads. Compare create/edit and empty pricing IDs.
- **Schedule editor — unbounded BOM options plus edit hydration:** Evidence `pages/manufacturing/ProductionScheduleEditor.tsx:38-87`; V0 shell shares this editor at `pages/manufacturing-v0/ManufacturingShell.tsx:9-10,129-137`. Hypothesis: a large BOM catalog and sequential edit header/items reads increase route-ready time. Measure cold create versus edit; `generate_schedule_no` at `:89-105` is reached only after Save, so it is not a landing request.
- **Job cards — 12-row view over full select:** Evidence `pages/manufacturing-v0/JobCardList.tsx:104-121`. Hypothesis: payload scales beyond visible page. Measure response versus rendered rows.
- **Activity log — likely unbounded source plus permissions:** Evidence `pages/manufacturing/ActivityLog.tsx:146-174,258+`. Hypothesis: client paging leaves large activity payload and permissions adds a dependency. Capture rows/bytes and permission request.
- **Production — full arrays/no virtualization:** Evidence `pages/manufacturing-v0/ProductionEntryForm.tsx:219-236,897,1040,1118`. Hypothesis: options/history scale in payload and render. Cold capture `/production` and `/production/create`.
- **V0 chunk — coarse/static hidden panels:** Evidence `pages/manufacturing-v0/ManufacturingShell.tsx:5-17,59-60,110-167`. Hypothesis: all child modules inflate initial JS and hidden panel work. Compare manifest/initial transfer with independently lazy-loaded tabs.

### Routing and deployed assets

- **Manufacturing V2 Work Centers — route resolver falls back to Dashboard:** Evidence `App.tsx:541`; `ManufacturingShell.tsx:64-79,107-112,208-220`. Hypothesis: `/manufacturing/work-centers` displays Dashboard (five Dashboard reads) instead of WorkCenterList and loads the wrong lazy chunk. Navigate directly and compare active tab, rendered component, query starts, and chunk requests.
- **Public route chunks — deployed asset paths return the HTML shell:** Evidence: HEAD sample URLs and local chunk/map byte sizes in the comparison section. Hypothesis: browsers may reject module scripts on MIME type or fail to load lazy route/source-map assets if the same response is served. Confirm `Content-Type`, status, transferred bytes, console errors, and deployed rewrite/build output on an unauthenticated route; no API bodies are needed.

## Deployed static-asset/source-map comparison

The static comparison is **limited, not a runtime verification**. During route-chunk discovery, the public app HTML shell was fetched and inspected for its asset references (the exception disclosed in Scope). Subsequent public checks used HEAD only: `/assets/index-Rpo5wnKX.js`, `/assets/ProcurementList-CHyHi8Uj.js`, `/assets/ProcurementList-CHyHi8Uj.js.map`, and `/assets/PurchaseModule-s2ZcQcJC.js` returned 200 `text/html`, 1,693 bytes, with the same ETag as `/`; local counterparts are JavaScript/maps sized 442,346, 13,057, 31,322, and 276,011 bytes respectively. This is consistent with a static-asset path falling through to the SPA HTML shell. **Hypothesis:** if the browser receives those same responses as module scripts/maps, module loading may fail or source maps may be unusable. Confirm via browser Network `Content-Type` and console error metadata on an unauthenticated route, plus the deployed rewrite/build output; no API response bodies or business data were read. Local maps' `sourcesContent` matched current source for the modified Purchase files, but the remote HEAD responses do not prove which source revision is deployed.

## Caveats and units

No units failed: `[]`. Counts remain source-inferred, and several Warehouse fan-outs, VendorInquirySection, v2 editor lower query bodies, demand-repository fan-out, and some permissions implementations remain conditional/unknown. Follow-up source reads resolved StockTransfer, QuickStockCheck, StockAdjustment, DebitNoteView, WIP valuation, the V2 PO list, and ProductionScheduleEditor. Existing working-tree modifications are present; this audit did not edit source files.

## Complete route/tab inventory (audited route/query surfaces)

This inventory expands combined lookup cells above and provides a **107-entry** audit index; grouped tab states are noted in the final inventory note.

1. `/procurement — Sourcing Lists`; 2. `/procurement — Dispatch Logistics`; 3. `/procurement/detail?id=<id>`.
4. `/store/materials?tab=items`; 5. `/store/materials?tab=service-rates`; 6. `/store/materials?tab=category`; 7. `/store/materials?tab=unit`; 8. `/store/materials?tab=warehouses`; 9. `/store/materials?tab=variants`; 10. `/store/materials?tab=discount-categories`; 11. `/store/materials?tab=inward`; 12. `/store/materials?tab=outward`; 13. `/store/materials?tab=stock-transfer`; 14. `/store/materials?tab=stock-balance`; 15. `/store/materials?tab=stock-check`; 16. `/store/materials?tab=stock-adjust`; 17. `/store/inward (alias)`; 18. `/store/outward (alias)`; 19. `/store/transfer (alias)`; 20. `/store/stock (alias)`; 21. `/store/adjust (alias)`; 22. `/quick-stock-check (alias)`; 23. `/store/materials/items/new`.
24. `/purchase (Dashboard initial tab)`; 25. `/purchase/dashboard`; 26. `/purchase/vendors`; 27. `/purchase/requisitions — All PRs`; 28. `/purchase/requisitions — Drafts`; 29. `/purchase/inquiries — Sourcing Board`; 30. `/purchase/inquiries — Vendor Inquiries`; 31. `/purchase/orders`; 32. `/purchase/tracking`; 33. `/purchase/bills`; 34. `/purchase/invoice-verification`; 35. `/purchase/debit-notes`; 36. `/purchase/payments`; 37. `/purchase/payment-queue — All Pending`; 38. `/purchase/payment-queue — Overdue`; 39. `/purchase/payment-queue — Next 7 Days`; 40. `/purchase/payment-queue — Next 30 Days`; 41. `/purchase/payment-accountant`; 42. `/purchase/debit-notes-v2`; 43. `/purchase/orders-v2`; 44. `/purchase/orders-v2/new`; 45. `/purchase/orders-v2/edit`; 46. `/purchase/purchase-returns`; 47. `/purchase/purchase-returns/create`.
48. `/warehouse (shell default → Dashboard)`; 49. `/warehouse/dashboard — Dashboard`; 50. `/warehouse/stock-requests — list/status tabs`; 51. `/warehouse/stock-requests/<id> — detail tabs`; 52. `/warehouse/fulfillment — Allocation/Dispatch/Transit`; 53. `/warehouse/designer`; 54. `/warehouse/designer/<id>`; 55. `/warehouse/viewer`; 56. `/warehouse/viewer/<id>`; 57. `/warehouse/inventory`; 58. `/warehouse/inventory/<id>`; 59. `/warehouse/operations — Receiving/Transfers/Dispatch/Picking/Replenishment/Cycle Count`; 60. `/warehouse/reports — Overview/Utilization/Movement history/Stock velocity/Dead stock`; 61. `/warehouse/warehouses`.
62. `/manufacturing — Dashboard default`; 63. `/manufacturing/dashboard — Dashboard alias`; 64. `/manufacturing/machines`; 65. `/manufacturing/moulds`; 66. `/manufacturing/inventory`; 67. `/manufacturing/inventory/wip-valuation`; 68. `/manufacturing/boms`; 69. `/manufacturing/boms/create`; 70. `/manufacturing/boms/edit`; 71. `/manufacturing/schedules`; 72. `/manufacturing/schedules/create`; 73. `/manufacturing/schedules/edit`; 74. `/manufacturing/job-cards`; 75. `/manufacturing/job-cards/create`; 76. `/manufacturing/production`; 77. `/manufacturing/production/create`; 78. `/manufacturing/plans`; 79. `/manufacturing/plans/create`; 80. `/manufacturing/work-centers`; 81. `/manufacturing/dispatch`; 82. `/manufacturing/stores`; 83. `/manufacturing/stores/grn/create`; 84. `/manufacturing/qc`; 85. `/manufacturing/qc/create`; 86. `/manufacturing/qc/parameters`; 87. `/manufacturing/qc/ipqc`; 88. `/manufacturing/qc/ipqc/checkpoints`; 89. `/manufacturing/activity-log`; 90. `/manufacturing/custom-units`; 91. `/manufacturing/custom-fields`.
92. `/manufacturing-v0 (Dashboard)`; 93. `/manufacturing-v0/inventory`; 94. `/manufacturing-v0/inventory/wip-valuation`; 95. `/manufacturing-v0/boms`; 96. `/manufacturing-v0/boms/create`; 97. `/manufacturing-v0/boms/edit`; 98. `/manufacturing-v0/schedules`; 99. `/manufacturing-v0/schedules/create`; 100. `/manufacturing-v0/schedules/edit`; 101. `/manufacturing-v0/job-cards`; 102. `/manufacturing-v0/job-cards/create`; 103. `/manufacturing-v0/production`; 104. `/manufacturing-v0/production/create`; 105. `/manufacturing-v0/activity-log`; 106. `/manufacturing-v0/custom-units`; 107. `/manufacturing-v0/custom-fields`.


**Inventory note:** The numbered index counts route/query surfaces, not every value of grouped status-filter tabs. Purchase sub-tabs are enumerated individually; Warehouse sub-tabs are grouped by route where they share the same page/query. Bare unrouted aliases are excluded; `/manufacturing/work-centers` is included because App registers it.
Grouped filter values do not add separate path IDs, so the index is not a count of every possible filter state.
The only public response body inspected was the static app HTML shell; no application data endpoint bodies were read.
