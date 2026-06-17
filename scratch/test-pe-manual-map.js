import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: entries, error } = await supabase
    .from('production_entries')
    .select('*')
    .limit(3);

  if (error) {
    console.error('Error fetching production entries:', error);
    return;
  }

  const jobCardIds = [...new Set(entries.map(e => e.job_card_id).filter(Boolean))];
  console.log('Found job card IDs:', jobCardIds);

  if (jobCardIds.length > 0) {
    const { data: jcs, error: jcErr } = await supabase
      .from('job_cards')
      .select('id, job_card_no, product_name')
      .in('id', jobCardIds);
    
    if (jcErr) {
      console.error('Error fetching job cards:', jcErr);
    } else {
      const jcMap = Object.fromEntries(jcs.map(jc => [jc.id, jc]));
      const mapped = entries.map(entry => ({
        ...entry,
        job_cards: jcMap[entry.job_card_id] || null
      }));
      console.log('Mapped entries successfully:', mapped);
    }
  }
}

test();
