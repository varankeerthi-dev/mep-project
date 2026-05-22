-- ============================================
-- MINUTES OF MEETING ENHANCEMENT
-- Run this in Supabase SQL Editor
-- ============================================

-- Add columns to existing meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS organisation_id UUID,
ADD COLUMN IF NOT EXISTS project_id UUID,
ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(50) DEFAULT 'client',
ADD COLUMN IF NOT EXISTS minutes_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS minutes_content TEXT,
ADD COLUMN IF NOT EXISTS minutes_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS minutes_created_by UUID,
ADD COLUMN IF NOT EXISTS reference_file_path TEXT,
ADD COLUMN IF NOT EXISTS is_site_visit_meeting BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS site_visit_id UUID;

-- Create meeting minutes items table (tabular format)
CREATE TABLE IF NOT EXISTS meeting_minutes_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  serial_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  client_scope TEXT,
  vendor_scope TEXT,
  target_date DATE,
  remarks TEXT,
  requirement TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting attendees table
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(100) DEFAULT 'attendee',
  organisation VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting action items table (linked to tasks)
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  minutes_item_id UUID REFERENCES meeting_minutes_items(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID,
  assigned_to_name VARCHAR(255),
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'open',
  task_id UUID, -- Link to unified_tasks table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organisation_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_minutes_status ON meetings(minutes_status);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_minutes_items_meeting ON meeting_minutes_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_attendees_meeting ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_task ON meeting_action_items(task_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned ON meeting_action_items(assigned_to);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meetings
CREATE POLICY "Users can view meetings in their organisation"
  ON meetings FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert meetings in their organisation"
  ON meetings FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update meetings in their organisation"
  ON meetings FOR UPDATE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete meetings in their organisation"
  ON meetings FOR DELETE
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for meeting_minutes_items (cascade through meeting)
CREATE POLICY "Users can view minutes items for their organisation meetings"
  ON meeting_minutes_items FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert minutes items for their organisation meetings"
  ON meeting_minutes_items FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update minutes items for their organisation meetings"
  ON meeting_minutes_items FOR UPDATE
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete minutes items for their organisation meetings"
  ON meeting_minutes_items FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for meeting_attendees (cascade through meeting)
CREATE POLICY "Users can view attendees for their organisation meetings"
  ON meeting_attendees FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert attendees for their organisation meetings"
  ON meeting_attendees FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update attendees for their organisation meetings"
  ON meeting_attendees FOR UPDATE
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete attendees for their organisation meetings"
  ON meeting_attendees FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for meeting_action_items (cascade through meeting)
CREATE POLICY "Users can view action items for their organisation meetings"
  ON meeting_action_items FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert action items for their organisation meetings"
  ON meeting_action_items FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update action items for their organisation meetings"
  ON meeting_action_items FOR UPDATE
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete action items for their organisation meetings"
  ON meeting_action_items FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM meetings 
      WHERE organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid()
      )
    )
  );
