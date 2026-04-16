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

async function checkColumns() {
  console.log('--- Checking for organisation_id column in tables ---');
  
  for (const table of tables) {
    // Try to select one row and check if it has the column
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
       console.log(`${table.padEnd(20)}: Error - ${error.message}`);
    } else {
       const hasOrgId = data && data.length > 0 ? 'organisation_id' in data[0] : 'UNKNOWN (No data)';
       // If no data, try to query the column specifically
       if (hasOrgId === 'UNKNOWN (No data)') {
           const { error: colError } = await supabase.from(table).select('organisation_id').limit(1);
           const columnExists = !colError;
           console.log(`${table.padEnd(20)}: Column 'organisation_id' exists? ${columnExists}`);
       } else {
           console.log(`${table.padEnd(20)}: Column 'organisation_id' exists? ${hasOrgId}`);
       }
    }
  }
}

checkColumns();
