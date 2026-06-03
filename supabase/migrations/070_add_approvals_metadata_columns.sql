-- Add denormalized metadata columns to the approvals table.
-- These are used for display in the Approvals page and by the backfill RPC.

alter table public.approvals add column if not exists requester_name text;
alter table public.approvals add column if not exists requester_role text;
alter table public.approvals add column if not exists project_id uuid;
alter table public.approvals add column if not exists project_name text;
alter table public.approvals add column if not exists reference_number text;
alter table public.approvals add column if not exists assigned_approver_id uuid;
alter table public.approvals add column if not exists released_at timestamptz;
