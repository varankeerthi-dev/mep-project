import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'materials',
  'item_categories',
  'item_units',
  'company_variants',
  'warehouses'
];

async function dumpData() {
  console.log('--- Dumping first 5 rows of each table (unfiltered) ---');
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(5);

    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
    } else {
      console.log(`\nTable: ${table} (${data?.length || 0} rows found in sample)`);
      data?.forEach(row => {
        console.log(`- ID: ${row.id}, OrgID: ${row.organisation_id}, Name: ${row.name || row.category_name || row.unit_name || row.variant_name || row.warehouse_name || 'N/A'}`);
      });
    }
  }

  // Check unique organisation_ids across these tables
  console.log('\n--- Unique Organisation IDs in use ---');
  for (const table of tables) {
     const { data, error } = await supabase
      .from(table)
      .select('organisation_id');
     
     if (!error && data) {
       const orgIds = [...new Set(data.map(d => d.organisation_id))];
       console.log(`${table.padEnd(20)}: ${orgIds.join(', ') || 'NONE'}`);
     }
  }
}

dumpData();
