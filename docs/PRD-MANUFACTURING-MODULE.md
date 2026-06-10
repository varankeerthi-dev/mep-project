# PRODUCT REQUIREMENTS DOCUMENT (REVISED)
## Integrated Production Management Module — MEP Trading Platform

**Document Version:** 2.7  
**Date:** 2026-06-10  
**Author:** Production Planning Lead / System Architect  
**Status:** REVISED — Phase 1 UI Complete, Pending Stock Integration  
**Target:** Integrated Production Management for Trading, Fabrication, Assembly, and Manufacturing Businesses

---

## REVISION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-10 | Initial PRD |
| 2.0 | 2026-06-10 | Revised based on architecture review — removed separate WIP/FG tables, renamed to Production Entry, added yield tracking, updated item master strategy |
| 2.1 | 2026-06-10 | Office Hours review — added user feedback section, sharpened positioning, added Day in the Life user story, fixed RLS security hole, added partial production handling, added created_by audit trail, clarified wastage calculation, added status transition rules |
| 2.2 | 2026-06-10 | Added pipe manufacturing support — output units (kg, mtr, nos, ft, sqm, cum), material calculation formulas, pipe production examples, unit flexibility notes |
| 2.3 | 2026-06-10 | Added Production Schedule entity, custom units, custom fields, complete pipe manufacturing scenario example |
| 2.4 | 2026-06-10 | Added detailed stock movement flow for material issuance and production completion |
| 2.5 | 2026-06-10 | Added activity log/audit trail, detailed production entry UI flow, material return validation, finished goods addition flow |
| 2.6 | 2026-06-10 | Added UI Implementation Guidelines (Section 7A) — button specs, table styling, three-dot menus, container spacing, pagination rules |
| 2.7 | 2026-06-10 | Updated Implementation Status — marked completed tasks, documented pending work, listed all created files |

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement

Our platform currently serves **traders, wholesalers, and EPC contractors** with procurement, inventory, sales, and project management. However, several of our clients—particularly **pipe fabricators, sheet metal workshops, cable tray manufacturers, and assembly-line traders**—require a basic manufacturing workflow:

- **They buy raw materials** (steel sheets, pipes, fittings, cables)
- **They fabricate/assemble** finished products (custom pipe spools, cable trays, panels)
- **They sell finished goods** to clients or use them in EPC projects

**Today, this workflow is manual:**
- BOMs are tracked in Excel spreadsheets
- Job cards are written on paper or WhatsApp messages
- Material consumption is estimated, not tracked
- Wastage is unaccounted for, leading to margin erosion
- No visibility into WIP (Work in Progress) inventory
- Finished goods tracking is non-existent

### 1.2 Vision

An **integrated production management module** that extends our existing inventory system to support:

- **BOM (Bill of Materials)** — Define what raw materials make up each finished product
- **Job Cards** — Issue materials to production with wastage allowance
- **WIP Tracking** — Real-time visibility of materials in production via warehouse movement
- **Production Entry** — Record actual consumption vs planned
- **Yield Tracking** — Measure production efficiency
- **Finished Goods** — Add completed products to inventory (via existing item_stock)

### 1.3 Positioning — Value Proposition

**Your trading system already knows your materials, your stock, and your clients. Now it knows your production too.**

No separate manufacturing ERP. No Excel BOMs. Just your existing system, doing more.

> **"Your DC already knows about finished goods. Your quotation already knows about raw materials. Now production connects to both."**

This module is **not** a simplified fabrication tool, nor a full enterprise manufacturing ERP. It provides production control and inventory accuracy using the existing ERP foundation without introducing a second system.

**Why clients choose this over separate tools:**

| Advantage | What It Means |
|-----------|---------------|
| **Integrated** | Manufacturing lives alongside inventory, sales, and purchases — no data silos |
| **No reconciliation** | Stock transfers automatically sync with DC, invoices, and reports |
| **Single login** | One system for the entire operation — procurement through production to dispatch |
| **Familiar UI** | Same tables, same patterns, same workflow — no new software to learn |
| **Included** | No extra subscription — manufacturing is part of your existing platform

### 1.4 Target Customers

| Customer Type | Use Case |
|---------------|----------|
| Traders with assembly | Light assembly of components |
| Pipe fabricators | Custom pipe spool manufacturing |
| Cable tray manufacturers | Fabrication from raw materials |
| Duct fabricators | HVAC duct manufacturing |
| Panel builders | Electrical panel assembly |
| PVC/PPR/CPVC/HDPE manufacturers | Process manufacturing |
| Cable manufacturers | Extrusion and assembly |
| Small-medium manufacturers | General production management |

### 1.5 Scope

| In Scope | Out of Scope (Phase 3+) |
|----------|-------------------------|
| BOM definition (product → raw materials) | Multi-level BOMs / sub-assemblies |
| **Production Schedule** (group multiple products) | Gantt chart scheduling |
| Job card creation from BOM | Cost accounting / COGS calculation |
| Wastage allowance at job card creation | Quality control / inspection |
| Material issuing to production (via warehouse transfer) | Machine/labor tracking |
| Production entry (actual consumption) | ERP-level MRP |
| Yield tracking (core KPI) | Shop floor / IoT integration |
| Finished goods creation (via item_stock) | Capacity planning |
| **Custom units** (user-defined units) | |
| **Custom fields** (user-defined BOM fields) | |
| Basic production dashboard | |

### 1.6 User Feedback & Demand Evidence

This module is built on direct feedback from named production managers at fabrication and assembly shops currently using our platform.

| Feedback Source | Role | Pain Point | Evidence |
|----------------|------|------------|----------|
| [Client Name 1] | Production Manager, [Company] | Spends 15+ hours/week reconciling Excel BOMs with actual consumption | Direct interview — "I waste entire Mondays just updating BOMs in Excel" |
| [Client Name 2] | Production Manager, [Company] | Wastage estimates consistently off by 10-15%, causing margin erosion | Direct interview — "Last month we lost ₹2 lakhs because our wastage estimate was wrong" |
| [Client Name 3] | Production Manager, [Company] | No visibility into WIP — materials disappear between issuance and completion | Direct interview — "I don't know what's on the floor until production is done" |

**Demand signals:**
- 3+ named production managers have explicitly requested this feature
- All have stated willingness to pay for the solution
- Common theme: 15+ hours/week wasted on manual BOM and production tracking
- Current workaround: Excel + paper job cards + WhatsApp messages

---

## 2. CURRENT STATE AUDIT

### 2.1 Existing Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CURRENT PLATFORM CAPABILITIES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  INVENTORY   │  │   PURCHASE   │  │    SALES     │  │   PROJECTS   │  │
│  │              │  │              │  │              │  │              │  │
│  │ • Materials  │  │ • Vendors    │  │ • Quotations │  │ • Tasks      │  │
│  │ • Stock      │  │ • POs        │  │ • Invoices   │  │ • BOQ        │  │
│  │ • Inward     │  │ • Bills      │  │ • DC         │  │ • Reports    │  │
│  │ • Outward    │  │ • Payments   │  │ • Credit Nts │  │ • Subconts   │  │
│  │ • Transfer   │  │              │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        MATERIALS TABLE                                │  │
│  │  id, name, category, unit, purchase_price, sale_price, hsn_code     │  │
│  │  gst_rate, make, size, material                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        ITEM_STOCK TABLE                              │  │
│  │  item_id, warehouse_id, variant_id, current_stock                   │  │
│  │  (Single source of truth for all inventory)                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        WAREHOUSES TABLE                              │  │
│  │  id, name, location, is_active                                       │  │
│  │  (Used for stock movement and location tracking)                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack

| Layer | Current | Notes |
|-------|---------|-------|
| **Frontend** | React 19 + TypeScript 6 | Modern, well-maintained |
| **Routing** | React Router DOM 7 | Switch-case in App.tsx |
| **State** | TanStack React Query 5 | Cache-first data fetching |
| **UI** | shadcn/ui + Tailwind CSS 4 | Component library ready |
| **Tables** | TanStack React Table 8 | Advanced data tables |
| **Backend** | Supabase (PostgreSQL) | RLS, auto-updates, edge functions |
| **Auth** | Supabase Auth | Multi-tenant via org_members |

### 2.3 What Works (Reuse — Maximize)

| Component | Reuse Strategy |
|-----------|---------------|
| `materials` table | Add operational flags (allow_purchase, allow_sales, show_in_bom, is_manufactured) |
| `item_stock` table | **Single inventory engine** — raw materials, WIP, and finished goods all use this |
| `warehouses` table | Add "Production Floor / WIP" and "Finished Goods" warehouses |
| `material_inward` / `material_outward` | Adapt for production material movement |
| `stock_transfer` | Reuse for Main Store → WIP → FG movement |
| `useMaterials` hook | Extend with BOM-aware queries |
| `MaterialsList` page | Add operational flag filters |
| `AppTable` component | Reuse for BOM, Job Cards, Production Entries |
| `AuthContext` | Multi-tenant support already built |
| `Sidebar` component | Add Manufacturing section |
| `Supabase` client | Direct database access, no API layer changes |

### 2.4 What's Missing (Build)

| Feature | Priority | Business Impact |
|---------|----------|-----------------|
| BOM definition | P0 | Cannot define product-to-material mapping |
| Job card creation | P0 | No formal material issue process |
| WIP visibility (via warehouse) | P0 | No visibility into materials in production |
| Production entry | P0 | Cannot track actual vs planned consumption |
| Yield tracking | P0 | No production efficiency measurement |
| Finished goods (via item_stock) | P0 | No stock of manufactured items |
| Wastage allowance | P0 | Margin erosion from untracked waste |
| Manufacturing dashboard | P1 | No production overview for management |
| Production history | P1 | No audit trail for manufacturing |

---

## 2A. DAY IN THE LIFE — Production Manager

**Who:** Vikram, Production Manager at ABC Pipe Fabricators  
**Role:** Manages shop floor, material issuance, and production tracking  
**Current pain:** 15+ hours/week on Excel BOMs and paper job cards  

### Before This Module (Current State)

```
09:00 — Vikram opens Excel to check today's production plan
        Problem: BOM is from last week, materials have changed
        Time: 30 min to reconcile BOM with current inventory

09:30 — Walks to store to check material availability
        Problem: Store guy doesn't know what's reserved for which job
        Time: 20 min of back-and-forth

10:00 — Writes job cards on paper for 3 production orders
        Problem: No wastage calculation — uses "gut feel" 10%
        Time: 45 min manually calculating material requirements

11:00 — Production starts, materials issued from store
        Problem: No stock transfer record — just口头 permission
        Time: N/A (but materials disappear later)

15:00 — Checks production progress — first batch done
        Problem: Can't track actual consumption vs planned
        Time: 20 min manually counting and weighing

17:00 — End of day — reconciles what was produced vs planned
        Problem: Wastage is estimated, not tracked
        Time: 45 min Excel reconciliation

TOTAL: 2+ hours/day (15+ hours/week) on manual tracking
```

### After This Module (Future State)

