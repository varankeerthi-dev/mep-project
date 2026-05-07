-- Fix missing gst_percentage column in po_line_items table
-- Run this in Supabase SQL Editor

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='gst_percentage'
    ) THEN
        ALTER TABLE po_line_items 
        ADD COLUMN gst_percentage DECIMAL(5,2) DEFAULT 18;
        
        RAISE NOTICE 'gst_percentage column added to po_line_items table';
    ELSE
        RAISE NOTICE 'gst_percentage column already exists in po_line_items table';
    END IF;
END $$;

-- Also check if other required columns exist
DO $$
BEGIN
    -- Check item_code column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='item_code'
    ) THEN
        ALTER TABLE po_line_items 
        ADD COLUMN item_code VARCHAR(100);
        
        RAISE NOTICE 'item_code column added to po_line_items table';
    END IF;
    
    -- Check remarks column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='remarks'
    ) THEN
        ALTER TABLE po_line_items 
        ADD COLUMN remarks TEXT;
        
        RAISE NOTICE 'remarks column added to po_line_items table';
    END IF;
    
    -- Check line_order column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='po_line_items' 
        AND column_name='line_order'
    ) THEN
        ALTER TABLE po_line_items 
        ADD COLUMN line_order INTEGER DEFAULT 0;
        
        RAISE NOTICE 'line_order column added to po_line_items table';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'po_line_items' 
ORDER BY ordinal_position;
