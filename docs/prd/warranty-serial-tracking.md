# WARRANTY & SERIAL TRACKING MODULE — PRD

**Module:** Warranty & Serial Tracking  
**Status:** Draft  
**Owner:** Engineering + Product  
**Priority:** P1 — High  
**Target:** Materials → GRN → DC → Invoice → Warranty Tracker → Vendor Return  

---

## 1. OBJECTIVE

Enable end-to-end traceability of serialized and warrantied items from vendor receipt through sales delivery to post-sales service and vendor returns.

The module must satisfy:

```text
Security
Tenant Isolation
Data Integrity
Correctness
Performance
Cache Safety
Maintainability
Migration Integrity
Runtime Reliability
```

---

## 2. GOLDEN RULES

1. **Database security is authoritative.** Frontend validation is UX-only. All business rules must be enforced at the database layer via RPCs and constraints.
2. **Understand before changing.** Every table, route, hook, and RPC must be inventoried before modification.
3. **Preserve business behavior.** Existing workflows (GRN, DC, Invoice, Returns) must continue to function. This module adds fields and flows; it does not remove or alter existing behavior without explicit approval.
4. **Verify, don't assume.** Schema changes must be validated against live database state, not just repository migrations.
5. **Measure before optimizing.** No premature indexing or query changes without demonstrated need.
6. **Tenant isolation includes cache.** Query keys must include `organisation_id`. Cache must not leak data across tenants.
7. **Critical business operations require integrity.** Multi-step operations (GRN confirmation, DC submission, vendor return) must use RPCs with atomic execution.
8. **Build success is not production verification.** Runtime testing against live database is required.
9. **Do not manufacture abstractions.** Use existing patterns: `user_can_access_org`, `supabase.rpc`, `useQuery` with tenant-aware keys.
10. **The standard evolves.** If a better pattern emerges, update this PRD rather than creating a conflicting local standard.

---

## 3. MODULE DISCOVERY

### 3.1 Module Boundaries

```text
Warranty & Serial Tracking
├── Item Master (Materials)
│   ├── has_warranty
│   ├── warranty_period
│   ├── warranty_unit
│   ├── has_serial_number
│   └── serial_number_format
│
├── GRN (Goods Receipt)
│   ├── grn_items.serial_number
│   ├── grn_items.warranty_start_date
│   └── grn_items.warranty_end_date
│
├── Warehouse Inventory
│   ├── warehouse_bin_items.serial_number
│   ├── warehouse_bin_items.warranty_start_date
│   ├── warehouse_bin_items.warranty_end_date
│   └── warehouse_bin_items.returned_to_supplier
│
├── Delivery Challan (DC)
│   ├── delivery_challan_items.serial_number
│   ├── delivery_challan_items.warranty_start_date
│   └── delivery_challan_items.warranty_end_date
│
├── Invoice
│   └── [inherits serial/warranty from DC — read-only]
│
├── Warranty Tracker
│   └── New dashboard module
│
├── Vendor Return
│   ├── vendor_returns (new table)
│   └── vendor_return_items (new table)
│
└── Warranty Claims (existing)
    └── Link to serial numbers
```

### 3.2 Existing Code to Modify

| File | Role | Change Required |
|------|------|-----------------|
| `src/components/ItemCreateDrawer.tsx` | Item creation UI | Add warranty/serial toggles |
| `src/features/materials/page/ItemEditorPage.tsx` | Item edit UI | Add warranty/serial toggles |
| `src/pages/CreateDCV2.tsx` | DC creation | Add serial/warranty fields at line item level |
| `src/pages/InvoiceEditorPage.tsx` | Invoice creation | Display serial/warranty from DC (read-only) |
| `src/pages/InvoiceEditorPageV2.tsx` | Invoice creation v2 | Display serial/warranty from DC (read-only) |
| `src/features/subcontractor-v2/components/...` | Subcontractor module | Not in scope for this module |

### 3.3 New Files Required

