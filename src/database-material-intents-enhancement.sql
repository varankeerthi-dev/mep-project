-- Material Intents Enhancement for Inventory Tracking
-- Phase 1: Database Schema Updates
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns to material_intents table
DO $$
BEGIN
  -- Add reserved_qty column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_intents' AND column_name = 'reserved_qty') THEN
    ALTER TABLE material_intents ADD COLUMN reserved_qty DECIMAL(15,2) DEFAULT 0;
  END IF;

  -- Add in_transit_qty column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_intents' AND column_name = 'in_transit_qty') THEN
    ALTER TABLE material_intents ADD COLUMN in_transit_qty DECIMAL(15,2) DEFAULT 0;
  END IF;

  -- Add dc_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_intents' AND column_name = 'dc_id') THEN
    ALTER TABLE material_intents ADD COLUMN dc_id UUID;
  END IF;

  -- Add stores_remarks column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_intents' AND column_name = 'stores_remarks') THEN
    ALTER TABLE material_intents ADD COLUMN stores_remarks TEXT;
  END IF;

  -- Add indent_number column for display purposes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'material_intents' AND column_name = 'indent_number') THEN
    ALTER TABLE material_intents ADD COLUMN indent_number VARCHAR(50);
  END IF;
END $$;

-- Step 2: Create intent_assignments table to link stock items to intents
CREATE TABLE IF NOT EXISTS intent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  intent_id UUID NOT NULL REFERENCES material_intents(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  variant_id UUID,
  warehouse_id UUID,
  assigned_qty DECIMAL(15,2) NOT NULL DEFAULT 0,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Enable RLS on intent_assignments
ALTER TABLE intent_assignments ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for intent_assignments
DROP POLICY IF EXISTS "Users can view intent assignments for their organisation" ON intent_assignments;
CREATE POLICY "Users can view intent assignments for their organisation"
  ON intent_assignments
  FOR SELECT
  TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() AND status = 'active'));

DROP POLICY IF EXISTS "Users can insert intent assignments for their organisation" ON intent_assignments;
CREATE POLICY "Users can insert intent assignments for their organisation"
  ON intent_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() AND status = 'active'));

DROP POLICY IF EXISTS "Users can update intent assignments for their organisation" ON intent_assignments;
CREATE POLICY "Users can update intent assignments for their organisation"
  ON intent_assignments
  FOR UPDATE
  TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() AND status = 'active'))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() AND status = 'active'));

DROP POLICY IF EXISTS "Users can delete intent assignments for their organisation" ON intent_assignments;
CREATE POLICY "Users can delete intent assignments for their organisation"
  ON intent_assignments
  FOR DELETE
  TO authenticated
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() AND status = 'active'));

-- Step 5: Create indexes for intent_assignments
CREATE INDEX IF NOT EXISTS idx_intent_assignments_organisation_id ON intent_assignments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_intent_assignments_intent_id ON intent_assignments(intent_id);
CREATE INDEX IF NOT EXISTS idx_intent_assignments_item_id ON intent_assignments(item_id);
CREATE INDEX IF NOT EXISTS idx_intent_assignments_warehouse_id ON intent_assignments(warehouse_id);

-- Step 6: Add foreign key constraint for dc_id in material_intents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'material_intents_dc_id_fkey'
    AND table_name = 'material_intents'
  ) THEN
    ALTER TABLE material_intents 
    ADD CONSTRAINT material_intents_dc_id_fkey 
    FOREIGN KEY (dc_id) REFERENCES delivery_challans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 7: Create trigger for updated_at on intent_assignments
CREATE OR REPLACE FUNCTION update_intent_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_intent_assignments_updated_at ON intent_assignments;
CREATE TRIGGER trigger_update_intent_assignments_updated_at
  BEFORE UPDATE ON intent_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_intent_assignments_updated_at();

-- Step 8: Update status check constraint to include new statuses
DO $$
BEGIN
  -- Drop existing status constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'material_intents_status_check' 
    AND conrelid = 'material_intents'::regclass
  ) THEN
    ALTER TABLE material_intents DROP CONSTRAINT material_intents_status_check;
  END IF;

  -- Add new status constraint with all statuses
  ALTER TABLE material_intents 
  ADD CONSTRAINT material_intents_status_check 
  CHECK (status IN ('Pending', 'Approved', 'Partial', 'Received', 'Rejected', 'Assigned', 'In Transit', 'Fulfilled'));
END $$;
