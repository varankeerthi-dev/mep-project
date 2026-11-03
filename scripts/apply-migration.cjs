const fs = require('fs');
const path = require('path');

const SUPABASE_MIGRATIONS_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/migrations';
const SUPABASE_QUERY_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function applyMigration(migrationFileName) {
  const filePath = path.resolve(__dirname, '../apps/web/supabase/migrations', migrationFileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filePath}`);
  }

  const sqlContent = fs.readFileSync(filePath, 'utf8');
  console.log(`[INFO] Applying migration: ${migrationFileName}`);
  console.log(`[INFO] Size: ${sqlContent.length} bytes`);

  // First execute the DDL query directly to ensure it succeeds
  console.log(`[INFO] Executing migration SQL...`);
  const queryRes = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sqlContent })
  });

  if (!queryRes.ok) {
    const errText = await queryRes.text();
    throw new Error(`Failed to execute migration query (${queryRes.status}): ${errText}`);
  }

  console.log(`[SUCCESS] Migration SQL applied successfully!`);

  // Extract version and name from filename: e.g. 20261103010000_phase0_labour_foundation.sql
  const match = migrationFileName.match(/^([0-9]+)_(.+)\.sql$/);
  if (match) {
    const version = match[1];
    const name = match[2];

    // Record in schema_migrations if table exists
    const recordSql = `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations') THEN
          INSERT INTO supabase_migrations.schema_migrations (version, name)
          VALUES ('${version}', '${name}')
          ON CONFLICT (version) DO NOTHING;
        END IF;
      END;
      $$;
    `;
    await fetch(SUPABASE_QUERY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: recordSql })
    });
    console.log(`[SUCCESS] Recorded in supabase_migrations.schema_migrations (${version}_${name})`);
  }
}

const file = process.argv[2] || '20261103010000_phase0_labour_foundation.sql';
applyMigration(file).catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
