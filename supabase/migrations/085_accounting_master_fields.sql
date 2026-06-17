-- Migration: 085_accounting_master_fields.sql
-- Description: Extending Vendors and Clients with Accounting, TDS, and MSME 43B(h) fields

-- Adding fields to 'purchase_vendors' table
ALTER TABLE purchase_vendors
ADD COLUMN IF NOT EXISTS is_msme BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS msme_udyam_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS msme_type msme_type_enum,
ADD COLUMN IF NOT EXISTS lower_deduction_cert_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS tds_valid_from DATE,
ADD COLUMN IF NOT EXISTS tds_valid_to DATE,
ADD COLUMN IF NOT EXISTS tds_cumulative_ytd JSONB DEFAULT '{}'::jsonb;

-- Adding fields to 'clients' table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS lower_deduction_cert_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS tds_valid_from DATE,
ADD COLUMN IF NOT EXISTS tds_valid_to DATE,
ADD COLUMN IF NOT EXISTS tds_cumulative_ytd JSONB DEFAULT '{}'::jsonb;