| File | Purpose |
|------|---------|
| `src/features/warranty-tracker/components/WarrantyTrackerDashboard.tsx` | Main warranty tracking dashboard |
| `src/features/warranty-tracker/components/WarrantyClaimCreate.tsx` | Create warranty claim from tracker |
| `src/features/vendor-returns/components/VendorReturnList.tsx` | Vendor return list |
| `src/features/vendor-returns/components/VendorReturnCreate.tsx` | Create vendor return |
| `src/features/vendor-returns/components/SerialPickerModal.tsx` | Pick serials from inventory |

---

## 4. DATABASE TENANCY STANDARD

### 4.1 Ownership Model

| Table | Ownership |
|-------|-----------|
| `materials` | TENANT-OWNED |
| `grn_items` | CHILD OF TENANT-OWNED RECORD (via `grn_id` → `grns.organisation_id`) |
| `warehouse_bin_items` | TENANT-OWNED |
| `delivery_challan_items` | CHILD OF TENANT-OWNED RECORD (via `delivery_challan_id`) |
| `vendor_returns` | TENANT-OWNED |
| `vendor_return_items` | CHILD OF TENANT-OWNED RECORD |

All tenant-owned tables must have `organisation_id` with FK to `organisations.id`.

### 4.2 Existing Tables Audit

**`materials` table:**
- Has `organisation_id`: YES
- FK to `organisations`: NEEDS VERIFICATION
- RLS: NEEDS VERIFICATION

**`grn_items` table:**
- Has `organisation_id`: YES
- FK via `grn_id` → `grns.organisation_id`: NEEDS VERIFICATION
- RLS: NEEDS VERIFICATION

**`warehouse_bin_items` table:**
- Has `organisation_id`: YES
- FK to `organisations`: NEEDS VERIFICATION
- RLS: NEEDS VERIFICATION

**`delivery_challan_items` table:**
- Has `organisation_id`: NEEDS VERIFICATION
- FK via `delivery_challan_id`: NEEDS VERIFICATION
- RLS: NEEDS VERIFICATION

---

## 5. ORGANISATION OWNERSHIP

For every tenant-owned table:

```text
organisation_id
        ↓
organisations.id
```

Checks required:
- FK constraint exists
- `organisation_id` is NOT NULL
- Delete behavior is RESTRICT or SET NULL (not CASCADE which could orphan records)
- Index on `organisation_id` for query performance
- No existing NULL `organisation_id` records in production

---

## 6. RLS STANDARD

For every tenant-owned table added or modified:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `materials` | USING (auth.uid() = created_by OR org member) | WITH CHECK (org member) | USING (org member) WITH CHECK (org member) | USING (org member) |
| `grn_items` | USING (grn belongs to org) | WITH CHECK (grn belongs to org) | USING (grn belongs to org) WITH CHECK (grn belongs to org) | USING (grn belongs to org) |
| `warehouse_bin_items` | USING (org member) | WITH CHECK (org member) | USING (org member) WITH CHECK (org member) | USING (org member) |
| `delivery_challan_items` | USING (dc belongs to org) | WITH CHECK (dc belongs to org) | USING (dc belongs to org) WITH CHECK (dc belongs to org) | USING (dc belongs to org) |
| `vendor_returns` | USING (org member) | WITH CHECK (org member) | USING (org member) WITH CHECK (org member) | USING (org member) |
| `vendor_return_items` | USING (vendor_return belongs to org) | WITH CHECK (vendor_return belongs to org) | USING (vendor_return belongs to org) WITH CHECK (vendor_return belongs to org) | USING (vendor_return belongs to org) |

All policies must use `user_can_access_org()` for authorization.

---

## 7. TENANT AUTHORIZATION STANDARD

All RPCs must enforce:

```text
Authenticated user
        ↓
Active organisation membership
        ↓
Authorised organisation
        ↓
Requested record
```

Using existing `public.user_can_access_org(p_organisation_id)`.

No new authorization mechanisms. All RPCs must call this check before any business logic.

---

## 8. RLS TAUTOLOGY AUDIT

Explicitly avoid:

