-- 1. Create supplier profiles table for few-shot layout instructions
CREATE TABLE IF NOT EXISTS public.supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  layout_hints TEXT,                  -- Few-shot instructions for the VLM prompt
  stability_score NUMERIC(5,2) DEFAULT 100.00,
  manual_corrections_pct NUMERIC(5,2) DEFAULT 0.00,
  average_review_seconds INTEGER DEFAULT 0,
  total_imports INTEGER DEFAULT 0,
  last_imported_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_org_supplier UNIQUE (organisation_id, supplier_name)
);

ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable select/insert/update for org members on supplier profiles"
ON public.supplier_profiles
USING (
  EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.organisation_id = supplier_profiles.organisation_id
    AND org_members.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_profiles_name 
ON public.supplier_profiles(organisation_id, supplier_name);

-- 2. Create benchmarks log table for nightly runs
CREATE TABLE IF NOT EXISTS public.benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  total_tests INTEGER NOT NULL,
  passed_tests INTEGER NOT NULL,
  field_accuracy NUMERIC(5,2),
  line_accuracy NUMERIC(5,2),
  gst_accuracy NUMERIC(5,2),
  catalog_accuracy NUMERIC(5,2),
  details JSONB
);

ALTER TABLE public.benchmark_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users on benchmark runs"
ON public.benchmark_runs
USING (auth.role() = 'authenticated');