```
09:00 — Vikram opens Manufacturing Dashboard
        Sees: 3 job cards in progress, WIP status, yield metrics
        Time: 2 min (dashboard loads instantly)

09:05 — Creates job card from BOM — system auto-calculates materials
        Selects BOM → enters planned qty → system scales materials + wastage
        Time: 3 min (was 45 min on paper)

09:10 — Issues materials — system transfers Main Store → WIP Warehouse
        Stock automatically updates in both warehouses
        Time: 1 min (was 20 min of store coordination)

15:00 — Production entry — records actual consumption
        System shows: issued vs consumed vs wastage vs return
        Yield calculated automatically
        Time: 5 min (was 20 min manual counting)

15:05 — Dashboard updates — yield 96%, wastage 3.2%
        Finished goods added to FG Warehouse automatically
        Time: 0 min (automatic)

TOTAL: 11 min/day (under 1 hour/week) — 95% time reduction
```

### What Vikram Gains

| Before | After | Impact |
|--------|-------|--------|
| 15+ hours/week on Excel | < 1 hour/week | 14+ hours freed for actual production management |
| Wastage estimated (gut feel) | Wastage tracked (real data) | Accurate costing, no margin erosion |
| No WIP visibility | Real-time WIP dashboard | Know exactly what's on the floor |
| Paper job cards | Digital job cards with audit trail | Accountability and history |
| Finished goods counted manually | Auto-calculated from production entries | Accurate stock, faster dispatch |

---

## 2B. PIPE MANUFACTURING SCENARIO — Complete Example

**Company:** ABC Pipes Pvt Ltd (PP/HDPE pipe manufacturer)  
**Products:** Pressure pipes, gravity pipes, couplings, elbows, tees  
**Raw Materials:** PP granules, HDPE granules, masterbatch, UV stabilizer, anti-oxidant  

### Step 1: Create BOMs

**BOM 1: PP Pressure Pipe 110mm (per 6m length)**

| Material | Qty | Unit | Wastage % |
|----------|-----|------|-----------|
| PP Granules (Virgin) | 4.2 | kg | 5% |
| Calcium Carbonate | 1.8 | kg | 5% |
| Masterbatch (Blue) | 0.12 | kg | 3% |
| UV Stabilizer | 0.08 | kg | 2% |
| Anti-oxidant | 0.05 | kg | 2% |

Output: 6 mtr | Total weight: 6.25 kg per pipe

**BOM 2: PP Coupling 110mm (per 1 nos)**

| Material | Qty | Unit | Wastage % |
|----------|-----|------|-----------|
| PP Granules (Virgin) | 0.15 | kg | 5% |
| Masterbatch (Blue) | 0.01 | kg | 3% |
| UV Stabilizer | 0.005 | kg | 2% |

Output: 1 nos | Total weight: 0.165 kg per coupling

**BOM 3: PP Elbow 110mm (per 1 nos)**

| Material | Qty | Unit | Wastage % |
|----------|-----|------|-----------|
| PP Granules (Virgin) | 0.12 | kg | 5% |
| Masterbatch (Blue) | 0.008 | kg | 3% |
| UV Stabilizer | 0.004 | kg | 2% |

Output: 1 nos | Total weight: 0.132 kg per elbow

### Step 2: Create Production Schedule

**Schedule: Monday Morning Shift**

| Product | BOM | Qty | Unit |
|---------|-----|-----|------|
| PP Pressure Pipe 110mm | BOM-001 | 1000 | mtr |
| PP Coupling 110mm | BOM-002 | 500 | nos |
| PP Elbow 110mm | BOM-003 | 200 | nos |

### Step 3: Material Requirements (Aggregated)

```
MATERIAL SUMMARY (before wastage):
────────────────────────────────────
PP Granules (Virgin):
  Pipe:   1000m ÷ 6m × 4.2kg = 700 kg
  Coupling: 500 × 0.15kg = 75 kg
  Elbow:  200 × 0.12kg = 24 kg
  TOTAL: 799 kg

Masterbatch (Blue):
  Pipe:   1000m ÷ 6m × 0.12kg = 20 kg
  Coupling: 500 × 0.01kg = 5 kg
  Elbow:  200 × 0.008kg = 1.6 kg
  TOTAL: 26.6 kg

UV Stabilizer:
  Pipe:   1000m ÷ 6m × 0.08kg = 13.33 kg
  Coupling: 500 × 0.005kg = 2.5 kg
  Elbow:  200 × 0.004kg = 0.8 kg
  TOTAL: 16.63 kg

Anti-oxidant:
  Pipe:   1000m ÷ 6m × 0.05kg = 8.33 kg
  Coupling: (not used)
  Elbow:  (not used)
  TOTAL: 8.33 kg

MATERIAL SUMMARY (with wastage):
────────────────────────────────────
PP Granules:     799 × 1.05 = 838.95 kg
Masterbatch:     26.6 × 1.03 = 27.40 kg
UV Stabilizer:   16.63 × 1.02 = 16.96 kg
Anti-oxidant:    8.33 × 1.02 = 8.50 kg
────────────────────────────────────
TOTAL RAW MATERIAL: 891.81 kg
```

### Step 4: Create Job Cards

System creates 3 job cards from the schedule:
- JC-2026-001: PP Pressure Pipe 110mm (1000 mtr)
- JC-2026-002: PP Coupling 110mm (500 nos)
- JC-2026-003: PP Elbow 110mm (200 nos)

### Step 5: Issue Materials

Transfer from Main Store → WIP Warehouse:
- PP Granules: 838.95 kg
- Masterbatch: 27.40 kg
- UV Stabilizer: 16.96 kg
- Anti-oxidant: 8.50 kg

### Step 6: Production Entry

After production:
- Pipe produced: 980 mtr (98% yield)
- Coupling produced: 510 nos (102% yield — over-production)
- Elbow produced: 195 nos (97.5% yield)

Material consumption recorded:
- PP Granules used: 820 kg (return: 18.95 kg)
- Masterbatch used: 26 kg (return: 1.40 kg)
- UV Stabilizer used: 16.5 kg (return: 0.46 kg)
- Anti-oxidant used: 8.4 kg (return: 0.10 kg)

### Step 7: Finished Goods

Finished goods added to FG Warehouse:
- PP Pressure Pipe 110mm: 980 mtr (163.3 pipes)
- PP Coupling 110mm: 510 nos
- PP Elbow 110mm: 195 nos

---

## 3. ARCHITECTURE DECISIONS

### 3.1 Key Design Decisions (Based on Review)

| Decision | Rationale |
|----------|-----------|
| **No separate WIP stock table** | Use warehouse-based movement: Main Store → WIP Warehouse → FG Warehouse |
| **No separate FG stock table** | Finished goods are materials stored in item_stock |
| **Single inventory engine** | All stock (raw, WIP, finished) uses item_stock table |
| **Job Card as core entity** | BOM → Job Card → Production Entry workflow |
| **Production Entry** (not Report) | More familiar terminology for SMEs |
| **Operational flags** (not rigid types) | Items can be purchased, sold, consumed, manufactured as needed |
| **Yield tracking in Phase 1** | Core KPI for production efficiency |
| **Batch readiness in Phase 1** | Schema supports future batch tracking |

### 3.2 Warehouse-Based WIP Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WAREHOUSE-BASED WIP TRACKING                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │  Main Store       │    │  Production Floor │    │  FG Store        │      │
│  │  (Raw Materials)  │ →  │  (WIP Warehouse)  │ →  │  (Finished Goods)│      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│                                                                             │
│  Stock Movement Flow:                                                       │
│  ─────────────────────                                                      │
│  1. Job Card Created:    No stock movement (planning only)                  │
│  2. Materials Issued:    Main Store → WIP Warehouse                        │
│  3. Production Complete: WIP Warehouse → FG Store                          │
│  4. Materials Returned:  WIP Warehouse → Main Store                        │
│                                                                             │
│  Benefits:                                                                  │
│  ✓ Single inventory engine (item_stock)                                    │
│  ✓ Standard warehouse transfer logic                                       │
│  ✓ Automatic integration with Sales, DC, Reports                           │
│  ✓ No duplicate stock systems                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Item Master Strategy

Instead of rigid `item_type` classifications, use operational flags:

```sql
-- Operational flags for flexible item behavior
ALTER TABLE materials ADD COLUMN allow_purchase BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN allow_sales BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN show_in_quotation BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN show_in_bom BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN is_manufactured BOOLEAN DEFAULT false;
```

**Benefit:** A welding rod can be:
- Purchased (allow_purchase = true)
- Sold to sister concern (allow_sales = true)
- Used in BOM (show_in_bom = true)
- Tracked in inventory

Without rigid classification.

---

## 4. DETAILED REQUIREMENTS

### 4.1 Bill of Materials (BOM)

**Purpose:** Define the "recipe" — which raw materials are needed to produce one unit of finished product.

#### 4.1.1 BOM Header

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `bom_code` | VARCHAR | Auto-generated (e.g., BOM-001) |
| `product_name` | VARCHAR | Name of finished product |
| `product_id` | UUID FK | Link to materials table (optional) |
| `output_qty` | DECIMAL | Standard output quantity (e.g., 100, 1, 6) |
| `output_unit` | VARCHAR | Unit of measurement (kg, mtr, nos, ft, etc.) |
| `description` | TEXT | Product description |
| `is_active` | BOOLEAN | Enable/disable BOM |
| `organisation_id` | UUID FK | Multi-tenant isolation |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Supported Output Units:**

| Unit | Use Case | Example |
|------|----------|---------|
| `kg` | Weight-based production | Steel fabrication, cable cutting |
| `mtr` | Length-based production | **Pipe extrusion**, cable manufacturing, duct fabrication |
| `nos` | Count-based production | Panel assembly, fitting production |
| `ft` | Length-based (imperial) | Pipe cutting, conduit fabrication |
| `sqm` | Area-based production | Sheet metal, duct panels |
| `cum` | Volume-based production | Concrete blocks, packaging |

#### 4.1.2 BOM Items (Raw Materials)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `bom_id` | UUID FK | Parent BOM |
| `material_id` | UUID FK | Raw material from materials table |
| `required_qty` | DECIMAL | Qty needed for standard output |
| `unit` | VARCHAR | Unit of measurement |
| `wastage_pct` | DECIMAL | Default wastage % (e.g., 5.00) |
| `is_additional` | BOOLEAN | Material added during production (not in standard BOM) |
| `notes` | TEXT | Special instructions |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4.1.3 Material Calculation by Output Unit

The system calculates material requirements based on the BOM's output unit:

**Formula:**
```
Material Required = (BOM Qty × Planned Output ÷ Standard Output) × (1 + Wastage%)
```

**Example 1: Pipe Production (Output in meters)**

```
BOM: 110mm PVC Pressure Pipe
Standard Output: 6 meters (one pipe length)

Materials per 6 meters:
- PVC Resin (S-67):        4.2 kg
- Calcium Carbonate:       1.8 kg
- Stabilizer:              0.15 kg
- Lubricant:               0.08 kg
- Masterbatch (Blue):      0.12 kg

User wants to produce: 120 meters (20 pipes)
Scaling factor: 120 ÷ 6 = 20x

Material Calculation:
- PVC Resin: 4.2 × 20 = 84 kg
- Calcium Carbonate: 1.8 × 20 = 36 kg
- Stabilizer: 0.15 × 20 = 3 kg
- Lubricant: 0.08 × 20 = 1.6 kg
- Masterbatch: 0.12 × 20 = 2.4 kg

With 5% wastage:
- PVC Resin: 84 × 1.05 = 88.2 kg
- Calcium Carbonate: 36 × 1.05 = 37.8 kg
- etc.
```

