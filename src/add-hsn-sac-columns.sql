-- Add HSN/SAC column to po_line_items table
-- Run this in Supabase SQL Editor

-- Add single HSN/SAC column to po_line_items table
DO $$
BEGIN
    -- Check if hsn_sac_code column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='hsn_sac_code'
    ) THEN
        ALTER TABLE po_line_items 
        ADD COLUMN hsn_sac_code VARCHAR(20);
        
        RAISE NOTICE 'hsn_sac_code column added to po_line_items table';
    ELSE
        RAISE NOTICE 'hsn_sac_code column already exists in po_line_items table';
    END IF;
    
    -- Remove separate hsn_code and sac_code columns if they exist
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='hsn_code'
    ) THEN
        ALTER TABLE po_line_items 
        DROP COLUMN hsn_code;
        
        RAISE NOTICE 'hsn_code column removed from po_line_items table';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='sac_code'
    ) THEN
        ALTER TABLE po_line_items 
        DROP COLUMN sac_code;
        
        RAISE NOTICE 'sac_code column removed from po_line_items table';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'po_line_items' 
ORDER BY ordinal_position;
