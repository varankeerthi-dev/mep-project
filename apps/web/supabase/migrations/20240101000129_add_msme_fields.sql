-- ============================================
-- Extended Vendor Fields (MSME, GST & Bank details)
-- ============================================

ALTER TABLE purchase_vendors
  ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS msme_register_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS msme_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(50);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_msme_register_type_vendor'
  ) THEN
    ALTER TABLE purchase_vendors DROP CONSTRAINT check_msme_register_type_vendor;
  END IF;

  ALTER TABLE purchase_vendors
    ADD CONSTRAINT check_msme_register_type_vendor
    CHECK (msme_register_type IS NULL OR msme_register_type IN ('', 'micro', 'small', 'medium', 'Micro', 'Small', 'Medium'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
