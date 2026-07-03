-- ============================================================
-- SALES ORDERS & MRP INTEGRATION — DATABASE MIGRATION
-- Version: 1.0
-- Date: 2026-06-29
-- ============================================================

-- ============================================================
-- 1. CREATE SALES ORDERS HEADER TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_no VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE RESTRICT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotation_header(id) ON DELETE SET NULL,
  client_po_id UUID REFERENCES client_purchase_orders(id) ON DELETE SET NULL,
  approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  billing_address TEXT,
  shipping_address TEXT,
  gstin VARCHAR(50),
  state VARCHAR(100),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'waiting_approval', 'open', 'in_production', 'partially_shipped', 'completed', 'cancelled')),
  stock_status VARCHAR(30) DEFAULT 'shortfall' CHECK (stock_status IN ('fully_reserved', 'partially_reserved', 'shortfall')),
  remarks TEXT,
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  grand_total DECIMAL(15,2) DEFAULT 0,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_select" ON sales_orders;
DROP POLICY IF EXISTS "org_isolation_insert" ON sales_orders;
DROP POLICY IF EXISTS "org_isolation_update" ON sales_orders;
DROP POLICY IF EXISTS "org_isolation_delete" ON sales_orders;

CREATE POLICY "org_isolation_select" ON sales_orders 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_insert" ON sales_orders 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_update" ON sales_orders 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_delete" ON sales_orders 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_sales_orders_org ON sales_orders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_client ON sales_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_no ON sales_orders(sales_order_no);

-- ============================================================
-- 2. CREATE SALES ORDER ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  description TEXT,
  qty DECIMAL(12,3) NOT NULL,
  reserved_qty DECIMAL(12,3) DEFAULT 0,
  produced_qty DECIMAL(12,3) DEFAULT 0,
  shipped_qty DECIMAL(12,3) DEFAULT 0,
  uom VARCHAR(20) NOT NULL,
  rate DECIMAL(15,4) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'reserved', 'in_production', 'ready_to_ship', 'partially_shipped', 'shipped', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_select" ON sales_order_items;
DROP POLICY IF EXISTS "org_isolation_insert" ON sales_order_items;
DROP POLICY IF EXISTS "org_isolation_update" ON sales_order_items;
DROP POLICY IF EXISTS "org_isolation_delete" ON sales_order_items;

