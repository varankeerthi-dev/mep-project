-- ============================================
-- MEETINGS MODULE - COMPLETE SQL
-- ============================================

DO $$
BEGIN
  -- Check if meetings table exists and add missing columns
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'meetings') THEN
    -- Add missing columns to existing meetings table
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS client_id UUID;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS project_id UUID;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'physical';
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_link TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'client';
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes_status TEXT DEFAULT 'pending';
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes_created_at TIMESTAMPTZ;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes_created_by UUID;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS participants TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tags TEXT[];
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence JSONB;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_site_visit_meeting BOOLEAN DEFAULT false;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS site_visit_id UUID;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  ELSE
    -- Create meetings table
    CREATE TABLE meetings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organisation_id UUID NOT NULL,
      client_id UUID,
      project_id UUID,
      client_name TEXT NOT NULL,
      vendor_name TEXT,
      meeting_date DATE NOT NULL,
      meeting_time TEXT,
      duration_minutes INTEGER DEFAULT 60,
      location TEXT,
      location_type TEXT DEFAULT 'physical',
      meeting_link TEXT,
      description TEXT,
      meeting_type TEXT DEFAULT 'client',
      status TEXT DEFAULT 'upcoming',
      minutes_status TEXT DEFAULT 'pending',
      minutes_created_at TIMESTAMPTZ,
      minutes_created_by UUID,
      participants TEXT,
      tags TEXT[],
      recurrence JSONB,
      is_site_visit_meeting BOOLEAN DEFAULT false,
      site_visit_id UUID,
      reference_file_path TEXT,
      is_archived BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- ============================================
-- MEETING_MINUTES_ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_minutes_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  serial_number INTEGER NOT NULL,
  description TEXT,
  client_scope TEXT,
  vendor_scope TEXT,
  target_date DATE,
  remarks TEXT,
  requirement TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MEETING_ATTENDEES
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'attendee',
  organisation TEXT,
  is_present BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MEETING_ACTION_ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  minutes_item_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  due_date DATE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  task_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MEETING_ATTACHMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MEETING_TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_client_name TEXT,
  default_vendor_name TEXT,
  default_location TEXT,
  default_description TEXT,
  default_meeting_type TEXT,
  default_duration_minutes INTEGER,
  template_attendees JSONB,
  template_minutes JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organisation_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meetings_archived ON meetings(is_archived);
CREATE INDEX IF NOT EXISTS idx_minutes_meeting ON meeting_minutes_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_attendees_meeting ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON meeting_action_items(status);
CREATE INDEX IF NOT EXISTS idx_attachments_meeting ON meeting_attachments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_templates_org ON meeting_templates(organisation_id);