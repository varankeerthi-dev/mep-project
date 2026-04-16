import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDataDistribution() {
  const tables = ['materials', 'delivery_challans', 'projects', 'quotation_header'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('organisation_id');

    if (error) {
       console.log(`${table.padEnd(20)}: Error - ${error.message}`);
       continue;
    }

    const counts = {};
    data.forEach(row => {
      const id = row.organisation_id || 'NULL';
      counts[id] = (counts[id] || 0) + 1;
    });

    console.log(`\nTable: ${table}`);
    Object.entries(counts).forEach(([id, count]) => {
      console.log(`- ${id}: ${count} rows`);
    });
  }
}

checkDataDistribution();
