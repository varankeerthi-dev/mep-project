import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphans() {
  console.log('Checking for Delivery Challans without organisation_id...');
  
  const { data, error, count } = await supabase
    .from('delivery_challans')
    .select('*', { count: 'exact' })
    .is('organisation_id', null);

  if (error) {
    console.error('Error fetching orphan DCs:', error.message);
    return;
  }

  console.log(`Found ${count} Delivery Challans with NULL organisation_id.`);
  if (data && data.length > 0) {
    console.log('Orphan DC Numbers:', data.map(d => d.dc_number).join(', '));
  }
}

checkOrphans();