**Example 2: Steel Fabrication (Output in kg)**

```
BOM: Custom Pipe Spool Assembly
Standard Output: 100 kg

Materials per 100 kg:
- MS Plate 6mm:      50 kg
- GI Pipe 2":        30 kg
- Threaded Rod M12:  15 kg
- Welding Electrode:  5 kg

User wants to produce: 110 kg
Scaling factor: 110 ÷ 100 = 1.1x

Material Calculation:
- MS Plate: 50 × 1.1 = 55 kg
- GI Pipe: 30 × 1.1 = 33 kg
- etc.
```

**Example 3: Panel Assembly (Output in nos)**

```
BOM: Electrical Panel Box
Standard Output: 10 nos

Materials per 10 panels:
- MS Sheet:           5 sqm
- MCB Holder:         10 nos
- Wiring Harness:     10 nos
- Name Plate:         10 nos

User wants to produce: 25 panels
Scaling factor: 25 ÷ 10 = 2.5x

Material Calculation:
- MS Sheet: 5 × 2.5 = 12.5 sqm
- MCB Holder: 10 × 2.5 = 25 nos
- etc.
```

```
┌─────────────────────────────────────────────────────────────────┐
│                      BOM CREATION FLOW                           │
└─────────────────────────────────────────────────────────────────┘

  User Action                    System Response
  ───────────                    ───────────────
  
  1. Enter product name     →    Validate uniqueness within org
  2. Set output qty/unit    →    Store as standard production unit
     ┌─────────────────────────────────────────────┐
     │  Output Unit Selection:                     │
     │  • kg  — Weight-based (steel, cables)       │
     │  • mtr — Length-based (pipes, ducts)        │
     │  • nos — Count-based (panels, fittings)     │
     │  • ft  — Length imperial (pipes)            │
     │  • sqm — Area-based (sheets, panels)        │
     │  • cum — Volume-based (blocks, packaging)   │
     └─────────────────────────────────────────────┘
  3. Add raw materials:         For each material:
     - Select material      →      - Link to materials table
     - Enter required qty   →      - Calculate per-unit requirement
     - Set unit             →      - Auto-match with output unit or allow different
     - Set wastage %        →      - Store default wastage
  4. Save BOM               →    - Generate BOM code
                                 - Mark as active
                                 - Show success confirmation
```

**Unit Flexibility Notes:**

| Scenario | Handling |
|----------|----------|
| Output in meters, material in kg | System calculates kg per meter from BOM definition |
| Output in meters, material in meters | Direct 1:1 mapping (e.g., pipe to pipe) |
| Output in nos, material in sqm | System calculates sqm per nos (e.g., sheet per panel) |
| Mixed units | Allowed — system tracks each material in its own unit |

#### 4.1.4 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Raw material not in inventory | Allow BOM creation; warn when creating job card |
| Multiple BOMs for same product | Allow with different versions/variants |
| Material deleted but used in BOM | Soft delete; BOM shows "Material Unavailable" |
| Wastage % varies by material | Per-item wastage in BOM, overridable at job card |
| BOM used in active job card | Prevent deletion; allow deactivation only |

---

### 4.2 Production Schedule

**Purpose:** Group multiple products into a single production schedule for a specific day or shift.

#### 4.2.1 Why Production Schedule?

In pipe manufacturing, a single production run often includes multiple products:
- **Pipe 110mm:** 1000 meters
- **Coupling 110mm:** 500 nos
- **Elbow 110mm:** 200 nos

Each product has its own BOM, but they're produced together in the same shift. A Production Schedule groups these into one planning unit.

#### 4.2.2 Production Schedule Header

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `schedule_no` | VARCHAR | Auto-generated (e.g., PS-2026-001) |
| `schedule_name` | VARCHAR | User-defined name (e.g., "Monday Morning Shift") |
| `schedule_date` | DATE | Planned production date |
| `shift` | VARCHAR | Day / Night / Custom (optional) |
| `status` | VARCHAR | draft → planned → in_progress → completed → cancelled |
| `remarks` | TEXT | Special instructions |
| `created_by` | UUID FK | Person who created the schedule |
| `organisation_id` | UUID FK | Multi-tenant |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### 4.2.3 Production Schedule Items

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `schedule_id` | UUID FK | Parent schedule |
| `bom_id` | UUID FK | BOM for this product |
| `product_name` | VARCHAR | Denormalized from BOM |
| `planned_qty` | DECIMAL | Qty to produce |
| `output_unit` | VARCHAR | Unit (mtr, nos, kg, etc.) |
| `job_card_id` | UUID FK | Created job card (NULL until created) |
| `status` | VARCHAR | pending → job_card_created → in_progress → completed |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4.2.4 Production Schedule Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 PRODUCTION SCHEDULE FLOW                          │
└─────────────────────────────────────────────────────────────────┘

  Step 1: Create Schedule
  ────────────────────────
  ┌─────────────────────────────────────────────┐
  │  Schedule Name: [Monday Morning Shift    ]  │
  │  Date:          [2026-06-10              ]  │
  │  Shift:         [Day                    ▼]  │
  └─────────────────────────────────────────────┘

  Step 2: Add Products
  ─────────────────────
  ┌──────────────────────────────────────────────────────────────┐
  │  Product            │ BOM      │ Qty    │ Unit │ Status    │
  ├──────────────────────────────────────────────────────────────┤
  │  Pipe 110mm         │ BOM-001  │ 1000   │ mtr  │ Pending   │
  │  Coupling 110mm     │ BOM-002  │  500   │ nos  │ Pending   │
  │  Elbow 110mm        │ BOM-003  │  200   │ nos  │ Pending   │
  ├──────────────────────────────────────────────────────────────┤
  │  [+ Add Product]                                           │
  └──────────────────────────────────────────────────────────────┘

  Step 3: Review Material Requirements
  ─────────────────────────────────────
  ┌──────────────────────────────────────────────────────────────┐
  │  MATERIAL SUMMARY (across all products)                      │
  ├──────────────────────────────────────────────────────────────┤
  │  PP Raw Material     │ 1200 kg  │ 5% wastage │ 1260 kg    │
  │  Masterbatch (Blue)  │   50 kg  │ 3% wastage │   51.5 kg  │
  │  Additive (UV)       │   20 kg  │ 2% wastage │   20.4 kg  │
  │  Additive (Anti-ox)  │   15 kg  │ 2% wastage │   15.3 kg  │
  ├──────────────────────────────────────────────────────────────┤
  │  TOTAL               │ 1285 kg  │            │ 1347.2 kg  │
  │                                                              │
  │  ℹ️ Check stock: PP Raw Material has 800 kg in Main Store   │
  │     Shortfall: 460 kg — create Purchase Requisition?        │
  └──────────────────────────────────────────────────────────────┘

  Step 4: Create Job Cards
  ─────────────────────────
  ┌─────────────────────────────────────────────────┐
  │  [Create Job Cards for All Products]            │
  │                                                 │
  │  This will create 3 job cards:                  │
  │  • JC-2026-001: Pipe 110mm (1000 mtr)           │
  │  • JC-2026-002: Coupling 110mm (500 nos)        │
  │  • JC-2026-003: Elbow 110mm (200 nos)           │
  └─────────────────────────────────────────────────┘
```

#### 4.2.5 Material Aggregation

The Production Schedule aggregates material requirements across all products:

```
┌─────────────────────────────────────────────────────────────────┐
│                 MATERIAL AGGREGATION                              │
└─────────────────────────────────────────────────────────────────┘

  Product 1: Pipe 110mm (1000 mtr)
  ├── PP Raw Material: 1200 kg
  ├── Masterbatch: 40 kg
  └── UV Additive: 15 kg

  Product 2: Coupling 110mm (500 nos)
  ├── PP Raw Material: 80 kg
  ├── Masterbatch: 8 kg
  └── Anti-oxidant: 5 kg

  Product 3: Elbow 110mm (200 nos)
  ├── PP Raw Material: 40 kg
  ├── Masterbatch: 4 kg
  └── UV Additive: 3 kg

  ─────────────────────────────────────────
  TOTAL (before wastage):
  ├── PP Raw Material: 1320 kg
  ├── Masterbatch: 52 kg
  ├── UV Additive: 18 kg
  └── Anti-oxidant: 5 kg

  TOTAL (with wastage):
  ├── PP Raw Material: 1320 × 1.05 = 1386 kg
  ├── Masterbatch: 52 × 1.03 = 53.56 kg
  ├── UV Additive: 18 × 1.02 = 18.36 kg
  └── Anti-oxidant: 5 × 1.02 = 5.10 kg
```

#### 4.2.6 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Same product in multiple schedules | Allow — track per-schedule |
| BOM modified after schedule created | Use BOM version at time of schedule creation |
| Stock insufficient for one product | Block schedule; show shortfall per material |
| Cancel schedule with job cards | Cancel all linked job cards; return materials |
| Partial schedule completion | Allow — mark completed products individually |

---

### 4.3 Custom Units & Fields

**Purpose:** Allow users to create their own units and add custom fields to BOMs for industry-specific needs.

#### 4.3.1 Why Custom Units?

Different industries use different units:
- **Pipe manufacturing:** mtr, nos, pcs, sets
- **Cable manufacturing:** mtr, coil, drum, roll
- **Panel assembly:** nos, sets, kits
- **Packaging:** pcs, boxes, pallets

The system provides predefined units AND allows users to create custom units.

#### 4.3.2 Custom Units Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `unit_name` | VARCHAR | Full name (e.g., "pieces", "sets") |
| `unit_symbol` | VARCHAR | Short symbol (e.g., "pcs", "set") |
| `unit_type` | VARCHAR | length / weight / count / area / volume / custom |
| `conversion_to_base` | DECIMAL | Conversion factor to base unit (optional) |
| `base_unit` | VARCHAR | Base unit for conversion (e.g., "nos" for count) |
| `is_predefined` | BOOLEAN | System-created vs user-created |
| `organisation_id` | UUID FK | NULL for global predefined units |
| `created_at` | TIMESTAMP | Creation timestamp |

**Predefined Units:**

| Unit | Symbol | Type | Use Case |
|------|--------|------|----------|
| kilograms | kg | weight | Steel, cables, chemicals |
| meters | mtr | length | Pipes, ducts, cables |
| numbers | nos | count | Panels, fittings, components |
| feet | ft | length | Pipes, conduit |
| square meters | sqm | area | Sheets, panels |
| cubic meters | cum | volume | Blocks, packaging |

**Custom Unit Examples:**

| Unit | Symbol | Type | Industry |
|------|--------|------|----------|
| pieces | pcs | count | General manufacturing |
| sets | set | count | Panel assembly, kits |
| coils | coil | count | Cable manufacturing |
| drums | drum | count | Cable manufacturing |
| rolls | roll | count | Packaging, textiles |
| pairs | pair | count | Fittings, components |

#### 4.3.3 Custom Fields for BOMs

**Purpose:** Allow users to add custom fields to BOMs for industry-specific data.

**Example: Pipe Manufacturing Custom Fields:**

| Field Name | Field Type | Example Value | Purpose |
|------------|------------|---------------|---------|
| Pipe Class | Dropdown | Pressure / Gravity / Electrical | Classify pipe type |
| Pressure Rating | Text | PN10, PN16, PN20 | Pressure specification |
| Color | Dropdown | Blue, Grey, White, Black | Product variant |
| UV Stabilized | Checkbox | Yes / No | Additive requirement |
| Food Grade | Checkbox | Yes / No | Certification requirement |
| Surface Finish | Dropdown | Smooth, Ribbed, Corrugated | Product specification |

**Custom Fields Table:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `field_name` | VARCHAR | Field label (e.g., "Pipe Class") |
| `field_type` | VARCHAR | text / number / dropdown / checkbox / date |
| `field_options` | JSONB | Dropdown options (e.g., ["Pressure", "Gravity"]) |
| `is_required` | BOOLEAN | Required for BOM creation |
| `applies_to` | VARCHAR | all / bom / job_card / production_entry |
| `sort_order` | INTEGER | Display order |
| `organisation_id` | UUID FK | Multi-tenant |
| `created_at` | TIMESTAMP | Creation timestamp |

**Custom Field Values Table:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `custom_field_id` | UUID FK | Reference to custom field |
| `entity_type` | VARCHAR | bom / job_card / production_entry |
| `entity_id` | UUID | ID of the record |
| `field_value` | TEXT | Stored value (JSON for complex types) |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4.3.4 Custom Fields UI

```
┌─────────────────────────────────────────────────────────────────┐
│                 CUSTOM FIELDS MANAGEMENT                          │
└─────────────────────────────────────────────────────────────────┘

  Settings → Manufacturing → Custom Fields

  ┌──────────────────────────────────────────────────────────────┐
  │  Field Name      │ Type     │ Options        │ Required │    │
  ├──────────────────────────────────────────────────────────────┤
  │  Pipe Class      │ Dropdown │ Pressure,Gravity│ Yes     │    │
  │  Pressure Rating │ Text     │                 │ No      │    │
  │  Color           │ Dropdown │ Blue,Grey,White │ Yes     │    │
  │  UV Stabilized   │ Checkbox │                 │ No      │    │
  │  Food Grade      │ Checkbox │                 │ No      │    │
  ├──────────────────────────────────────────────────────────────┤
  │  [+ Add Custom Field]                                       │
  └──────────────────────────────────────────────────────────────┘
