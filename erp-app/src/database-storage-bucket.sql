-- Run this in Supabase SQL Editor to create storage bucket for organisation assets

-- Create storage bucket for organisation assets (logos and signatures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('organisation-assets', 'organisation-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Enable public access to the bucket
CREATE POLICY "Public Access for organisation-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'organisation-assets');

CREATE POLICY "Allow Uploads for organisation-assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'organisation-assets');

CREATE POLICY "Allow Updates for organisation-assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'organisation-assets');

CREATE POLICY "Allow Deletes for organisation-assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'organisation-assets');
