import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const cols = ['output_unit', 'produced_unit', 'unit', 'output_qty'];
  for (const col of cols) {
    const { error } = await supabase
      .from('production_entries')
      .select(col)
      .limit(1);
    if (error) {
      console.log(`Column "${col}": NOT FOUND or ERROR: ${error.message}`);
    } else {
      console.log(`Column "${col}": EXISTS`);
    }
  }
}

inspect();
