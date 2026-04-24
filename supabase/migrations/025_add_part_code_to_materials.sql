-- Add part_code column to materials table
-- Part code is an alphanumeric value, organisation-based

ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS part_code TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_materials_part_code ON public.materials(part_code);

-- Add unique constraint per organisation for part_code
-- This ensures part_code is unique within each organisation
CREATE UNIQUE INDEX IF NOT EXISTS idx_materials_part_code_org_unique 
ON public.materials(part_code, organisation_id) 
WHERE part_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.materials.part_code IS 'Alphanumeric part code unique per organisation';
