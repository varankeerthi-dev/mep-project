import os
from supabase import create_client

url = os.environ.get('VITE_SUPABASE_URL', os.environ.get('REACT_APP_SUPABASE_URL', ''))
key = os.environ.get('VITE_SUPABASE_ANON_KEY', os.environ.get('REACT_APP_SUPABASE_ANON_KEY', ''))

if not url:
    with open('frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_SUPABASE_URL'):
                url = line.split('=')[1].strip()
            elif line.startswith('REACT_APP_SUPABASE_ANON_KEY'):
                key = line.split('=')[1].strip()

supabase = create_client(url, key)
res = supabase.table('clients').select('*').limit(1).execute()
print(res.data[0].keys() if len(res.data) > 0 else 'No clients')

res2 = supabase.table('site_visits').select('*').limit(1).execute()
print(res2.data[0].keys() if len(res2.data) > 0 else 'No visits')
