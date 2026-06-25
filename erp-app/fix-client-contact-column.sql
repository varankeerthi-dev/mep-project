-- Fix missing client_contact column in quotation_header table
-- Run this in Supabase SQL Editor

ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS client_contact VARCHAR(100);
