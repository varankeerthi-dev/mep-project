alter table public.clients
  add column if not exists client_type text not null default 'Business',
  add column if not exists country text not null default 'India';
