-- ============================================================
-- MEPS PROJECT DATABASE MIGRATION RECOVERY SCRIPT
-- ============================================================

-- 1. Migration 078: Add production_schedule_items table & RPCs
CREATE TABLE IF NOT EXISTS production_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES production_schedules(id) ON DELETE CASCADE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE RESTRICT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  output_unit VARCHAR(20) DEFAULT 'nos',
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_schedule_items_schedule ON production_schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_schedule_items_bom ON production_schedule_items(bom_id);

ALTER TABLE production_schedule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_access" ON production_schedule_items;
CREATE POLICY "org_access" ON production_schedule_items FOR ALL USING (
  schedule_id IN (
    SELECT id FROM production_schedules WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  )
);

CREATE OR REPLACE FUNCTION generate_schedule_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(schedule_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM production_schedules WHERE organisation_id = org_id;
  RETURN 'PS-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_production_schedules_updated_at ON production_schedules;
CREATE TRIGGER trg_production_schedules_updated_at
  BEFORE UPDATE ON production_schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_production_schedule_items_updated_at ON production_schedule_items;
CREATE TRIGGER trg_production_schedule_items_updated_at
  BEFORE UPDATE ON production_schedule_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 2. Migration 079: Remove legacy columns from production_schedules
ALTER TABLE production_schedules 
  DROP COLUMN IF EXISTS bom_id,
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS planned_qty,
  DROP COLUMN IF EXISTS output_unit,
  DROP COLUMN IF EXISTS notes;


-- 3. Migration 080: Add multi-tenant & warehouse columns to material outward
ALTER TABLE material_outward 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE material_outward_items 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;


-- 4. Migration 081: Add missing columns to job_cards
ALTER TABLE job_cards 
  ADD COLUMN IF NOT EXISTS actual_qty DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS yield_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS issued_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;


-- 5. Migration 082: Add missing columns to production_entries
ALTER TABLE production_entries 
  ADD COLUMN IF NOT EXISTS actual_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_unit VARCHAR(20) NOT NULL DEFAULT 'nos',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Fix legacy/unused column produced_qty and produced_unit constraints if they exist
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='production_entries' AND column_name='produced_qty'
    ) THEN 
        ALTER TABLE production_entries ALTER COLUMN produced_qty DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='production_entries' AND column_name='produced_unit'
    ) THEN 
        ALTER TABLE production_entries ALTER COLUMN produced_unit DROP NOT NULL;
    END IF;
END $$;



-- 6. Migration 083: Add columns for production start/end time, operator, machine, and scrap/byproducts
ALTER TABLE production_entries 
  ADD COLUMN IF NOT EXISTS production_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS scrap_byproducts TEXT;


-- 7. Fix activity log triggers to query user_profiles instead of profiles
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
      auth.uid(), 
      COALESCE(
        (SELECT full_name FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
        (SELECT full_name FROM user_profiles WHERE id = auth.uid() LIMIT 1),
        'Unknown'
      ),
      NEW.organisation_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_production_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details,
    user_id, user_name, organisation_id
  ) VALUES (
    'production_entry', NEW.id, 'created',
    jsonb_build_object(
      'entry_no', NEW.entry_no,
      'job_card_id', NEW.job_card_id,
      'actual_qty', NEW.actual_qty,
      'output_unit', NEW.output_unit
    ),
    auth.uid(),
    COALESCE(
      (SELECT full_name FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
      (SELECT full_name FROM user_profiles WHERE id = auth.uid() LIMIT 1),
      'Unknown'
    ),
    NEW.organisation_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_schedule_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details,
    user_id, user_name, organisation_id
  ) VALUES (
    'production_schedule', NEW.id, 'created',
    jsonb_build_object(
      'schedule_no', NEW.schedule_no,
      'schedule_name', NEW.schedule_name,
      'schedule_date', NEW.schedule_date
    ),
    auth.uid(),
    COALESCE(
      (SELECT full_name FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
      (SELECT full_name FROM user_profiles WHERE id = auth.uid() LIMIT 1),
      'Unknown'
    ),
    NEW.organisation_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

