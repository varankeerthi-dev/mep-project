-- Add denormalized metadata columns to the approvals table.
-- These are used for display in the Approvals page and by the backfill RPC.

alter table public.approvals add column if not exists requester_name text;
alter table public.approvals add column if not exists requester_role text;
alter table public.approvals add column if not exists project_id uuid;
alter table public.approvals add column if not exists project_name text;
alter table public.approvals add column if not exists reference_number text;
alter table public.approvals add column if not exists assigned_approver_id uuid;
alter table public.approvals add column if not exists released_at timestamptz;

-- Link quotation_header to its approval record.
alter table public.quotation_header add column if not exists approval_id uuid references public.approvals(id) on delete set null;

-- Track when a quotation was sent to the client (independent of approval status).
alter table public.quotation_header add column if not exists sent_at timestamptz;
