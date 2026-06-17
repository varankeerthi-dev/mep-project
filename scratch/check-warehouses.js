import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: whs, error: whErr } = await supabase.from('warehouses').select('*');
  if (whErr) {
    console.error('Error fetching warehouses:', whErr);
  } else {
    console.log('=== WAREHOUSES ===');
    console.log(whs);
  }

  const { data: stocks, error: stockErr } = await supabase.from('item_stock').select('*, warehouses(name, warehouse_purpose)').limit(10);
  if (stockErr) {
    console.error('Error fetching stock:', stockErr);
  } else {
    console.log('=== ITEM STOCK SAMPLE ===');
    console.log(stocks);
  }
}

check();
