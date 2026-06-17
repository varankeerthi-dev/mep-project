import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching material_outward...');
  const { data: outward, error: err1 } = await supabase.from('material_outward').select('*').limit(10);
  if (err1) {
    console.error('Error fetching material_outward:', err1.message);
  } else {
    console.log('material_outward count:', outward.length);
    console.log('material_outward samples:', outward);
  }

  console.log('\nFetching material_outward_items...');
  const { data: items, error: err2 } = await supabase.from('material_outward_items').select('*').limit(10);
  if (err2) {
    console.error('Error fetching material_outward_items:', err2.message);
  } else {
    console.log('material_outward_items count:', items.length);
    console.log('material_outward_items samples:', items);
  }
}

test();
