-- FR8: SLA / Escalation

-- Notifications table (lightweight in-app)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(user_id) NOT NULL,
  organisation_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Escalation function
CREATE OR REPLACE FUNCTION escalate_urgent_communications()
RETURNS TABLE(escalated_id UUID, assigned_to_name TEXT) AS $$
DECLARE
  comm RECORD;
  org_admin_id UUID;
  admin_name TEXT;
BEGIN
  FOR comm IN
    SELECT *
    FROM client_communication
    WHERE priority = 'Urgent'
      AND status IN ('Open', 'In Progress')
      AND (
        (follow_up_date IS NOT NULL AND follow_up_date < now())
        OR
        (follow_up_date IS NULL AND created_at < now() - interval '4 hours')
      )
  LOOP
    -- If assigned_to is set, notify them
    IF comm.assigned_to IS NOT NULL THEN
      INSERT INTO notifications (user_id, organisation_id, title, body, link)
      VALUES (
        comm.assigned_to,
        comm.organisation_id,
        'Urgent communication past due',
        LEFT(COALESCE(comm.subject || ' — ', '') || COALESCE(comm.call_brief, 'No details'), 200),
        '/communication-log'
      );
    END IF;

    -- If no assignee OR past due > 24h, also escalate to org_admin
    IF comm.assigned_to IS NULL OR (comm.follow_up_date IS NOT NULL AND comm.follow_up_date < now() - interval '24 hours') THEN
      FOR org_admin_id, admin_name IN
        SELECT u.id, u.full_name
        FROM user_profiles u
        JOIN org_members om ON om.user_id = u.id
        WHERE om.organisation_id = comm.organisation_id
          AND om.role = 'org_admin'
      LOOP
        INSERT INTO notifications (user_id, organisation_id, title, body, link)
        VALUES (
          org_admin_id,
          comm.organisation_id,
          'Escalated: unowned urgent communication',
          LEFT('Unassigned urgent item: ' || COALESCE(comm.subject, 'No subject') || ' — ' || COALESCE(comm.call_brief, ''), 200),
          '/communication-log'
        );
      END LOOP;
    END IF;

    escalated_id := comm.id;
    assigned_to_name := (SELECT full_name FROM user_profiles WHERE user_id = comm.assigned_to);
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule every 15 minutes via pg_cron
SELECT cron.schedule('escalate-urgent-comms', '*/15 * * * *', 'SELECT escalate_urgent_communications()');
