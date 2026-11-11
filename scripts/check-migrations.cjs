const SUPABASE_QUERY_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function main() {
  const res = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;`
    })
  });
  const data = await res.json();
  console.log('Recent migrations:', data);
}

main().catch(console.error);
