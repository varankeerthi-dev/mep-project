const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });
console.log(process.env.REACT_APP_BACKEND_URL);
