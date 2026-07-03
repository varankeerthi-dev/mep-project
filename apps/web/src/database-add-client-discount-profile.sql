-- Migration: Add Discount Profile to Clients
-- Adds nullable FK to link clients with a specific discount profile (structure)

-- 1. Add discount_profile_id column to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS discount_profile_id UUID REFERENCES discount_structures(id);

-- 2. Add comment for documentation
COMMENT ON COLUMN clients.discount_profile_id IS 'FK to discount_structures table for client-specific pricing control';

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_clients_discount_profile ON clients(discount_profile_id);
