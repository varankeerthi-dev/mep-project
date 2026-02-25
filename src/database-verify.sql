-- ============================================
-- VERIFY ALL TABLES EXIST
-- Run this in Supabase SQL Editor
-- ============================================

SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'organisations', 'user_profiles', 'org_members',
      'projects', 'clients', 'materials',
      'delivery_challans', 'delivery_challan_items',
      'material_inward', 'material_inward_items',
      'material_outward', 'material_outward_items',
      'todos', 'reminders', 'daily_updates', 'users'
    ) THEN '✓ REQUIRED'
    ELSE 'EXTRA'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Count records in each table
SELECT 'organisations' as table_name, COUNT(*) as count FROM organisations
UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL SELECT 'org_members', COUNT(*) FROM org_members
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'materials', COUNT(*) FROM materials
UNION ALL SELECT 'delivery_challans', COUNT(*) FROM delivery_challans
UNION ALL SELECT 'delivery_challan_items', COUNT(*) FROM delivery_challan_items
UNION ALL SELECT 'material_inward', COUNT(*) FROM material_inward
UNION ALL SELECT 'material_outward', COUNT(*) FROM material_outward
UNION ALL SELECT 'todos', COUNT(*) FROM todos
UNION ALL SELECT 'reminders', COUNT(*) FROM reminders
UNION ALL SELECT 'daily_updates', COUNT(*) FROM daily_updates
UNION ALL SELECT 'users', COUNT(*) FROM users;
