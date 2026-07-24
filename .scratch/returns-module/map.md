# Wayfinder Map: Material Returns Module

## Destination

A fully specified, verified design and implementation plan for the Material Returns module, which allows users to log returned materials against Invoices and Delivery Challans (DCs), update the project consumption report, and convert returns to credit notes.

## Notes

- Domain: AEC / EPC / MEP Construction & Procurement (material returns from sites)
- Related Modules: Invoices, Delivery Challans (DCs), Credit Notes, Projects, Consumption Report
- Target directory: `apps/web` (React/Vite/TypeScript codebase)

## Decisions so far

- [Database Schema for Returns](file:///c:/Users/admin/mep-project/.scratch/returns-module/issues/01-database-schema-for-returns.md) — Created `returns`, `return_items`, and `return_sources` tables with explicit polymorphic foreign keys (`invoice_item_id`, `delivery_challan_item_id`) for referential integrity, and corrected RLS cast pattern to match `(auth.jwt() ->> 'org_id')::uuid`.
- [Two-Panel Split Screen UI Layout](file:///c:/Users/admin/mep-project/.scratch/returns-module/issues/02-three-split-screen-layout-ui.md) — Confirmed a two-panel split screen on desktop (Left Panel: Return items table/actions, Right Panel: Invoice/DC source mapper drawer).
- [Credit Note Conversion Rules](file:///c:/Users/admin/mep-project/.scratch/returns-module/issues/03-credit-note-conversion-rules.md) — Grouped returned items by unique `invoice_id` and generate one Credit Note per source invoice. Mappings to DCs are excluded from Credit Notes.
- [Consumption Report Updates](file:///c:/Users/admin/mep-project/.scratch/returns-module/issues/04-consumption-report-updates.md) — Confirmed adding `returned_qty` to the consumption table and using the formula `Remaining = Supplied - Used - Returned`. Added a `cancelled` status to allow reversed returns.
- [PDF/Excel Export Utilities](file:///c:/Users/admin/mep-project/.scratch/returns-module/issues/05-pdf-excel-export-utilities.md) — Confirmed client-side XLSX export via `xlsx` and custom PDF generation matching existing document themes via `jspdf` / `jspdf-autotable`.
- **Validation and Security Locks**: Added trigger `trigger_validate_return_quantity` to prevent over-returns during mapping, trigger `trigger_validate_on_complete` with explicit row-locking (`FOR UPDATE`) on source items to prevent same-instant race conditions on transition to `'completed'`, trigger `trigger_lock_completed_returns` to lock completed/cancelled documents, and trigger-based sequence for `return_number` generation (`RET-XXXX`) with app-level conflict retry.
- **Warehouse Stock Allocation**: Created trigger `trigger_update_warehouse_stock_on_return_complete` to automatically increment stock level in `item_stock` when a DC return or an Invoice-mapped return (resolving warehouse via `invoice_items.meta_json`) is completed, and decrement/reverse it symmetrically when status changes to `cancelled`.

## Not yet specified

*(All decisions specified, race conditions handled, and warehouse stock updates configured!)*
