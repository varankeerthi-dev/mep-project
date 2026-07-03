-- Tools Management System - Structure Fix
-- This migration fixes missing organisation_id columns

-- First, let's check what tables exist and their structure
-- Then add missing organisation_id columns if needed

-- Fix tools_catalog table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tools_catalog') THEN
        -- Check if organisation_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tools_catalog' AND column_name = 'organisation_id'
        ) THEN
            -- Add organisation_id column if it doesn't exist
            ALTER TABLE tools_catalog ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Fix tool_transactions table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_transactions') THEN
        -- Check if organisation_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tool_transactions' AND column_name = 'organisation_id'
        ) THEN
            -- Add organisation_id column if it doesn't exist
            ALTER TABLE tool_transactions ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Fix tool_transaction_items table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_transaction_items') THEN
        -- Check if organisation_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tool_transaction_items' AND column_name = 'organisation_id'
        ) THEN
            -- Add organisation_id column if it doesn't exist
            ALTER TABLE tool_transaction_items ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Fix tool_stock_movements table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_stock_movements') THEN
        -- Check if organisation_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tool_stock_movements' AND column_name = 'organisation_id'
        ) THEN
            -- Add organisation_id column if it doesn't exist
            ALTER TABLE tool_stock_movements ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Fix site_tool_transfers table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_tool_transfers') THEN
        -- Check if organisation_id column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'site_tool_transfers' AND column_name = 'organisation_id'
        ) THEN
            -- Add organisation_id column if it doesn't exist
            ALTER TABLE site_tool_transfers ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_tools_catalog_org_id ON tools_catalog(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_org_id ON tool_transactions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_org_id ON tool_transaction_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_org_id ON tool_stock_movements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_org_id ON site_tool_transfers(organisation_id);
