-- Supporting RPCs for v2 subcontractor module
-- Labour categories, context modifiers, and rate cards

-- 1. RPC: get_labour_categories
CREATE OR REPLACE FUNCTION public.get_labour_categories(
  p_organisation_id uuid
)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  name text,
  code text,
  description text,
  base_rate numeric,
  unit text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, organisation_id, name, code, description, base_rate, unit, is_active, created_at, updated_at
  FROM public.labour_categories
  WHERE organisation_id = p_organisation_id
  ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public.get_labour_categories(uuid) TO authenticated;


-- 2. RPC: create_labour_category
CREATE OR REPLACE FUNCTION public.create_labour_category(
  p_organisation_id uuid,
  p_name text,
  p_code text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_base_rate numeric DEFAULT 0,
  p_unit text DEFAULT 'day'::text,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_category RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  INSERT INTO public.labour_categories (
    organisation_id, name, code, description, base_rate, unit, is_active
  ) VALUES (
    p_organisation_id, p_name, p_code, p_description, p_base_rate, p_unit, p_is_active
  )
  RETURNING * INTO v_category;

  RETURN jsonb_build_object(
    'status', 'success',
    'category_id', v_category.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_labour_category(uuid, text, text, text, numeric, text, boolean) TO authenticated;


-- 3. RPC: delete_labour_category
CREATE OR REPLACE FUNCTION public.delete_labour_category(
  p_category_id uuid,
  p_organisation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_category RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_category FROM public.labour_categories
  WHERE id = p_category_id AND organisation_id = p_organisation_id;

  IF v_category IS NULL THEN
    RAISE EXCEPTION 'Labour category not found or unauthorized';
  END IF;

  DELETE FROM public.labour_categories WHERE id = p_category_id;

  RETURN jsonb_build_object('status', 'success');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_labour_category(uuid, uuid) TO authenticated;


-- 4. RPC: get_context_modifiers
CREATE OR REPLACE FUNCTION public.get_context_modifiers(
  p_organisation_id uuid
)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  name text,
  code text,
  modifier_type text,
  multiplier numeric,
  is_percentage boolean,
  description text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, organisation_id, name, code, modifier_type, multiplier, is_percentage, description, is_active, created_at, updated_at
  FROM public.context_modifiers
  WHERE organisation_id = p_organisation_id
  ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public.get_context_modifiers(uuid) TO authenticated;


-- 5. RPC: get_rate_cards
CREATE OR REPLACE FUNCTION public.get_rate_cards(
  p_organisation_id uuid,
  p_subcontractor_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  subcontractor_id uuid,
  work_unit_id uuid,
  labour_category_id uuid,
  base_rate numeric,
  negotiated_rate numeric,
  effective_from date,
  effective_to date,
  is_active boolean,
  remarks text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, organisation_id, subcontractor_id, work_unit_id, labour_category_id,
         base_rate, negotiated_rate, effective_from, effective_to, is_active, remarks,
         created_at, updated_at
  FROM public.rate_cards
  WHERE organisation_id = p_organisation_id
    AND (p_subcontractor_id IS NULL OR subcontractor_id = p_subcontractor_id)
  ORDER BY effective_from DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_rate_cards(uuid, uuid) TO authenticated;
