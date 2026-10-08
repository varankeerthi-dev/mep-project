-- Relax check constraints on clients and purchase_vendors to allow empty strings and standard values
ALTER TABLE clients DROP CONSTRAINT IF EXISTS check_gst_treatment;
ALTER TABLE clients
  ADD CONSTRAINT check_gst_treatment
  CHECK (
    gst_treatment IS NULL 
    OR gst_treatment = '' 
    OR (gst_treatment)::text = ANY (ARRAY[
      'Registered Business Regular'::character varying,
      'Registered Business Composition'::character varying,
      'Unregistered Business'::character varying,
      'Consumer'::character varying,
      'Overseas'::character varying,
      'Special Economic Zone (SEZ)'::character varying,
      'Deemed Export'::character varying,
      'Tax Deductor'::character varying,
      'SEZ Developer'::character varying,
      'Input Service Distributor'::character varying
    ]::text[])
  );

ALTER TABLE clients DROP CONSTRAINT IF EXISTS check_msme_register_type;
ALTER TABLE clients
  ADD CONSTRAINT check_msme_register_type
  CHECK (
    msme_register_type IS NULL 
    OR msme_register_type = '' 
    OR (msme_register_type)::text = ANY (ARRAY[
      'micro'::character varying,
      'small'::character varying,
      'medium'::character varying,
      'macro'::character varying,
      'Micro'::character varying,
      'Small'::character varying,
      'Medium'::character varying
    ]::text[])
  );

ALTER TABLE purchase_vendors DROP CONSTRAINT IF EXISTS check_gst_treatment_vendor;
ALTER TABLE purchase_vendors
  ADD CONSTRAINT check_gst_treatment_vendor
  CHECK (
    gst_treatment IS NULL 
    OR gst_treatment = '' 
    OR (gst_treatment)::text = ANY (ARRAY[
      'Registered Business Regular'::character varying,
      'Registered Business Composition'::character varying,
      'Unregistered Business'::character varying,
      'Consumer'::character varying,
      'Overseas'::character varying,
      'Special Economic Zone (SEZ)'::character varying,
      'Deemed Export'::character varying,
      'Tax Deductor'::character varying,
      'SEZ Developer'::character varying,
      'Input Service Distributor'::character varying
    ]::text[])
  );
