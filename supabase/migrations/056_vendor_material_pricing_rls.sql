-- RLS policies for vendor_material_pricing table
-- Uses org_members lookup instead of JWT claim for reliability
ALTER TABLE public.vendor_material_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read vendor_material_pricing in their org" ON public.vendor_material_pricing;
DROP POLICY IF EXISTS "Users can insert vendor_material_pricing in their org" ON public.vendor_material_pricing;
DROP POLICY IF EXISTS "Users can update vendor_material_pricing in their org" ON public.vendor_material_pricing;
DROP POLICY IF EXISTS "Users can delete vendor_material_pricing in their org" ON public.vendor_material_pricing;

CREATE POLICY "Users can read vendor_material_pricing in their org"
  ON public.vendor_material_pricing FOR SELECT
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert vendor_material_pricing in their org"
  ON public.vendor_material_pricing FOR INSERT
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update vendor_material_pricing in their org"
  ON public.vendor_material_pricing FOR UPDATE
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete vendor_material_pricing in their org"
  ON public.vendor_material_pricing FOR DELETE
  USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
