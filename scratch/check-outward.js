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

async function checkCol(table, col) {
  const { error } = await supabase.from(table).select(col).limit(1);
  if (error) {
    console.log(`Table "${table}", column "${col}": ERROR - ${error.message} (${error.code})`);
  } else {
    console.log(`Table "${table}", column "${col}": EXISTS`);
  }
}

async function test() {
  await checkCol('material_outward', 'organisation_id');
  await checkCol('material_outward', 'project_id');
  await checkCol('material_outward_items', 'organisation_id');
  await checkCol('material_outward_items', 'material_id');
  await checkCol('material_outward_items', 'warehouse_id');
  await checkCol('material_outward_items', 'outward_id');
}

test();
