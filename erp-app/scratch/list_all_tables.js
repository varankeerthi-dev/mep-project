import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('--- Listing all tables via RPC or direct query ---');
  
  // Try to use a common Supabase trick to list tables if allowed
  const { data, error } = await supabase.rpc('get_tables'); // Highly unlikely to work unless defined

  if (error) {
    console.log('RPC get_tables failed, trying information_schema...');
    // We can't query information_schema directly via PostgREST usually
    // But we can check some known tables to see if they exist with data
    const possibleTables = [
        'materials', 'items', 'products',
        'item_categories', 'categories', 'material_categories',
        'item_units', 'units', 'uoms',
        'company_variants', 'variants', 'item_variants',
        'warehouses', 'warehouse', 'stores'
    ];
    
    for (const t of possibleTables) {
        const { count, error: e } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (!e) {
            console.log(`Table exists: ${t.padEnd(20)} - Count: ${count}`);
        }
    }
  } else {
    console.log('Tables:', data);
  }
}

listTables();
