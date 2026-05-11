-- Debug: Check what tables and columns actually exist
-- Run this to see current database state

-- Check if tools_catalog table exists and its structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('tools_catalog', 'tool_transactions', 'tool_transaction_items', 'tool_stock_movements', 'site_tool_transfers')
    AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check if RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE tablename IN ('tools_catalog', 'tool_transactions', 'tool_transaction_items', 'tool_stock_movements', 'site_tool_transfers');

-- Check if tools_catalog has any data
SELECT COUNT(*) as tools_catalog_count FROM tools_catalog;

-- Check if organisations table exists
SELECT COUNT(*) as organisations_count FROM organisations;