```sql
-- WRONG: tautological
WHERE organisation_id = organisation_id

-- CORRECT: explicit qualification
WHERE grn_items.organisation_id = user_org.id
```

All RLS policies must use explicit table qualification to avoid shadowing.

---

## 9. CHILD RECORD SECURITY

For child tables without direct `organisation_id`:

```text
delivery_challan_items
  ↓
delivery_challan.organisation_id
  ↓
user_org.id
```

Must enforce: `delivery_challan.organisation_id = user_org.id`

For child tables with `organisation_id`:

```text
vendor_return_items.organisation_id = vendor_returns.organisation_id
```

Must be enforced via RPC or trigger.

---

## 10. GLOBAL / REFERENCE DATA

No global reference data is introduced by this module.

`materials` remains tenant-owned. No global item catalog is created.

---

## 11. FRONTEND TENANT AWARENESS

All queries must include `organisation_id`:

```ts
// Correct
queryKey: ['warranty-tracker', organisation?.id]
queryFn: async () => {
  if (!organisation?.id) return [];
  return supabase.from('...').select('...').eq('organisation_id', organisation.id);
}

// Wrong
queryKey: ['warranty-tracker']
```

All mutation payloads must include `organisation_id`.

---

## 12. REACT QUERY / CACHE STANDARD

Cache identity must reflect tenant context:

```ts
// Materials
['materials', organisation?.id]

// GRN items
['grn-items', grnId, organisation?.id]

// Warranty tracker
['warranty-tracker', organisation?.id]

// Vendor returns
['vendor-returns', organisation?.id]
```

All `enabled` conditions must check `!!organisation?.id`.

All mutations must invalidate tenant-scoped queries.

---

## 13. ORGANISATION SWITCHING TEST

When user switches organisation:

```text
Tenant A
   ↓
Open module
   ↓
Load data
   ↓
Switch to Tenant B
   ↓
Reload/render
```

Verify:
- Tenant A data disappears
- Tenant B data appears
- Cached Tenant A data is not displayed
- Dropdowns do not retain Tenant A entities
- Mutations use Tenant B
- Related records do not leak across organisations

---

## 14. CANONICAL DATA HOOKS

Use existing canonical hooks:

```ts
useMaterials()        // Materials list
useWarehouses()       // Warehouse list
useUnits()            // Unit list
useAuth()             // Organisation context
```

Do not create duplicate hooks for the same data.

---

## 15. QUERY PROJECTION STANDARD

Avoid `SELECT *`. Use explicit columns:

```ts
// Correct
.select('id, name, has_warranty, warranty_period, has_serial_number')

// Wrong
.select('*')
```

Exception: When fetching single records for detail views, `*` is acceptable.

---

## 16. QUERY JOIN STANDARD

Avoid unnecessary joins. For warranty tracker, join only what's needed:

```ts
// Correct
.select('*, materials!inner(name, has_warranty), clients!inner(client_name)')

// Wrong: nested joins when not needed
.select('*, materials(*), clients(*), projects(*), ...')
```

---

## 17. POLLING STANDARD

No unconditional polling. Use:

```ts
staleTime: 5 * 60 * 1000,  // 5 minutes
gcTime: 30 * 60 * 1000,    // 30 minutes
```

Explicit refresh only on user action or targeted invalidation.

---

## 18. MUTATION STANDARD

Every mutation must verify:

- Validation (frontend + backend)
- Authorization (tenant check)
- Tenant protection (organisation_id in payload)
- Duplicate submission handling (disable button during mutation)
- Error handling (show user-friendly message)
- Cache invalidation (invalidate affected queries)
- Business integrity (atomic RPC where needed)

---

## 19. ATOMICITY STANDARD

Multi-step operations require RPCs:

```text
GRN Confirmation
  ↓
Update grn_items status
  ↓
Create warehouse_bin_items with serials
  ↓
Update material stock counts
  ↓
Create inventory movement log
```

Must be atomic. Use single RPC `confirm_grn_with_serials()`.

DC submission with serial allocation:
```text
Validate serials available
  ↓
Mark serials as dispatched
  ↓
Create delivery_challan_items with serials
  ↓
Update warehouse_bin_items quantity
  ↓
Create inventory movement log
```

