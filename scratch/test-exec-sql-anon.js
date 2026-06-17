import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
ALTER TABLE production_entries 
  ADD COLUMN IF NOT EXISTS actual_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_unit VARCHAR(20) NOT NULL DEFAULT 'nos',
  ADD COLUMN IF NOT EXISTS notes TEXT;
`;

async function test() {
  const rpcs = ['exec_sql', 'run_sql', 'execute_sql', 'sql', 'query'];
  for (const rpc of rpcs) {
    console.log(`Trying RPC with anon key: ${rpc}`);
    try {
      const { data, error } = await supabase.rpc(rpc, { query_text: sql, sql: sql, query: sql });
      if (error) {
        console.log(`  Error: ${error.message} (${error.code})`);
      } else {
        console.log(`  Success! Response:`, data);
        return;
      }
    } catch (e) {
      console.log(`  Caught error:`, e.message);
    }
  }
}

test();
