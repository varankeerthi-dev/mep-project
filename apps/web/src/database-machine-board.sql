-- ============================================================
-- MANUFACTURING MODULE — MACHINE BOARD & TOOLING MASTER MIGRATION
-- Migration: 20260804_machine_board_and_tooling.sql
-- ============================================================

-- 1. EXTEND WORK_CENTERS (MACHINE MASTER)
ALTER TABLE work_centers
  ADD COLUMN IF NOT EXISTS machine_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS make TEXT,
  ADD COLUMN IF NOT EXISTS model_number TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS location_in_plant TEXT,
  ADD COLUMN IF NOT EXISTS machine_incharge TEXT,
  ADD COLUMN IF NOT EXISTS machine_status TEXT DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS length_mm INTEGER,
  ADD COLUMN IF NOT EXISTS width_mm INTEGER,
  ADD COLUMN IF NOT EXISTS height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS machine_weight_kg NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS manufacture_year INTEGER,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS purchase_order_ref TEXT,
  ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_type TEXT DEFAULT 'expired',
  ADD COLUMN IF NOT EXISTS connected_load_kw NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS motor_current_amps NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS supply_voltage_v INTEGER DEFAULT 415,
  ADD COLUMN IF NOT EXISTS power_factor NUMERIC(4,2) DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS motors_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clamping_force_tonnes NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS max_shot_weight_grams NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS max_shot_volume_cc NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS plasticising_cap_kg_hr NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS tie_bar_h_mm INTEGER,
  ADD COLUMN IF NOT EXISTS tie_bar_v_mm INTEGER,
  ADD COLUMN IF NOT EXISTS min_mould_height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS max_mould_height_mm INTEGER,
  ADD COLUMN IF NOT EXISTS last_maintenance_date DATE,
  ADD COLUMN IF NOT EXISTS maintenance_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS maintenance_notes TEXT,
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_tooling_id UUID;

-- 2. MANUFACTURING TOOLING MASTER
CREATE TABLE IF NOT EXISTS manufacturing_tooling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooling_name TEXT NOT NULL,
  tooling_number TEXT,
  tooling_type TEXT DEFAULT 'mould',
  no_of_cavities INTEGER,
  compatible_machine_type TEXT,
  compatible_min_tonnage NUMERIC(8,1),
  compatible_max_tonnage NUMERIC(8,1),
  material_type TEXT,
  cycle_time_seconds NUMERIC(8,1),
  maintenance_interval_shots INTEGER,
  status TEXT DEFAULT 'available',
  current_machine_id UUID REFERENCES work_centers(id),
  notes TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Drop deprecated shot counter columns if present
ALTER TABLE manufacturing_tooling
  DROP COLUMN IF EXISTS total_shots_lifetime,
  DROP COLUMN IF EXISTS shots_since_last_maintenance;

-- FK from work_centers to manufacturing_tooling
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_current_tooling') THEN
    ALTER TABLE work_centers
      ADD CONSTRAINT fk_current_tooling
      FOREIGN KEY (current_tooling_id) REFERENCES manufacturing_tooling(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Products this tooling can produce
CREATE TABLE IF NOT EXISTS manufacturing_tooling_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooling_id UUID NOT NULL REFERENCES manufacturing_tooling(id) ON DELETE CASCADE,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tooling maintenance history
CREATE TABLE IF NOT EXISTS manufacturing_tooling_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooling_id UUID NOT NULL REFERENCES manufacturing_tooling(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shots_at_maintenance INTEGER,
  work_done TEXT NOT NULL,
  done_by TEXT,
  next_maintenance_at_shots INTEGER,
  cost NUMERIC(12,2),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MACHINE DOWNTIME LOG
CREATE TABLE IF NOT EXISTS machine_downtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES work_centers(id) ON DELETE CASCADE,
  downtime_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  downtime_end TIMESTAMPTZ,
  reason_category TEXT NOT NULL,
  reason_detail TEXT,
  raised_by UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. JOB CARD EXTENSIONS
ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS tooling_id UUID REFERENCES manufacturing_tooling(id),
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES work_centers(id),
  ADD COLUMN IF NOT EXISTS running_cavities INTEGER,
  ADD COLUMN IF NOT EXISTS planned_shots INTEGER,
  ADD COLUMN IF NOT EXISTS planned_cycle_time_sec NUMERIC(8,1);

-- Unique index to prevent double-booking reserved tooling across active job cards
CREATE UNIQUE INDEX IF NOT EXISTS uq_tooling_reserved
ON job_cards (tooling_id)
WHERE status NOT IN ('completed', 'cancelled') AND tooling_id IS NOT NULL;

-- 5. PRODUCTION ENTRY EXTENSIONS
ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS actual_shots INTEGER,
  ADD COLUMN IF NOT EXISTS actual_cycle_time_sec NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS tooling_id UUID REFERENCES manufacturing_tooling(id),
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES work_centers(id),
  ADD COLUMN IF NOT EXISTS scrap_short_shot NUMERIC(8,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_flash NUMERIC(8,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_burn_mark NUMERIC(8,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_weld_line NUMERIC(8,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_sink_mark NUMERIC(8,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_warpage NUMERIC(8,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrap_other NUMERIC(8,3) DEFAULT 0;

-- RLS POLICIES FOR NEW TABLES
ALTER TABLE manufacturing_tooling ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturing_tooling_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturing_tooling_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_downtime ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manufacturing_tooling' AND policyname = 'tooling_org_isolation') THEN
    CREATE POLICY tooling_org_isolation ON manufacturing_tooling FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manufacturing_tooling_products' AND policyname = 'tooling_prod_org_isolation') THEN
    CREATE POLICY tooling_prod_org_isolation ON manufacturing_tooling_products FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manufacturing_tooling_maintenance' AND policyname = 'tooling_maint_org_isolation') THEN
    CREATE POLICY tooling_maint_org_isolation ON manufacturing_tooling_maintenance FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'machine_downtime' AND policyname = 'downtime_org_isolation') THEN
    CREATE POLICY downtime_org_isolation ON machine_downtime FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
END $$;