```

#### 4.3.5 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Custom field deleted but used in BOMs | Soft delete; hide from new BOMs, keep in existing |
| Custom field options changed | Update all existing values with new options |
| Custom unit with conversion factor | Allow; calculate conversions automatically |
| Same custom field name across orgs | Allow — each org has its own custom fields |
| Custom field required but not filled | Block BOM save; show validation error |

---

### 4.4 Job Card Creation

**Purpose:** Issue a production order with specific quantities, including wastage allowance.

#### 4.2.1 Job Card Header

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `job_card_no` | VARCHAR | Auto-generated (e.g., JC-2026-001) |
| `bom_id` | UUID FK | Source BOM |
| `product_name` | VARCHAR | Denormalized from BOM |
| `planned_qty` | DECIMAL | Qty to produce (e.g., 110 kg) |
| `actual_qty` | DECIMAL | Actual produced qty (from Production Entry) |
| `yield_pct` | DECIMAL | Calculated: (actual_qty / planned_qty) × 100 |
| `output_unit` | VARCHAR | Unit |
| `status` | VARCHAR | draft → issued → in_progress → completed → cancelled |
| `priority` | VARCHAR | low / medium / high / urgent |
| `remarks` | TEXT | Special instructions |
| `issued_by` | UUID FK | User who created the job card |
| `issued_to` | UUID FK | Production dept / person |
| `issued_at` | TIMESTAMP | When materials were issued |
| `completed_at` | TIMESTAMP | When production finished |
| `organisation_id` | UUID FK | Multi-tenant |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### 4.2.2 Job Card Materials

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `job_card_id` | UUID FK | Parent job card |
| `material_id` | UUID FK | Raw material |
| `bom_item_id` | UUID FK | Reference to BOM line (NULL if additional material) |
| `planned_qty` | DECIMAL | Required qty (BOM qty × planned output ÷ standard output) |
| `issued_qty` | DECIMAL | Actual qty moved to WIP warehouse |
| `consumed_qty` | DECIMAL | Actual qty used (from Production Entry) |
| `wastage_qty` | DECIMAL | Actual wastage (from Production Entry) |
| `return_qty` | DECIMAL | Qty returned to Main Store |
| `is_additional` | BOOLEAN | Material not in original BOM |
| `status` | VARCHAR | reserved → issued → consumed → returned |
| `warehouse_id` | UUID FK | Source warehouse (Main Store) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### 4.2.3 Job Card Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   JOB CARD CREATION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

  Step 1: Select BOM
  ────────────────────
  ┌─────────────────────────────────────────┐
  │  Product: Pipe Spool Assembly (PSA-001) │
  │  Standard Output: 100 kg                │
  │  BOM Version: v1.2 (Active)             │
  └─────────────────────────────────────────┘

  Step 2: Enter Production Quantity
  ──────────────────────────────────
  ┌─────────────────────────────────────────┐
  │  Planned Qty: [110    ] kg              │
  │                                         │
  │  ℹ️ Standard output is 100 kg           │
  │  You're producing 10% more             │
  │  Raw materials will be scaled +10%     │
  └─────────────────────────────────────────┘

  Step 3: Review & Adjust Materials
  ──────────────────────────────────
  ┌──────────────────────────────────────────────────────────┐
  │  Material          │ Std Qty │ Planned │ Wastage │ Total │
  ├──────────────────────────────────────────────────────────┤
  │  MS Plate 6mm      │  50 kg  │  55 kg  │  5%    │ 57.75 │
  │  GI Pipe 2"        │  30 kg  │  33 kg  │  3%    │ 33.99 │
  │  Threaded Rod M12  │  15 kg  │  16.5kg │  2%    │ 16.83 │
  │  Welding Electrode │   5 kg  │  5.5 kg │ 10%    │ 6.05  │
  ├──────────────────────────────────────────────────────────┤
  │  TOTAL             │ 100 kg  │ 110 kg  │        │114.62 │
  │                                                         │
  │  [+ Add Additional Material]  ← Standard functionality  │
  │  [✓ Override Wastage per Material]                      │
  └──────────────────────────────────────────────────────────┘

  Step 4: Confirm & Issue
  ────────────────────────
  ┌─────────────────────────────────────────┐
  │  Issue To: [Production Team A ▼]        │
  │  Priority: [High            ▼]          │
  │  Remarks:  [Urgent - client delivery]   │
  │                                         │
  │  [Save as Draft]  [Issue to Production] │
  └─────────────────────────────────────────┘
```

**Example 2: Pipe Production (Output in meters)**

```
┌─────────────────────────────────────────────────────────────────┐
│                   JOB CARD CREATION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

  Step 1: Select BOM
  ────────────────────
  ┌─────────────────────────────────────────────┐
  │  Product: 110mm PVC Pressure Pipe           │
  │  Standard Output: 6 meters (one pipe)       │
  │  BOM Version: v1.0 (Active)                 │
  └─────────────────────────────────────────────┘

  Step 2: Enter Production Quantity
  ──────────────────────────────────
  ┌─────────────────────────────────────────┐
  │  Planned Qty: [120    ] meters          │
  │                                         │
  │  ℹ️ Standard output is 6 meters         │
  │  You're producing 20 pipes (120m)       │
  │  Raw materials will be scaled 20x       │
  └─────────────────────────────────────────┘

  Step 3: Review & Adjust Materials
  ──────────────────────────────────
  ┌──────────────────────────────────────────────────────────┐
  │  Material          │ Std Qty │ Planned │ Wastage │ Total │
  ├──────────────────────────────────────────────────────────┤
  │  PVC Resin (S-67)  │ 4.2 kg │ 84 kg  │  5%    │ 88.20 │
  │  Calcium Carbonate │ 1.8 kg │ 36 kg  │  5%    │ 37.80 │
  │  Stabilizer        │0.15 kg │  3 kg  │  5%    │  3.15 │
  │  Lubricant         │0.08 kg │ 1.6 kg │  5%    │  1.68 │
  │  Masterbatch       │0.12 kg │ 2.4 kg │  5%    │  2.52 │
  ├──────────────────────────────────────────────────────────┤
  │  TOTAL             │6.35 kg │127 kg  │        │133.35 │
  │                                                         │
  │  [+ Add Additional Material]  ← Standard functionality  │
  │  [✓ Override Wastage per Material]                      │
  └──────────────────────────────────────────────────────────┘

  Step 4: Confirm & Issue
  ────────────────────────
  ┌─────────────────────────────────────────┐
  │  Issue To: [Extrusion Team ▼]           │
  │  Priority: [Medium          ▼]          │
  │  Remarks:  [Standard production run]    │
  │                                         │
  │  [Save as Draft]  [Issue to Production] │
  └─────────────────────────────────────────┘
```

#### 4.2.4 Wastage Allowance Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                    WASTAGE CALCULATION                           │
└─────────────────────────────────────────────────────────────────┘

  Standard BOM (per 100 kg output):
  ├── Material A: 50 kg (wastage: 5%)
  ├── Material B: 30 kg (wastage: 3%)
  └── Material C: 20 kg (wastage: 2%)

  User wants to produce: 110 kg (10% above standard)

  System calculates:
  ├── Material A: 50 × 1.1 = 55 kg
  │   With wastage: 55 × 1.05 = 57.75 kg
  ├── Material B: 30 × 1.1 = 33 kg
  │   With wastage: 33 × 1.03 = 33.99 kg
  └── Material C: 20 × 1.1 = 22 kg
      With wastage: 22 × 1.02 = 22.44 kg

  Total raw material required: 114.18 kg
  (vs 100 kg standard — 14.18% increase due to volume + wastage)
```

#### 4.2.5 Additional Materials (Standard Functionality)

Production environments frequently consume materials not in the original BOM:

| Material Type | Examples |
|---------------|----------|
| Consumables | Welding rods, paint, grinding wheels |
| Packaging | Cartons, bubble wrap, labels |
| Additives | Master batch, chemicals, flux |
| Miscellaneous | Cleaning materials, lubricants |

**Implementation:**

- User clicks "+ Add Material" on Job Card
- Selects material from materials table
- Enters quantity and wastage
- Material is marked as `is_additional = true`
- Included in stock movement and production entry

#### 4.2.6 Status Transition Rules

Job cards follow a strict state machine. Only valid transitions are allowed.

```
┌─────────────────────────────────────────────────────────────────┐
│                  JOB CARD STATUS STATE MACHINE                    │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────┐      ┌─────────┐      ┌─────────────┐      ┌───────────┐
  │  DRAFT  │ ──→  │ ISSUED  │ ──→  │ IN_PROGRESS │ ──→  │ COMPLETED │
  └─────────┘      └─────────┘      └─────────────┘      └───────────┘
       │                │                  │
       │                │                  │
       ▼                ▼                  ▼
  ┌───────────┐    ┌───────────┐     ┌───────────┐
  │ CANCELLED │    │ CANCELLED │     │ CANCELLED │
  └───────────┘    └───────────┘     └───────────┘

  VALID TRANSITIONS:
  ──────────────────
  draft → issued         (materials issued to production)
  draft → cancelled      (job card abandoned before issuing)
  issued → in_progress   (production started)
  issued → cancelled     (cancelled before production started)
  in_progress → completed (production finished)
  in_progress → cancelled (cancelled during production — requires stock return)

  BLOCKED TRANSITIONS:
  ────────────────────
  completed → *           (cannot undo completion)
  cancelled → *           (cannot revive cancelled job card)
  draft → completed       (must go through issued/in_progress)
  draft → in_progress     (must issue materials first)
