const SUPABASE_QUERY_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function main() {
  const query = `
    DO $$
    BEGIN
      SET LOCAL ROLE authenticated;
      RAISE NOTICE 'Role is now: %', current_user;
      SET LOCAL ROLE postgres;
    END;
    $$;
  `;

  const res = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const rows = await res.json();
  console.log('Vendors & Subcontractors:', rows);
}

main().catch(console.error);
