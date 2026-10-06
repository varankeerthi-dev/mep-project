-- Reusable attribute sets for materials.
--
-- Problem: Technical Attributes are per-item rows. Ten pipe items sharing
-- Grade + Pressure Rating + End Connection meant retyping the same rows ten
-- times. AttributeSuggestionPicker only suggests skeletons (name/type/unit,
-- no values) from a hardcoded preset list.
--
-- This adds one table holding named, org-scoped sets of attribute LINES
-- including values. The editor applies a set by appending its lines to the
-- item form (skipping names already present); saving the item persists rows
-- through the existing material_custom_attributes path, unchanged.
-- One table, lines as jsonb — no lines table, no new save path.
--
-- NOT APPLIED YET. The UI reads through a tolerant query: table absent means
-- an empty set list, never a broken editor.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.material_attribute_sets (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid        NOT NULL,
  name            text        NOT NULL,
  lines           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT material_attribute_set_name_len CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS material_attribute_sets_org_name_idx
  ON public.material_attribute_sets (organisation_id, name);

CREATE INDEX IF NOT EXISTS material_attribute_sets_org_idx
  ON public.material_attribute_sets (organisation_id);

ALTER TABLE public.material_attribute_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_attribute_sets_select ON public.material_attribute_sets;
CREATE POLICY material_attribute_sets_select ON public.material_attribute_sets
  FOR SELECT USING (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS material_attribute_sets_insert ON public.material_attribute_sets;
CREATE POLICY material_attribute_sets_insert ON public.material_attribute_sets
  FOR INSERT WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS material_attribute_sets_update ON public.material_attribute_sets;
CREATE POLICY material_attribute_sets_update ON public.material_attribute_sets
  FOR UPDATE USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS material_attribute_sets_delete ON public.material_attribute_sets;
CREATE POLICY material_attribute_sets_delete ON public.material_attribute_sets
  FOR DELETE USING (public.user_can_access_org(organisation_id));