Must be atomic. Use single RPC.

---

## 20. RPC / SERVER FUNCTION STANDARD

All new RPCs must:

- Use `SECURITY DEFINER`
- Set `search_path TO 'public'`
- Call `public.user_can_access_org(p_organisation_id)` first
- Validate all input parameters
- Use explicit schema qualification (`public.table_name`)
- Return appropriate JSONB response
- Have `GRANT EXECUTE TO authenticated`

---

## 21. VALIDATION STANDARD

### Frontend Validation (UX)

- Required fields marked with `*`
- Serial number format validation against `serial_number_format`
- Quantity matches number of serial numbers
- Warranty end date >= warranty start date
- Warranty period within reasonable bounds (1-120 months)

### Backend Validation (Authoritative)

All validations must also exist in RPCs:

- `organisation_id` is valid and user has access
- `has_serial_number = true` → `serial_number` is required
- `has_warranty = true` → `warranty_start_date` and `warranty_end_date` are required
- Serial numbers match item's `serial_number_format` (if set)
- Quantity matches number of serial numbers
- Serial numbers are unique across `warehouse_bin_items` for the same item
- Warranty dates are valid (end > start)

---

## 22. FOREIGN KEY STANDARD

New FKs required:

```sql
-- materials to organisations
ALTER TABLE materials ADD CONSTRAINT fk_materials_organisation 
  FOREIGN KEY (organisation_id) REFERENCES organisations(id);

-- grn_items to grns
ALTER TABLE grn_items ADD CONSTRAINT fk_grn_items_grn 
  FOREIGN KEY (grn_id) REFERENCES grns(id);

-- warehouse_bin_items to materials
ALTER TABLE warehouse_bin_items ADD CONSTRAINT fk_warehouse_bin_items_material 
  FOREIGN KEY (item_id) REFERENCES materials(id);

-- delivery_challan_items to delivery_challans
ALTER TABLE delivery_challan_items ADD CONSTRAINT fk_dc_items_dc 
  FOREIGN KEY (delivery_challan_id) REFERENCES delivery_challans(id);

-- vendor_returns to purchase_vendors
ALTER TABLE vendor_returns ADD CONSTRAINT fk_vendor_returns_vendor 
  FOREIGN KEY (vendor_id) REFERENCES purchase_vendors(id);

-- vendor_return_items to vendor_returns
ALTER TABLE vendor_return_items ADD CONSTRAINT fk_vendor_return_items_return 
  FOREIGN KEY (vendor_return_id) REFERENCES vendor_returns(id);
```

Check existing tables for missing FKs before adding.

---

## 23. INDEX STANDARD

Indexes required:

```sql
-- Materials
CREATE INDEX idx_materials_organisation_id ON materials(organisation_id);
CREATE INDEX idx_materials_has_serial ON materials(has_serial_number) WHERE has_serial_number = true;
CREATE INDEX idx_materials_has_warranty ON materials(has_warranty) WHERE has_warranty = true;

-- GRN items
CREATE INDEX idx_grn_items_grn_id ON grn_items(grn_id);
CREATE INDEX idx_grn_items_serial ON grn_items(serial_number) WHERE serial_number IS NOT NULL;

-- Warehouse bin items
CREATE INDEX idx_warehouse_bin_items_serial ON warehouse_bin_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_warehouse_bin_items_warranty_end ON warehouse_bin_items(warranty_end_date) WHERE warranty_end_date IS NOT NULL;
CREATE INDEX idx_warehouse_bin_items_returned ON warehouse_bin_items(returned_to_supplier) WHERE returned_to_supplier = true;

-- Delivery challan items
CREATE INDEX idx_dc_items_dc_id ON delivery_challan_items(delivery_challan_id);
CREATE INDEX idx_dc_items_serial ON delivery_challan_items(serial_number) WHERE serial_number IS NOT NULL;

-- Vendor returns
CREATE INDEX idx_vendor_returns_organisation ON vendor_returns(organisation_id);
CREATE INDEX idx_vendor_returns_vendor ON vendor_returns(vendor_id);
CREATE INDEX idx_vendor_returns_status ON vendor_returns(status);
```

