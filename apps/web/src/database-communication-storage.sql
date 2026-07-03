-- FR7: Communication attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-attachments', 'communication-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to read within their org
CREATE POLICY "org_users_read_comm_attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'communication-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM org_members WHERE user_id = auth.uid()
  )
);

-- RLS: Allow authenticated users to upload within their org
CREATE POLICY "org_users_insert_comm_attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'communication-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM org_members WHERE user_id = auth.uid()
  )
);

-- RLS: Allow authenticated users to delete their org's files
CREATE POLICY "org_users_delete_comm_attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'communication-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organisation_id::text FROM org_members WHERE user_id = auth.uid()
  )
);
