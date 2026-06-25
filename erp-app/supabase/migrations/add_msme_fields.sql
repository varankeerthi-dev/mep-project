-- Add MSME fields to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS msme_register_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS msme_number VARCHAR(50);

-- Add MSME fields to purchase_vendors table
ALTER TABLE purchase_vendors
ADD COLUMN IF NOT EXISTS msme_register_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS msme_number VARCHAR(50);

-- Add GST Treatment field to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(100);

-- Add GST Treatment field to purchase_vendors table
ALTER TABLE purchase_vendors
ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(100);

-- Add MSME toggle to document_templates table
ALTER TABLE document_templates
ADD COLUMN IF NOT EXISTS show_msme BOOLEAN DEFAULT false;

-- Add check constraint for valid MSME register types (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_msme_register_type') THEN
        ALTER TABLE clients
        ADD CONSTRAINT check_msme_register_type
        CHECK (msme_register_type IN ('micro', 'small', 'macro') OR msme_register_type IS NULL);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_msme_register_type_vendor') THEN
        ALTER TABLE purchase_vendors
        ADD CONSTRAINT check_msme_register_type_vendor
        CHECK (msme_register_type IN ('micro', 'small', 'macro') OR msme_register_type IS NULL);
    END IF;
END $$;

-- Add check constraint for valid GST treatment types (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_gst_treatment') THEN
        ALTER TABLE clients
        ADD CONSTRAINT check_gst_treatment
        CHECK (gst_treatment IN (
          'Registered Business Regular',
          'Registered Business Composition',
          'Unregistered Business',
          'Consumer',
          'Overseas',
          'Special Economic Zone (SEZ)',
          'Deemed Export',
          'Tax Deductor',
          'SEZ Developer',
          'Input Service Distributor'
        ) OR gst_treatment IS NULL);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_gst_treatment_vendor') THEN
        ALTER TABLE purchase_vendors
        ADD CONSTRAINT check_gst_treatment_vendor
        CHECK (gst_treatment IN (
          'Registered Business Regular',
          'Registered Business Composition',
          'Unregistered Business',
          'Consumer',
          'Overseas',
          'Special Economic Zone (SEZ)',
          'Deemed Export',
          'Tax Deductor',
          'SEZ Developer',
          'Input Service Distributor'
        ) OR gst_treatment IS NULL);
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN clients.msme_register_type IS 'MSME registration type: micro, small, or macro enterprise';
COMMENT ON COLUMN clients.msme_number IS 'MSME registration/UDYAM number';
COMMENT ON COLUMN clients.gst_treatment IS 'GST treatment category for the client';
COMMENT ON COLUMN purchase_vendors.msme_register_type IS 'MSME registration type: micro, small, or macro enterprise';
COMMENT ON COLUMN purchase_vendors.msme_number IS 'MSME registration/UDYAM number';
COMMENT ON COLUMN purchase_vendors.gst_treatment IS 'GST treatment category for the vendor';
COMMENT ON COLUMN document_templates.show_msme IS 'Show MSME details in printed documents';
