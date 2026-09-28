-- WEL-44 Phase 1 follow-up: align the V1 action key with the established
-- permission-key convention (`update`, not `edit`).
-- Applied directly to the live database via Supabase MCP on 2026-09-28.
-- All renamed rows/grants originated from 20260928000003 (same day), so no
-- legacy data was reinterpreted. Idempotent, safe to re-apply.

INSERT INTO public.rbac_actions (key, label, sort) VALUES ('update', 'Edit', 3)
ON CONFLICT (key) DO NOTHING;

UPDATE public.rbac_module_actions SET action_key = 'update' WHERE action_key = 'edit';

DELETE FROM public.role_permissions WHERE permission_key LIKE '%.edit';

DELETE FROM public.permissions WHERE action_key = 'edit';

DELETE FROM public.rbac_actions WHERE key = 'edit';
