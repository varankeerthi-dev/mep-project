import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrganisations() {
  const { data, count, error } = await supabase
    .from('organisations')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error fetching organisations:', error.message);
  } else {
    console.log(`Found ${count} organisations:`);
    data?.forEach(org => {
      console.log(`- ID: ${org.id}, Name: ${org.name}`);
    });
  }
}

checkOrganisations();
