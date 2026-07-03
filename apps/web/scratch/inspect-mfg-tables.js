import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCol(table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  if (error) {
    console.log(`Table "${table}", column "${col}": ERROR - ${error.message} (${error.code})`);
  } else {
    console.log(`Table "${table}", column "${col}": EXISTS`);
  }
}

async function test() {
  console.log('Checking production_entries...');
  const peCols = ['id', 'entry_no', 'job_card_id', 'actual_qty', 'output_unit', 'yield_pct', 'notes', 'created_by', 'organisation_id', 'created_at'];
  for (const col of peCols) {
    await checkCol('production_entries', col);
  }

  console.log('Checking production_entry_items...');
  const peiCols = ['id', 'production_entry_id', 'job_card_material_id', 'material_id', 'issued_qty', 'consumed_qty', 'wastage_qty', 'return_qty'];
  for (const col of peiCols) {
    await checkCol('production_entry_items', col);
  }
}

test();