CREATE POLICY "org_isolation_select" ON sales_order_items 
  FOR SELECT USING (sales_order_id IN (
    SELECT id FROM sales_orders WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "org_isolation_insert" ON sales_order_items 
  FOR INSERT WITH CHECK (sales_order_id IN (
    SELECT id FROM sales_orders WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "org_isolation_update" ON sales_order_items 
  FOR UPDATE USING (sales_order_id IN (
    SELECT id FROM sales_orders WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "org_isolation_delete" ON sales_order_items 
  FOR DELETE USING (sales_order_id IN (
    SELECT id FROM sales_orders WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX IF NOT EXISTS idx_so_items_sales_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_material ON sales_order_items(item_id);

-- ============================================================
-- 3. CREATE SALES ORDER RESERVATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_order_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES materials(id) ON DELETE CASCADE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT NOT NULL,
  qty DECIMAL(12,3) NOT NULL CHECK (qty > 0),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales_order_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_select" ON sales_order_reservations;
DROP POLICY IF EXISTS "org_isolation_insert" ON sales_order_reservations;
DROP POLICY IF EXISTS "org_isolation_update" ON sales_order_reservations;
DROP POLICY IF EXISTS "org_isolation_delete" ON sales_order_reservations;

CREATE POLICY "org_isolation_select" ON sales_order_reservations 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_insert" ON sales_order_reservations 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_update" ON sales_order_reservations 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_delete" ON sales_order_reservations 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_so_reservations_item ON sales_order_reservations(sales_order_item_id);
CREATE INDEX IF NOT EXISTS idx_so_reservations_material ON sales_order_reservations(item_id);
CREATE INDEX IF NOT EXISTS idx_so_reservations_wh ON sales_order_reservations(warehouse_id);

-- ============================================================
-- 4. MODIFY EXISTING TABLES
-- ============================================================

-- Add fields to job_cards if missing
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS approval_id UUID REFERENCES approvals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_job_cards_so_item ON job_cards(sales_order_item_id);

-- Add fields to purchase_orders if missing
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_so ON purchase_orders(sales_order_id);

-- Add fields to delivery_challans & items if missing
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_challans_so ON delivery_challans(sales_order_id);

ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES sales_order_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dc_items_so_item ON delivery_challan_items(sales_order_item_id);

-- ============================================================
-- 5. CREATE HELPER FUNCTIONS
-- ============================================================

-- Generate Sales Order number
CREATE OR REPLACE FUNCTION generate_sales_order_no(p_org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  new_no VARCHAR;
  current_year INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COALESCE(MAX(CAST(SUBSTRING(sales_order_no FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales_orders
  WHERE organisation_id = p_org_id
  AND SUBSTRING(sales_order_no FROM 4 FOR 4) = current_year::TEXT;
  
  new_no := 'SO-' || current_year::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. CREATE TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================

-- A. Update Quotation Status Lock on SO insert/update/cancel
CREATE OR REPLACE FUNCTION sync_quotation_conversion_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- If SO is created and is not cancelled/draft, lock the Quotation
    IF NEW.quotation_id IS NOT NULL AND NEW.status NOT IN ('draft', 'cancelled') THEN
      UPDATE quotation_header
      SET status = 'converted'
      WHERE id = NEW.quotation_id;
    -- If SO is cancelled, unlock the Quotation back to Approved
    ELSIF NEW.quotation_id IS NOT NULL AND NEW.status = 'cancelled' THEN
      UPDATE quotation_header
      SET status = 'Approved'
      WHERE id = NEW.quotation_id;
    END IF;
  END IF;
  
  -- Handle delete
  IF TG_OP = 'DELETE' THEN
    IF OLD.quotation_id IS NOT NULL THEN
      UPDATE quotation_header
      SET status = 'Approved'
      WHERE id = OLD.quotation_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_quotation_conversion ON sales_orders;
CREATE TRIGGER trigger_sync_quotation_conversion
  AFTER INSERT OR UPDATE OR DELETE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_quotation_conversion_status();

-- B. Calculate Sales Order Item Status based on quantity fields
CREATE OR REPLACE FUNCTION calculate_sales_order_item_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipped_qty >= NEW.qty THEN
    NEW.status := 'shipped';
  ELSIF NEW.shipped_qty > 0 THEN
    NEW.status := 'partially_shipped';
  ELSIF NEW.reserved_qty >= NEW.qty THEN
    NEW.status := 'reserved';
  ELSIF NEW.produced_qty >= NEW.qty THEN
    NEW.status := 'ready_to_ship';
  ELSIF NEW.produced_qty > 0 THEN
    NEW.status := 'in_production';
  ELSE
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_so_item_status ON sales_order_items;
CREATE TRIGGER trigger_calculate_so_item_status
  BEFORE INSERT OR UPDATE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sales_order_item_status();

-- C. Sync Sales Order Stock status dynamically
CREATE OR REPLACE FUNCTION sync_so_stock_status()
RETURNS TRIGGER AS $$
DECLARE
  v_so_id UUID;
  v_total_items INTEGER;
  v_reserved_items INTEGER;
  v_partial_reserved_items INTEGER;
  v_new_status VARCHAR(30);
BEGIN
  -- Determine SO ID
  IF TG_OP = 'DELETE' THEN
    v_so_id := OLD.sales_order_id;
  ELSE
    v_so_id := NEW.sales_order_id;
  END IF;
  
  IF v_so_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Count total items in the SO
  SELECT COUNT(*) INTO v_total_items FROM sales_order_items WHERE sales_order_id = v_so_id;
  
  -- Count fully reserved items
  SELECT COUNT(*) INTO v_reserved_items 
  FROM sales_order_items 
  WHERE sales_order_id = v_so_id AND reserved_qty >= qty;
  
  -- Count partially reserved items
  SELECT COUNT(*) INTO v_partial_reserved_items 
  FROM sales_order_items 
  WHERE sales_order_id = v_so_id AND reserved_qty > 0 AND reserved_qty < qty;

  IF v_total_items = 0 THEN
    v_new_status := 'shortfall';
  ELSIF v_reserved_items = v_total_items THEN
    v_new_status := 'fully_reserved';
  ELSIF v_reserved_items > 0 OR v_partial_reserved_items > 0 THEN
    v_new_status := 'partially_reserved';
  ELSE
    v_new_status := 'shortfall';
  END IF;

  UPDATE sales_orders SET stock_status = v_new_status WHERE id = v_so_id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_so_stock_status_items ON sales_order_items;
CREATE TRIGGER trigger_sync_so_stock_status_items
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_so_stock_status();

-- D. Update reserved_qty in sales_order_items from reservations
CREATE OR REPLACE FUNCTION update_so_item_reserved_qty()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id UUID;
  v_total_res DECIMAL(12,3);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.sales_order_item_id;
  ELSE
    v_item_id := NEW.sales_order_item_id;
  END IF;

  SELECT COALESCE(SUM(qty), 0) INTO v_total_res
  FROM sales_order_reservations
  WHERE sales_order_item_id = v_item_id;

  UPDATE sales_order_items SET reserved_qty = v_total_res WHERE id = v_item_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reserved_qty ON sales_order_reservations;
CREATE TRIGGER trigger_update_reserved_qty
  AFTER INSERT OR UPDATE OR DELETE ON sales_order_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_so_item_reserved_qty();

-- E. Auto-reserve newly produced finished goods on Production Entry completion
CREATE OR REPLACE FUNCTION auto_reserve_on_production_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_so_item_id UUID;
  v_item_id UUID;
  v_org_id UUID;
  v_ordered_qty DECIMAL(12,3);
  v_reserved_qty DECIMAL(12,3);
  v_to_reserve DECIMAL(12,3);
  v_fg_wh_id UUID;
BEGIN
  -- 1. Check if production entry corresponds to a job card linked to a sales order item
  SELECT sales_order_item_id, organisation_id
  INTO v_so_item_id, v_org_id
  FROM job_cards
  WHERE id = NEW.job_card_id;

  IF v_so_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch sales order item details
  SELECT item_id, qty, reserved_qty
  INTO v_item_id, v_ordered_qty, v_reserved_qty
  FROM sales_order_items
  WHERE id = v_so_item_id;

  -- 3. Calculate reservation amount with overshoot cap
  v_to_reserve := LEAST(NEW.actual_qty, v_ordered_qty - v_reserved_qty);

  IF v_to_reserve > 0 THEN
    -- Get FG Warehouse for this organization
    SELECT id INTO v_fg_wh_id 
    FROM warehouses 
    WHERE organisation_id = v_org_id 
    AND warehouse_purpose = 'fg' 
    LIMIT 1;

    -- Fallback: lookup by name/code
    IF v_fg_wh_id IS NULL THEN
      SELECT id INTO v_fg_wh_id 
      FROM warehouses 
      WHERE organisation_id = v_org_id 
      AND (warehouse_code = 'FG-001' OR name ILIKE '%Finished%') 
      LIMIT 1;
    END IF;

    -- If warehouse exists, create the reservation row
    IF v_fg_wh_id IS NOT NULL THEN
      INSERT INTO sales_order_reservations (
        sales_order_item_id, item_id, warehouse_id, qty, organisation_id
      ) VALUES (
        v_so_item_id, v_item_id, v_fg_wh_id, v_to_reserve, v_org_id
      );

      -- Update produced_qty in sales_order_items
      UPDATE sales_order_items 
      SET produced_qty = COALESCE(produced_qty, 0) + NEW.actual_qty 
      WHERE id = v_so_item_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_reserve_on_prod ON production_entries;
CREATE TRIGGER trigger_auto_reserve_on_prod
  AFTER INSERT ON production_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_reserve_on_production_receipt();