---

## 24. FRONTEND ARCHITECTURE STANDARD

### 4.1 Structure

```text
src/features/warranty-tracker/
├── components/
│   ├── WarrantyTrackerDashboard.tsx
│   ├── WarrantyTrackerTable.tsx
│   ├── WarrantyClaimCreate.tsx
│   └── WarrantyClaimList.tsx
├── hooks/
│   ├── useWarrantyTracker.ts
│   └── useWarrantyClaims.ts
├── services/
│   └── warrantyService.ts
└── types/
    └── index.ts

src/features/vendor-returns/
├── components/
│   ├── VendorReturnList.tsx
│   ├── VendorReturnCreate.tsx
│   ├── VendorReturnDetail.tsx
│   └── SerialPickerModal.tsx
├── hooks/
│   ├── useVendorReturns.ts
│   └── useSerialPicker.ts
├── services/
│   └── vendorReturnService.ts
└── types/
    └── index.ts
```

### 4.2 Responsibility Boundaries

- **Components:** UI only, no business logic
- **Hooks:** Data fetching and mutations via React Query
- **Services:** Supabase client calls and RPC invocations
- **Types:** TypeScript interfaces

No component should combine UI + data fetching + business logic + database mutations.

---

## 25. BUSINESS LOGIC STANDARD

### 25.1 Item Master

```
Initial state: Item created without warranty/serial flags
   ↓
User toggles "Has warranty"
   ↓
User enters warranty period and unit
   ↓
System stores: has_warranty=true, warranty_period=N, warranty_unit='months'
   ↓
User toggles "Has serial numbers"
   ↓
User enters serial number format (optional)
   ↓
System stores: has_serial_number=true, serial_number_format='SN-{YYYY}-{####}'
   ↓
Final state: Item configured for tracking
```

### 25.2 GRN Serial Capture

```
Initial state: GRN created with items
   ↓
User adds item with has_serial_number=true
   ↓
System shows "Serial numbers" textarea
   ↓
User enters serials (one per line) OR picks from PO
   ↓
System validates:
  - Count matches quantity
  - Format matches serial_number_format (if set)
  - No duplicates
   ↓
User enters warranty start date (default = GRN date)
   ↓
System auto-calculates warranty_end_date
   ↓
Final state: GRN items have serials and warranty dates
```

### 25.3 DC Serial Allocation

```
Initial state: DC created, items added
   ↓
User adds serialized item
   ↓
System checks warehouse for available serials
   ↓
Branch: Pick from inventory
  → Shows modal with available serials
  → User selects serials
  → Quantity auto-fills
   ↓
Branch: Enter manually
  → Shows textarea
  → User enters serials
  → System validates
   ↓
User confirms warranty dates (pre-filled from item defaults)
   ↓
Final state: DC items have serials and warranty dates
```

### 25.4 Invoice Inheritance

```
Initial state: DC confirmed with serials
   ↓
User creates invoice from DC
   ↓
System copies serials and warranty dates from DC
   ↓
Invoice line items show serials (read-only)
   ↓
Final state: Invoice has full traceability
```

### 25.5 Vendor Return

```
Initial state: GRN confirmed, serials in warehouse
   ↓
User creates vendor return
   ↓
Selects vendor and original GRN
   ↓
System shows only serialized items from that GRN still in stock
   ↓
User selects specific serial numbers to return
   ↓
User enters reason
   ↓
User chooses: Credit Note OR Delivery Challan
   ↓
System creates:
  - vendor_returns record
  - vendor_return_items with serials
  - Marks serials as returned_to_supplier=true
  - Deducts quantity from warehouse
   ↓
Final state: Serial tracked through vendor return
```

### 25.6 Warranty Tracker

