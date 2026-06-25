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
  'warehouses',
  'services'
];

async function checkColumns() {
  console.log('--- Checking for organisation_id and company_id columns ---');
  
  for (const table of tables) {
    const { data: cols, error } = await supabase.from(table).select('*').limit(1);
    
    // We can also check by trying to select specific columns
    const results = {};
    
    const { error: errOrg } = await supabase.from(table).select('organisation_id').limit(1);
    results.organisation_id = !errOrg;
    
    const { error: errCo } = await supabase.from(table).select('company_id').limit(1);
    results.company_id = !errCo;

    console.log(`${table.padEnd(20)}: org_id: ${results.organisation_id}, company_id: ${results.company_id}`);
  }
}

checkColumns();
