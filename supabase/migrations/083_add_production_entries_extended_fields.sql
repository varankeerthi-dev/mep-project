-- 083_add_production_entries_extended_fields.sql
-- Adds columns for start time, end time, operator, machine, and scrap/byproducts to production_entries

ALTER TABLE production_entries 
  ADD COLUMN IF NOT EXISTS production_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS scrap_byproducts TEXT;
