import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';
const userJwt = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImE3Y2I4NTEzLWJiMDMtNDQ4Ni05NjcwLTg2YTY1MmRmZDBjNyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3J1anFlanRpc3Flcm1qeXFxZ29qLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3ZTgyYzUzYi1iMDYwLTRjMTQtOWY0Ni1jZGZjMDhlNDMxNTUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgxNjMzNDIyLCJpYXQiOjE3ODE2Mjk4MjIsImVtYWlsIjoidmFyYW5rZWVydGhpQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiLCJnb29nbGUiXX0sInVzZXJfbWV0YWRhdGEiOnsiYXZhdGFyX3VybCI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0w3SzAxZEpMeWRBbUxTeHBpZTlxU2dpUnRVTjdUamlDNHc4V0I1d0x5M216ZmthMXQ0PXM5Ni1jIiwiZW1haWwiOiJ2YXJhbmtlZXJ0aGlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6IktlZXJ0aGkgVmFyYW4iLCJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYW1lIjoiS2VlcnRoaSBWYXJhbiIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0w3SzAxZEpMeWRBbUxTeHBpZTlxU2dpUnRVTjdUamlDNHc4V0I1d0x5M216ZmthMXQ0PXM5Ni1jIiwicHJvdmlkZXJfaWQiOiIxMDQ4Nzc0MjM2NzkzNjQ2NTM2NjYiLCJzdWIiOiIxMDQ4Nzc0MjM2NzkzNjQ2NTM2NjYifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4MTUwNTQ0Mn1dLCJzZXNzaW9uX2lkIjoiNDY2OWU0MTktNzliNC00NDY0LTliZjAtYjEzN2ZjZjYwMjhlIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.OseX0QWfRLIai5LtBG5FdaL9Pze6JKNjbXNFg6K5QBKEnpZI15KzR5y9dCxrH17TJFBK7AQHTijotkhkClODmg';

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      Authorization: `Bearer ${userJwt}`
    }
  }
});

async function test() {
  const jobCardId = 'c5991313-137e-477a-84eb-5f76613b1d98';
  
  console.log('--- JOB CARD DETAILS ---');
  const { data: jc, error: jcErr } = await supabase
    .from('job_cards')
    .select('*, job_card_materials(*, materials(name, unit))')
    .eq('id', jobCardId)
    .single();

  if (jcErr) {
    console.error(jcErr);
    return;
  }

  console.log(`Job Card No: ${jc.job_card_no}, Status: ${jc.status}`);
  
  const orgId = jc.organisation_id;
  console.log('Organisation ID:', orgId);

  // Fetch warehouses
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .eq('organisation_id', orgId);
  
  console.log('Warehouses count:', warehouses ? warehouses.length : 0);

  const reservedMaterials = jc.job_card_materials.filter(m => m.status === 'reserved');
  console.log(`\nReserved Materials count: ${reservedMaterials.length}`);

  for (const mat of reservedMaterials) {
    console.log(`\nChecking stock for material: ${mat.materials?.name} (id: ${mat.material_id}), needed: ${mat.planned_qty}`);
    
    const { data: withOrg, error: err1 } = await supabase
      .from('item_stock')
      .select('current_stock, warehouse_id')
      .eq('item_id', mat.material_id)
      .eq('organisation_id', orgId);
    
    console.log('withOrg response:', withOrg);
    if (err1) console.log('withOrg error:', err1);

    const stockRows = withOrg || [];
    const available = stockRows.reduce((sum, r) => sum + (r.current_stock || 0), 0);
    console.log(`Calculated available stock: ${available}`);

    if (available < mat.planned_qty) {
      console.log('=> RESULT: INSUFFICIENT STOCK!');
    } else {
      console.log('=> RESULT: SUFFICIENT STOCK.');
    }
  }
}

test();
