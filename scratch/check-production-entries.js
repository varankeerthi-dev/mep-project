import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const materialsScriptPath = path.join('scratch', 'check-materials.js');
const materialsScriptContent = fs.readFileSync(materialsScriptPath, 'utf8');
const tokenMatch = materialsScriptContent.match(/const userJwt = '([^']+)';/);
if (!tokenMatch) {
  console.error('Failed to extract token from check-materials.js');
  process.exit(1);
}
const userJwt = tokenMatch[1];

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      Authorization: `Bearer ${userJwt}`
    }
  }
});

async function checkColumns() {
  const { data, error } = await supabase.from('production_entries').select('*').limit(1);
  if (error) {
    console.error('Error fetching production_entries:', error.message);
  } else {
    console.log('Columns in production_entries:', data.length > 0 ? Object.keys(data[0]) : 'No rows returned, trying RPC or checking columns via metadata...');
  }
  
  // Let's also check column existence specifically
  const testCols = ['id', 'entry_no', 'job_card_id', 'entry_date', 'actual_qty', 'output_unit', 'yield_pct', 'notes', 'batch_no', 'production_date', 'reported_by', 'created_by', 'organisation_id', 'created_at'];
  for (const col of testCols) {
    const { error: colErr } = await supabase.from('production_entries').select(col).limit(1);
    if (colErr) {
      console.log(`Column "${col}": NOT FOUND/ERROR - ${colErr.message}`);
    } else {
      console.log(`Column "${col}": EXISTS`);
    }
  }
}

checkColumns();
