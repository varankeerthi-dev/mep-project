-- Migration to add organisation_id to store/inventory tables for proper multitenancy isolation
ALTER TABLE public.material_inward 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.material_inward_items 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.material_outward 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.material_outward_items 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
