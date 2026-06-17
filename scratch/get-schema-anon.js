import fetch from 'node-fetch';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

async function getSchema() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const schema = await res.json();
    console.log('Available tables in Supabase schema:');
    const tables = Object.keys(schema.definitions || {});
    console.log(tables);
    
    for (const table of ['production_entries', 'production_entry_items', 'material_outward', 'material_outward_items']) {
      const tableInfo = schema.definitions?.[table];
      if (tableInfo) {
        console.log(`\nColumns in ${table}:`);
        console.log(Object.keys(tableInfo.properties));
      } else {
        console.log(`\n${table} table not found in OpenAPI definitions.`);
      }
    }
  } catch (err) {
    console.error('Error fetching OpenAPI schema:', err.message);
  }
}

getSchema();
