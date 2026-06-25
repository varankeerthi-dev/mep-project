import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function lookForBackups() {
  console.log('--- Looking for backup or old tables ---');
  
  const suspects = [
    'materials_backup', 'materials_old',
    'item_categories_old', 'categories_old',
    'item_units_old', 'units_old',
    'warehouses_old', 'company_variants_old',
    'items', 'services_old'
  ];
  
  for (const t of suspects) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`Potential backup found: ${t} - Count: ${count}`);
    }
  }
}

lookForBackups();
