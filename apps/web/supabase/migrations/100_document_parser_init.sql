-- 1. Create document extraction status enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extraction_status') THEN
    CREATE TYPE extraction_status AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED', 'PARTIAL');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_session_status') THEN
    CREATE TYPE review_session_status AS ENUM ('DRAFT', 'IMPORTED', 'ROLLED_BACK');
  END IF;
END $$;

-- 2. Create the document extractions cache table
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  file_hash CHAR(64) NOT NULL,        -- Fixed length SHA-256 hash of the document content
  filename VARCHAR(255) NOT NULL,
  pages INTEGER DEFAULT 1,
  source_type VARCHAR(20) NOT NULL,  -- 'TEXT' or 'VISION'
  provider VARCHAR(50) NOT NULL,      -- 'nvidia' or 'gemini'
  model VARCHAR(100) NOT NULL,
  model_version VARCHAR(50),
  prompt_version VARCHAR(50),
  schema_version VARCHAR(50),
  extracted_data JSONB,               -- The cached raw output from the VLM/LLM
  provider_latency_ms INTEGER,
  cost NUMERIC(12,6),                 -- Micro-cents parsing cost
  tokens INTEGER,
  status extraction_status NOT NULL DEFAULT 'PROCESSING',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for authenticated org members" 
ON public.document_extractions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = document_extractions.organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

CREATE POLICY "Enable select for org members" 
ON public.document_extractions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = document_extractions.organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

CREATE POLICY "Enable update for org members" 
ON public.document_extractions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = document_extractions.organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

-- Index for duplicate hash lookup (ensures only 1 extraction entry exists per hash per org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_extractions_hash_unique 
ON public.document_extractions(organisation_id, file_hash);

-- 3. Create the document review sessions table
CREATE TABLE IF NOT EXISTS public.document_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID NOT NULL REFERENCES public.document_extractions(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  request_id UUID NOT NULL,           -- Client-side generated request id to prevent double imports
  imported_data JSONB,                -- User-approved header + items values
  selected_items INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  review_duration_seconds INTEGER,
  corrections_count INTEGER DEFAULT 0,
  confidence_avg NUMERIC(5,2),
  warning_count INTEGER DEFAULT 0,
  target_id UUID,                     -- Created document UUID (Quotation, PO, etc.)
  target_type VARCHAR(20),            -- 'QUOTATION', 'PROFORMA', 'INVOICE', 'PURCHASE_ORDER'
  status review_session_status NOT NULL DEFAULT 'DRAFT',
  rolled_back_by_user_id UUID,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  rollback_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.document_review_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for authenticated members" 
ON public.document_review_sessions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

CREATE POLICY "Enable select for org members" 
ON public.document_review_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = document_review_sessions.organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

CREATE POLICY "Enable update for org members" 
ON public.document_review_sessions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = document_review_sessions.organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

-- Unique index to prevent retry spam for the same review session
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sessions_request_unique 
ON public.document_review_sessions(organisation_id, request_id);

-- 4. Create the document import items materialized table
CREATE TABLE IF NOT EXISTS public.document_import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_session_id UUID NOT NULL REFERENCES public.document_review_sessions(id) ON DELETE CASCADE,
  raw_name VARCHAR(255) NOT NULL,
  resolved_material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  confidence NUMERIC(5,2),
  warnings JSONB DEFAULT '[]'::jsonb,
  selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.document_import_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write to org members" 
ON public.document_import_items 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    JOIN public.document_review_sessions ON document_review_sessions.organisation_id = org_members.organisation_id
    WHERE document_review_sessions.id = document_import_items.review_session_id 
    AND org_members.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_import_items_session ON public.document_import_items(review_session_id);
CREATE INDEX IF NOT EXISTS idx_import_items_material ON public.document_import_items(resolved_material_id);

-- 5. Create the catalog learning alias memory table
CREATE TABLE IF NOT EXISTS public.catalog_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  raw_name VARCHAR(255) NOT NULL,
  resolved_material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_org_raw_name UNIQUE (organisation_id, raw_name)
);

ALTER TABLE public.catalog_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write access to org members" 
ON public.catalog_aliases 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE org_members.organisation_id = catalog_aliases.organisation_id 
    AND org_members.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_aliases_raw 
ON public.catalog_aliases(organisation_id, raw_name);

-- 6. Create the catalog alias stats table for telemetry tracking
CREATE TABLE IF NOT EXISTS public.catalog_alias_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_id UUID NOT NULL REFERENCES public.catalog_aliases(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 1,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  confidence NUMERIC(5,2),
  supplier_name VARCHAR(255)
);

ALTER TABLE public.catalog_alias_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write access" 
ON public.catalog_alias_stats 
USING (
  EXISTS (
    SELECT 1 FROM public.org_members 
    JOIN public.catalog_aliases ON catalog_aliases.organisation_id = org_members.organisation_id
    WHERE catalog_aliases.id = catalog_alias_stats.alias_id
    AND org_members.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_alias_stats_alias ON public.catalog_alias_stats(alias_id);

-- 7. Add AI Limits to the public.organisations table
ALTER TABLE public.organisations 
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_daily_limit INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS ai_monthly_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS ai_pages_limit INTEGER DEFAULT 5;