```
Initial state: Items delivered with serials and warranty
   ↓
User opens Warranty Tracker
   ↓
System shows all serialized items with:
  - Customer
  - Serial number
  - Warranty start/end
  - Days remaining
   ↓
User filters by:
  - Customer
  - Item
  - Warranty expiry range
  - Status
   ↓
User actions:
  - Create Warranty Claim
  - Schedule Service Visit
  - Extend Warranty
   ↓
Final state: Active warranty tracking
```

---

## 26. ERROR HANDLING STANDARD

All operations must handle:

- Loading state (show spinner/skeleton)
- Empty state (show "No data" message)
- Error state (show user-friendly error, retry button)
- Authorization failure (redirect to login)
- Validation failure (show field-level errors)
- Network failure (show retry option)
- Mutation failure (show error, keep form data)
- Partial failure (GRN confirmation partially succeeds → rollback)

Look for silently swallowed errors:
```ts
// Wrong
catch {}

// Correct
catch (err) {
  console.error('Error:', err);
  toast.error(err.message || 'Operation failed');
}
```

---

## 27. PERFORMANCE STANDARD

### Frontend
- Lazy load warranty tracker dashboard
- Virtualize long serial number lists (>100 items)
- Debounce search inputs

### Network
- Use query projections (select only needed columns)
- Cache warranty tracker data for 5 minutes
- Invalidate cache on DC/GRN changes

### Database
- Indexes on `serial_number`, `warranty_end_date`, `organisation_id`
- Avoid N+1 in warranty tracker queries
- Use count queries for dashboard stats, not full table scans

---

## 28. MIGRATION STANDARD

All schema changes must be in repository migrations:

```text
Production database
         ↕
Repository migrations
         ↕
Ad-hoc SQL (for emergency fixes only, must be migrated later)
```

Migration naming: `YYYYMMDDHHMMSS_description.sql`

Example: `20260920183000_warranty_serial_tracking.sql`

No empty migrations. No placeholder migrations. No duplicate migrations.

---

## 29. STALE FILE STANDARD

Do not create:
- `*.backup`
- `*.backup2`
- `*.old`
- `*.tmp`
- `copy files`
- `debug files`

Flag existing stale files. Do not automatically delete without approval.

---

## 30. EXPORT / REPORT STANDARD

### 30.1 Warranty Tracker Export

- Export to CSV: serial numbers, warranty dates, customer, status
- Tenant isolation: only export current tenant's data
- Correct calculations: days remaining, status

### 30.2 Vendor Return Export

- Export to PDF: vendor return note with serial numbers
- Export to CSV: return items with serials, reasons

---

## 31. MOBILE STANDARD

Warranty Tracker must be responsive:
- Touch-friendly serial number entry
- Camera input for serial numbers (future)
- Offline-capable for field service (future)

Desktop build success does not prove mobile functionality.

---

## 32. RUNTIME STANDARD

Test actual application:

```text
Open
 ↓
List
 ↓
Search
 ↓
Filter
 ↓
Create
 ↓
Edit
 ↓
Detail
 ↓
Primary workflow
 ↓
Secondary workflow
 ↓
Delete / Cancel
 ↓
Export
 ↓
Organisation switch
```

Observe:
- Console errors
- Network errors
- Database errors
- RLS errors
- React errors
- Duplicate requests
- Stale data

Only mark PASS if actually executed.

---

## 33. MULTI-TENANT SECURITY TEST

| Operation | A → A | A → B |
|---|---|---|
| SELECT | PASS | BLOCKED |
| INSERT | PASS | BLOCKED |
| UPDATE | PASS | BLOCKED |
| DELETE | PASS | BLOCKED |

For child records:
- A child → A parent = allowed
- A child → B parent = blocked

Do not claim success based solely on policy inspection. Test with actual data.

---

## 34. BUILD VERIFICATION

Run applicable:

```text
TypeScript: PASS/FAIL/NOT RUN
Lint: PASS/FAIL/NOT RUN
Web build: PASS/FAIL/NOT RUN
Tests: PASS/FAIL/NOT RUN
Mobile build: PASS/FAIL/N/A
Capacitor sync: PASS/FAIL/N/A
```

Report actual result. Never reuse old build result.

