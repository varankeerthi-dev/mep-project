import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn(col) {
  const { data, error } = await supabase
    .from('production_schedules')
    .select(col)
    .limit(1);

  if (error) {
    console.log(`Column "${col}": ERROR - ${error.message} (${error.code})`);
  } else {
    console.log(`Column "${col}": EXISTS`);
  }
}

async function test() {
  const columnsToCheck = [
    'id',
    'schedule_no',
    'bom_id',
    'product_name',
    'planned_qty',
    'output_unit',
    'scheduled_date',
    'notes',
    'schedule_name',
    'schedule_date',
    'shift',
    'remarks',
    'created_by',
    'organisation_id'
  ];

  console.log('Checking columns on "production_schedules" table...');
  for (const col of columnsToCheck) {
    await checkColumn(col);
  }
}

test();
