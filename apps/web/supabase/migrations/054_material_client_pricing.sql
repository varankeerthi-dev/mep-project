-- Material Client Pricing (ARC/Pricing per client per material)
CREATE TABLE IF NOT EXISTS public.material_client_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  pricing_type TEXT NOT NULL DEFAULT 'Fixed ARC',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  valid_from DATE,
  valid_to DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_material_client_pricing_material ON public.material_client_pricing(material_id);
CREATE INDEX IF NOT EXISTS idx_material_client_pricing_client ON public.material_client_pricing(client_id);
CREATE INDEX IF NOT EXISTS idx_material_client_pricing_org ON public.material_client_pricing(organisation_id);

-- Price change history table
CREATE TABLE IF NOT EXISTS public.material_client_pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id UUID NOT NULL REFERENCES public.material_client_pricing(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  pricing_type TEXT,
  old_rate NUMERIC(12,2),
  new_rate NUMERIC(12,2),
  valid_from DATE,
  valid_to DATE,
  status TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL DEFAULT 'created'
);

CREATE INDEX IF NOT EXISTS idx_pricing_history_pricing ON public.material_client_pricing_history(pricing_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_material ON public.material_client_pricing_history(material_id);

-- RLS policies
ALTER TABLE public.material_client_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_client_pricing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read material_client_pricing in their org" ON public.material_client_pricing FOR SELECT USING (organisation_id::text = (current_setting('request.jwt.claims', true)::json->>'organisation_id'));
CREATE POLICY "Users can insert material_client_pricing in their org" ON public.material_client_pricing FOR INSERT WITH CHECK (organisation_id::text = (current_setting('request.jwt.claims', true)::json->>'organisation_id'));
CREATE POLICY "Users can update material_client_pricing in their org" ON public.material_client_pricing FOR UPDATE USING (organisation_id::text = (current_setting('request.jwt.claims', true)::json->>'organisation_id'));
CREATE POLICY "Users can delete material_client_pricing in their org" ON public.material_client_pricing FOR DELETE USING (organisation_id::text = (current_setting('request.jwt.claims', true)::json->>'organisation_id'));

CREATE POLICY "Users can read pricing_history in their org" ON public.material_client_pricing_history FOR SELECT USING (organisation_id::text = (current_setting('request.jwt.claims', true)::json->>'organisation_id'));
CREATE POLICY "Users can insert pricing_history in their org" ON public.material_client_pricing_history FOR INSERT WITH CHECK (organisation_id::text = (current_setting('request.jwt.claims', true)::json->>'organisation_id'));

-- Trigger: auto-log price changes
CREATE OR REPLACE FUNCTION public.log_client_pricing_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.material_client_pricing_history (pricing_id, material_id, client_id, organisation_id, pricing_type, old_rate, new_rate, valid_from, valid_to, status, changed_by, change_type)
    VALUES (NEW.id, NEW.material_id, NEW.client_id, NEW.organisation_id, NEW.pricing_type, NULL, NEW.rate, NEW.valid_from, NEW.valid_to, NEW.status, auth.uid(), 'created');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.rate IS DISTINCT FROM OLD.rate OR NEW.pricing_type IS DISTINCT FROM OLD.pricing_type OR NEW.valid_from IS DISTINCT FROM OLD.valid_from OR NEW.valid_to IS DISTINCT FROM OLD.valid_to OR NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.material_client_pricing_history (pricing_id, material_id, client_id, organisation_id, pricing_type, old_rate, new_rate, valid_from, valid_to, status, changed_by, change_type)
      VALUES (NEW.id, NEW.material_id, NEW.client_id, NEW.organisation_id, NEW.pricing_type, OLD.rate, NEW.rate, NEW.valid_from, NEW.valid_to, NEW.status, auth.uid(), 'updated');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.material_client_pricing_history (pricing_id, material_id, client_id, organisation_id, pricing_type, old_rate, new_rate, valid_from, valid_to, status, changed_by, change_type)
    VALUES (OLD.id, OLD.material_id, OLD.client_id, OLD.organisation_id, OLD.pricing_type, OLD.rate, NULL, OLD.valid_from, OLD.valid_to, OLD.status, auth.uid(), 'deleted');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_client_pricing_change ON public.material_client_pricing;
CREATE TRIGGER trg_log_client_pricing_change
  AFTER INSERT OR UPDATE OR DELETE ON public.material_client_pricing
  FOR EACH ROW EXECUTE FUNCTION public.log_client_pricing_change();