---

## 35. SEVERITY STANDARD

### P0 — Critical
- Cross-tenant exposure
- Authorization bypass
- Severe data corruption
- Unsafe destructive operation

### P1 — High
- Serious integrity problem
- Critical workflow failure
- Significant security weakness
- Major production performance issue

### P2 — Medium
- Moderate performance issue
- Maintainability problem
- Missing non-critical validation
- Architectural weakness

### P3 — Low
- Cleanup
- Minor duplication
- Documentation
- Non-critical technical debt

---

## 36. IMPLEMENTATION PLAN

### Phase 1: Database Schema (Day 1)
1. Add columns to `materials`: `has_warranty`, `warranty_period`, `warranty_unit`, `has_serial_number`, `serial_number_format`
2. Add columns to `grn_items`: `serial_number`, `warranty_start_date`, `warranty_end_date`
3. Add columns to `warehouse_bin_items`: `serial_number`, `warranty_start_date`, `warranty_end_date`, `returned_to_supplier`
4. Add columns to `delivery_challan_items`: `serial_number`, `warranty_start_date`, `warranty_end_date`
5. Create `vendor_returns` table
6. Create `vendor_return_items` table
7. Add indexes
8. Add FKs
9. Enable RLS on new/modified tables

### Phase 2: RPCs (Day 2-3)
1. `update_material_warranty_settings` — Update item master warranty/serial flags
2. `update_grn_item_serials` — Update GRN items with serial numbers and warranty dates
3. `allocate_serials_to_dc` — Allocate serials from warehouse to DC
4. `create_vendor_return` — Create vendor return with serial tracking
5. `get_warranty_tracker_data` — Get warranty tracking data for dashboard

### Phase 3: Service Layer (Day 4)
1. Add methods to `subcontractorService.ts` or create `warrantyService.ts`
2. Add methods to `vendorReturnService.ts`

### Phase 4: UI Implementation (Day 5-7)
1. Update `ItemCreateDrawer.tsx` with warranty/serial toggles
2. Update `ItemEditorPage.tsx` with warranty/serial toggles
3. Update `GRNCreate.tsx` with serial/warranty fields
4. Update `CreateDCV2.tsx` with serial picker and manual entry
5. Update `InvoiceEditorPage*.tsx` to display serials from DC
6. Create `WarrantyTrackerDashboard.tsx`
7. Create `VendorReturnList.tsx` and `VendorReturnCreate.tsx`
8. Create `SerialPickerModal.tsx`

### Phase 5: Testing & Verification (Day 8)
1. TypeScript build
2. Runtime testing
3. Multi-tenant security test
4. Migration verification

---

## 37. RISKS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Existing data missing new columns | High | Medium | Use `ADD COLUMN IF NOT EXISTS` with defaults |
| RLS policies break existing queries | Medium | High | Test all existing queries after RLS changes |
| Serial number duplication | Medium | High | Unique constraint on `serial_number` per item |
| Performance impact on large datasets | Low | Medium | Add indexes, use pagination |
| Migration ordering conflicts | Low | High | Use timestamp-based naming, verify order |
| Frontend cache leaks across tenants | Medium | High | Audit all query keys, test org switching |

---

## 38. OPEN QUESTIONS

1. Should warranty period be per-item or per-batch/lot?
2. Should serial numbers be globally unique or unique per item?
3. Should vendor returns support partial returns (some serials, not all)?
4. Should warranty tracker show expired warranties or hide them?
5. Should warranty claims be linked to specific serial numbers or just items?
6. Should AMC module integrate with warranty tracker for renewal tracking?

---

## 39. APPROVALS

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Owner | | Pending | |
| Engineering Lead | | Pending | |
| QA Lead | | Pending | |
| Security Review | | Pending | |

---

## 40. REFERENCES

- `MODULE_REFERENCE_PATTERN.md` — ERP production standard
- Existing warranty claims: `warranty_claims` table
- Existing GRN: `grn_items` table
- Existing DC: `delivery_challan_items` table
- Existing returns: `returns`, `return_items` tables
