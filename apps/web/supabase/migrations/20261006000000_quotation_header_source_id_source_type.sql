-- Add source_id and source_type columns to quotation_header for document conversion lineage
ALTER TABLE public.quotation_header
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text;

CREATE INDEX IF NOT EXISTS idx_quotation_header_source_id ON public.quotation_header (source_id);
CREATE INDEX IF NOT EXISTS idx_quotation_header_source_type ON public.quotation_header (source_type);

COMMENT ON COLUMN public.quotation_header.source_id IS 'UUID of the originating document or source record (e.g., delivery_challan, lead, etc.)';
COMMENT ON COLUMN public.quotation_header.source_type IS 'Type of the originating source document (e.g., challan, lead, etc.)';
