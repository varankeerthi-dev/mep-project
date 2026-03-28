-- Enable UUID generator if not already available
create extension if not exists "pgcrypto";

-- Main Site Reports table
create table if not exists site_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  report_date date not null,

  total_manpower text,
  skilled_manpower text,
  unskilled_manpower text,
  start_time text,
  end_time text,

  planned_progress text,
  actual_progress text,
  percent_complete text,

  equipment_on_site text,
  breakdown_issues text,

  toolbox_meeting boolean default false,
  ppe_followed boolean default false,

  inspection_status text,
  satisfied_percent text,
  rework_required_reason text,

  is_rework boolean default false,
  rework_reason text,
  rework_start text,
  rework_end text,
  rework_material_used text,
  rework_total_manpower text,

  doc_type text,
  doc_no text,
  received_signature text,

  client_req_details jsonb,
  quote_to_be_sent boolean default false,
  mail_received boolean default false,

  pm_status text,
  material_arrangement text,

  work_plan_next_day jsonb,
  special_instructions jsonb,
  issues_faced jsonb,

  is_filed boolean default false,
  tools_locked boolean default false,
  site_pictures_status text,

  engineer_name text,
  signature_date text,

  created_at timestamptz not null default now()
);

create index if not exists idx_site_reports_client_id on site_reports(client_id);
create index if not exists idx_site_reports_project_id on site_reports(project_id);
create index if not exists idx_site_reports_report_date on site_reports(report_date);

-- Sub-contractors linked to a report
create table if not exists sub_contractors (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references site_reports(id) on delete cascade,
  name text,
  count text,
  start_time text,
  end_time text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sub_contractors_report_id on sub_contractors(report_id);

-- Work carried out items
create table if not exists work_carried_out (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references site_reports(id) on delete cascade,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_carried_out_report_id on work_carried_out(report_id);

-- Milestones completed
create table if not exists milestones_completed (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references site_reports(id) on delete cascade,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_milestones_completed_report_id on milestones_completed(report_id);
