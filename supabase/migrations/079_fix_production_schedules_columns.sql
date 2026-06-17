-- 079_fix_production_schedules_columns.sql
-- Removes leftover single-product columns from production_schedules table
-- that conflict with the multi-product schema and cause NOT NULL violations.

ALTER TABLE production_schedules 
  DROP COLUMN IF EXISTS bom_id,
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS planned_qty,
  DROP COLUMN IF EXISTS output_unit,
  DROP COLUMN IF EXISTS notes;
