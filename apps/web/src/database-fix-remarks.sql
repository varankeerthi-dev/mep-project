-- Fix: Ensure remarks column exists in quotation_header
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS remarks TEXT;
