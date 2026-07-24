-- ============================================
-- Vendor Document Upload Fields
-- Stores Supabase Storage URLs for PAN card, cheque leaf,
-- GST certificate, and MSME certificate uploads.
-- ============================================

-- Add URL columns to purchase_vendors
ALTER TABLE purchase_vendors
  ADD COLUMN IF NOT EXISTS pan_card_url TEXT,
  ADD COLUMN IF NOT EXISTS cheque_leaf_url TEXT,
  ADD COLUMN IF NOT EXISTS gstin_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS msme_certificate_url TEXT;

-- Create storage bucket for vendor documents (private, 10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-documents',
  'vendor-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: org members can read their own vendor documents
CREATE POLICY "vendor_docs_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vendor-documents'
  AND EXISTS (
    SELECT 1 FROM purchase_vendors v
    WHERE v.organisation_id = (storage.foldername(name))[1]::uuid
    AND v.id::text = (storage.foldername(name))[2]
  )
);

-- RLS: org members can upload to their vendor folders
CREATE POLICY "vendor_docs_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vendor-documents');

-- RLS: org members can delete their own vendor documents
CREATE POLICY "vendor_docs_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'vendor-documents');
