-- Fix: Add variant_id column to quotation_header if not exists
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
