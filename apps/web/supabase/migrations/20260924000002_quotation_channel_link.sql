-- Quotation <-> project collaboration interlink.
-- Mirrors link_daily_report_to_channel: idempotent per (quotation, event)
-- system message with a linked quotation entity in the project's channel.
-- Run this in the Supabase Dashboard SQL Editor.

CREATE TABLE IF NOT EXISTS public.quotation_channel_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES quotation_header(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL,
  message_id UUID NOT NULL,
  event TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quotation_id, event)
);

CREATE INDEX IF NOT EXISTS idx_quotation_channel_links_project
  ON public.quotation_channel_links(project_id);

ALTER TABLE public.quotation_channel_links ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-by-default. All access goes through
-- the SECURITY DEFINER RPC below, which performs its own auth checks.

CREATE OR REPLACE FUNCTION public.post_quotation_channel_card(
  p_quotation_id UUID,
  p_event TEXT DEFAULT 'created'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_q RECORD;
  v_client_name TEXT;
  v_channel RECORD;
  v_existing_message_id UUID;
  v_existing_msg JSONB;
  v_message_id UUID;
  v_metadata JSONB;
  v_content TEXT;
  v_hash TEXT;
  v_client_msg_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_event NOT IN ('created', 'submitted', 'approved') THEN RAISE EXCEPTION 'invalid_event'; END IF;

  SELECT q.id, q.quotation_no, q.project_id, q.organisation_id, q.grand_total, c.client_name
    INTO v_q
  FROM public.quotation_header q
  LEFT JOIN public.clients c ON c.id = q.client_id
  WHERE q.id = p_quotation_id;
  IF v_q.id IS NULL THEN RAISE EXCEPTION 'quotation_not_found'; END IF;
  IF v_q.project_id IS NULL THEN RAISE EXCEPTION 'no_project_linked'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('quotation-channel:' || p_quotation_id::text || ':' || p_event));

  SELECT message_id INTO v_existing_message_id
  FROM public.quotation_channel_links
  WHERE quotation_id = p_quotation_id AND event = p_event;
  IF v_existing_message_id IS NOT NULL THEN
    SELECT row_to_json(m.*)::jsonb INTO v_existing_msg
    FROM public.project_collaboration_messages m
    WHERE m.id = v_existing_message_id;
    RETURN COALESCE(v_existing_msg, jsonb_build_object('deduplicated', true, 'message_id', v_existing_message_id));
  END IF;

  v_channel := public.get_or_create_project_channel(v_q.project_id);
  IF v_channel.organisation_id IS DISTINCT FROM v_q.organisation_id THEN
    RAISE EXCEPTION 'org_mismatch';
  END IF;

  v_client_name := COALESCE(v_q.client_name, 'Client');
  IF p_event = 'created' THEN
    v_content := 'Quotation ' || v_q.quotation_no || ' created for ' || v_client_name || ' - Total ' || COALESCE(v_q.grand_total::text, '0');
  ELSIF p_event = 'submitted' THEN
    v_content := 'Quotation ' || v_q.quotation_no || ' submitted for approval';
  ELSE
    v_content := 'Quotation ' || v_q.quotation_no || ' approved';
  END IF;

  v_metadata := jsonb_build_object(
    'linked_entities', jsonb_build_array(jsonb_build_object(
      'type', 'quotation',
      'id', p_quotation_id,
      'label', v_q.quotation_no
    ))
  );

  v_hash := md5('qc:' || p_quotation_id::text || ':' || p_event);
  v_client_msg_id := (substr(v_hash, 1, 8) || '-' || substr(v_hash, 9, 4) || '-4' || substr(v_hash, 13, 3) || '-' || substr(v_hash, 17, 4) || '-' || substr(v_hash, 21, 12))::uuid;

  PERFORM public.send_collaboration_message(
    v_channel.id, v_content, NULL, 'system', v_metadata, v_client_msg_id
  );

  SELECT id INTO v_message_id
  FROM public.project_collaboration_messages
  WHERE channel_id = v_channel.id AND client_msg_id = v_client_msg_id;

  INSERT INTO public.quotation_channel_links
    (organisation_id, quotation_id, project_id, channel_id, message_id, event)
  VALUES
    (v_channel.organisation_id, p_quotation_id, v_q.project_id, v_channel.id, v_message_id, p_event);

  BEGIN
    INSERT INTO audit_log (organisation_id, user_id, action, entity_type, entity_id, changes)
    VALUES (v_channel.organisation_id, v_user_id, 'CREATE', 'quotation_channel_card', v_message_id,
            jsonb_build_object('event', p_event, 'quotation_id', p_quotation_id));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('message_id', v_message_id, 'channel_id', v_channel.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_quotation_channel_card(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
