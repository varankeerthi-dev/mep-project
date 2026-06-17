-- 082_add_production_entries_missing_columns.sql
-- Adds missing columns actual_qty, output_unit, and notes to production_entries table

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


