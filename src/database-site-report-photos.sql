-- ============================================
-- SITE REPORT PHOTOS
-- Phase B: per-org storage bucket + persistent photo records
-- Run in Supabase SQL Editor
-- ============================================

-- ------------------------------------------------------------
-- 0. Helper: current_org_id() used by all RLS policies below
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM public.org_members
  WHERE user_id = auth.uid()
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ORDER BY joined_at DESC
  LIMIT 1
$$;

-- ============================================
-- 1. site_report_photos table
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,
  bucket_name text NOT NULL,                       -- e.g. 'site-report-photos-{org_id}'
  file_path text NOT NULL,                         -- path within bucket, e.g. '{report_id}/{photo_id}.webp'
  file_name text NOT NULL,                         -- original filename
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  file_size_bytes bigint,
  width integer,
  height integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_report_photos_report ON public.site_report_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_site_report_photos_org ON public.site_report_photos(organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_report_photos_sort ON public.site_report_photos(report_id, sort_order);

-- ============================================
-- 2. RLS on site_report_photos
-- ============================================
ALTER TABLE public.site_report_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_photos_select" ON public.site_report_photos;
DROP POLICY IF EXISTS "sr_photos_insert" ON public.site_report_photos;
DROP POLICY IF EXISTS "sr_photos_update" ON public.site_report_photos;
DROP POLICY IF EXISTS "sr_photos_delete" ON public.site_report_photos;

CREATE POLICY "sr_photos_select" ON public.site_report_photos
  FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

CREATE POLICY "sr_photos_insert" ON public.site_report_photos
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id());

CREATE POLICY "sr_photos_update" ON public.site_report_photos
  FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id())
  WITH CHECK (organisation_id = public.current_org_id());

CREATE POLICY "sr_photos_delete" ON public.site_report_photos
  FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id());

-- ============================================
-- 3. RPC: ensure the org's photo bucket exists
--    Returns the bucket name; idempotent.
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_site_report_photos_bucket()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid := public.current_org_id();
  v_bucket_name text;
  v_exists boolean;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User is not associated with any organisation';
  END IF;

  v_bucket_name := 'site-report-photos-' || v_org_id::text;

  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = v_bucket_name
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      v_bucket_name,
      v_bucket_name,
      false,
      10485760,  -- 10MB per file
      ARRAY['image/webp', 'image/jpeg', 'image/png']
    );
  END IF;

  RETURN v_bucket_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_site_report_photos_bucket() TO authenticated;

-- ============================================
-- 4. Storage RLS for per-org buckets
--    Bucket name pattern: site-report-photos-{org_id}
-- ============================================
DROP POLICY IF EXISTS "sr_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "sr_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "sr_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "sr_storage_delete" ON storage.objects;

-- Helper: is the given bucket the current user's org bucket?
CREATE OR REPLACE FUNCTION public.is_my_org_site_report_bucket(p_bucket_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p_bucket_id = 'site-report-photos-' || public.current_org_id()::text
$$;

CREATE POLICY "sr_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_my_org_site_report_bucket(bucket_id));

CREATE POLICY "sr_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_org_site_report_bucket(bucket_id));

CREATE POLICY "sr_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (public.is_my_org_site_report_bucket(bucket_id))
  WITH CHECK (public.is_my_org_site_report_bucket(bucket_id));

CREATE POLICY "sr_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (public.is_my_org_site_report_bucket(bucket_id));