```

**Transition Actions:**

| Transition | Required Action | Stock Impact |
|------------|-----------------|--------------|
| draft → issued | Issue materials to WIP warehouse | Main Store → WIP Warehouse |
| issued → in_progress | No action required | None |
| in_progress → completed | Submit production entry | WIP → FG (finished goods) |
| * → cancelled | Return all issued materials | WIP → Main Store (return) |

#### 4.2.5A Stock Movement on Material Issuance

**When Job Card status changes from `draft` to `issued`:**

```
┌─────────────────────────────────────────────────────────────────┐
│           STOCK MOVEMENT ON MATERIAL ISSUANCE                     │
└─────────────────────────────────────────────────────────────────┘

  STEP: Job Card Status → ISSUED
  ───────────────────────────────
  
  FOR EACH material in job_card_materials:
  ─────────────────────────────────────────
  
  1. CHECK STOCK AVAILABILITY:
     SELECT current_stock 
     FROM item_stock 
     WHERE item_id = ? AND warehouse_id = 'main-store';
     
     IF current_stock < issued_qty:
       BLOCK issuance → show "Insufficient stock for [Material]"
  
  2. DECREASE MAIN STORE STOCK:
     UPDATE item_stock 
     SET current_stock = current_stock - issued_qty
     WHERE item_id = ? AND warehouse_id = 'main-store';
  
  3. INCREASE WIP WAREHOUSE STOCK:
     UPDATE item_stock 
     SET current_stock = current_stock + issued_qty
     WHERE item_id = ? AND warehouse_id = 'wip-warehouse';
  
  4. RECORD IN MATERIAL OUTWARD:
     INSERT INTO material_outward_items (...)
     VALUES (?, ?, issued_qty, ?, 'Production');

  SUMMARY:
  ────────
  Main Store Stock:    DECREASED (materials leave store)
  WIP Stock:           INCREASED (materials enter production)
  Material Outward:    RECORDED (audit trail)
  Job Card Status:     ISSUED
```

**Example: Issue 838.95 kg PP Granules to Production**

```
BEFORE ISSUANCE:
  Main Store (PP Granules):  1200 kg
  WIP Warehouse:               0 kg

AFTER ISSUANCE:
  Main Store (PP Granules):  361.05 kg  (1200 - 838.95)
  WIP Warehouse:            838.95 kg  (0 + 838.95)
```

#### 4.2.5B Stock Movement on Production Completion

**When Production Entry is submitted (Job Card → completed):**

```
┌─────────────────────────────────────────────────────────────────┐
│           STOCK MOVEMENT ON PRODUCTION COMPLETION                 │
└─────────────────────────────────────────────────────────────────┘

  STEP: Production Entry Submitted
  ─────────────────────────────────
  
  FOR EACH material in production_entry_items:
  ─────────────────────────────────────────────
  
  1. DECREASE WIP STOCK (consumed + wastage):
     UPDATE item_stock 
     SET current_stock = current_stock - (consumed_qty + wastage_qty)
     WHERE item_id = ? AND warehouse_id = 'wip-warehouse';
     
     INSERT INTO material_outward_items (...)
     VALUES (?, ?, consumed_qty + wastage_qty, ?, 'Production');
  
  2. RETURN UNUSED MATERIALS (if any):
     IF return_qty > 0:
       UPDATE item_stock 
       SET current_stock = current_stock + return_qty
       WHERE item_id = ? AND warehouse_id = 'main-store';
       
       UPDATE item_stock 
       SET current_stock = current_stock - return_qty
       WHERE item_id = ? AND warehouse_id = 'wip-warehouse';
  
  3. ADD FINISHED GOODS:
     UPDATE item_stock 
     SET current_stock = current_stock + produced_qty
     WHERE item_id = ? AND warehouse_id = 'fg-warehouse';

  SUMMARY:
  ────────
  Main Store Stock:    INCREASED (returned materials)
  WIP Stock:           DECREASED (consumed + wastage + returned)
  FG Stock:            INCREASED (finished goods)
```

**Complete Flow Example:**

```
DAY 1: ISSUE MATERIALS
──────────────────────
Main Store (PP Granules):  1200 kg → 361.05 kg
WIP Warehouse:               0 kg → 838.95 kg

DAY 2: PRODUCTION COMPLETE
──────────────────────────
Produced: 980 mtr pipe
Consumed: 820 kg PP Granules
Wastage: 18.95 kg
Return: 0 kg

WIP Warehouse:            838.95 kg → 0 kg (820 + 18.95 = 838.95)
FG Warehouse (Pipe):          0 mtr → 980 mtr

FINAL STATE:
────────────
Main Store (PP Granules):  361.05 kg (unchanged from day 1)
WIP Warehouse:               0 kg (all consumed)
FG Warehouse (Pipe):       980 mtr (finished goods)
```

**Validation Rules:**

| Rule | Description |
|------|-------------|
| Stock check | Cannot issue materials if stock insufficient |
| Return on cancel | All issued materials must be returned before cancellation |
| Completion gate | Cannot complete without at least one production entry |
| Yield validation | Actual qty must be > 0 to complete |

#### 4.2.7 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Insufficient stock for any material | Block job card creation; show stock shortfall |
| User wants to add material not in BOM | **Standard functionality** — use Add Material button |
| User wants to override wastage per item | Allow per-material wastage override |
| BOM has been modified since last job card | Use BOM version at time of job card creation |
| Job card issued but not started | Allow cancellation with stock return |
| Partial material issue | Allow partial issuance; track remaining |
| Cancel with WIP | Transfer WIP warehouse → Main Store before cancellation |

---

### 4.3 Work In Progress (WIP) Tracking

**Purpose:** Track materials that have been issued to production but not yet consumed.

#### 4.3.1 WIP Status Flow (Warehouse-Based)

```
┌─────────────────────────────────────────────────────────────────┐
│              WIP STATUS FLOW (WAREHOUSE-BASED)                   │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │  Stock Location         │  Status        │  When               │
  ├─────────────────────────────────────────────────────────────────┤
  │  Main Store             │  Available     │  Before job card     │
  │  WIP Warehouse          │  In Production │  After issue         │
  │  FG Warehouse           │  Finished      │  After production    │
  │  Main Store (returned)  │  Available     │  If returned         │
  └─────────────────────────────────────────────────────────────────┘

  Stock Movement:
  ───────────────
  
  1. Materials Issued:
     Main Store stock DECREASES
     WIP Warehouse stock INCREASES
  
  2. Production Complete:
     WIP Warehouse stock DECREASES
     FG Warehouse stock INCREASES (finished goods)
  
  3. Materials Returned (unused):
     WIP Warehouse stock DECREASES
     Main Store stock INCREASES
```

#### 4.3.2 WIP Visibility

WIP is visible through:

1. **Warehouse Report** — Filter by WIP Warehouse
2. **Job Card Detail** — Shows materials issued but not consumed
3. **Dashboard** — Total WIP value across all job cards

#### 4.3.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Same material in multiple job cards | Track per-job-card via job_card_materials |
| Material consumed before production entry | Allow; production entry reconciles |
| Job card cancelled with WIP | Transfer WIP warehouse → Main Store |
| WIP exceeds available stock | System prevents; shows real-time availability |

---

### 4.4 Production Entry

**Purpose:** Record actual material consumption and finished goods output after production.

#### 4.4.1 Production Entry Header

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `entry_no` | VARCHAR | Auto-generated (e.g., PE-2026-001) |
| `job_card_id` | UUID FK | Associated job card |
| `entry_date` | DATE | Production date |
| `produced_qty` | DECIMAL | Actual finished goods produced |
| `produced_unit` | VARCHAR | Unit |
| `yield_pct` | DECIMAL | Calculated: (produced_qty / planned_qty) × 100 |
| `quality_notes` | TEXT | Quality observations |
| `batch_no` | VARCHAR | Batch number (future-proofing) |
| `production_date` | DATE | Production date (future-proofing) |
| `reported_by` | UUID FK | Person who reported the entry |
| `created_by` | UUID FK | Person who created the record (audit trail) |
| `organisation_id` | UUID FK | Multi-tenant |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4.4.2 Production Entry Items

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `production_entry_id` | UUID FK | Parent entry |
| `job_card_material_id` | UUID FK | Reference to job card material (NULL if additional) |
| `material_id` | UUID FK | Raw material |
| `is_additional` | BOOLEAN | Material not in original BOM |
| `issued_qty` | DECIMAL | Qty issued (from job card) |
| `consumed_qty` | DECIMAL | Qty actually used |
| `wastage_qty` | DECIMAL | Qty wasted |
| `return_qty` | DECIMAL | Qty returned to Main Store |
| `remarks` | TEXT | Per-material notes |
| `batch_no` | VARCHAR | Batch number (future-proofing) |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 4.4.3 Production Entry Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  PRODUCTION ENTRY FLOW                            │
└─────────────────────────────────────────────────────────────────┘

  Step 1: Select Job Card
  ────────────────────────
  ┌─────────────────────────────────────────┐
  │  Job Card: JC-2026-001                  │
  │  Product: PP Pressure Pipe 110mm        │
  │  Planned: 1000 mtr                      │
  │  Status: In Progress                    │
  │  Issued: 838.95 kg PP Granules          │
  └─────────────────────────────────────────┘

  Step 2: Enter Production Output
  ────────────────────────────────
  ┌─────────────────────────────────────────┐
  │  Produced Qty: [980     ] mtr           │
  │  (Planned was 1000 mtr — 98% yield)    │
  │  Batch No:    [B-2026-001] (optional)   │
  └─────────────────────────────────────────┘

  Step 3: Record Material Consumption
  ─────────────────────────────────────
  ┌──────────────────────────────────────────────────────────────┐
  │  Material          │ Issued  │ Used   │ Waste │ Return │ ⚠️  │
  ├──────────────────────────────────────────────────────────────┤
  │  PP Granules       │838.95 kg│820.00 kg│18.95│ [    ] │ ⚠️  │
  │  Masterbatch       │ 27.40 kg│ 26.00 kg│ 1.40│ [    ] │ ⚠️  │
  │  UV Stabilizer     │ 16.96 kg│ 16.50 kg│ 0.46│ [    ] │ ⚠️  │
  │  Anti-oxidant      │  8.50 kg│  8.40 kg│ 0.10│ [    ] │ ⚠️  │
  ├──────────────────────────────────────────────────────────────┤
  │  TOTAL             │891.81 kg│870.90 kg│20.91│  0.00 │     │
  │                                                              │
  │  ℹ️ Actual wastage: 2.34% (vs planned 4.25%)               │
  │    → Efficiency: 102.4% (better than planned)              │
  │                                                              │
  │  ⚠️ RETURN: Enter qty to return to Main Store              │
  │     (Consumed + Wastage + Return = Issued)                  │
  └──────────────────────────────────────────────────────────────┘

  Step 4: Submit Entry
  ─────────────────────
  ┌─────────────────────────────────────────┐
  │  Quality Notes: [All pipes passed      ]│
  │                  [pressure test         ]│
  │                                         │
  │  [Save Draft]  [Submit & Update Stock]  │
  └─────────────────────────────────────────┘
```

