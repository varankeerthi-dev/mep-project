import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'materials',
  'item_stock',
  'item_categories',
  'item_units',
  'company_variants',
  'warehouses'
];

async function checkAllOrphans() {
  console.log('--- Checking for records with NULL organisation_id ---');
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .is('organisation_id', null);

    if (error) {
      console.error(`Error checking ${table}:`, error.message);
    } else {
      console.log(`${table.padEnd(20)}: ${count} orphans found`);
    }
  }

  // Also check for 'services' which are usually in 'materials' table
  const { count: serviceCount, error: serviceError } = await supabase
    .from('materials')
    .select('*', { count: 'exact', head: true })
    .eq('item_type', 'service')
    .is('organisation_id', null);

  if (serviceError) {
    console.error(`Error checking services:`, serviceError.message);
  } else {
    console.log(`${'services'.padEnd(20)}: ${serviceCount} orphans found (in materials table)`);
  }
}

checkAllOrphans();
