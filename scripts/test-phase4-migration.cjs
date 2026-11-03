const fs = require('fs');
const path = require('path');

const SUPABASE_QUERY_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function main() {
  const migrationPath = path.resolve(__dirname, '../apps/web/supabase/migrations/20261103050000_phase4_cross_tenant_sharing.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  console.log('[TEST] Verifying Phase 4 migration syntax in rollback transaction...');

  // Wrap the entire migration in BEGIN ... ROLLBACK
  const wrappedSql = `
    BEGIN;
    ${sqlContent}
    -- Quick assertion that tables and functions were created
    SELECT count(*) FROM public.labour_tenant_links;
    SELECT count(*) FROM public.labour_attendance_shares;
    SELECT count(*) FROM public.labour_share_inbox;
    ROLLBACK;
  `;

  const res = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: wrappedSql })
  });

  const body = await res.json();
  if (!res.ok || (body && body.message && body.message.includes('ERROR'))) {
    console.error('[FAIL] Migration failed in rollback test:', body);
    process.exit(1);
  }

  console.log('[PASS] Phase 4 migration syntax and execution verified cleanly in rollback transaction!');
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