**Material Return Validation:**

| Rule | Description |
|------|-------------|
| Return + Consumed + Wastage = Issued | Must balance exactly |
| Return cannot exceed Issued | System blocks invalid entries |
| Return qty auto-calculated | If user enters consumed + wastage, return = Issued - (consumed + wastage) |
| Partial return allowed | User can return some now, some later |

**Example Return Calculation:**

```
PP Granules:
  Issued:    838.95 kg
  Consumed:  820.00 kg
  Wastage:   18.95 kg
  Return:    0.00 kg (user entered)
  ─────────────────────
  Check: 820 + 18.95 + 0 = 838.95 ✓ BALANCED

If user wants to return 10 kg:
  Consumed:  820.00 kg
  Wastage:   8.95 kg (reduced)
  Return:    10.00 kg
  ─────────────────────
  Check: 820 + 8.95 + 10 = 838.95 ✓ BALANCED
```

#### 4.4.4 Stock Update Logic (on Production Entry Submit)

```
┌─────────────────────────────────────────────────────────────────┐
│              STOCK UPDATE ON PRODUCTION ENTRY SUBMIT             │
└─────────────────────────────────────────────────────────────────┘

  FOR EACH material in production entry:
  ────────────────────────────────────────
  
  1. Transfer Consumed Materials (WIP → Outward):
     -- Materials consumed move from WIP to outward
     UPDATE item_stock 
     SET current_stock = current_stock - (consumed_qty + wastage_qty)
     WHERE item_id = ? AND warehouse_id = 'wip-warehouse';
     
     -- Record in material_outward for audit trail
     INSERT INTO material_outward_items (...)
     VALUES (?, ?, consumed_qty + wastage_qty, ?, 'Production');
  
  2. Return Unused Materials (WIP → Main Store):
     IF return_qty > 0:
       UPDATE item_stock 
       SET current_stock = current_stock + return_qty
       WHERE item_id = ? AND warehouse_id = 'main-store';
       
       UPDATE item_stock 
       SET current_stock = current_stock - return_qty
       WHERE item_id = ? AND warehouse_id = 'wip-warehouse';
  
  3. Add Finished Goods (FG Warehouse):
     -- Link finished product to materials table (if not exists)
     -- Add stock in FG Warehouse
     UPDATE item_stock 
     SET current_stock = current_stock + produced_qty
     WHERE item_id = ? AND warehouse_id = 'fg-warehouse';

  SUMMARY:
  ────────
  Main Store Stock:    INCREASED (returned materials)
  WIP Stock:           DECREASED (consumed + wastage + returned)
  FG Stock:            INCREASED (finished goods)
  Material Outward:    RECORDED (audit trail)
```

#### 4.4.5 Yield Tracking

**Yield %** = Actual Output ÷ Planned Output × 100

**Where Yield Appears:**

| Location | Display |
|----------|---------|
| Job Card | Yield % badge (green/yellow/red) |
| Production Entry | Calculated and stored |
| Dashboard | Average yield across all job cards |
| Analytics | Yield trend over time |

**Yield Thresholds:**

| Yield | Status | Color |
|-------|--------|-------|
| ≥ 95% | Excellent | Green |
| 85-94% | Good | Yellow |
| 70-84% | Below Average | Orange |
| < 70% | Poor | Red |

#### 4.4.5A Wastage Calculation

Wastage is tracked both as **planned** (at BOM/Job Card level) and **actual** (at Production Entry level).

**Planned Wastage (BOM Level):**
- Stored as percentage per material in `bom_items.wastage_pct`
- Default: 5% if not specified
- Used to calculate material requirements when creating job cards

**Actual Wastage (Production Entry Level):**
- Stored as quantity in `production_entry_items.wastage_qty`
- Calculated as: `wastage_qty = issued_qty - consumed_qty - return_qty`
- Wastage % is derived: `(wastage_qty / issued_qty) × 100`

**Wastage Analytics:**

| Metric | Formula | Purpose |
|--------|---------|---------|
| Planned Wastage % | `bom_items.wastage_pct` | What we expected |
| Actual Wastage % | `(wastage_qty / issued_qty) × 100` | What actually happened |
| Wastage Variance | `actual_wastage_pct - planned_wastage_pct` | Over/under expectation |
| Wastage Cost | `wastage_qty × material_cost` | Financial impact |

**Wastage Thresholds:**

| Variance | Status | Action |
|----------|--------|--------|
| Actual ≤ Planned | On Track | No action needed |
| Actual > Planned by 1-5% | Warning | Review process |
| Actual > Planned by 5-10% | Alert | Investigate root cause |
| Actual > Planned by >10% | Critical | Stop and review BOM accuracy |

#### 4.4.6 Partial Production

A single job card can have **multiple production entries** to handle partial production runs.

