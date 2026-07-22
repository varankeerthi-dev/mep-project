# Product Requirement Document (PRD): Material Returns Module

## 1. Objectives & Scope
The Material Returns module enables project managers and storekeepers to record materials returned from construction sites (leftovers or project completion surplus) and accurately reconcile them against original supply documents.

### Key Capabilities:
- Mapped tracking of returns against original Delivery Challans (DCs) and/or Sales Invoices.
- Directly update the project consumption report so that return quantities reduce the net-supplied quantity on-site.
- Convert return documents into Credit Notes for invoice-mapped returns (no Credit Notes allowed for DC-only returns).
- Download records as PDF and Excel sheets.

---

## 2. Database Schema

We will create three tables to store return headers, item lists, and source document links:

### 2.1 `returns` (Header)
Stores metadata for each return transaction. Includes `default_warehouse_id` for bulk warehouse assignments.
```sql
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  return_number VARCHAR(100) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  default_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL, -- Default warehouse for bulk apply
  customer_dc_number VARCHAR(100), -- Customer Delivery Challan Number reference
  vehicle_number VARCHAR(100), -- Vehicle carrying the returned materials
  returned_by UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Employee coordinating the return
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'completed', 'cancelled'
  remarks TEXT,
  next_action_type VARCHAR(50), -- 'credit_note', 'inspection', 'stock_transfer', 'other'
  next_action_remarks TEXT, -- Description of next steps
  next_action_assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Assigned employee
  next_action_due_date DATE, -- Due date for action
  next_action_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'deferred'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_return_number_per_org UNIQUE(organisation_id, return_number)
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable RLS for returns by organisation" ON returns
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid) 
  WITH CHECK (organisation_id = (auth.jwt() ->> 'org_id')::uuid);
```

### 2.2 `return_items` (Line Items)
Stores individual item return quantities. Includes item-level `warehouse_id` override.
```sql
CREATE TABLE public.return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES materials(id),
  variant_id UUID REFERENCES company_variants(id),
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL, -- Row-level warehouse override
  is_scrap BOOLEAN DEFAULT false, -- If true, bypass restocking in inventory
  rate DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable RLS for return_items by organisation" ON return_items
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid) 
  WITH CHECK (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
```

### 2.3 `return_sources` (Audit & Reconciliation Mapping)
Breaks down the items returned by mapping specific quantities back to original supply sources. Explicit foreign keys enforce referential integrity natively.
```sql
CREATE TABLE public.return_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_item_id UUID NOT NULL REFERENCES return_items(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE CASCADE,
  delivery_challan_item_id UUID REFERENCES delivery_challan_items(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_single_source_type CHECK (
    (invoice_item_id IS NULL AND delivery_challan_item_id IS NOT NULL) OR
    (invoice_item_id IS NOT NULL AND delivery_challan_item_id IS NULL)
  )
);

ALTER TABLE return_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable RLS for return_sources" ON return_sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM return_items 
      WHERE return_items.id = return_sources.return_item_id 
        AND return_items.organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

CREATE INDEX IF NOT EXISTS idx_return_sources_item_id ON return_sources(return_item_id);
CREATE INDEX IF NOT EXISTS idx_return_sources_invoice_item_id ON return_sources(invoice_item_id) WHERE invoice_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_sources_dc_item_id ON return_sources(delivery_challan_item_id) WHERE delivery_challan_item_id IS NOT NULL;
```

---

## 3. User Interface (UI) Layout

The interface is structured as a **Two-Panel Split Layout** to keep the workflow clean and simple:

![Material Returns Split-Screen UI Layout Mockup](file:///c:/Users/admin/.gemini/antigravity/brain/f3760b60-e481-40ed-8d57-c1b491cdad10/material_returns_ui_rupees_buttons_1784660531804.png)

```
+----------------------------------------------------------------------------------+----------------------------------------+
| LEFT PANEL: Return Document Form & Items                                          | RIGHT PANEL: Source Mapping Drawer     |
|                                                                                  |                                        |
| Return Details:                                                                  | Item: 25mm GI Pipe (Return Qty: 15)    |
| Return #: [ RET-001 ]  Date: [ 21 Jul 2026 ]                                     |                                        |
| Project: [ MEP Project A                  | v ]                                  | Mapped Sources (Explicit Details):     |
| Client: Reliance Projects Ltd (Auto-resolved)                                    |                                        |
| Default Warehouse: [ Main Warehouse       | v ]                                  | [x] DC-124 (Date: 12 Jun 2026)         |
| Source Docs Filter: [ DC-124, Inv-093     | v ]                                  |     Supplied: 15 | Ret: 0 | Avail: 15  |
| Customer DC No: [ CUST-DC-7892            ]                                      |     Return Qty: [ 10 ]                 |
| Vehicle No/Name: [ KA-01-ME-1234          ]                                      |                                        |
| Returned By: [ Suresh Kumar (Driver)      | v ]                                  | [x] Inv-093 (Date: 18 Jun 2026)        |
|                                                                                  |     Supplied: 20 | Ret: 2 | Avail: 18  |
| Returned Items Table:                                                            |     Return Qty: [ 5  ]                 |
| S.No | Material  | Warehouse     | Qty | Rate (₹) | Total (₹) | Remarks          |                                        |
|  1.  | GI Pipe   | [Main WH  |v] | 15  | 120.00   | 1,800.00  | DC-124           | [ + Add DC Source ]                    |
|  2.  | T-Joint   | [Scrap WH |v] | 5   | 45.00    | 225.00    | Inv-093          | [ + Add Invoice Source ]               |
|                                                                                  | [ Save Mapping ]                       |
| [ Load from BOQ ]  [ Add Multiple Items ]  [ Add Item Manually ]                 |                                        |
|                                                                                  |                                        |
| Next Action Details:                                                             |                                        |
| Type: [ Credit Note | v ]  Due Date: [ 25 Jul ]                                  |                                        |
| Assigned To: [ Rakesh Sharma (Billing)    | v ]                                  |                                        |
| Remarks: [ Please verify pricing & issue CN ]                                    |                                        |
|                                                                                  |                                        |
| [ Save Draft ]  [ Complete Return ]  [ Export PDF ]  [ Export Excel ]            |                                        |
+----------------------------------------------------------------------------------+----------------------------------------+
```

### Left Panel (Main Interface):
- Metadata forms (Return #, Return Date, Project Selector, **Client Name auto-label**, Remarks, Default Warehouse selector, Source Documents Filter, Customer DC No, Vehicle No/Name, and Returned By employee selector).
  - The **Client Name** is dynamically resolved and displayed once a Project is selected.
- **Source Documents Filter (Multi-Select Dropdown)**: Allows the user to select specific DCs and/or Invoices. 
  - If selected, clicking **Auto-load BOQ** will fetch only the items and quantities that were physically delivered on those specific documents.
  - If selected, the Right Panel's source mapping drawer will automatically filter to show matching lines only from these documents.
  - If left blank, the system defaults to showing all historical DCs/Invoices and pulling from the project's entire BOQ.
- Selecting a Default Warehouse bulk-applies it as the target for all return items.
- Returns items table containing columns: `S.No`, `Item & Variant`, Warehouse override selector, `Quantity`, `Unit`, `Rate (₹)`, `Total (₹)`, and `Remarks` (showing source references).
- Action buttons before the table:
  - **[ Load from BOQ ]**: Auto-fills the returned items table using planned materials.
  - **[ Add Multiple Items ]**: Opens a bulk picker modal to select several materials at once.
  - **[ Add Item Manually ]**: Appends a single empty row to the table.
- **Next Action Configuration Panel** (located at the bottom of the form):
  - **Type**: Dropdown selecting the next step (e.g. `'credit_note'`, `'inspection'`, `'stock_transfer'`, `'other'`).
  - **Assigned To**: Dropdown selecting an employee from the organization.
  - **Due Date**: Date field specifying when the action is required.
  - **Remarks**: Text area for instructions to the assigned owner.
- Submission and Export buttons:
  - **[ Save Draft ]**: Persists document to database with `'draft'` status.
  - **[ Complete Return ]**: Validates allocations, serializes transaction with row locks, updates `item_stock`, updates consumption logs, and moves status to `'completed'`.
  - **[ Export PDF ]**: Downloads a styled PDF document using custom billing grid layouts.
  - **[ Export Excel ]**: Generates a standard grid spreadsheet sheet (`xlsx`).

### Right Panel (Mapping Drawer):
- Triggered by selecting any row in the Left Panel table.
- **Explicit Source Card Details**: Displays the supply **Date**, **Supplied Qty**, **Previously Returned Qty**, and **Available Qty to Return** inline.
- Allows splitting the return quantity across multiple source documents by checking the box and inputting specific return values.
- Mapped document numbers populate the item's Remarks column automatically.

---

## 4. Business Logic & Conversions

### 4.1 Billing vs Stock Allocation
- **Invoices**: Mapped returned quantities are financial returns. They carry tax information and represent money to be credited back.
- **Delivery Challans (DCs)**: Mapped returned quantities represent physical stock moves back to warehouses.

### 4.2 Credit Note Conversion Rules
- **No DC Conversions**: Return items/quantities mapped to DCs **cannot** be converted to Credit Notes.
- **Invoice Conversions & Grouping**: Only returned items/quantities mapped to original Invoices can be converted to Credit Notes.
  * **Indian GST Grouping Rule**: Credit Notes must map to a single originating invoice. If a single Return document contains mappings spanning multiple unique invoices, the system will generate **one Credit Note per unique source invoice**, grouping items by `invoice_id`.
  * For each returned item, the Credit Note line item uses the exact `rate`, `discount_amount`, and tax rates (`cgst_percent`, `sgst_percent`, `igst_percent`) from the original invoice item.
  * The generated Credit Note references the `invoice_id` in its header.

### 4.3 Warehouse Stock Updates
Returned materials (both Invoice-mapped and DC-mapped) must update warehouse stock levels in `item_stock` on completion/cancellation. The destination warehouse is resolved using the following fallback chain:
1. Item-level warehouse selection (`return_items.warehouse_id`).
2. Header-level default warehouse selection (`returns.default_warehouse_id`).
3. Original supplying document warehouse (`delivery_challan_items.warehouse_id` or `invoice_items.meta_json->>'warehouse_id'`).

- When a Return moves to `'completed'`:
  - The resolved warehouse receives the returned stock. The `current_stock` column in `item_stock` is incremented.
- When a Return moves to `'cancelled'`:
  - The stock is decremented symmetrically to reverse the return action.

### 4.4 Lock State post Completion/Cancellation
Once a return is marked as `completed` or `cancelled`, the document and all associated tables are locked from modification:
- A trigger on `returns` prevents updates if status is `completed` or `cancelled`.
- Triggers on `return_items` and `return_sources` prevent insert, update, or delete operations once the parent return status is finalized.
- If a document is in error, the user must update its status to `cancelled` (reversing inventory changes) or create a corrective return.

---

## 5. Consumption Report Reconciliation

Once a return document is finalized (`status = 'completed'`), it updates the Project Consumption Summary.

### Formulas:
- **Net Supplied Qty** = `Received Qty` - `Returned Qty`
- **Actual Qty on Site** = `Received Qty` - `Used Qty` - `Returned Qty`

We will add a `returned_qty DECIMAL(10,2) DEFAULT 0` column to the `material_consumption_summary` table. The calculation RPC `update_material_consumption_summary` will fetch and sum return quantities from `return_items` where `returns.status = 'completed'`. If a return is `cancelled`, its quantities are ignored, reversing its effect.

---

## 6. Sequence & Business Validation Rules

### 6.1 Return Number Generation
Return numbers are generated sequentially per organisation. To handle numbering conflicts under concurrent creations cleanly, the insert function should employ an app-level retry-on-conflict block if it hits the `unique_return_number_per_org` constraint.
```sql
CREATE OR REPLACE FUNCTION generate_return_number(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM returns WHERE organisation_id = org_id;
  RETURN 'RET-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

### 6.2 Over-Return Prevention (Mapping Stage)
To prevent mapping more than the supplied quantity on any original document line during mapping drafts:
```sql
CREATE OR REPLACE FUNCTION validate_return_quantity()
RETURNS TRIGGER AS $$
DECLARE
  original_qty DECIMAL(10,2);
  total_returned DECIMAL(10,2);
BEGIN
  -- 1. Get original quantity
  IF NEW.invoice_item_id IS NOT NULL THEN
    SELECT qty INTO original_qty FROM invoice_items WHERE id = NEW.invoice_item_id;
  ELSE
    SELECT quantity INTO original_qty FROM delivery_challan_items WHERE id = NEW.delivery_challan_item_id;
  END IF;

  IF original_qty IS NULL THEN
    RAISE EXCEPTION 'Original source item not found.';
  END IF;

  -- 2. Calculate already returned quantity (excluding current row if updating)
  SELECT COALESCE(SUM(rs.quantity), 0)
  INTO total_returned
  FROM return_sources rs
  JOIN return_items ri ON ri.id = rs.return_item_id
  JOIN returns r ON r.id = ri.return_id
  WHERE (rs.invoice_item_id = NEW.invoice_item_id OR rs.delivery_challan_item_id = NEW.delivery_challan_item_id)
    AND r.status = 'completed'
    AND rs.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 3. Validate
  IF (total_returned + NEW.quantity) > original_qty THEN
    RAISE EXCEPTION 'Return quantity % exceeds remaining available supply quantity % (Original: %, Already Returned: %)', 
      NEW.quantity, (original_qty - total_returned), original_qty, total_returned;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_return_quantity
  BEFORE INSERT OR UPDATE ON return_sources
  FOR EACH ROW EXECUTE FUNCTION validate_return_quantity();
```

### 6.3 Over-Return Prevention (Completion Stage / Race Condition Fix)
To prevent race conditions where two draft returns collectively over-allocate a source line, this trigger re-evaluates all return quantities when transitioning the document status to `'completed'`.
Acquiring an explicit row lock (`FOR UPDATE`) on the target `invoice_items` or `delivery_challan_items` row serializes concurrent transactions updating the same source line.
```sql
CREATE OR REPLACE FUNCTION validate_return_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  ri RECORD;
  rs RECORD;
  original_qty DECIMAL(10,2);
  total_returned DECIMAL(10,2);
  lock_placeholder INT;
BEGIN
  -- Re-validate only when status transitions to 'completed'
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    -- Loop through all return_items of this return
    FOR ri IN (SELECT id, item_id, variant_id FROM return_items WHERE return_id = NEW.id) LOOP
      -- Loop through return_sources of this return item
      FOR rs IN (SELECT id, invoice_item_id, delivery_challan_item_id, quantity FROM return_sources WHERE return_item_id = ri.id) LOOP
        
        -- Acquire row lock to serialize same-instant completions on identical source lines
        IF rs.invoice_item_id IS NOT NULL THEN
          SELECT 1 INTO lock_placeholder FROM invoice_items WHERE id = rs.invoice_item_id FOR UPDATE;
          SELECT qty INTO original_qty FROM invoice_items WHERE id = rs.invoice_item_id;
        ELSE
          SELECT 1 INTO lock_placeholder FROM delivery_challan_items WHERE id = rs.delivery_challan_item_id FOR UPDATE;
          SELECT quantity INTO original_qty FROM delivery_challan_items WHERE id = rs.delivery_challan_item_id;
        END IF;

        IF original_qty IS NULL THEN
          RAISE EXCEPTION 'Original source item not found for source mapping ID %.', rs.id;
        END IF;

        -- Calculate already returned quantity (excluding CURRENT return's mappings)
        SELECT COALESCE(SUM(rs_other.quantity), 0)
        INTO total_returned
        FROM return_sources rs_other
        JOIN return_items ri_other ON ri_other.id = rs_other.return_item_id
        JOIN returns r_other ON r_other.id = ri_other.return_id
        WHERE (
          (rs_other.invoice_item_id = rs.invoice_item_id AND rs.invoice_item_id IS NOT NULL) OR 
          (rs_other.delivery_challan_item_id = rs.delivery_challan_item_id AND rs.delivery_challan_item_id IS NOT NULL)
        )
          AND r_other.status = 'completed'
          AND r_other.id <> NEW.id; -- exclude this return document

        -- Validate
        IF (total_returned + rs.quantity) > original_qty THEN
          RAISE EXCEPTION 'Cannot complete return. Mapped quantity of % for item % exceeds remaining available supply quantity % (Original: %, Already Returned: %)', 
            rs.quantity, ri.item_id, (original_qty - total_returned), original_qty, total_returned;
        END IF;

      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_return_on_complete
  BEFORE UPDATE OF status ON returns
  FOR EACH ROW
  EXECUTE FUNCTION validate_return_on_complete();
```

### 6.4 Warehouse Inventory Update Trigger
Handles stock allocations when a return is completed or cancelled, supporting both Invoice and DC mappings. Employs the fallback warehouse logic.
```sql
CREATE OR REPLACE FUNCTION update_warehouse_stock_on_return_complete()
RETURNS TRIGGER AS $$
DECLARE
  ri RECORD;
  rs RECORD;
  target_warehouse_id UUID;
  current_qty DECIMAL(10,2);
  stock_id UUID;
BEGIN
  -- Return moves from NOT completed to completed: increment stock
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    FOR ri IN (SELECT id, item_id, variant_id, warehouse_id, is_scrap FROM return_items WHERE return_id = NEW.id) LOOP
      -- Skip physical restocking if marked as scrap
      IF ri.is_scrap THEN
        CONTINUE;
      END IF;

      FOR rs IN (SELECT id, invoice_item_id, delivery_challan_item_id, quantity FROM return_sources WHERE return_item_id = ri.id) LOOP
        
        -- Resolve warehouse_id depending on fallback chain
        IF ri.warehouse_id IS NOT NULL THEN
          target_warehouse_id := ri.warehouse_id;
        ELSIF NEW.default_warehouse_id IS NOT NULL THEN
          target_warehouse_id := NEW.default_warehouse_id;
        ELSIF rs.delivery_challan_item_id IS NOT NULL THEN
          SELECT warehouse_id INTO target_warehouse_id FROM delivery_challan_items WHERE id = rs.delivery_challan_item_id;
        ELSIF rs.invoice_item_id IS NOT NULL THEN
          SELECT (meta_json->>'warehouse_id')::uuid INTO target_warehouse_id FROM invoice_items WHERE id = rs.invoice_item_id;
        END IF;
        
        IF target_warehouse_id IS NOT NULL THEN
          -- Check if stock row exists
          SELECT id, current_stock INTO stock_id, current_qty 
          FROM item_stock 
          WHERE item_id = ri.item_id 
            AND (company_variant_id = ri.variant_id OR (company_variant_id IS NULL AND ri.variant_id IS NULL))
            AND warehouse_id = target_warehouse_id;

          IF stock_id IS NOT NULL THEN
            UPDATE item_stock 
            SET current_stock = current_stock + rs.quantity, 
                updated_at = NOW() 
            WHERE id = stock_id;
          ELSE
            INSERT INTO item_stock (item_id, company_variant_id, warehouse_id, organisation_id, current_stock)
            VALUES (ri.item_id, ri.variant_id, target_warehouse_id, NEW.organisation_id, rs.quantity);
          END IF;
        END IF;
      END LOOP;
    END LOOP;

  -- Return moves from completed to cancelled: decrement stock (reversal)
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN
    FOR ri IN (SELECT id, item_id, variant_id, warehouse_id, is_scrap FROM return_items WHERE return_id = NEW.id) LOOP
      -- Skip physical restocking reversal if marked as scrap
      IF ri.is_scrap THEN
        CONTINUE;
      END IF;

      FOR rs IN (SELECT id, invoice_item_id, delivery_challan_item_id, quantity FROM return_sources WHERE return_item_id = ri.id) LOOP
        
        -- Resolve warehouse_id depending on fallback chain
        IF ri.warehouse_id IS NOT NULL THEN
          target_warehouse_id := ri.warehouse_id;
        ELSIF NEW.default_warehouse_id IS NOT NULL THEN
          target_warehouse_id := NEW.default_warehouse_id;
        ELSIF rs.delivery_challan_item_id IS NOT NULL THEN
          SELECT warehouse_id INTO target_warehouse_id FROM delivery_challan_items WHERE id = rs.delivery_challan_item_id;
        ELSIF rs.invoice_item_id IS NOT NULL THEN
          SELECT (meta_json->>'warehouse_id')::uuid INTO target_warehouse_id FROM invoice_items WHERE id = rs.invoice_item_id;
        END IF;
        
        IF target_warehouse_id IS NOT NULL THEN
          SELECT id INTO stock_id 
          FROM item_stock 
          WHERE item_id = ri.item_id 
            AND (company_variant_id = ri.variant_id OR (company_variant_id IS NULL AND ri.variant_id IS NULL))
            AND warehouse_id = target_warehouse_id;

          IF stock_id IS NOT NULL THEN
            UPDATE item_stock 
            SET current_stock = GREATEST(0, current_stock - rs.quantity), 
                updated_at = NOW() 
            WHERE id = stock_id;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_stock_on_return_complete
  AFTER UPDATE OF status ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_stock_on_return_complete();
```

---

## 7. Document Exports

### 7.1 Excel Export (`xlsx`)
We will dynamically import the `xlsx` library and export the returns list matching:
- **Headers**: Company Logo/Name, Return Number, Date, Project Name.
- **Table Columns**: `S.No`, `Item Description`, `Variant`, `Unit`, `Quantity`, `Rate`, `Total`, `Mapped Documents / Remarks`.

### 7.2 PDF Export (`jspdf` + `jspdf-autotable`)
Using the project's existing custom PDF formatting layouts in `apps/web/src/pdf/proGridLayout`, we will build a PDF export for Return documents that renders:
- Double border frame layout.
- Company details banner.
- Mapped Client information and Project name.
- Standardized tabular view of returned items.
- Remarks and authorized signature line.
