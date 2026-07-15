const fs = require('fs');
const env = fs.readFileSync('c:/Users/admin/mep-project/apps/web/.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const { createClient } = require('c:/Users/admin/mep-project/apps/web/node_modules/@supabase/supabase-js');
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:clients(id, client_name), pos:client_purchase_orders!client_purchase_orders_project_id_fkey(po_total_value), created_by_user:user_profiles!created_by(full_name), updated_by_user:user_profiles!updated_by(full_name)')
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data count:", data ? data.length : 0);
}
test();
