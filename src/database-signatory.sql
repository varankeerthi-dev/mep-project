-- Add Authorized Signatory support to documents
-- Run this in Supabase SQL Editor

ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;
