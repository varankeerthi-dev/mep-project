-- 1. Work Centers (Machines / Production Lines)
CREATE TABLE IF NOT EXISTS work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  work_center_type TEXT DEFAULT 'machine', -- machine | assembly_line | workstation
  capacity_per_hour NUMERIC(10,3) NOT NULL,
  capacity_uom TEXT NOT NULL DEFAULT 'nos',
  hours_per_shift NUMERIC(5,2) DEFAULT 8.0,
  shifts_per_day INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BOM to Work Center Mapping (compatibility & throughput)
CREATE TABLE IF NOT EXISTS bom_work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  work_center_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
  setup_time_minutes INTEGER DEFAULT 0,
  cycle_time_minutes NUMERIC(8,2) NOT NULL,
  is_preferred BOOLEAN DEFAULT false,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Production Plans (aggregates demand from open Sales Orders)
CREATE TABLE IF NOT EXISTS production_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_no TEXT NOT NULL UNIQUE,
  plan_period_start DATE NOT NULL,
  plan_period_end DATE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft | approved | in_progress | completed
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Production Plan Items (net requirements calculator)
CREATE TABLE IF NOT EXISTS production_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES materials(id),
  product_name TEXT NOT NULL,
  bom_id UUID REFERENCES bom_headers(id),
  demand_qty NUMERIC(12,3) NOT NULL,
  current_fg_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  wip_qty NUMERIC(12,3) DEFAULT 0,
  net_to_produce NUMERIC(12,3) NOT NULL,
  planned_qty NUMERIC(12,3) DEFAULT 0,
  linked_sales_orders JSONB, -- [{order_id, order_no, qty, due_date}]
  linked_schedule_id UUID,
  linked_job_card_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending | scheduled | in_production | fulfilled
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Sales Order Production Link (traceability)
CREATE TABLE IF NOT EXISTS sales_order_production_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_item_id UUID NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
  job_card_id UUID REFERENCES job_cards(id) ON DELETE CASCADE,
  allocated_qty NUMERIC(12,3) NOT NULL,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Add Capacity Fields to Production Schedule Items
ALTER TABLE production_schedule_items
  ADD COLUMN IF NOT EXISTS work_center_id UUID REFERENCES work_centers(id),
  ADD COLUMN IF NOT EXISTS estimated_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allocated_hours NUMERIC(6,2);
