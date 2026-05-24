-- Migration: Add submission details to invoices and create storage bucket
-- Created: 2026-05-24

-- 1. Add submission columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS submitted_date DATE,
ADD COLUMN IF NOT EXISTS submitted_by TEXT,
ADD COLUMN IF NOT EXISTS submitted_file_url TEXT;

-- 2. Create storage bucket for proofs (5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoice-submissions', 'invoice-submissions', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Set security policies for the bucket
-- Note: These policies assume standard Supabase Auth and organisation-based access is handled via URL path or application logic
-- For stricter security, you can refine these policies to check organisation_id in the path

-- Allow public read access to submissions
DROP POLICY IF EXISTS "Public Access for submissions" ON storage.objects;
CREATE POLICY "Public Access for submissions" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'invoice-submissions');

-- Allow authenticated users to upload submissions
DROP POLICY IF EXISTS "Allow Uploads for submissions" ON storage.objects;
CREATE POLICY "Allow Uploads for submissions" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'invoice-submissions');

-- Allow users to delete their own organisation's submissions (optional, based on path)
DROP POLICY IF EXISTS "Allow Deletes for submissions" ON storage.objects;
CREATE POLICY "Allow Deletes for submissions" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'invoice-submissions');
