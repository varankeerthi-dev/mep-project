-- Create storage bucket for meeting reference documents
-- Run this in Supabase SQL Editor

-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-references', 'meeting-references', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "meeting_references_select" ON storage.objects;
DROP POLICY IF EXISTS "meeting_references_insert" ON storage.objects;
DROP POLICY IF EXISTS "meeting_references_delete" ON storage.objects;

-- Select policy: organisation members can view files
CREATE POLICY "meeting_references_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meeting-references'
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
      AND (storage.objects.name LIKE om.organisation_id::text || '/%')
    )
  );

-- Insert policy: organisation members can upload files
CREATE POLICY "meeting_references_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-references'
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
      AND (storage.objects.name LIKE om.organisation_id::text || '/%')
    )
  );

-- Delete policy: organisation members can delete their files
CREATE POLICY "meeting_references_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'meeting-references'
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
      AND (storage.objects.name LIKE om.organisation_id::text || '/%')
    )
  );
