-- 011_quick_quote.sql
-- Quick Quote configuration engine tables (org-scoped, config-driven)

create table if not exists public.quick_quote_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  default_material uuid null references public.materials(id) on delete set null,
  default_variant uuid null references public.company_variants(id) on delete set null,
  default_make text null,
  default_spec text null,
  enable_valves boolean not null default true,
  enable_thread_items boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create table if not exists public.quick_quote_size_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organisations(id) on delete cascade,
  mm_size text not null,
  inch_size text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, mm_size)
);

create table if not exists public.quick_quote_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table if not exists public.quick_quote_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quick_quote_templates(id) on delete cascade,
  item_type text null,
  material_id uuid null references public.materials(id) on delete set null,
  size_formula text null,
  size_source text not null default 'size',
  use_inch boolean not null default false,
  include_valves boolean null,
  include_thread_items boolean null,
  sequence_no integer not null default 0,
  description_override text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_quote_template_items_size_source_chk check (size_source in ('size','sub_size','none'))
);

create table if not exists public.material_attributes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (material_id, key)
);

create index if not exists idx_qq_settings_org on public.quick_quote_settings(org_id);
create index if not exists idx_qq_size_mappings_org on public.quick_quote_size_mappings(org_id);
create index if not exists idx_qq_templates_org on public.quick_quote_templates(org_id);
create index if not exists idx_qq_template_items_template on public.quick_quote_template_items(template_id, sequence_no);
create index if not exists idx_material_attributes_material on public.material_attributes(material_id);
create index if not exists idx_material_attributes_key_value on public.material_attributes(key, value);

create or replace function public.set_quick_quote_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_qq_settings_updated_at on public.quick_quote_settings;
create trigger trg_qq_settings_updated_at
before update on public.quick_quote_settings
for each row execute function public.set_quick_quote_updated_at();

drop trigger if exists trg_qq_size_map_updated_at on public.quick_quote_size_mappings;
create trigger trg_qq_size_map_updated_at
before update on public.quick_quote_size_mappings
for each row execute function public.set_quick_quote_updated_at();

drop trigger if exists trg_qq_templates_updated_at on public.quick_quote_templates;
create trigger trg_qq_templates_updated_at
before update on public.quick_quote_templates
for each row execute function public.set_quick_quote_updated_at();

drop trigger if exists trg_qq_template_items_updated_at on public.quick_quote_template_items;
create trigger trg_qq_template_items_updated_at
before update on public.quick_quote_template_items
for each row execute function public.set_quick_quote_updated_at();

drop trigger if exists trg_material_attributes_updated_at on public.material_attributes;
create trigger trg_material_attributes_updated_at
before update on public.material_attributes
for each row execute function public.set_quick_quote_updated_at();

alter table public.quick_quote_settings enable row level security;
alter table public.quick_quote_size_mappings enable row level security;
alter table public.quick_quote_templates enable row level security;
alter table public.quick_quote_template_items enable row level security;
alter table public.material_attributes enable row level security;

drop policy if exists qq_settings_select on public.quick_quote_settings;
create policy qq_settings_select on public.quick_quote_settings
for select using (public.user_can_access_org(org_id));

drop policy if exists qq_settings_write on public.quick_quote_settings;
create policy qq_settings_write on public.quick_quote_settings
for all using (public.user_can_access_org(org_id))
with check (public.user_can_access_org(org_id));

drop policy if exists qq_size_map_select on public.quick_quote_size_mappings;
create policy qq_size_map_select on public.quick_quote_size_mappings
for select using (org_id is null or public.user_can_access_org(org_id));

drop policy if exists qq_size_map_write on public.quick_quote_size_mappings;
create policy qq_size_map_write on public.quick_quote_size_mappings
for all using (org_id is not null and public.user_can_access_org(org_id))
with check (org_id is not null and public.user_can_access_org(org_id));

drop policy if exists qq_templates_select on public.quick_quote_templates;
create policy qq_templates_select on public.quick_quote_templates
for select using (public.user_can_access_org(org_id));

drop policy if exists qq_templates_write on public.quick_quote_templates;
create policy qq_templates_write on public.quick_quote_templates
for all using (public.user_can_access_org(org_id))
with check (public.user_can_access_org(org_id));

drop policy if exists qq_template_items_select on public.quick_quote_template_items;
create policy qq_template_items_select on public.quick_quote_template_items
for select using (
  exists (
    select 1 from public.quick_quote_templates t
    where t.id = template_id
      and public.user_can_access_org(t.org_id)
  )
);

drop policy if exists qq_template_items_write on public.quick_quote_template_items;
create policy qq_template_items_write on public.quick_quote_template_items
for all using (
  exists (
    select 1 from public.quick_quote_templates t
    where t.id = template_id
      and public.user_can_access_org(t.org_id)
  )
)
with check (
  exists (
    select 1 from public.quick_quote_templates t
    where t.id = template_id
      and public.user_can_access_org(t.org_id)
  )
);

drop policy if exists material_attributes_select on public.material_attributes;
create policy material_attributes_select on public.material_attributes
for select using (
  exists (
    select 1 from public.materials m
    where m.id = material_id
      and (
        m.organisation_id is null
        or public.user_can_access_org(m.organisation_id)
      )
  )
);

drop policy if exists material_attributes_write on public.material_attributes;
create policy material_attributes_write on public.material_attributes
for all using (
  exists (
    select 1 from public.materials m
    where m.id = material_id
      and m.organisation_id is not null
      and public.user_can_access_org(m.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.materials m
    where m.id = material_id
      and m.organisation_id is not null
      and public.user_can_access_org(m.organisation_id)
  )
);
