-- Sync legacy user_organisations table with org_members.
-- This avoids a full codebase migration of 213+ references and
-- fixes the current 406 / empty-response path by ensuring the
-- table has the columns/rows the legacy queries expect.

BEGIN;

-- 0) Drop the bad FK that blocks inserting auth user IDs.
ALTER TABLE public.user_organisations
  DROP CONSTRAINT IF EXISTS user_organisations_user_id_fkey;

-- 1) Ensure required columns exist on the legacy table.
ALTER TABLE public.user_organisations
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS organisation_id UUID;

-- 2) Backfill rows from org_members where possible.
INSERT INTO public.user_organisations (id, user_id, organisation_id, status, role)
SELECT
  om.id,
  om.user_id,
  om.organisation_id,
  COALESCE(om.status, 'active'),
  om.role
FROM public.org_members om
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  organisation_id = EXCLUDED.organisation_id,
  status = EXCLUDED.status,
  role = EXCLUDED.role;

-- 3) Backfill rows that may only have a user_id by looking up the
--    user's current org from org_members.
INSERT INTO public.user_organisations (id, user_id, organisation_id, status, role)
SELECT
  gen_random_uuid(),
  up.user_id,
  (
    SELECT om.organisation_id
    FROM public.org_members om
    WHERE om.user_id = up.user_id
      AND om.status = 'active'
    LIMIT 1
  ),
  'active',
  COALESCE(up.role, 'member')
FROM public.user_profiles up
WHERE up.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_organisations uo WHERE uo.user_id = up.user_id
  )
ON CONFLICT DO NOTHING;

-- 4) Keep the legacy table in sync going forward.
DROP TRIGGER IF EXISTS trg_sync_user_organisations ON public.org_members;

CREATE OR REPLACE FUNCTION public.sync_org_members_to_user_organisations()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_organisations (id, user_id, organisation_id, status, role)
    VALUES (NEW.id, NEW.user_id, NEW.organisation_id, NEW.status, NEW.role)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      organisation_id = EXCLUDED.organisation_id,
      status = EXCLUDED.status,
      role = EXCLUDED.role;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.user_organisations
    SET user_id = NEW.user_id,
        organisation_id = NEW.organisation_id,
        status = NEW.status,
        role = NEW.role
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_organisations WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path TO public;

CREATE TRIGGER trg_sync_user_organisations
AFTER INSERT OR UPDATE OR DELETE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.sync_org_members_to_user_organisations();

COMMIT;
