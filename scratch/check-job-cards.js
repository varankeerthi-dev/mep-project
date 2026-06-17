import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Extract token dynamically from check-materials.js to bypass any LLM translation bugs
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

async function checkCol(table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  if (error) {
    console.log(`Table "${table}", column "${col}": ERROR - ${error.message} (${error.code})`);
  } else {
    console.log(`Table "${table}", column "${col}": EXISTS`);
  }
}

async function test() {
  const columns = ['issued_at', 'issued_to', 'completed_at', 'actual_qty', 'yield_pct'];
  console.log('Checking columns on "job_cards" table...');
  for (const col of columns) {
    await checkCol('job_cards', col);
  }
}

test();
