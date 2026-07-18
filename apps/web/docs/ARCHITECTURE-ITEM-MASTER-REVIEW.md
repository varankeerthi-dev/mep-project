# Item Master Architecture Review

> **Project:** MEP ERP Web Application
> **Date:** 2026-07-16
> **Purpose:** Allow an independent software architect to review and improve the Item Master design

---

## 1. Database Schema

### 1.1 Core Table: `materials`

The central Item Master table. Every physical product and service item lives here.

**Columns:**

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | PK | `uuid_generate_v4()` | Primary key |
| `organisation_id` | `UUID` | FK→`organisations(id)` | — | Multi-tenant isolation |
| `name` | `VARCHAR` | NOT NULL | — | Primary item name; must be unique per org |
| `display_name` | `VARCHAR(255)` | — | — | Shown in quotations; defaults to `name` |
| `item_code` | `VARCHAR(50)` | — | — | Unique SKU; auto-generated if empty (`ITEM-{timestamp}`) |
| `main_category` | `VARCHAR(50)` | — | — | Category group: VALVE, PIPE, FITTING, etc. |
| `sub_category` | `VARCHAR(100)` | — | — | Sub-classification (e.g. Ball Valve, Gate Valve) |
| `size` | `VARCHAR(50)` | — | — | e.g. "25mm", "1 inch" |
| `pressure_class` | `VARCHAR(50)` | — | — | e.g. "PN16", "Class 150" |
| `schedule_type` | `VARCHAR(50)` | — | — | Pipe schedule type |
| `make` | `VARCHAR(255)` | — | — | Brand/manufacturer name |
| `material` | `VARCHAR(100)` | — | — | Material of construction (SS304, CI, PVC) |
| `end_connection` | `VARCHAR(100)` | — | — | Threaded, Flanged, Solder, etc. |
| `unit` | `VARCHAR(50)` | — | `'nos'` | Base unit of measure |
| `sale_price` | `DECIMAL(12,2)` | — | — | Default sale price |
| `purchase_price` | `DECIMAL(12,2)` | — | — | Default purchase price |
| `gst_rate` | `DECIMAL(5,2)` | — | — | GST percentage |
| `hsn_code` | `VARCHAR(20)` | — | — | HSN/SAC code |
| `uses_variant` | `BOOLEAN` | — | `false` | Whether item uses multi-category pricing |
| `discount_category_id` | `UUID` | FK→`discount_categories(id)` | — | Bulk discount grouping |
| `taxable` | `VARCHAR(20)` | — | `'taxable'` | `taxable` / `non-taxable` / `non-gst supply` |
| `size_lwh` | `VARCHAR(100)` | — | — | Dimensions in "L×W×H" format |
| `weight` | `DECIMAL(10,3)` | — | — | Item weight |
| `weight_unit` | `VARCHAR(10)` | — | `'kg'` | kg or lb |
| `dimension` | `VARCHAR(100)` | — | — | Dimension value |
| `dimension_unit` | `VARCHAR(10)` | — | `'cm'` | cm or in |
| `upc` | `VARCHAR(50)` | — | — | Universal Product Code |
| `mpn` | `VARCHAR(50)` | — | — | Manufacturer Part Number |
| `ean` | `VARCHAR(50)` | — | — | European Article Number |
| `part_number` | `VARCHAR(100)` | — | — | Internal part number |
| `description` | `TEXT` | — | — | Item description |
| `item_type` | `item_type_enum` | — | `'product'` | Enum: `product` or `service` |
| `item_classification` | `VARCHAR(20)` | — | `'goods_sold'` | CHECK: `finished_good`, `raw_material`, `consumable`, `goods_sold` |
| `allow_purchase` | `BOOLEAN` | — | `true` | Can be purchased |
| `allow_sales` | `BOOLEAN` | — | `true` | Can be sold |
| `show_in_bom` | `BOOLEAN` | — | `true` | Appears in bill of materials |
| `is_manufactured` | `BOOLEAN` | — | `false` | Item is manufactured in-house |
| `is_active` | `BOOLEAN` | — | `true` | Soft-delete flag |
| `created_at` | `TIMESTAMPTZ` | — | `NOW()` | — |
| `updated_at` | `TIMESTAMPTZ` | — | `NOW()` | — |

**Indexes:**

| Index | Columns |
|-------|---------|
| `idx_materials_company` | `company_id` (legacy, same as organisation_id) |
| `idx_materials_item_code` | `item_code` |
| `idx_materials_display_name` | `display_name` |
| `idx_materials_uses_variant` | `uses_variant` |
| `idx_materials_is_active` | `is_active` |
| `idx_materials_discount_category` | `discount_category_id` |

**Constraints:**
- No formal `UNIQUE(name, organisation_id)` at DB level — enforced in application code via explicit SELECT before insert
- `item_code` has a `UNIQUE` constraint

---

### 1.2 Supporting Tables

#### `item_categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `category_name` | VARCHAR(100) | UNIQUE NOT NULL |
| `description` | TEXT | — |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |

**Default seed data:** VALVE, PIPE, FITTING, FLANGE, ELECTRICAL, PLUMBING, HVAC, FIRE PROTECTION, BUILDING MATERIALS, TOOLS, SAFETY, OFFICE, OTHER

#### `item_units`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `unit_name` | VARCHAR(50) | UNIQUE NOT NULL |
| `unit_code` | VARCHAR(20) | UNIQUE NOT NULL |
| `description` | TEXT | — |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |

**Default seed data:** nos, kg, mtr, sqm, sqft, cuft, ltr, bags, box, pair, set, pack

#### `material_units` (Alternative Units)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `material_id` | UUID | FK→`materials(id)` ON DELETE CASCADE |
| `unit_name` | TEXT | NOT NULL |
| `conversion_factor` | NUMERIC | CHECK > 0 |
| `created_at` | TIMESTAMPTZ | — |

**Index:** `idx_material_units_material_id` on `material_id`

#### `company_variants` (Variant Categories)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `company_id`/`organisation_id` | UUID | FK→`organisations(id)` |
| `variant_name` | VARCHAR(100) | NOT NULL |
| `description` | VARCHAR(255) | — |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

**Default seed data:** Retail, Wholesale, Special (also appears: Default, Online, Export from different scripts)

#### `warehouses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `organisation_id` | UUID | FK→`organisations(id)` |
| `warehouse_code` | VARCHAR(50) | UNIQUE |
| `warehouse_name` | VARCHAR(255) | NOT NULL |
| `name` | VARCHAR(255) | Legacy column; being migrated to `warehouse_name` |
| `location` | TEXT | — |
| `is_default` | BOOLEAN | Default `false` |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

---

### 1.3 Pricing Tables

#### `item_variant_pricing` (Variant Pricing)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `item_id` | UUID | FK→`materials(id)` ON DELETE CASCADE |
| `company_variant_id` | UUID | FK→`company_variants(id)` |
| `organisation_id` | UUID | FK→`organisations(id)` |
| `make` | TEXT | Brand name for this pricing row |
| `sale_price` | DECIMAL(12,2) | NOT NULL in some migrations |
| `purchase_price` | DECIMAL(12,2) | — |
| `tax_rate` | DECIMAL(5,2) | — |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

