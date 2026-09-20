-- Notifications system for subcontractor module
-- Stores user notifications for approvals, expiries, overdue payments, etc.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid DEFAULT NULL::uuid,
  reference_type text DEFAULT NULL::text,
  is_read boolean DEFAULT false,
  read_at timestamptz DEFAULT NULL::timestamp with time zone,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON public.notifications(organisation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;


-- RPC: create_notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_organisation_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_reference_id uuid DEFAULT NULL::uuid,
  p_reference_type text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  INSERT INTO public.notifications (
    user_id, organisation_id, type, title, message, reference_id, reference_type
  ) VALUES (
    p_user_id, p_organisation_id, p_type, p_title, p_message, p_reference_id, p_reference_type
  )
  RETURNING * INTO v_notification;

  RETURN jsonb_build_object(
    'status', 'success',
    'notification_id', v_notification.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, uuid, text) TO authenticated;


-- RPC: get_notifications
CREATE OR REPLACE FUNCTION public.get_notifications(
  p_user_id uuid DEFAULT NULL::uuid,
  p_organisation_id uuid DEFAULT NULL::uuid,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  organisation_id uuid,
  user_id uuid,
  type text,
  title text,
  message text,
  reference_id uuid,
  reference_type text,
  is_read boolean,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, organisation_id, user_id, type, title, message, reference_id, reference_type, is_read, read_at, created_at
  FROM public.notifications
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_organisation_id IS NULL OR organisation_id = p_organisation_id)
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_notifications(uuid, uuid, int) TO authenticated;


-- RPC: mark_notification_read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_notification FROM public.notifications
  WHERE id = p_notification_id AND user_id = COALESCE(p_user_id, auth.uid());

  IF v_notification IS NULL THEN
    RAISE EXCEPTION 'Notification not found or unauthorized';
  END IF;

  UPDATE public.notifications SET
    is_read = true,
    read_at = NOW()
  WHERE id = p_notification_id;

  RETURN jsonb_build_object('status', 'success');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid, uuid) TO authenticated;


-- RPC: mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_user_id uuid DEFAULT NULL::uuid,
  p_organisation_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.notifications SET
    is_read = true,
    read_at = NOW()
  WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND (p_organisation_id IS NULL OR organisation_id = p_organisation_id)
    AND is_read = false;

  RETURN jsonb_build_object('status', 'success');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid, uuid) TO authenticated;


-- RPC: get_unread_notification_count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(
  p_user_id uuid DEFAULT NULL::uuid,
  p_organisation_id uuid DEFAULT NULL::uuid
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM public.notifications
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND (p_organisation_id IS NULL OR organisation_id = p_organisation_id)
    AND is_read = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid, uuid) TO authenticated;
