-- Migration: Material Returns Module
-- Date: 2026-07-22

-- 1. Create public.returns (Header)
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  return_number VARCHAR(100) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  default_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  customer_dc_number VARCHAR(100),
  vehicle_number VARCHAR(100),
  returned_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  remarks TEXT,
  next_action_type VARCHAR(50) CHECK (next_action_type IN ('credit_note', 'inspection', 'stock_transfer', 'other')),
  next_action_remarks TEXT,
  next_action_assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  next_action_due_date DATE,
  next_action_status VARCHAR(50) DEFAULT 'pending' CHECK (next_action_status IN ('pending', 'completed', 'deferred')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_return_number_per_org UNIQUE(organisation_id, return_number),
  CONSTRAINT chk_returns_status CHECK (status IN ('draft', 'completed', 'cancelled'))
);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable RLS for returns by organisation" ON public.returns;
CREATE POLICY "Enable RLS for returns by organisation" ON public.returns
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid) 
  WITH CHECK (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_returns_project_id ON public.returns(project_id);
CREATE INDEX IF NOT EXISTS idx_returns_org_id ON public.returns(organisation_id);

-- 2. Create public.return_items (Line Items)
CREATE TABLE IF NOT EXISTS public.return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES materials(id),
  variant_id UUID REFERENCES company_variants(id),
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  is_scrap BOOLEAN DEFAULT false,
  rate DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable RLS for return_items by organisation" ON public.return_items;
CREATE POLICY "Enable RLS for return_items by organisation" ON public.return_items
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid) 
  WITH CHECK (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_org_id ON public.return_items(organisation_id);

-- 3. Create public.return_sources (Audit & Reconciliation Mappings)
CREATE TABLE IF NOT EXISTS public.return_sources (
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

ALTER TABLE public.return_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable RLS for return_sources" ON public.return_sources;
CREATE POLICY "Enable RLS for return_sources" ON public.return_sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM return_items 
      WHERE return_items.id = return_sources.return_item_id 
        AND return_items.organisation_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

CREATE INDEX IF NOT EXISTS idx_return_sources_item_id ON public.return_sources(return_item_id);
CREATE INDEX IF NOT EXISTS idx_return_sources_invoice_item_id ON public.return_sources(invoice_item_id) WHERE invoice_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_sources_dc_item_id ON public.return_sources(delivery_challan_item_id) WHERE delivery_challan_item_id IS NOT NULL;

-- 4. Number Series Generator
CREATE OR REPLACE FUNCTION public.generate_return_number(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM public.returns WHERE organisation_id = org_id;
  RETURN 'RET-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger Functions & Triggers

-- 5.1 Validation: Over-Return on Draft Insert/Update
CREATE OR REPLACE FUNCTION public.validate_return_quantity()
RETURNS TRIGGER AS $$
DECLARE
  original_qty DECIMAL(10,2);
  total_returned DECIMAL(10,2);
BEGIN
  -- Get original quantity
  IF NEW.invoice_item_id IS NOT NULL THEN
    SELECT qty INTO original_qty FROM public.invoice_items WHERE id = NEW.invoice_item_id;
  ELSE
    SELECT quantity INTO original_qty FROM public.delivery_challan_items WHERE id = NEW.delivery_challan_item_id;
  END IF;

  IF original_qty IS NULL THEN
    RAISE EXCEPTION 'Original source item not found.';
  END IF;

  -- Calculate already returned quantity (completed only, excluding current row if update)
  SELECT COALESCE(SUM(rs.quantity), 0)
  INTO total_returned
  FROM public.return_sources rs
  JOIN public.return_items ri ON ri.id = rs.return_item_id
  JOIN public.returns r ON r.id = ri.return_id
  WHERE (
    (rs.invoice_item_id = NEW.invoice_item_id AND NEW.invoice_item_id IS NOT NULL) OR 
    (rs.delivery_challan_item_id = NEW.delivery_challan_item_id AND NEW.delivery_challan_item_id IS NOT NULL)
  )
    AND r.status = 'completed'
    AND rs.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (total_returned + NEW.quantity) > original_qty THEN
    RAISE EXCEPTION 'Return quantity % exceeds remaining available supply quantity % (Original: %, Already Returned: %)', 
      NEW.quantity, (original_qty - total_returned), original_qty, total_returned;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_return_quantity ON public.return_sources;
CREATE TRIGGER trigger_validate_return_quantity
  BEFORE INSERT OR UPDATE ON public.return_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_return_quantity();

-- 5.2 Concurrency Safeguard: Over-Return on Status 'completed'
CREATE OR REPLACE FUNCTION public.validate_return_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  ri RECORD;
  rs RECORD;
  original_qty DECIMAL(10,2);
  total_returned DECIMAL(10,2);
  lock_placeholder INT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    -- Loop through all child items
    FOR ri IN (SELECT id, item_id, variant_id FROM public.return_items WHERE return_id = NEW.id) LOOP
      -- Loop through source mappings
      FOR rs IN (SELECT id, invoice_item_id, delivery_challan_item_id, quantity FROM public.return_sources WHERE return_item_id = ri.id) LOOP
        
        -- Acquire row lock to serialize same-instant completions
        IF rs.invoice_item_id IS NOT NULL THEN
          SELECT 1 INTO lock_placeholder FROM public.invoice_items WHERE id = rs.invoice_item_id FOR UPDATE;
          SELECT qty INTO original_qty FROM public.invoice_items WHERE id = rs.invoice_item_id;
        ELSE
          SELECT 1 INTO lock_placeholder FROM public.delivery_challan_items WHERE id = rs.delivery_challan_item_id FOR UPDATE;
          SELECT quantity INTO original_qty FROM public.delivery_challan_items WHERE id = rs.delivery_challan_item_id;
        END IF;

        IF original_qty IS NULL THEN
          RAISE EXCEPTION 'Original source item not found for source mapping ID %.', rs.id;
        END IF;

        -- Sum already returned quantities (excluding current return document)
        SELECT COALESCE(SUM(rs_other.quantity), 0)
        INTO total_returned
        FROM public.return_sources rs_other
        JOIN public.return_items ri_other ON ri_other.id = rs_other.return_item_id
        JOIN public.returns r_other ON r_other.id = ri_other.return_id
        WHERE (
          (rs_other.invoice_item_id = rs.invoice_item_id AND rs.invoice_item_id IS NOT NULL) OR 
          (rs_other.delivery_challan_item_id = rs.delivery_challan_item_id AND rs.delivery_challan_item_id IS NOT NULL)
        )
          AND r_other.status = 'completed'
          AND r_other.id <> NEW.id;

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

DROP TRIGGER IF EXISTS trigger_validate_return_on_complete ON public.returns;
CREATE TRIGGER trigger_validate_return_on_complete
  BEFORE UPDATE OF status ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_return_on_complete();

-- 5.3 Lock completed / cancelled documents
CREATE OR REPLACE FUNCTION public.lock_completed_returns()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Document is locked. Completed or Cancelled return documents cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_completed_returns ON public.returns;
CREATE TRIGGER trigger_lock_completed_returns
  BEFORE UPDATE OR DELETE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_completed_returns();

-- Lock child lines for completed returns
CREATE OR REPLACE FUNCTION public.lock_return_child_items()
RETURNS TRIGGER AS $$
DECLARE
  parent_status VARCHAR(50);
BEGIN
  SELECT status INTO parent_status FROM public.returns WHERE id = COALESCE(OLD.return_id, NEW.return_id);
  IF parent_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Return items are locked because the parent document is completed or cancelled.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_return_child_items ON public.return_items;
CREATE TRIGGER trigger_lock_return_child_items
  BEFORE INSERT OR UPDATE OR DELETE ON public.return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_return_child_items();

-- Lock mappings
CREATE OR REPLACE FUNCTION public.lock_return_sources()
RETURNS TRIGGER AS $$
DECLARE
  parent_status VARCHAR(50);
BEGIN
  SELECT r.status INTO parent_status 
  FROM public.returns r
  JOIN public.return_items ri ON ri.return_id = r.id
  WHERE ri.id = COALESCE(OLD.return_item_id, NEW.return_item_id);
  
  IF parent_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Return source mappings are locked because the parent document is completed or cancelled.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_return_sources ON public.return_sources;
CREATE TRIGGER trigger_lock_return_sources
  BEFORE INSERT OR UPDATE OR DELETE ON public.return_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_return_sources();

-- 5.4 Warehouse Restocking Trigger
CREATE OR REPLACE FUNCTION public.update_warehouse_stock_on_return_complete()
RETURNS TRIGGER AS $$
DECLARE
  ri RECORD;
  rs RECORD;
  target_warehouse_id UUID;
  stock_id UUID;
BEGIN
  -- Transition to Completed: Increment stock
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    FOR ri IN (SELECT id, item_id, variant_id, warehouse_id, is_scrap FROM public.return_items WHERE return_id = NEW.id) LOOP
      IF ri.is_scrap THEN
        CONTINUE;
      END IF;

      FOR rs IN (SELECT id, invoice_item_id, delivery_challan_item_id, quantity FROM public.return_sources WHERE return_item_id = ri.id) LOOP
        
        -- Fallback Warehouse logic
        IF ri.warehouse_id IS NOT NULL THEN
          target_warehouse_id := ri.warehouse_id;
        ELSIF NEW.default_warehouse_id IS NOT NULL THEN
          target_warehouse_id := NEW.default_warehouse_id;
        ELSIF rs.delivery_challan_item_id IS NOT NULL THEN
          SELECT warehouse_id INTO target_warehouse_id FROM public.delivery_challan_items WHERE id = rs.delivery_challan_item_id;
        ELSIF rs.invoice_item_id IS NOT NULL THEN
          SELECT (meta_json->>'warehouse_id')::uuid INTO target_warehouse_id FROM public.invoice_items WHERE id = rs.invoice_item_id;
        END IF;

        IF target_warehouse_id IS NOT NULL THEN
          SELECT id INTO stock_id 
          FROM public.item_stock 
          WHERE item_id = ri.item_id 
            AND (company_variant_id = ri.variant_id OR (company_variant_id IS NULL AND ri.variant_id IS NULL))
            AND warehouse_id = target_warehouse_id;

          IF stock_id IS NOT NULL THEN
            UPDATE public.item_stock 
            SET current_stock = current_stock + rs.quantity, 
                updated_at = NOW() 
            WHERE id = stock_id;
          ELSE
            INSERT INTO public.item_stock (item_id, company_variant_id, warehouse_id, organisation_id, current_stock)
            VALUES (ri.item_id, ri.variant_id, target_warehouse_id, NEW.organisation_id, rs.quantity);
          END IF;
        END IF;

      END LOOP;
    END LOOP;

  -- Transition to Cancelled: Decrement stock (reversal)
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN
    FOR ri IN (SELECT id, item_id, variant_id, warehouse_id, is_scrap FROM public.return_items WHERE return_id = NEW.id) LOOP
      IF ri.is_scrap THEN
        CONTINUE;
      END IF;

      FOR rs IN (SELECT id, invoice_item_id, delivery_challan_item_id, quantity FROM public.return_sources WHERE return_item_id = ri.id) LOOP
        
        IF ri.warehouse_id IS NOT NULL THEN
          target_warehouse_id := ri.warehouse_id;
        ELSIF NEW.default_warehouse_id IS NOT NULL THEN
          target_warehouse_id := NEW.default_warehouse_id;
        ELSIF rs.delivery_challan_item_id IS NOT NULL THEN
          SELECT warehouse_id INTO target_warehouse_id FROM public.delivery_challan_items WHERE id = rs.delivery_challan_item_id;
        ELSIF rs.invoice_item_id IS NOT NULL THEN
          SELECT (meta_json->>'warehouse_id')::uuid INTO target_warehouse_id FROM public.invoice_items WHERE id = rs.invoice_item_id;
        END IF;

        IF target_warehouse_id IS NOT NULL THEN
          SELECT id INTO stock_id 
          FROM public.item_stock 
          WHERE item_id = ri.item_id 
            AND (company_variant_id = ri.variant_id OR (company_variant_id IS NULL AND ri.variant_id IS NULL))
            AND warehouse_id = target_warehouse_id;

          IF stock_id IS NOT NULL THEN
            UPDATE public.item_stock 
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

DROP TRIGGER IF EXISTS trigger_update_warehouse_stock_on_return_complete ON public.returns;
CREATE TRIGGER trigger_update_warehouse_stock_on_return_complete
  AFTER UPDATE OF status ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_warehouse_stock_on_return_complete();

-- 6. Consumption Summary Updates
ALTER TABLE public.material_consumption_summary ADD COLUMN IF NOT EXISTS returned_qty DECIMAL(10,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_material_consumption_summary(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  rec RECORD;
  planned_val DECIMAL(10,2);
  received_val DECIMAL(10,2);
  used_val DECIMAL(10,2);
  returned_val DECIMAL(10,2);
  target_org_id UUID;
BEGIN
  -- Resolve organisation_id from the project
  SELECT organisation_id INTO target_org_id FROM public.projects WHERE id = p_project_id;

  -- Loop through all item/variant combinations in the project
  FOR rec IN 
    SELECT DISTINCT item_id, variant_id 
    FROM public.project_material_list 
    WHERE project_id = p_project_id
    UNION
    SELECT DISTINCT item_id, variant_id 
    FROM public.material_logs 
    WHERE project_id = p_project_id
  LOOP
    -- Planned qty
    SELECT COALESCE(SUM(planned_qty), 0) INTO planned_val 
    FROM public.project_material_list 
    WHERE project_id = p_project_id AND item_id = rec.item_id 
      AND (variant_id = rec.variant_id OR (variant_id IS NULL AND rec.variant_id IS NULL));

    -- Received qty (IN logs)
    SELECT COALESCE(SUM(qty_received), 0) INTO received_val 
    FROM public.material_logs 
    WHERE project_id = p_project_id AND item_id = rec.item_id 
      AND (variant_id = rec.variant_id OR (variant_id IS NULL AND rec.variant_id IS NULL))
      AND type = 'IN';

    -- Used qty (OUT logs)
    SELECT COALESCE(SUM(qty_used), 0) INTO used_val 
    FROM public.material_logs 
    WHERE project_id = p_project_id AND item_id = rec.item_id 
      AND (variant_id = rec.variant_id OR (variant_id IS NULL AND rec.variant_id IS NULL))
      AND type = 'OUT';

    -- Returned qty (Completed returns)
    SELECT COALESCE(SUM(ri.quantity), 0) INTO returned_val
    FROM public.return_items ri
    JOIN public.returns r ON r.id = ri.return_id
    WHERE r.project_id = p_project_id AND ri.item_id = rec.item_id
      AND (ri.variant_id = rec.variant_id OR (ri.variant_id IS NULL AND rec.variant_id IS NULL))
      AND r.status = 'completed';

    -- Upsert summary
    INSERT INTO public.material_consumption_summary (
      project_id, organisation_id, item_id, variant_id, planned_qty, received_qty, used_qty, returned_qty, remaining_qty, last_updated
    ) VALUES (
      p_project_id, target_org_id, rec.item_id, rec.variant_id, planned_val, received_val, used_val, returned_val, (received_val - used_val - returned_val), NOW()
    )
    ON CONFLICT (project_id, item_id, variant_id) DO UPDATE SET
      planned_qty = EXCLUDED.planned_qty,
      received_qty = EXCLUDED.received_qty,
      used_qty = EXCLUDED.used_qty,
      returned_qty = EXCLUDED.returned_qty,
      remaining_qty = EXCLUDED.remaining_qty,
      last_updated = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;