**Constraints:** `UNIQUE(item_id, company_variant_id)`

#### `vendor_material_pricing` (Vendor-Specific Pricing)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `vendor_id` | UUID | FK→`purchase_vendors(id)` or `clients(id)` ON DELETE CASCADE |
| `material_id` | UUID | — |
| `variant_id` | UUID | — |
| `make` | TEXT | Brand |
| `vendor_item_code` | TEXT | — |
| `base_rate` | NUMERIC(15,2) | Default 0 |
| `discount_percent` | NUMERIC(5,2) | Default 0 |
| `is_preferred` | BOOLEAN | Default `false` |
| `organisation_id` | UUID | — |
| `created_by` | UUID | — |
| `updated_by` | UUID | — |
| `last_purchased_at` | TIMESTAMPTZ | — |

**Constraints:** `UNIQUE(vendor_id, material_id, variant_id, make)`

#### `material_client_mappings` (Client Part Number Mapping)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `material_id` | UUID | FK→`materials(id)` ON DELETE CASCADE |
| `client_id` | UUID | FK→`clients(id)` ON DELETE CASCADE |
| `company_variant_id` | UUID | FK→`company_variants(id)` ON DELETE SET NULL |
| `client_part_no` | TEXT | Client's part number for this item |
| `client_description` | TEXT | Client's description for this item |
| `organisation_id` | UUID | FK→`organisations(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

**Constraints:** `UNIQUE(material_id, client_id, company_variant_id)`

#### `material_client_pricing` (Client-Specific Pricing/ARC)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `material_id` | UUID | FK→`materials(id)` |
| `client_id` | UUID | FK→`clients(id)` |
| `company_variant_id` | UUID | FK→`company_variants(id)` ON DELETE SET NULL |
| `pricing_type` | VARCHAR | `Fixed ARC` / `Variable ARC` / `Discount` / `Special Price` / `Lumpsum` |
| `rate` | DECIMAL | — |
| `valid_from` | DATE | — |
| `valid_to` | DATE | — |
| `status` | VARCHAR | `active` / `inactive` / `expired` |
| `organisation_id` | UUID | FK→`organisations(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

*Note: No DDL for the initial table creation found; only RLS migration and variant column addition exist in the codebase.*

#### `material_client_pricing_history` (Client Pricing Audit Trail)

Referenced in the frontend code but **no DDL found** in the repository. The query references columns: `id`, `material_id`, `pricing_type`, `old_rate`, `new_rate`, `valid_from`, `valid_to`, `status`, `change_type`, `changed_at`.

---

### 1.4 Inventory Tables

#### `item_stock`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `item_id` | UUID | FK→`materials(id)` ON DELETE CASCADE |
| `company_variant_id` | UUID | FK→`company_variants(id)` |
| `warehouse_id` | UUID | FK→`warehouses(id)` ON DELETE CASCADE |
| `organisation_id` | UUID | FK→`organisations(id)` |
| `current_stock` | DECIMAL(10-12,2-3) | Default 0; precision varies by migration |
| `low_stock_level` | DECIMAL(10-12,2-3) | — |
| `reorder_level` | DECIMAL(12,3) | — |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

**Constraints:** `UNIQUE(item_id, company_variant_id, warehouse_id)`
**Indexes:** `idx_item_stock_item(item_id)`, `idx_item_stock_variant(company_variant_id)`

---

### 1.5 Audit & Catalog Tables

#### `item_audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `item_id` | UUID | FK→`materials(id)` ON DELETE CASCADE |
| `action` | VARCHAR(80) | NOT NULL |
| `notes` | TEXT | — |
| `changes` | JSONB | JSON array of change descriptions |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Indexes:** `idx_item_audit_logs_item_id(item_id)`, `idx_item_audit_logs_created_at(created_at DESC)`

*Note: A localStorage-based fallback audit trail also exists (`items_audit_trail_v1`), used when the DB audit log insert fails (e.g., table doesn't exist).

#### `discount_categories`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `organisation_id` | UUID | FK→`organisations(id)` |
| `name` | VARCHAR(100) | NOT NULL |
| `default_discount_percent` | DECIMAL(5,2) | Default 0 |
| `min_discount_percent` | DECIMAL(5,2) | Default 0 |
| `max_discount_percent` | DECIMAL(5,2) | Default 100 |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |

**Default seed data:** Standard (0%), Wholesale (10%), Distributor (20%)

#### `consumable_catalog`

Referenced in the codebase (via `useConsumableCatalog` hook) but **no DDL found** in SQL files. Appears to have columns: `id`, `organisation_id`, `name`, `category`, `unit`, `default_rate`, `is_active`, `created_at`, `updated_at`. Category is an enum-like string: `Hardware`, `Electrical`, `Consumable Tools`, `Local Purchase`, `Other`.

#### `services` (Legacy — being deprecated)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | — |
| `service_code` | VARCHAR(50) | UNIQUE |
| `service_name` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | — |
| `unit` | VARCHAR(50) | Default `'nos'` |
| `sale_price` | DECIMAL(12,2) | — |
| `purchase_price` | DECIMAL(12,2) | — |
| `tax_rate` | DECIMAL(5,2) | — |
| `hsn_code` | VARCHAR(20) | — |
| `is_active` | BOOLEAN | Default `true` |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

Services are being migrated into `materials` with `item_type = 'service'`.

#### `custom_units`

Referenced in `useCombinedUnits` hook but **no DDL found**. Used alongside `item_units` for unit selection.

---

## 2. Relationships

```
┌───────────────────┐       ┌───────────────────────┐
│  organisations    │       │  discount_categories   │
│  (multi-tenant)   │──┐    └───────────┬───────────┘
└───────────────────┘  │                │
                       │                │ FK
                       ▼                ▼
              ┌──────────────────────────────────────┐
              │              materials               │
              │         (Item Master Core)           │
              └──────┬──────┬──────┬──────┬──────────┘
                     │      │      │      │
                     │      │      │      │
     ┌───────────────┘      │      │      └───────────────┐
     ▼                      ▼      ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ item_stock   │  │ item_variant_    │  │ vendor_material_     │
│ 1 item ──── *│  │ pricing          │  │ pricing              │
│ warehouse    │  │ 1 item ─── *     │  │ 1 item ──── *        │
│ variant opt  │  │ 1 variant ─ *    │  │ 1 vendor ─ *         │
│              │  │                  │  │                      │
└──────────────┘  └──────────────────┘  └──────────────────────┘

┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
│ material_client_ │  │ material_client_     │  │ material_units   │
│ mappings         │  │ pricing              │  │ (alternative)    │
│ 1 item ─── *     │  │ 1 item ─── *         │  │ 1 item ─── *    │
│ 1 client ─ *     │  │ 1 client ─ *         │  │                  │
└──────────────────┘  └──────────────────────┘  └──────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│ item_cate-   │      │ item_units   │      │ item_audit_logs  │
│ gories       │      │              │      │ 1 item ─── *    │
│ 1 ─── * items│      │ 1 ─── * items│      │                  │
└──────────────┘      └──────────────┘      └──────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│ company_     │◄──── │ item_stock   │      │ warehouses       │
│ variants     │────► │ item_variant_│      │ 1 ─── * stocks   │
│              │      │ pricing      │      │                  │
└──────────────┘      └──────────────┘      └──────────────────┘
```

**Cardinality Summary:**

| Relationship | Type |
|-------------|------|
| materials → item_stock | One-to-Many (per warehouse/variant) |
| materials → item_variant_pricing | One-to-Many (per variant category) |
| materials → vendor_material_pricing | One-to-Many (per vendor) |
| materials → material_client_mappings | One-to-Many (per client) |
| materials → material_client_pricing | One-to-Many (per client) |
| materials → material_units | One-to-Many (per alternative unit) |
| materials → item_audit_logs | One-to-Many |
| materials → discount_categories | Many-to-One |
| warehouses → item_stock | One-to-Many |
| company_variants → item_variant_pricing | One-to-Many |
| company_variants → item_stock | One-to-Many (optional) |
| company_variants → material_client_mappings | One-to-Many (optional) |
| clients → material_client_mappings | One-to-Many |
| clients → material_client_pricing | One-to-Many |

---

## 3. Current Item Fields

### Field Inventory with Purpose & Usage

| # | Field | Purpose | Required | Validation | Default | Used By |
|---|-------|---------|----------|------------|---------|---------|
| 1 | `name` | Primary item identifier | **Yes** | Unique per org (app-level) | — | All modules |
| 2 | `display_name` | Friendly name for quotations | No | — | Falls back to `name` | Quotations |
| 3 | `item_code` | SKU / product code | No | Unique index at DB level | Auto: `ITEM-{timestamp36}` | Inventory, Purchase, Sales, Reports |
| 4 | `main_category` | High-level category group | No | Must match seeded categories (UI-only) | — | Inventory, Reports, Filtering |
| 5 | `sub_category` | Detailed classification | No | — | — | Inventory, Reports |
| 6 | `size` | Item size specification | No | — | — | Purchase, Sales, Technical specs |
| 7 | `pressure_class` | Pressure rating (PN/Class) | No | — | — | Technical specs (MEP), Purchase |
| 8 | `make` | Brand / manufacturer | No | — | — | Purchase, Sales, Vendor mapping |
| 9 | `material` | Material of construction | No | — | — | Technical specs, Purchase |
| 10 | `end_connection` | Connection type | No | — | — | Technical specs (MEP) |
| 11 | `unit` | Base unit of measure | No | From `item_units` table | `'nos'` | Inventory, Purchase, Sales, Quotations |
| 12 | `sale_price` | Default selling price | No | Numeric, 0 if uses_variant | — | Quotations, Sales, Invoices |
| 13 | `purchase_price` | Default purchase cost | No | Numeric | — | Purchase Orders, Costing |
| 14 | `gst_rate` | GST tax rate | No | Select from: 0, 0.5, 5, 12, 18, 28 | 18 | Quotations, Invoices, Purchase |
| 15 | `hsn_code` | HSN/SAC code | No | Max 10 digits, numeric only | — | Tax/GST compliance, Invoices |
| 16 | `uses_variant` | Flag for multi-category pricing | No | Boolean | `false` | Pricing engine, UI conditional sections |
| 17 | `discount_category_id` | Links to bulk discount rules | No | FK→`discount_categories` | — | Quotations (discount engine) |
| 18 | `taxable` | Tax status classification | No | `taxable`/`non-taxable`/`non-gst supply` | `'taxable'` | Tax/GST compliance |
| 19 | `size_lwh` | Physical dimensions | No | — | — | Logistics, Shipping |
| 20 | `weight` | Item weight | No | Numeric | — | Logistics, Shipping |
| 21 | `dimension` | Dimension value | No | — | — | Logistics |
| 22 | `dimension_unit` | Unit for dimension | No | `cm` or `in` | `'cm'` | Logistics |
| 23 | `weight_unit` | Unit for weight | No | `kg` or `lb` | `'kg'` | Logistics |
| 24 | `upc` | Universal Product Code | No | — | — | Barcode/scanning |
| 25 | `mpn` | Manufacturer Part Number | No | — | — | Purchase (vendor matching) |
| 26 | `ean` | European Article Number | No | — | — | International trade |
| 27 | `part_number` | Internal part number | No | — | — | Inventory, Purchase |
| 28 | `description` | Item description | No | — | — | Quotations, Internal notes |
| 29 | `item_type` | Product vs Service | No | Enum: `product`, `service` | `'product'` | UI tabs, pricing logic |
| 30 | `item_classification` | Mfg classification | No | `finished_good`, `raw_material`, `consumable`, `goods_sold` | `'goods_sold'` | Manufacturing, BOM, Purchase/Sales flags |
| 31 | `allow_purchase` | Can be purchased | No | Boolean | `true` | Purchase module, BOM |
| 32 | `allow_sales` | Can be sold | No | Boolean | `true` | Sales module |
| 33 | `show_in_bom` | Appears in BOM | No | Boolean | `true` | Manufacturing, BOM |
| 34 | `is_manufactured` | Manufactured in-house | No | Boolean | `false` | Manufacturing, Production |
| 35 | `is_active` | Soft-delete / enable flag | No | Boolean | `true` | All modules (filtering) |
| 36 | `schedule_type` | Pipe schedule | No | — | — | MEP/Pipe specifications |

---

## 4. Pricing Architecture

### 4.1 Base Item Pricing (materials table)

Every item has a default `sale_price` and `purchase_price` on the `materials` row itself. These serve as the fallback when no variant or client-specific pricing is configured.

### 4.2 Variant Pricing (`item_variant_pricing`)

When `materials.uses_variant = true`, the base `sale_price` is set to 0 and all pricing is managed via the `item_variant_pricing` table. Each row maps:
- `item_id` → the material
- `company_variant_id` → a variant category (Retail, Wholesale, Special, etc.)
- `make` → brand/manufacturer
- `sale_price`, `purchase_price` → prices for that combination

**Price Resolution (via `get_item_price()` PostgreSQL function):**
1. If variant_id provided AND item uses variants → look up `item_variant_pricing`
2. If no variant price found → fallback to `materials.sale_price` or `materials.purchase_price`
3. If still null → return 0

### 4.3 Vendor Pricing (`vendor_material_pricing`)

Each vendor can have their own pricing per item, including:
- `base_rate` and `discount_percent`
- `is_preferred` flag
- Variant + make combination
- `vendor_item_code` for cross-reference
- `last_purchased_at` for recency tracking

### 4.4 Client Pricing (`material_client_pricing`)

Clients can have negotiated pricing per item with:
- **Pricing types:** Fixed ARC, Variable ARC, Discount, Special Price, Lumpsum
- **Validity period:** `valid_from` / `valid_to` date range
- **Status:** active, inactive, expired
- Optionally scoped to a variant category

**Price Change History:** `material_client_pricing_history` tracks changes with old/new rates and change type (`created`/`updated`/`deleted`).

### 4.5 Client Part Numbers (`material_client_mappings`)

Client-specific item identification:
- `client_part_no` — the client's own part/code for this item
- `client_description` — the client's description

This supports EDI-like integration where clients refer to items by their own codes.

### 4.6 Discount Categories (`discount_categories`)

Bulk discount grouping used in quotation workflows:
- Each item can have a single `discount_category_id`
- Categories define `default_discount_percent`, `min_discount_percent`, `max_discount_percent`
- Default categories: Standard (0-5%), Wholesale (0-15%), Distributor (0-25%)
- Referenced by quotation discount approval tables and variant discount settings

### 4.7 Architecture Summary

```
Item (materials)
  ├── Base Prices (sale_price, purchase_price)
  │
  ├── Variant Pricing (item_variant_pricing)
  │   └── Scoped by company_variant + make
  │
  ├── Vendor Pricing (vendor_material_pricing)
  │   └── Scoped by vendor + variant + make
  │
  ├── Client Pricing (material_client_pricing)
  │   └── Scoped by client + variant + validity dates
  │
  ├── Discount Categories (discount_categories)
  │   └── Bulk discount rules for quotations
  │
  └── Client Mappings (material_client_mappings)
      └── Maps client part numbers to internal items
```

---

## 5. Inventory Architecture

### 5.1 Warehouse Structure

Warehouses are managed in the `warehouses` table with a simple name/code/location model. Each warehouse can be flagged as `is_default` and `is_active`. There is no hierarchy (no parent-child warehouse structure).

### 5.2 Stock Tracking (`item_stock`)

Stock is tracked at the **item × variant × warehouse** level:
- `item_id` — which material
- `company_variant_id` — optional variant category (null if item doesn't use variants)
- `warehouse_id` — which warehouse
- `current_stock` — current quantity on hand
- `low_stock_level` — threshold for low-stock warnings
- `reorder_level` — threshold for reorder alerts

**Unique constraint:** `(item_id, company_variant_id, warehouse_id)` — one record per combination.

### 5.3 Opening Stock

Opening stock is set during item creation in the item creation form. The user:
1. Checks "Track Inventory"
2. For each warehouse, sets opening stock quantity
3. Can also mark a warehouse as "Not in this warehouse" (exclude)
4. For variant items, opening stock can be set per variant category per warehouse

The stock is written to `item_stock` via `UPSERT` on conflict of `(item_id, company_variant_id, warehouse_id)`.

### 5.4 Stock Movements (Not in Item Master — separate modules)

Stock is consumed/produced through:
- **Material Inward** (`material_inward` / `material_inward_items`) — stock increases
- **Material Outward** (`material_outward` / `material_outward_items`) — stock decreases
- **Stock Transfer** (`stock_transfer_items`) — movement between warehouses
- **Stock Adjustment** — direct quantity corrections
- **Quick Stock Check** — audit/verification

### 5.5 Stock Aggregation

The frontend computes total stock per item by summing `current_stock` across all warehouse/variant records:
```ts
stock.forEach((s) => {
  if (!stockMap[s.item_id]) stockMap[s.item_id] = 0;
  stockMap[s.item_id] += parseFloat(s.current_stock) || 0;
});
```

### 5.6 Inventory Valuation

**No formal inventory valuation method** (FIFO, weighted average, etc.) is implemented. Stock values are recorded at purchase/transaction time but no costing engine exists.

### 5.7 Reserved / Available Stock

**No reserved stock or available-to-promise (ATP)** mechanism exists. Stock is a simple quantity-on-hand model.

### 5.8 Variant Stock

When an item uses variants (`uses_variant = true`), stock is tracked per variant category. Each variant gets its own row per warehouse in `item_stock`. The stock UI in the item form shows separate sections for each variant.

---

## 6. Item Creation Flow

### 6.1 User Journey

```
User clicks "Add Material"
         │
         ▼
  ┌──────────────┐
  │  Form Opens   │  (Modal or Drawer)
  │  (empty or    │
  │   pre-filled  │
  │   for edit)   │
  └──────┬───────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 1: Select Item Classification     │
  │  (Finished Good / Raw Material /        │
  │   Consumable / Goods Sold)              │
  │  → Presets purchase/sales/BOM flags     │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 2: Basic Information              │
  │  • Item Name (required)                 │
  │  • Display Name (defaults to name)      │
  │  • Item Code/SKU (auto-generated)       │
  │  • Main Category (dropdown + add new)   │
  │  • Sub Category                         │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 3: Technical Attributes           │
  │  (Collapsible, optional)                │
  │  • Dimensions (L×W×H)                   │
  │  • Weight                               │
  │  • Size                                 │
  │  • Pressure Class                       │
  │  • Brand (Make)                         │
  │  • Material of Construction             │
  │  • End Connection                       │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 4: Commercial / Pricing           │
  │  • Unit (dropdown)                      │
  │  • Alternative Units (optional)         │
  │  • HSN/SAC Code                         │
  │  • GST Rate (dropdown)                  │
  │  • Sale Price                           │
  │  • Purchase Price                       │
  │  • Discount Category                    │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 5: Variant Pricing (if enabled)   │
  │  • Check "Uses Variant Pricing"         │
  │  • Add rows: Variant + Make + Prices    │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 6: Inventory Tracking (optional)  │
  │  • Check "Track Inventory"              │
  │  • Per warehouse: exclude + openings    │
  │  • Per variant (if enabled)             │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 7: Vendor Mapping (optional)      │
  │  • Add rows: Variant + Make + Vendor    │
  │    + Base Rate + Discount %             │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Step 8: Client Mapping (optional)      │
  │  Tab A: Client Code Mapping             │
  │    • Client + Part No + Description     │
  │  Tab B: ARC/Pricing                     │
  │    • Client + Pricing Type + Rate       │
  │    + Validity Dates                     │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  VALIDATION                             │
  │  • Duplicate name (app-level SELECT)    │
  │  • Variant pricing rows required if     │
  │    uses_variant=true                     │
  │  • HSN code numeric, max 10 digits      │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  DATABASE TRANSACTIONS                  │
  │  1. INSERT into materials               │
  │  2. DELETE+INSERT material_units        │
  │  3. DELETE+INSERT item_variant_pricing  │
  │  4. UPSERT item_stock (per warehouse)   │
  │  5. DELETE+INSERT vendor_material_pricing│
  │  6. DELETE+INSERT material_client_mappings│
  │  7. DELETE+INSERT material_client_pricing│
  │  8. INSERT into item_audit_logs         │
  │     (+ localStorage audit fallback)     │
  └─────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  CACHE UPDATE                           │
  │  • updateMaterialsCache (optimistic)    │
  │  • invalidateQueries (React Query)      │
  │  • refreshMaterials (refetch)           │
  │  • Invalidate BOM materials cache       │
  └─────────────────────────────────────────┘
```

### 6.2 Concurrent Save Protection

A `materialSavePending` flag prevents double-submissions.

### 6.3 Services Tab (separate workflow)

Services follow the same `materials` table with `item_type = 'service'`:
- Simpler form (no variants, no inventory, no vendor/client mapping)
- Listed under a separate "Services" tab in the UI
- Migration from legacy `services` table to `materials` with `item_type = 'service'` has been done

### 6.4 Bulk Item Creation

Two bulk creation modes exist:
1. **Multi-Item Modal** — Tabular input with clone-duplicate detection for variant pricing
2. **Bulk Import** — Excel/TSV/CSV file upload with validation, preview, and batch insert
3. **Excel Edit Mode** — Inline spreadsheet-style editing with field selector; supports create, update, and delete

---

## 7. Current Features

### Item Master Features

- ✓ **Item creation** (single item form, modal, and drawer)
- ✓ **Item editing** with full audit trail
- ✓ **Item deletion** with soft-archive fallback (hard-deletes only if no linked transactions)
- ✓ **Item enable/disable** (soft toggle via `is_active`)
- ✓ **Duplicate name prevention** (application-level)
- ✓ **Auto-generated item codes** with timestamp-based scheme
- ✓ **Custom item codes** (manual override)
- ✓ **Display names** separate from legal item names
- ✓ **Main categories** (seeded + user-extensible via in-form creation)
- ✓ **Sub categories** (free-text)
- ✓ **Technical attributes** — size, pressure class, schedule type, material, end connection

### Pricing Features

- ✓ **Default sale price** and **purchase price** on item
- ✓ **Multi-category variant pricing** (Retail, Wholesale, Special, etc.)
- ✓ **Variant pricing** with per-row make/brand
- ✓ **Vendor-specific pricing** with base rate, discount %, preferred flag
- ✓ **Client-specific pricing** (ARC model) with validity dates and status
- ✓ **Client part number mapping** (cross-reference client codes to internal items)
- ✓ **Client pricing history** (audit trail of rate changes)
- ✓ **Discount categories** (Standard, Wholesale, Distributor)
- ✓ **Bulk price update** (tab-separated paste tool)
- ✓ **Price resolution function** (`get_item_price` PostgreSQL function with fallback chain)

### Inventory Features

- ✓ **Warehouse management** (create, edit, activate/deactivate)
- ✓ **Per-warehouse stock tracking**
- ✓ **Per-variant stock tracking** (when variants enabled)
- ✓ **Opening stock entry** at item creation
- ✓ **Low stock level** thresholds per stock record
- ✓ **Reorder level** thresholds
- ✓ **Aggregated stock view** in item list
- ✓ **Stock adjustment** page
- ✓ **Material inward/outward** transactions
- ✓ **Stock transfer** between warehouses
- ✓ **Quick stock check** / audit
- ✓ **Stock status colors** (green = normal, red = low stock)

### Unit & Alternative Unit Features

- ✓ **Standard units** (seeded: nos, kg, mtr, sqm, sqft, cuft, ltr, bags, box, pair, set, pack)
- ✓ **Alternative units** with conversion factors (e.g., 1 box = 12 nos)
- ✓ **Combined unit loading** (from `item_units` + `custom_units`)

### Search & Filtering Features

- ✓ **Text search** by name, display name, item code, material
- ✓ **Category filter** dropdown with "All" option
- ✓ **Hide inactive** toggle
- ✓ **Configurable table columns** with user preference persistence (localStorage)
- ✓ **Column save as default**
- ✓ **Mandatory columns protection** (name, category, unit, actions cannot be hidden)
- ✓ **Pagination** (50 items per page)

### Item Detail / Workspace Features

- ✓ **Item detail workspace** (split-panel view)
- ✓ **Overview stats** — total stock, low stock warehouses, linked transactions
- ✓ **Warehouse report** tab — per-location stock breakdown
- ✓ **Stock adjustments** tab — inward/outward history with quantities
- ✓ **Quotation history** tab — linked quotation lines
- ✓ **Invoice history** tab — purchase/sales/credit/debit linked docs
- ✓ **Purchase details** tab — vendor purchase history
- ✓ **Delivery challan** tab — linked DC records
- ✓ **Audit trail** tab — full change history (DB + localStorage fallback)

### Bulk Operations

- ✓ **Multi-item creation** (tabular input with clone/duplicate detection)
- ✓ **Bulk price update** (paste tab-separated data)
- ✓ **Bulk import** (Excel/TSV/CSV with template download)
- ✓ **Excel Edit Mode** (spreadsheet-style inline editing of all fields)
- ✓ **Field selector** for Excel export/import templates

### Service Item Features

- ✓ **Service items** in same `materials` table with `item_type = 'service'`
- ✓ **Service-specific tab** with separate listing
- ✓ **Erection/service rates** sub-tab

### Manufacturing Integration Features

- ✓ **Item classification** (finished good, raw material, consumable, goods sold)
- ✓ **Classification presets** for purchase/sales/BOM flags
- ✓ **Manufacturing flag** (`is_manufactured`)
- ✓ **BOM visibility flag** (`show_in_bom`)

### Tax & Compliance Features

- ✓ **GST rate** selection (0%, 0.5%, 5%, 12%, 18%, 28%)
- ✓ **HSN/SAC code** with validation
- ✓ **Taxable status** (taxable / non-taxable / non-GST supply)
- ✓ **Inventory account** classification (finished goods / inventory asset / work in progress)

### RBAC Features

- ✓ **CRUD permissions** for materials module (read, create, update, delete)
- ✓ **PermissionGuard** component for UI-level access control

---

## 8. Missing Features

### Core Item Master Gaps

- ✗ **No formal unique constraint** at DB level on `(name, organisation_id)` — enforced in app code only (race condition possible)
- ✗ **No item image/attachment** support
- ✗ **No item documents** (datasheets, certificates, drawings)
- ✗ **No barcode** field storage (UPC exists but no barcode symbology support)
- ✗ **No serial number tracking** on items
- ✗ **No batch/lot number tracking**
- ✗ **No expiry date** management
- ✗ **No item relationship mapping** (substitutes, cross-references, bundled items, kit components)

### Pricing Gaps

- ✗ **No tiered pricing** (price breaks by quantity)
- ✗ **No multi-currency pricing**
- ✗ **No price calculation engine** (cost + margin = sale price)
- ✗ **No purchase price history** (only client pricing history exists)
- ✗ **No landing cost calculation** (duties, freight, insurance)
- ✗ **No price revision workflow** (approval for price changes)

### Inventory Gaps

- ✗ **No inventory valuation** (FIFO, weighted average, standard costing)
- ✗ **No reserved stock** / committed stock
- ✗ **No available-to-promise (ATP)** calculation
- ✗ **No bin/location** tracking within warehouses
- ✗ **No inventory aging** analysis
- ✗ **No cycle counting** workflow
- ✗ **No stock reconciliation** module
- ✗ **No minimum stock / maximum stock** levels (only low stock threshold)
- ✗ **No ABC analysis** (ABC classification for inventory optimization)
- ✗ **No inventory turnover** calculations
- ✗ **No landed cost allocation** to stock value

### Unit & Conversion Gaps

- ✗ **No automatic unit conversion** — conversion factors exist but no runtime conversion engine
- ✗ **No UOM group/dimension** validation (cannot define that kg cannot convert to mtr)

### Supplier/Vendor Gaps

- ✗ **No vendor lead time** tracking
- ✗ **No vendor quality rating**
- ✗ **No vendor catalog sync** (vendor_item_code exists but no automated sync)
- ✗ **No purchase history analytics** per item

### Search & Discovery Gaps

- ✗ **No full-text search** (PostgreSQL `tsvector`)
- ✗ **No faceted filtering** (refine by multiple attributes simultaneously)
- ✗ **No duplicate detection** at scale (fuzzy name matching)

### Audit & Compliance Gaps

- ✗ **No field-level audit trail** at DB level (uses manual app-level audit)
- ✗ **No compliance classification** (export control, hazardous material, etc.)
- ✗ **No regulatory fields** for specific industries (ISO, ASTM, ASME standards)

---

## 9. Attribute Analysis

### Current Approach: Fixed Columns

The Item Master uses a **fixed-column** approach with ~36 columns on the `materials` table. Attributes are defined at schema design time.

**Designed primarily for:** MEP (Mechanical, Electrical, Plumbing) / construction industry products:
- VALVE, PIPE, FITTING, FLANGE — pressure class, size, end connection, schedule type, material
- ELECTRICAL — basic category + generic specs
- HVAC — basic category + generic specs
- FIRE PROTECTION — basic category + generic specs

**Industry-Specific Coverage Assessment:**

| Industry | Current Coverage | Adequate? |
|----------|-----------------|-----------|
| **Mechanical** | Pressure class, size, material, end connection, make | Partial — missing torque specs, RPM, power rating |
| **Electrical** | Basic category only | **Poor** — missing voltage, current, power, phase, frequency, IP rating, wire gauge |
| **HVAC** | Size, pressure class, end connection | Partial — missing tonnage, BTU, SEER rating, refrigerant type |
| **Pumps** | Size, pressure class, material, make | Partial — missing flow rate, head, impeller size, NPSH, motor power |
| **Fire Fighting** | Pressure class, end connection, size | Partial — missing flow coefficient, sprinkler K-factor, listing/approval |
| **IT Equipment** | None specific | **Poor** — missing processor, RAM, storage, form factor, network specs |
| **Furniture** | Size/LWH, weight | **Poor** — missing color, finish, material composition, assembly specs |
| **Chemicals** | None specific | **Poor** — missing CAS number, concentration, hazard class, storage conditions |
| **Medical** | None specific | **Poor** — missing registration/license, sterilization, classification |

### Recommendation: Dynamic Product Attributes

The current fixed-column approach will **not** scale across multiple industries. A Dynamic Attribute (EAV-like or JSONB) architecture should be introduced.

#### Option A: JSONB Attributes

Store industry-specific attributes as JSONB on `materials`:

| Advantage | Disadvantage |
|-----------|-------------|
| Zero schema changes per industry | No referential integrity on attribute values |
| Simple to implement | Indexing JSONB paths is verbose |
| Flexible — any attribute anytime | Poor developer experience (no typed access) |
| Easy to extend for new industries | Complex validation logic |
| Single table query | Reporting requires JSONB extraction functions |

#### Option B: Attribute Definition System (EAV-inspired)

Separate tables: `item_attribute_definitions`, `item_attribute_values`

| Advantage | Disadvantage |
|-----------|-------------|
| Referential integrity | Complex queries with many joins |
| Attribute-level validation | Higher query complexity for listings |
| UI can auto-generate forms | Requires attribute registry management |
| Better reporting via pivot tables | Performance challenges at scale |
| Type-safe attribute values | Migration complexity from existing schema |

#### Analysis Summary

**Recommendation:** Option A (JSONB on `materials`) for Phase 1, with migration to Option B (formal attribute system) in Phase 2 only if attribute-driven search/filtering becomes a bottleneck.

**Key Decision Factors:**

| Factor | Assessment |
|--------|-----------|
| **Migration Complexity** | Medium — existing fixed columns remain as-is for common fields; JSONB column added for industry-specific extensions |
| **Performance Impact** | Low-to-Medium — JSONB queries are slower than column access but acceptable for <100K items |
| **UI Complexity** | Medium — form sections must be configurable per industry; attribute-driven dynamic form rendering needed |
| **Search Complexity** | Medium — JSONB path queries for specific attributes are possible but verbose |
| **Filtering Complexity** | High — combined filters across fixed columns + dynamic attributes require careful index design |
| **Reporting Complexity** | Medium-High — reporting tools need to know attribute schemas; requires an attribute metadata query |

**Data Migration Strategy:**
- Keep all existing fixed columns (backward compatible)
- Add `attributes JSONB` column to `materials`
- Define per-industry attribute templates in a new `industry_attribute_templates` table
- Move industry-specific fields out of fixed columns only for new items; existing data remains in fixed columns

---

## 10. Future Compatibility

| Future Module | Readiness | Assessment |
|--------------|-----------|------------|
| **Manufacturing** | **Minor Changes** | Item classification (finished_good, raw_material, consumable) already exists. BOM flags (`show_in_bom`, `is_manufactured`, `allow_purchase`, `allow_sales`) are in place. Missing: routing/operations, work center definitions, co/by-product support, and production order integration. |
| **Distribution Network** | **Major Changes** | Current warehouse model is flat with no location hierarchy. Distribution requires: multi-site inventory, transfer order workflows, inter-warehouse visibility, centralized vs. decentralized inventory models. Stock at variant×warehouse level is a good foundation but lacks the workflow layer. |
| **Dealer Portal** | **Minor Changes** | Client pricing and part number mappings exist already. Need: dealer-specific catalogs (subset of items), dealer price visibility (already has client pricing model), dealer inventory visibility (read-only). Item master is the foundation — the portal layer consumes it. |
| **Reverse Logistics** | **Minor Changes** | Item master is read-only from reverse logistics perspective. Need: return reason codes linked to items, RMA item tracking, inspection/grade classification. Item master data (supplier, make, category) is sufficient. |
| **Warranty** | **Minor Changes** | Needs warranty terms attached to items (warranty period, coverage type, claim process). Currently not on the schema but can be added as: item-level default warranty (for manufactured items), vendor-level warranty tracking (for purchased items). |
| **Serial Numbers** | **Major Changes** | No serial number infrastructure exists. Requires: serial number registry (per item), serial-to-stock movement tracking, serial number validation at inward/outward, unit-level (not bulk) tracking in transactions. Current stock model is decimal-quantity based. |
| **Batch Tracking** | **Major Changes** | No batch/lot tracking exists. Requires: batch creation with mfg/expiry dates, batch-to-stock link, batch traceability in all transactions, batch hold/release workflows. Similar scope to serial numbers. |
| **Expiry** | **Major Changes** | No expiry date field exists on any inventory table. Requires: expiry date at batch level, FIFO/FEFO allocation logic, expiry alerts/notifications, expired stock quarantine workflow. |
| **Product Recall** | **Major Changes** | Depends on serial/batch tracking. Without that foundation, recall identification is impossible. Needs: item→batch→transaction full traceability, customer notification list generation, recall status tracking on items. |
| **Vendor Portal** | **Minor Changes** | Vendor pricing (`vendor_material_pricing`) already exists with `vendor_item_code`. Need: vendor catalog sync API, vendor item availability feed, vendor price update workflow. Item master is ready for consumption. |
| **Customer Portal** | **Minor Changes** | Client pricing and part number mappings are ready. Need: customer-facing item catalog with filtered item sets, customer price visibility, customer stock inquiry (availability). |
| **AI Assistant** | **Ready** | Item master text data (name, description, technical attributes) is usable for AI training/retrieval. Need: embeddings for semantic search, standardized attribute extraction for AI parsing. No structural blockers. |

---

## 11. Scalability Review

### 10,000 Items

**Verdict: No issues.**

- Current architecture handles 10K items easily
- All queries filter by `organisation_id` with indexes
- Pagination at 50 per page works well
- No N+1 query problems in the main listing (single `useMaterialsPageData` query with 8 parallel Supabase calls)
- Stock aggregation in memory is fast (array reduce over all stock records)

### 100,000 Items

**Verdict: Minor issues — optimization needed.**

| Concern | Assessment |
|---------|-----------|
| **Query Performance** | The main listing query fetches ALL materials into memory. At 100K items, this becomes slow. Need server-side pagination with `range()` on Supabase queries. |
| **Stock Aggregation** | In-memory stock map (`stockData`) iterates all stock records. At 100K items with multiple warehouses/variants, this could be 300K+ stock records. Need aggregate query instead. |
| **Client-Side Filtering** | Search/filter is done client-side on the full dataset. At 100K, this becomes unresponsive. Need server-side filtering with `ilike` on the DB. |
| **Item Detail Workspace** | `loadItemTransactions` runs 10+ queries serially per item. Each linked table check (quotation_items, delivery_challan_items, etc.) fetches data. At 100K items, individual items with many transactions will be slow. |
| **Local Storage Audit** | localStorage `items_audit_trail_v1` stores up to 400 entries. At scale, this becomes meaningless — DB audit is the correct path. |
| **Bulk Operations** | Bulk API updates iterate sequentially over rows (not batched). At 100K, this times out. |

### 1,000,000 Items

**Verdict: Major changes required.**

| Concern | Assessment |
|---------|-----------|
| **Architecture Shift Needed** | Full dataset client-side fetch is impossible. Must implement: server-side pagination, server-side filtering, server-side search (tsvector full-text index) |
| **Database Indexes** | Current indexes are basic. Need: composite indexes for common filter combinations, partial indexes for active items, GIN index for any future JSONB attributes |
| **Item Workspace Query Complexity** | `loadItemTransactions` design (sequential per-table queries) does not scale. Need: materialized views for item transaction summaries, or a dedicated search/analytics index |
| **Variant Pricing Queries** | `loadVariantPricing` fetches all variants for an item. Fine for individual item views, but at 1M items the `item_variant_pricing` table itself has millions of rows. Need pagination on all subsidiary tables. |
| **Delete/Audit Operations** | The `deleteMaterial` function checks 11 linked tables sequentially. At scale, this needs batched async checks with timeout. |
| **Data Volume** | The `materials` table at 1M rows is fine. The concern is the aggregation and listing patterns, not the storage itself. |

### Scalability Infrastructure Recommendations

1. **Implement server-side pagination** on the main materials query (use Supabase `.range()`)
2. **Move filtering to server-side** using `ilike` for search
3. **Aggregate stock at query level** instead of in-memory
4. **Add composite indexes** for common filter patterns: `(organisation_id, is_active, main_category)`, `(organisation_id, name)`, `(organisation_id, item_code)`
5. **Consider row-level security (RLS)** for implicit org filtering rather than explicit `organisation_id` equality in queries (Supabase RLS can push this to the query planner)
6. **Add a search materialized view** with denormalized stock totals for the list view

---

## 12. Engineering Review

### 12.1 Folder Structure

```
src/
├── pages/
│   └── MaterialsList.tsx          ← 5,000+ line monolith (items, services, categories, units, warehouses, variants tabs)
│
├── components/
│   ├── ItemCreateDrawer.tsx        ← Quick-create drawer component
│   ├── ItemSelectorDrawer.tsx      ← Item selection for invoices/quotations
│   ├── SearchableItemSelect.tsx    ← Reusable searchable dropdown
│   ├── BulkImportModal.tsx         ← Bulk import via Excel/CSV
│   ├── ExcelEditor.tsx             ← Spreadsheet-style editing
│   ├── reusable/
│   │   └── ConsumableCatalogSelect.tsx
│   └── ui/                        ← Shared UI primitives
│
├── hooks/
│   ├── useMaterials.ts             ← Basic materials query
│   ├── useMaterialsPageData.tsx    ← Parallel 8-table fetch + memoized cells
│   ├── useVariants.ts              ← Company variants query
│   ├── useCombinedUnits.ts         ← Units + custom units query
│   ├── useWarehouses.ts            ← Warehouses query
│   ├── use-item-history.ts         ← Item timeline/activity
│   ├── usePermissions.ts           ← RBAC permissions
│   └── useConsumableCatalog.ts     ← Consumable catalog query + mutation
│
├── types/
│   ├── item-fields.ts              ← New field type definitions (taxable, weight, etc.)
│   └── expense.ts                  ← ConsumableCatalogItem type
│
├── rbac/
│   └── permission-catalog.ts       ← materials.read/create/update/delete
│
├── database-*.sql                  ← Scattered schema migrations (not in supabase/migrations/)
│
└── sql/
    └── 002_add_material_client_pricing_rls.sql
```

### 12.2 Strengths

- **Parallel data fetching**: `useMaterialsPageData` runs 8 Supabase queries in parallel via `Promise.all`, significantly reducing load time.
- **Memoization hygiene**: Extensive use of `useMemo`, `useCallback`, and `memo` (with dedicated `MaterialNameCell`, `MaterialStockCell`, `MemoizedTextCell`, etc.) for rendering performance.
- **Graceful degradation**: Catches missing-table errors (`42P01`) for `item_stock`, `item_categories`, `item_units`, `company_variants`, `warehouses` — enabling the app to work even when tables aren't fully migrated.
- **Local audit fallback**: When `item_audit_logs` DB insert fails, falls back to localStorage — prevents user-facing errors for audit failures.
- **Smart soft-delete**: The `deleteMaterial` function checks 11 linked tables and archives (sets `is_active=false`) instead of hard-deleting if references exist.
- **Column customization**: User-configurable visible columns with localStorage persistence and "save as default" support.
- **Bulk operations**: Multiple bulk editing modes (tabular multi-item, paste price update, Excel spreadsheet, file import).
- **Offline-friendly caching**: React Query's `staleTime: 5 min` and `gcTime: 10 min` reduce redundant network calls.

### 12.3 Weaknesses & Code Duplication

**Monolithic Component:**
- `MaterialsList.tsx` is ~5,000 lines handling 7 separate concerns: items tab, services tab, item form/modal, item workspace/detail, bulk price modal, multi-item modal, Excel editor, bulk import. This should be decomposed.
- State management within `ItemsTab` uses ~40 `useState` calls plus multiple `useEffect`, `useCallback`, and `useMemo` blocks. This is difficult to maintain and test.

**Duplicate Form Logic:**
- `MaterialsList.tsx` (inline form) and `ItemCreateDrawer.tsx` contain near-identical form rendering and submission logic. The form is duplicated rather than shared.
- Both files define the same `MAIN_CATEGORIES`, `GST_RATES` arrays.
- Both implement the same `handleSubmit` logic for variant pricing, stock, vendor mappings, client mappings.

**Duplicate Query Definitions:**
- `useMaterials.ts` queries `materials` with a specific `select` clause.
- `useMaterialsPageData.ts` queries `materials` again with a different `select` clause.
- `ItemSelectorDrawer.tsx` queries `materials` yet again inline (not through a hook).
- `SearchableItemSelect.tsx` receives materials as a prop rather than querying.

**Inconsistent Validation:**
- HSN code validation exists both in the form submission (`/^\d{1,10}$/`) and in the input `onChange` (`.replace(/\D/g, '').slice(0, 10)`).
- No shared validation schema (Zod or similar) — validation is scattered across components as inline logic.

**Race Conditions:**
- Duplicate name check is a separate SELECT before INSERT — not atomic. Two concurrent users could create the same item name.
- No database transaction wrapping for the multi-table insert flow — if a step fails mid-way, partial data is written.

**React Query Key Inconsistency:**
- `useMaterials.ts` uses `['materials', orgId]`
- `useMaterialsPageData.ts` uses `['materials-page-data', orgId]`
- `ItemSelectorDrawer.tsx` uses `['materials', searchTerm, orgId]` (different key due to search term dependency)
- `useVariants.ts` uses `['variants', orgId]`
- After save, `queryClient.invalidateQueries({ queryKey: ['materials'] })` does not invalidate `['materials-page-data', orgId]`, causing stale data.

**TypeScript Hygiene:**
- Widespread use of `any` types throughout `MaterialsList.tsx` and related files
- `MaterialsPageData` interface has `any[]` for every property — no proper typing for materials, stock, categories, etc.
- No generated types from the database schema — all types are manually maintained

**No Formal Validation Layer:**
- No Zod schemas for API input validation
- Form validation is manual and ad-hoc
- No shared TypeScript types between frontend and database (would benefit from `supabase gen types`)

### 12.4 React Query Usage Assessment

| Pattern | Status |
|---------|--------|
| Query keys consistent? | ❌ Inconsistent across hooks |
| Cache invalidation on mutation? | ⚠️ Partial — invalidates `['materials']` but not `['materials-page-data']` |
| Optimistic updates? | ❌ Manual cache update via `updateMaterialsCache` instead of `onMutate` |
| Deduplication? | ✅ React Query handles dedup |
| Stale time configured? | ✅ 5 min |
| Error boundaries? | ❌ No error boundaries |

### 12.5 RBAC Integration

- Materials CRUD permissions exist in `permission-catalog.ts`
- But the Materials List page does **not** use `PermissionGuard` or `useHasPermission` — any authenticated user can access all features
- Only route-level guards would be effective (not file-level)

---

## 13. Final Assessment

### Strengths

1. **Comprehensive feature set** — The Item Master already covers a wide range of practical MEP/construction business needs: variants, client pricing, vendor pricing, inventory, audit trail, and bulk operations.
2. **Graceful degradation patterns** — The code gracefully handles missing tables, making it resilient in incremental deployment scenarios.
3. **Performance-aware rendering** — Extensive memoization, parallel data fetching, and careful re-render management.
4. **Smart soft-delete** — The cascading reference check before deletion prevents data integrity issues while still allowing cleanup.
5. **User-configurable UI** — Column visibility, search, filters, and layout are all user-adjustable.
6. **Multi-tenant ready** — All queries filter by `organisation_id`, and most tables have RLS policies.

### Weaknesses

1. **Monolithic component** — `MaterialsList.tsx` at ~5,000 lines is the single biggest maintenance liability. It mixes concerns: listing, form, workspace, bulk operations, Excel editing.
2. **No shared form component** — Item creation/edit logic is duplicated between `MaterialsList.tsx` inline form and `ItemCreateDrawer.tsx`.
3. **Race conditions on item creation** — No database transaction wrapping the multi-table insert sequence; duplicate name check is non-atomic.
4. **No formal validation layer** — No Zod schemas, no shared validation. Inline validation is scattered and inconsistent.
5. **TypeScript `any` usage** — Widespread `any` types undermine the benefits of TypeScript.
6. **React Query inconsistency** — Multiple hook query keys and no central cache management cause stale data after mutations.

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Partial item creation if DB step fails | **High** | Wrap multi-table insert in a Supabase transaction or RPC |
| Duplicate item names from concurrent users | **Medium** | Add DB-level `UNIQUE(name, organisation_id)` constraint |
| Client-side filtering at scale | **Medium** | Move search/filter to server-side before 100K items |
| localStorage audit trail limits | **Low** | Ensure item_audit_logs table exists in all environments |
| Missing table DDL (`material_client_pricing`, `custom_units`, `consumable_catalog`) | **Medium** | Create proper migrations for all referenced tables |

### Technical Debt

1. **Schema sprawl** — Database schema is defined across ~15+ SQL files in `src/` rather than consolidated in `supabase/migrations/`. Some tables have no DDL in the repository (e.g., `material_client_pricing`, `consumable_catalog`, `custom_units`).
2. **Legacy column migration** — The `warehouses.name` → `warehouses.warehouse_name` migration is incomplete. Both columns exist.
3. **Old `services` table** — Services were migrated to `materials` but the `services` table DDL and associated code references remain.
4. **Multiple variant seeding scripts** — `database-items-variants.sql` seeds Retail/Wholesale/Special; `database-inventory.sql` seeds Default/Retail/Wholesale/Online/Export. Inconsistent defaults.
5. **No generated DB types** — All TypeScript types are hand-maintained and prone to drift from actual schema.

### Future Opportunities

1. **Consolidate all migration scripts** into proper versioned Supabase migrations
2. **Extract form logic** into a shared `ItemForm` component (React Hook Form + Zod)
3. **Add database-level unique constraint** on `(name, organisation_id)`
4. **Wrap multi-table save in a Supabase RPC** (single DB transaction)
5. **Add `supabase gen types`** to generate TypeScript types from the database
6. **Add JSONB `attributes` column** for cross-industry extensibility
7. **Implement server-side pagination** for the main materials listing query
8. **Add full-text search index** (`tsvector`) for item name + description search
9. **Extract item workspace** into a separate route/page instead of a modal overlay
10. **Add tiered pricing and multi-currency support** as a pricing engine layer
