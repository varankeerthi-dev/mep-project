CREATE TABLE public.document_checklist_configuration_revisions (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);

ALTER TABLE public.document_checklist_configuration_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_checklist_configuration_revisions FROM PUBLIC, anon, authenticated;

INSERT INTO public.document_checklist_configuration_revisions (organisation_id, revision)
SELECT id, 0 FROM public.organisations;

CREATE TABLE public.document_checklist_groups (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  display_order integer NOT NULL CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, id)
);

CREATE TABLE public.document_checklist_items (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL,
  group_id uuid NOT NULL,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  display_order integer NOT NULL CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organisation_id, group_id)
    REFERENCES public.document_checklist_groups(organisation_id, id) ON DELETE CASCADE,
  UNIQUE (organisation_id, group_id, id)
);

CREATE TABLE public.document_checklist_assignments (
  organisation_id uuid NOT NULL,
  group_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('quotation', 'sales_order')),
  display_order integer NOT NULL CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, document_type, group_id),
  FOREIGN KEY (organisation_id, group_id)
    REFERENCES public.document_checklist_groups(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX document_checklist_groups_org_order_idx
  ON public.document_checklist_groups (organisation_id, display_order, id);
CREATE INDEX document_checklist_items_group_order_idx
  ON public.document_checklist_items (organisation_id, group_id, display_order, id);

ALTER TABLE public.document_checklist_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_checklist_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_checklist_groups_select
  ON public.document_checklist_groups FOR SELECT
  USING (public.user_can_access_org(organisation_id));
CREATE POLICY document_checklist_items_select
  ON public.document_checklist_items FOR SELECT
  USING (public.user_can_access_org(organisation_id));
CREATE POLICY document_checklist_assignments_select
  ON public.document_checklist_assignments FOR SELECT
  USING (public.user_can_access_org(organisation_id));

REVOKE ALL ON public.document_checklist_groups FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_checklist_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.document_checklist_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_checklist_groups TO authenticated;
GRANT SELECT ON public.document_checklist_items TO authenticated;
GRANT SELECT ON public.document_checklist_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.get_document_checklist_configuration(p_organisation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_revision integer;
  v_groups jsonb;
  v_quotation_assignments jsonb;
  v_sales_order_assignments jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT COALESCE(
    (SELECT revision FROM public.document_checklist_configuration_revisions
      WHERE organisation_id = p_organisation_id),
    0
  ) INTO v_revision;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'display_order', g.display_order,
      'items', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', i.id,
          'label', i.label,
          'display_order', i.display_order
        ) ORDER BY i.display_order, i.id), '[]'::jsonb)
        FROM public.document_checklist_items i
        WHERE i.organisation_id = g.organisation_id AND i.group_id = g.id
      )
    ) ORDER BY g.display_order, g.id
  ), '[]'::jsonb)
  INTO v_groups
  FROM public.document_checklist_groups g
  WHERE g.organisation_id = p_organisation_id;

  SELECT COALESCE(jsonb_agg(a.group_id ORDER BY a.display_order, a.group_id), '[]'::jsonb)
  INTO v_quotation_assignments
  FROM public.document_checklist_assignments a
  WHERE a.organisation_id = p_organisation_id AND a.document_type = 'quotation';

  SELECT COALESCE(jsonb_agg(a.group_id ORDER BY a.display_order, a.group_id), '[]'::jsonb)
  INTO v_sales_order_assignments
  FROM public.document_checklist_assignments a
  WHERE a.organisation_id = p_organisation_id AND a.document_type = 'sales_order';

  RETURN jsonb_build_object(
    'revision', v_revision,
    'configuration', jsonb_build_object(
      'groups', v_groups,
      'assignments', jsonb_build_object(
      'quotation', v_quotation_assignments,
      'sales_order', v_sales_order_assignments
      )
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_document_checklist_configuration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_document_checklist_configuration(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_document_checklist_configuration(
  p_organisation_id uuid,
  p_config jsonb,
  p_expected_revision integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_group jsonb;
  v_item jsonb;
  v_group_id uuid;
  v_item_id uuid;
  v_group_name text;
  v_item_label text;
  v_group_order integer;
  v_item_order integer;
  v_document_type text;
  v_group_index integer := 0;
  v_item_index integer;
  v_assignment_ids jsonb;
  v_revision integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;
  IF NOT public.has_permission(p_organisation_id, 'org.settings') THEN
    RAISE EXCEPTION 'Missing org.settings permission';
  END IF;
  IF jsonb_typeof(p_config) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_config->'groups') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_config->'assignments') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid checklist configuration';
  END IF;
  IF jsonb_typeof(p_config->'assignments'->'quotation') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_config->'assignments'->'sales_order') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid checklist assignments';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_config->'assignments') AS assignment_key(key_name)
    WHERE assignment_key.key_name NOT IN ('quotation', 'sales_order')
  ) THEN
    RAISE EXCEPTION 'Unsupported checklist document type';
  END IF;

  FOR v_group IN SELECT value FROM jsonb_array_elements(p_config->'groups') LOOP
    v_group_index := v_group_index + 1;
    IF jsonb_typeof(v_group) IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_group->'items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid checklist group at position %', v_group_index;
    END IF;
    v_group_id := NULLIF(v_group->>'id', '')::uuid;
    v_group_name := btrim(COALESCE(v_group->>'name', ''));
    v_group_order := COALESCE((v_group->>'display_order')::integer, v_group_index - 1);
    IF v_group_id IS NULL OR v_group_name = '' OR v_group_order < 0 THEN
      RAISE EXCEPTION 'Checklist groups need an ID, name, and valid order';
    END IF;

    v_item_index := 0;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_group->'items') LOOP
      v_item_index := v_item_index + 1;
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Invalid checklist item in group %', v_group_name;
      END IF;
      v_item_id := NULLIF(v_item->>'id', '')::uuid;
      v_item_label := btrim(COALESCE(v_item->>'label', ''));
      v_item_order := COALESCE((v_item->>'display_order')::integer, v_item_index - 1);
      IF v_item_id IS NULL OR v_item_label = '' OR v_item_order < 0 THEN
        RAISE EXCEPTION 'Checklist items need an ID, label, and valid order';
      END IF;
    END LOOP;
  END LOOP;

  FOR v_document_type, v_assignment_ids IN
    SELECT key, value FROM jsonb_each(p_config->'assignments')
  LOOP
    IF v_document_type NOT IN ('quotation', 'sales_order')
      OR jsonb_typeof(v_assignment_ids) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Unsupported checklist document type';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_assignment_ids) AS requested(group_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_config->'groups') AS candidate(value)
        WHERE candidate.value->>'id' = requested.group_id
      )
    ) THEN
      RAISE EXCEPTION 'Checklist assignment refers to a missing group';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_assignment_ids) AS requested(group_id)
      JOIN jsonb_array_elements(p_config->'groups') AS candidate(value)
        ON candidate.value->>'id' = requested.group_id
      WHERE jsonb_array_length(candidate.value->'items') = 0
    ) THEN
      RAISE EXCEPTION 'Assigned checklist groups must contain at least one item';
    END IF;
  END LOOP;

  INSERT INTO public.document_checklist_configuration_revisions (organisation_id, revision)
  VALUES (p_organisation_id, 0) ON CONFLICT (organisation_id) DO NOTHING;
  SELECT revision INTO v_revision
  FROM public.document_checklist_configuration_revisions
  WHERE organisation_id = p_organisation_id
  FOR UPDATE;
  IF p_expected_revision IS DISTINCT FROM v_revision THEN
    RAISE EXCEPTION 'CHECKLIST_REVISION_CONFLICT' USING ERRCODE = '40001';
  END IF;

  DELETE FROM public.document_checklist_groups WHERE organisation_id = p_organisation_id;

  v_group_index := 0;
  FOR v_group IN SELECT value FROM jsonb_array_elements(p_config->'groups') LOOP
    v_group_index := v_group_index + 1;
    v_group_id := (v_group->>'id')::uuid;
    v_group_order := COALESCE((v_group->>'display_order')::integer, v_group_index - 1);
    INSERT INTO public.document_checklist_groups (id, organisation_id, name, display_order)
    VALUES (v_group_id, p_organisation_id, btrim(v_group->>'name'), v_group_order);

    v_item_index := 0;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_group->'items') LOOP
      v_item_index := v_item_index + 1;
      INSERT INTO public.document_checklist_items (id, organisation_id, group_id, label, display_order)
      VALUES (
        (v_item->>'id')::uuid,
        p_organisation_id,
        v_group_id,
        btrim(v_item->>'label'),
        COALESCE((v_item->>'display_order')::integer, v_item_index - 1)
      );
    END LOOP;
  END LOOP;

  FOR v_document_type, v_assignment_ids IN
    SELECT key, value FROM jsonb_each(p_config->'assignments')
  LOOP
    INSERT INTO public.document_checklist_assignments (organisation_id, group_id, document_type, display_order)
    SELECT p_organisation_id, requested.group_id::uuid, v_document_type, requested.ordinality - 1
    FROM jsonb_array_elements_text(v_assignment_ids) WITH ORDINALITY AS requested(group_id, ordinality);
  END LOOP;

  UPDATE public.document_checklist_configuration_revisions
  SET revision = v_revision + 1
  WHERE organisation_id = p_organisation_id;
  RETURN v_revision + 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_document_checklist_configuration(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_checklist_configuration(uuid, jsonb, integer) TO authenticated;
