import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const materialsScriptPath = path.join('scratch', 'check-materials.js');
const materialsScriptContent = fs.readFileSync(materialsScriptPath, 'utf8');
const tokenMatch = materialsScriptContent.match(/const userJwt = '([^']+)';/);
if (!tokenMatch) {
  console.error('Failed to extract token from check-materials.js');
  process.exit(1);
}
const userJwt = tokenMatch[1];

const supabaseUrl = 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1anFlanRpc3Flcm1qeXFxZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2OTA0NDIsImV4cCI6MjA4NzI2NjQ0Mn0.XKS-L4usiB0kKMz2p6SazFyNKc2Iyk2b35qqAoiRHio';

async function getSchema() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${userJwt}`
      }
    });
    const schema = await res.json();
    console.log('Available tables in Supabase schema:');
    console.log(Object.keys(schema.definitions || {}));
    
    const tableInfo = schema.definitions?.production_entries;
    if (tableInfo) {
      console.log('\nColumns in production_entries:');
      console.log(Object.keys(tableInfo.properties));
      console.log('\nDetails of production_entries schema:');
      console.log(JSON.stringify(tableInfo.properties, null, 2));
    } else {
      console.log('\nproduction_entries table not found in OpenAPI definitions.');
    }
  } catch (err) {
    console.error('Error fetching OpenAPI schema:', err.message);
  }
}

getSchema();
