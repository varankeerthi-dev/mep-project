-- Migration to fix missing columns in Purchase Module
-- Run this in Supabase SQL Editor

-- 1. Ensure issue_id exists in purchase_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='purchase_orders' 
        AND column_name='issue_id'
    ) THEN
        ALTER TABLE purchase_orders 
        ADD COLUMN issue_id UUID REFERENCES issues(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_issue_id ON purchase_orders(issue_id);
        RAISE NOTICE 'issue_id column added to purchase_orders table';
    END IF;
END $$;

-- 2. Add make and variant columns to purchase_order_items
DO $$
BEGIN
    -- Add make column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='purchase_order_items' 
        AND column_name='make'
    ) THEN
        ALTER TABLE purchase_order_items 
        ADD COLUMN make VARCHAR(100);
        RAISE NOTICE 'make column added to purchase_order_items table';
    END IF;

    -- Add variant column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='purchase_order_items' 
        AND column_name='variant'
    ) THEN
        ALTER TABLE purchase_order_items 
        ADD COLUMN variant VARCHAR(100);
        RAISE NOTICE 'variant column added to purchase_order_items table';
    END IF;
END $$;

-- 3. Add make and variant columns to purchase_bill_items (for consistency)
DO $$
BEGIN
    -- Add make column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='purchase_bill_items' 
        AND column_name='make'
    ) THEN
        ALTER TABLE purchase_bill_items 
        ADD COLUMN make VARCHAR(100);
        RAISE NOTICE 'make column added to purchase_bill_items table';
    END IF;

    -- Add variant column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='purchase_bill_items' 
        AND column_name='variant'
    ) THEN
        ALTER TABLE purchase_bill_items 
        ADD COLUMN variant VARCHAR(100);
        RAISE NOTICE 'variant column added to purchase_bill_items table';
    END IF;
END $$;

-- 4. Ensure total_amount_inr exists in purchase_order_items (if not already there)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='purchase_order_items' 
        AND column_name='total_amount_inr'
    ) THEN
        ALTER TABLE purchase_order_items 
        ADD COLUMN total_amount_inr DECIMAL(15,2) DEFAULT 0;
        RAISE NOTICE 'total_amount_inr column added to purchase_order_items table';
    END IF;
END $$;
