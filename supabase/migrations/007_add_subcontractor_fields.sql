-- Migration: Add new fields to subcontractors table
-- Created: 2026-04-05
-- Purpose: Add PIN CODE, PAN CARD, BANK ACCOUNT DETAILS, and Previous Projects fields

-- Add new columns to subcontractors table
ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
ADD COLUMN IF NOT EXISTS pan_card VARCHAR(20),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS previous_projects TEXT;

-- Create indexes for frequently searched fields
CREATE INDEX IF NOT EXISTS idx_subcontractors_pincode ON subcontractors(pincode);
CREATE INDEX IF NOT EXISTS idx_subcontractors_pan_card ON subcontractors(pan_card);

-- Add comments for documentation
COMMENT ON COLUMN subcontractors.pincode IS 'PIN/Postal code of the address';
COMMENT ON COLUMN subcontractors.pan_card IS 'PAN card number of the subcontractor';
COMMENT ON COLUMN subcontractors.bank_name IS 'Name of the bank';
COMMENT ON COLUMN subcontractors.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN subcontractors.bank_ifsc_code IS 'IFSC code for bank transfers';
COMMENT ON COLUMN subcontractors.bank_account_type IS 'Type of account (Savings, Current, etc.)';
COMMENT ON COLUMN subcontractors.previous_projects IS 'List of previous projects completed by the subcontractor';
