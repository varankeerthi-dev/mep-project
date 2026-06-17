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
  console.log('Fetching item_stock rows with null organisation_id...');
  const { data: stocks, error: getError } = await supabase
    .from('item_stock')
    .select('id, warehouse_id')
    .is('organisation_id', null);

  if (getError) {
    console.error('Error fetching stocks:', getError);
    return;
  }

  console.log(`Found ${stocks.length} rows with null organisation_id.`);
  if (stocks.length === 0) return;

  // Fetch all warehouses to map warehouse_id -> organisation_id
  const { data: warehouses, error: whError } = await supabase
    .from('warehouses')
    .select('id, organisation_id');

  if (whError) {
    console.error('Error fetching warehouses:', whError);
    return;
  }

  const whMap = {};
  warehouses.forEach(w => {
    whMap[w.id] = w.organisation_id;
  });

  console.log('Starting backfill...');
  let successCount = 0;
  let failCount = 0;

  for (const s of stocks) {
    const orgId = whMap[s.warehouse_id];
    if (!orgId) {
      console.log(`No organization found for warehouse ${s.warehouse_id}, skipping.`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('item_stock')
      .update({ organisation_id: orgId })
      .eq('id', s.id);

    if (updateError) {
      console.error(`Failed to update stock row ${s.id}:`, updateError.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`Backfill finished. Success: ${successCount}, Failed: ${failCount}`);
}

test();