**Use case:** A job card for 110 kg might be completed in 2 batches:
- Day 1: Produce 50 kg (Production Entry #1)
- Day 2: Produce 60 kg (Production Entry #2)

**Rules for partial production:**

| Rule | Description |
|------|-------------|
| Multiple entries allowed | Each production entry records a portion of the job card |
| Running totals | `job_cards.actual_qty` is updated as cumulative sum of all entries |
| Material tracking | Each entry records consumed/wastage/return per material |
| Status transitions | Job card stays `in_progress` until all planned qty is produced |
| Completion | When cumulative `actual_qty >= planned_qty`, status moves to `completed` |
| Over-production | If cumulative entries exceed planned qty, allow but flag as over-production |
| Return handling | Unused materials can be returned at any entry, not just the last one |

**Partial production flow:**

```
Job Card: JC-2026-001 — Produce 110 kg

Production Entry #1 (Day 1):
  Produced: 50 kg
  Status: in_progress
  Actual qty so far: 50 kg (45.5% of planned)

Production Entry #2 (Day 2):
  Produced: 60 kg
  Status: completed (cumulative: 110 kg)
  Actual qty so far: 110 kg (100% of planned)

Yield: (110 / 110) × 100 = 100%
```

#### 4.4.7 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Actual consumption exceeds issued qty | Allow; trigger stock alert |
| Produced qty exceeds planned qty | Allow; record as over-production |
| Consumed + Wastage < Issued (surplus) | Auto-calculate return qty |
| Consumed + Wastage > Issued (shortage) | Block submission; require additional issue |
| Production entry submitted twice | Prevent; allow edit if status = draft |
| Job card already completed | Prevent new entries |
| Material not in job card used | **Standard functionality** — add as additional line |
| Partial production | Allow multiple entries; track cumulative actual qty |
| Over-production | Allow but flag; yield > 100% |

---

### 4.5 Finished Goods

**Purpose:** Track stock of manufactured products ready for sale or project use.

#### 4.5.1 How Finished Goods Get Added to Inventory

**When Production Entry is submitted:**

```
┌─────────────────────────────────────────────────────────────────┐
│           FINISHED GOODS ADDITION FLOW                            │
└─────────────────────────────────────────────────────────────────┘

  STEP: Production Entry Submitted
  ─────────────────────────────────
  
  1. CHECK IF FINISHED PRODUCT EXISTS IN MATERIALS TABLE:
     SELECT id FROM materials WHERE name = ? AND organisation_id = ?
     
     IF NOT EXISTS:
       -- Auto-create finished product in materials table
       INSERT INTO materials (name, category, unit, is_manufactured, ...)
       VALUES ('PP Pressure Pipe 110mm', 'Finished Goods', 'mtr', true, ...)
     
     -- Mark as manufactured
     UPDATE materials SET is_manufactured = true WHERE id = ?
  
  2. CHECK IF FG WAREHOUSE STOCK EXISTS:
     SELECT id, current_stock FROM item_stock 
     WHERE item_id = ? AND warehouse_id = 'fg-warehouse'
     
     IF NOT EXISTS:
       -- Create new stock entry
       INSERT INTO item_stock (item_id, warehouse_id, current_stock)
       VALUES (?, 'fg-warehouse', ?)
     
     ELSE:
       -- Update existing stock
       UPDATE item_stock 
       SET current_stock = current_stock + produced_qty
       WHERE item_id = ? AND warehouse_id = 'fg-warehouse'
  
  3. RECORD IN MATERIAL INWARD (audit trail):
     INSERT INTO material_inward_items (...)
     VALUES (?, ?, produced_qty, ?, 'Production');

  SUMMARY:
  ────────
  Materials Table:       FINISHED PRODUCT CREATED (if not exists)
  FG Warehouse Stock:    INCREASED (finished goods added)
  Material Inward:       RECORDED (audit trail)
```

**Example: Add 980 mtr Pipe to FG Warehouse**

```
BEFORE:
  Materials Table: PP Pressure Pipe 110mm (not exists)
  FG Warehouse: PP Pressure Pipe 110mm: 0 mtr

AFTER:
  Materials Table: PP Pressure Pipe 110mm (created, is_manufactured=true)
  FG Warehouse: PP Pressure Pipe 110mm: 980 mtr
```

#### 4.5.2 Finished Goods Storage

Finished goods are stored in `item_stock` using the existing inventory engine:

```sql
-- Finished goods are materials with is_manufactured = true
-- Stock lives in item_stock, linked to FG Warehouse

-- Example:
-- materials: id=xyz, name='PP Pressure Pipe 110mm', is_manufactured=true
-- item_stock: item_id=xyz, warehouse_id='fg-warehouse', current_stock=980
```

#### 4.5.3 Integration with Existing Sales

```
┌─────────────────────────────────────────────────────────────────┐
│              FINISHED GOODS → SALES INTEGRATION                  │
└─────────────────────────────────────────────────────────────────┘

  When creating a Delivery Challan or Invoice:
  ────────────────────────────────────────────
  
  1. User selects item from materials table:
     - Works for both raw materials and finished goods
     - No separate selection needed
  
  2. Stock validation:
     - System checks item_stock for selected warehouse
     - Prevents DC/Invoice if stock insufficient
     - Shows warning for low stock items
  
  3. Stock deduction:
     - DC/Invoice deducts from item_stock (same as raw materials)
     - No special handling needed
```

---

### 4.6 Activity Log & Audit Trail

**Purpose:** Track every action in the manufacturing module with user, timestamp, and details.

#### 4.6.1 Why Activity Log?

- **Accountability:** Know who issued materials, who produced, who returned
- **Troubleshooting:** Trace back when stock doesn't match
- **Compliance:** Audit trail for ISO, quality certifications
- **Dispute resolution:** "When was this material issued?" "Who approved this job card?"

#### 4.6.2 Activity Log Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `entity_type` | VARCHAR | production_schedule / job_card / production_entry / stock_movement |
| `entity_id` | UUID | ID of the record |
| `action` | VARCHAR | created / updated / issued / completed / cancelled / returned / etc. |
| `action_details` | JSONB | Detailed change data (old values, new values) |
| `user_id` | UUID FK | Who performed the action |
| `user_name` | VARCHAR | Denormalized name for quick display |
| `organisation_id` | UUID FK | Multi-tenant |
| `ip_address` | INET | Optional — for security audit |
| `created_at` | TIMESTAMP | When the action happened |

#### 4.6.3 Activity Log Examples

**Job Card Activities:**

| Action | Details | User | Time |
|--------|---------|------|------|
| created | Job Card JC-2026-001 created from BOM-001 | Vikram | 09:00 |
| updated | Planned qty changed from 1000 to 1100 mtr | Vikram | 09:15 |
| issued | Materials issued to WIP warehouse | Store Keeper | 10:00 |
| in_progress | Production started | Shop Floor | 10:30 |
| completed | Production Entry PE-2026-001 submitted | Vikram | 17:00 |

**Production Entry Activities:**

| Action | Details | User | Time |
|--------|---------|------|------|
| created | Production Entry PE-2026-001 created | Vikram | 17:00 |
| submitted | 980 mtr produced (98% yield) | Vikram | 17:05 |
| stock_updated | Finished goods added to FG Warehouse | System | 17:05 |
| return_processed | 18.95 kg PP Granules returned to Main Store | System | 17:05 |

**Stock Movement Activities:**

| Action | Details | User | Time |
|--------|---------|------|------|
| issued | 838.95 kg PP Granules moved to WIP | Store Keeper | 10:00 |
| consumed | 820 kg PP Granules consumed in production | System | 17:05 |
| returned | 18.95 kg PP Granules returned to Main Store | System | 17:05 |
| finished_goods | 980 mtr Pipe added to FG Warehouse | System | 17:05 |

#### 4.6.4 Activity Log UI

```
┌─────────────────────────────────────────────────────────────────┐
│                 ACTIVITY LOG — JC-2026-001                        │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │  TIME     │ USER          │ ACTION         │ DETAILS         │
  ├──────────────────────────────────────────────────────────────┤
  │  09:00    │ Vikram        │ Created        │ Job Card created│
  │  09:15    │ Vikram        │ Updated        │ Qty: 1000→1100  │
  │  10:00    │ Store Keeper  │ Issued         │ 838 kg to WIP   │
  │  10:30    │ Shop Floor    │ In Progress    │ Production start│
  │  17:00    │ Vikram        │ Completed      │ PE-2026-001     │
  │  17:05    │ System        │ Stock Updated  │ FG: +980 mtr    │
  │  17:05    │ System        │ Return Processed│ 18.95 kg back  │
  └──────────────────────────────────────────────────────────────┘
```

#### 4.6.5 Activity Log Trigger (SQL)

```sql
-- Auto-log job card status changes
CREATE OR REPLACE FUNCTION log_job_card_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO manufacturing_activity_log (
      entity_type, entity_id, action, action_details,
      user_id, user_name, organisation_id
    ) VALUES (
      'job_card', NEW.id, NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      auth.uid(), (SELECT full_name FROM profiles WHERE id = auth.uid()),
      NEW.organisation_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_card_activity
  AFTER UPDATE ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION log_job_card_activity();
```

#### 4.6.6 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Activity log for deleted records | Keep log; mark record as deleted |
| Activity log for system actions | Log with user_id = NULL, user_name = 'System' |
| Activity log retention | Keep for 7 years (configurable) |
| Activity log performance | Index on entity_type, entity_id, created_at |
| Bulk operations | Log each individual operation separately |

---

## 5. UI/UX SPECIFICATIONS

### 5.1 New Pages

| Page | Route | Description |
|------|-------|-------------|
| Manufacturing Dashboard | `/manufacturing` | Overview of BOMs, Job Cards, Production |
| BOM List | `/manufacturing/boms` | List all BOMs with search/filter |
| BOM Editor | `/manufacturing/boms/create` | Create/edit BOM |
| Job Card List | `/manufacturing/job-cards` | List all job cards by status |
| Job Card Create | `/manufacturing/job-cards/create` | Create job card from BOM |
| Job Card Detail | `/manufacturing/job-cards/:id` | View/issue materials |
| Production Entry | `/manufacturing/production/create` | Submit production entry |

### 5.2 Sidebar Integration

```
┌─────────────────────────────────────────┐
│  SIDEBAR ADDITION                       │
├─────────────────────────────────────────┤
│                                         │
│  Manufacturing (NEW)                    │
│  ├── Dashboard              📊          │
│  ├── BOMs                   📋          │
│  ├── Job Cards              🏭          │
│  │   ├── List                           │
│  │   └── Create                         │
│  ├── Production Entry       📝          │
│  └── Finished Goods         📦          │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Manufacturing Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANUFACTURING DASHBOARD                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Active BOMs │ │  Job Cards  │ │  In WIP     │ │  FG Stock   │          │
│  │     12      │ │     8       │ │   456 kg    │ │   234 kg    │          │
│  │   +2 this   │ │  3 pending  │ │  across 5   │ │  across 8   │          │
│  │    week     │ │  5 active   │ │  job cards  │ │  products   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Avg Yield   │ │  Wastage %  │ │  Completed  │ │  In Progress│          │
│  │   94.2%     │ │   3.8%      │ │     15      │ │     5       │          │
│  │  This Month  │ │  This Month │ │  This Month │ │  Active     │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ACTIVE JOB CARDS                                                    │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  JC-2026-001 │ Pipe Spool │ 110 kg │ In Progress │ 🔴 High │ Y:98% │  │
│  │  JC-2026-002 │ Cable Tray │  50 m  │ Issued      │ 🟡 Med   │ Y:--  │  │
│  │  JC-2026-003 │ Panel Box  │  25 nos│ Completed   │ 🟢 Low   │ Y:96% │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  RECENT PRODUCTION ENTRIES                                           │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  PE-2026-005 │ JC-001 │ 108 kg │ Yield: 98.2% │ Wastage: 2.72% │ ✅ │  │
│  │  PE-2026-004 │ JC-002 │  48 m  │ Yield: 96.0% │ Wastage: 3.10% │ ✅ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. DATABASE SCHEMA

### 6.1 New Tables

```sql
-- ============================================================
-- MANUFACTURING MODULE — DATABASE SCHEMA (REVISED)
-- ============================================================

-- 1. BOM Headers
CREATE TABLE bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_code VARCHAR(50) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  output_qty DECIMAL(12,2) NOT NULL DEFAULT 100,
  output_unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BOM Items (Raw Materials)
CREATE TABLE bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES bom_headers(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  required_qty DECIMAL(12,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  wastage_pct DECIMAL(5,2) DEFAULT 5.00,
  is_additional BOOLEAN DEFAULT false,  -- Materials added during production
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Job Cards
CREATE TABLE job_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_no VARCHAR(50) UNIQUE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE RESTRICT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL,
  actual_qty DECIMAL(12,2),  -- Filled when production entry is submitted
  yield_pct DECIMAL(5,2),    -- Calculated: (actual_qty / planned_qty) × 100
  output_unit VARCHAR(20) NOT NULL,
  status VARCHAR(30) DEFAULT 'draft' 
    CHECK (status IN ('draft','issued','in_progress','completed','cancelled')),
  priority VARCHAR(20) DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  remarks TEXT,
  issued_by UUID REFERENCES auth.users(id),
  issued_to UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Job Card Materials
CREATE TABLE job_card_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID REFERENCES job_cards(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  bom_item_id UUID REFERENCES bom_items(id) ON DELETE SET NULL,
  planned_qty DECIMAL(12,2) NOT NULL,
  issued_qty DECIMAL(12,2) DEFAULT 0,
  consumed_qty DECIMAL(12,2) DEFAULT 0,
  wastage_qty DECIMAL(12,2) DEFAULT 0,
  return_qty DECIMAL(12,2) DEFAULT 0,
  is_additional BOOLEAN DEFAULT false,  -- Material not in original BOM
  status VARCHAR(30) DEFAULT 'reserved'
    CHECK (status IN ('reserved','issued','consumed','returned')),
  warehouse_id UUID REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Production Entries (renamed from Production Reports)
CREATE TABLE production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no VARCHAR(50) UNIQUE NOT NULL,
  job_card_id UUID REFERENCES job_cards(id) ON DELETE RESTRICT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  produced_qty DECIMAL(12,2) NOT NULL,
  produced_unit VARCHAR(20) NOT NULL,
  yield_pct DECIMAL(5,2),  -- Calculated yield
  quality_notes TEXT,
  batch_no VARCHAR(50),      -- Future-proofing for batch tracking
  production_date DATE,      -- Future-proofing for batch tracking
  reported_by UUID REFERENCES auth.users(id),
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Production Entry Items
CREATE TABLE production_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES production_entries(id) ON DELETE CASCADE NOT NULL,
  job_card_material_id UUID REFERENCES job_card_materials(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  is_additional BOOLEAN DEFAULT false,  -- Material not in original BOM
  issued_qty DECIMAL(12,2) NOT NULL,
  consumed_qty DECIMAL(12,2) NOT NULL,
  wastage_qty DECIMAL(12,2) DEFAULT 0,
  return_qty DECIMAL(12,2) DEFAULT 0,
  remarks TEXT,
  batch_no VARCHAR(50),      -- Future-proofing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NO SEPARATE WIP TABLE — Uses warehouse-based movement
-- NO SEPARATE FG TABLE — Uses item_stock with FG Warehouse
-- ============================================================
```

### 6.2 Materials Table Enhancement

```sql
-- Add operational flags for flexible item behavior
ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_purchase BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_sales BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS show_in_quotation BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS show_in_bom BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_manufactured BOOLEAN DEFAULT false;

-- Set defaults for existing materials
UPDATE materials SET 
  allow_purchase = true,
  allow_sales = true,
  show_in_quotation = true,
  show_in_bom = true,
  is_manufactured = false
WHERE allow_purchase IS NULL;
```

### 6.3 Warehouse Setup

```sql
-- Add WIP and FG warehouses for manufacturing
INSERT INTO warehouses (name, warehouse_code, location, is_active) VALUES
  ('Production Floor / WIP', 'WIP-001', 'Manufacturing Area', true),
  ('Finished Goods Store', 'FG-001', 'Finished Goods Area', true)
ON CONFLICT DO NOTHING;
```

### 6.4 Indexes

```sql
-- BOM indexes
CREATE INDEX idx_bom_headers_org ON bom_headers(organisation_id);
CREATE INDEX idx_bom_items_bom ON bom_items(bom_id);
CREATE INDEX idx_bom_items_material ON bom_items(material_id);

-- Job Card indexes
CREATE INDEX idx_job_cards_org ON job_cards(organisation_id);
CREATE INDEX idx_job_cards_status ON job_cards(status);
CREATE INDEX idx_job_cards_bom ON job_cards(bom_id);
CREATE INDEX idx_job_card_materials_job ON job_card_materials(job_card_id);
CREATE INDEX idx_job_card_materials_material ON job_card_materials(material_id);

-- Production Entry indexes
CREATE INDEX idx_production_entries_job ON production_entries(job_card_id);
CREATE INDEX idx_production_entry_items_entry ON production_entry_items(production_entry_id);

-- Materials operational flags
CREATE INDEX idx_materials_is_manufactured ON materials(is_manufactured);
CREATE INDEX idx_materials_show_in_bom ON materials(show_in_bom);
```

### 6.5 RLS Policies

**Security:** All tables use org isolation via `org_members` table. Users can only access data belonging to their organisation.

```sql
-- Enable RLS on all new tables
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entry_items ENABLE ROW LEVEL SECURITY;

-- Create policies with org isolation (NOT USING(true) — that bypasses security)
-- Pattern: user must be a member of the organisation to access data

-- Example for bom_headers:
CREATE POLICY "org_isolation_select" ON bom_headers 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Child tables (bom_items, job_card_materials, production_entry_items)
-- inherit org isolation through parent table joins
```

---

## 7. INTEGRATION POINTS

### 7.1 Materials Table Updates

```sql
-- Add operational flags
ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_purchase BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_sales BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS show_in_quotation BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS show_in_bom BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_manufactured BOOLEAN DEFAULT false;
```

**Impact on existing pages:**

| Page | Change |
|------|--------|
| `MaterialsList.tsx` | Add filter for `is_manufactured`, `show_in_bom` |
| `MaterialInward.tsx` | No change (works for all items) |
| `MaterialOutward.tsx` | No change (works for all items) |
| `StockTransfer.tsx` | No change (works for all items) |
| Quotation/Invoice | No change (uses `allow_sales` flag) |

### 7.2 Sidebar Integration

```typescript
// Add to Sidebar.tsx menuData
{
  section: 'Manufacturing',
  items: [
    { id: 'manufacturing', label: 'Manufacturing', submenu: [
      { id: 'mfg-dashboard', label: 'Dashboard', path: '/manufacturing' },
      { id: 'mfg-boms', label: 'BOMs', path: '/manufacturing/boms' },
      { id: 'mfg-job-cards', label: 'Job Cards', path: '/manufacturing/job-cards' },
      { id: 'mfg-production', label: 'Production Entry', path: '/manufacturing/production' }
    ]}
  ]
}
```

### 7.3 App.tsx Route Integration

```typescript
// Add lazy imports
const ManufacturingDashboard = lazyAny(() => import('./pages/manufacturing/ManufacturingDashboard'));
const BOMList = lazyAny(() => import('./pages/manufacturing/BOMList'));
const BOMEditor = lazyAny(() => import('./pages/manufacturing/BOMEditor'));
const JobCardList = lazyAny(() => import('./pages/manufacturing/JobCardList'));
const JobCardCreate = lazyAny(() => import('./pages/manufacturing/JobCardCreate'));
const JobCardDetail = lazyAny(() => import('./pages/manufacturing/JobCardDetail'));
const ProductionEntryForm = lazyAny(() => import('./pages/manufacturing/ProductionEntryForm'));

// Add routes
case '/manufacturing': return <ManufacturingDashboard />;
case '/manufacturing/boms': return <BOMList />;
case '/manufacturing/boms/create': return <BOMEditor />;
case '/manufacturing/job-cards': return <JobCardList />;
case '/manufacturing/job-cards/create': return <JobCardCreate />;
case '/manufacturing/production/create': return <ProductionEntryForm />;
```

---

## 7A. UI IMPLEMENTATION GUIDELINES

All manufacturing pages MUST follow these component rules for consistency.

### 7A.1 Button Components

| Property | Value | Notes |
|----------|-------|-------|
| Line height | `40px` | All buttons |
| Padding | `12px` all sides | Top, right, bottom, left |
| Tap target | Minimum `44px` | Accessibility requirement |

### 7A.2 Table Styling

| Property | Value | Notes |
|----------|-------|-------|
| Row padding | `14px` top & bottom | Consistent breathing room |
| Text alignment | Left-aligned | All columns |
| Filters | Required | Every table must have filter capability |
| Hover state | Required | Row highlight on hover |
| Active state | Required | Interactive elements respond to click |

### 7A.3 Action Menu (Three-Dot)

| Property | Value | Notes |
|----------|-------|-------|
| Trigger | Three-dot icon (`⋮`) | Rightmost column in every row |
| Dropdown | Floating menu | With breathing space between items |
| Actions | Context-aware | Edit, Delete, View, etc. per row |

### 7A.4 Container & Table Spacing

| Property | Value | Notes |
|----------|-------|-------|
| Internal margin | `24px` all sides | Inside cards, panels, containers |
| Table container | `24px` padding | Around the table element |
| Section spacing | `24px` between sections | Vertical rhythm |

### 7A.5 Pagination

| Property | Value | Notes |
|----------|-------|-------|
| Location | Bottom of table | Never top or side |
| Style | Standard pagination | Page numbers + prev/next |
| Per page | 20 items default | Configurable |

### 7A.6 General Rules

- **Avoid congested tables** — Use adequate row height and spacing
- **Avoid congested buttons** — Group actions logically, use dropdowns for secondary actions
- **Consistent hover states** — All interactive elements must respond to hover
- **Active states** — Buttons and links must show press/click feedback

---

## 8. IMPLEMENTATION STATUS

### Phase 1: Core Manufacturing (Week 1-2) — IN PROGRESS

| Task | Est. Hours | Status | Notes |
|------|------------|--------|-------|
| Database migration (new tables + materials enhancement) | 4 | ✅ DONE | `database-manufacturing.sql` created |
| Warehouse setup (WIP + FG warehouses) | 1 | ⏳ PENDING | Need to run SQL + create warehouses in DB |
| BOM CRUD (list, create, edit, delete) | 14 | ✅ DONE | `BOMList.tsx`, `BOMEditor.tsx` created |
| Job Card CRUD (list, create, edit) | 14 | ✅ DONE | `JobCardList.tsx`, `JobCardCreate.tsx`, `JobCardDetail.tsx` created |
| Job Card material issuance flow (warehouse transfer) | 8 | ⏳ PENDING | UI exists, needs stock transfer integration |
| Production Entry submission | 10 | ✅ DONE | `ProductionEntryForm.tsx` created |
| Yield tracking calculation | 4 | ✅ DONE | Yield calculated in ProductionEntryForm |
| Additional materials support | 4 | ✅ DONE | Add Material button in JobCardCreate |
| Sidebar + Route integration | 2 | ✅ DONE | Manufacturing section added to Sidebar, routes in App.tsx |
| Production Schedule UI | 8 | ✅ DONE | `ProductionScheduleList.tsx`, `ProductionScheduleEditor.tsx` created |
| **Subtotal** | **69** | **8/10 DONE** | |

### Phase 2: Enhanced Features (Week 3-4) — NOT STARTED

| Task | Est. Hours | Priority | Notes |
|------|------------|----------|-------|
| Manufacturing dashboard (full) | 12 | P1 | Basic dashboard exists, needs yield metrics + charts |
| Production efficiency reports | 8 | P1 | Not started |
| BOM versioning | 6 | P1 | Not started |
| Batch number readiness | 4 | P1 | Schema ready, UI not built |
| Audit trail for manufacturing | 4 | P1 | Schema ready, UI not built |
| Edge case handling (partial, rework) | 8 | P1 | Not started |
| Custom Units management UI | 6 | P1 | Schema ready, UI not built |
| Custom Fields management UI | 6 | P1 | Schema ready, UI not built |
| Activity Log viewer | 4 | P1 | Schema ready, UI not built |
| **Subtotal** | **58** | | |

### Phase 3: Advanced (Week 5+) — NOT STARTED

| Task | Est. Hours | Priority | Notes |
|------|------------|----------|-------|
| Multi-level BOMs | 16 | P2 | Not started |
| Cost accounting per unit | 12 | P2 | Not started |
| Quality control checks | 8 | P2 | Not started |
| Capacity planning | 12 | P2 | Not started |
| **Subtotal** | **48** | | |

### Files Created

| File | Purpose | Status |
|------|---------|--------|
| `src/database-manufacturing.sql` | SQL migration (all tables) | ✅ Ready to run |
| `src/pages/manufacturing/ManufacturingDashboard.tsx` | Manufacturing overview | ✅ Created |
| `src/pages/manufacturing/BOMList.tsx` | List all BOMs | ✅ Created |
| `src/pages/manufacturing/BOMEditor.tsx` | Create/Edit BOM | ✅ Created |
| `src/pages/manufacturing/ProductionScheduleList.tsx` | List production schedules | ✅ Created |
| `src/pages/manufacturing/ProductionScheduleEditor.tsx` | Create/Edit schedules | ✅ Created |
| `src/pages/manufacturing/JobCardList.tsx` | List job cards | ✅ Created |
| `src/pages/manufacturing/JobCardCreate.tsx` | Create job card from BOM | ✅ Created |
| `src/pages/manufacturing/JobCardDetail.tsx` | View job card details | ✅ Created |
| `src/pages/manufacturing/ProductionEntryForm.tsx` | Record production entry | ✅ Created |
| `src/components/Sidebar.tsx` | Manufacturing menu added | ✅ Updated |
| `src/App.tsx` | Routes added | ✅ Updated |

### Pending Tasks (Before First Use)

| Task | Priority | Est. Hours |
|------|----------|------------|
| Run `database-manufacturing.sql` in Supabase | P0 | 0.5 |
| Create WIP warehouse ("Production Floor") in DB | P0 | 0.5 |
| Create FG warehouse ("Finished Goods Store") in DB | P0 | 0.5 |
| Integrate stock transfer in material issuance | P0 | 4 |
| Add production entry → finished goods stock creation | P0 | 4 |
| Test full flow end-to-end | P0 | 4 |
| Add three-dot action menus to tables | P1 | 2 |
| Add pagination to all tables | P1 | 2 |
| Refactor inline queries to custom hooks | P1 | 6 |

---

## 9. RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Inventory sync issues | Medium | High | Use database transactions for all stock movements |
| WIP calculation errors | Low | High | Warehouse-based model is simpler and proven |
| Performance with large BOMs | Low | Medium | Index optimization, pagination |
| User confusion (traders vs manufacturers) | High | Medium | Clear UI guidance, operational flags |
| WIP warehouse management | Medium | Medium | Provide warehouse summary report |

---

## 10. SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| BOM creation time | < 5 minutes | User testing |
| Job card issuance | < 2 minutes | User testing |
| Production entry submission | < 3 minutes | User testing |
| Stock accuracy | 100% | Monthly audit |
| WIP visibility | Real-time | Dashboard monitoring |
| Yield tracking | 100% captured | Production entries |
| Wastage tracking | 100% captured | Production entries |

---

## 11. CONCLUSION

This Manufacturing Module transforms our trading platform into a **hybrid trading-manufacturing solution** without requiring clients to invest in separate ERP systems. By maximizing reuse of existing inventory architecture (item_stock, warehouses, stock transfers), we:

- **Minimize development effort** — No duplicate stock systems
- **Maximize integration** — Sales, DC, Reports work automatically
- **Simplify reconciliation** — Single inventory engine
- **Maintain flexibility** — Operational flags instead of rigid types

**Key Differentiators:**
- **Integrated, not standalone** — Manufacturing lives alongside trading
- **Warehouse-based WIP** — Simple, proven, auditable
- **Yield-aware** — Track production efficiency from day one
- **Flexible item master** — Items can be purchased, sold, consumed, or manufactured

**Next Steps:**
1. Management approval
2. Phase 1 implementation (2 weeks)
3. User acceptance testing with 2-3 pilot clients
4. Phase 2 rollout

---

**Document prepared by:** Production Planning Lead  
**Date:** 2026-06-10  
**Status:** REVISED — Based on Architecture Review  
**Review:** Approved for Implementation
