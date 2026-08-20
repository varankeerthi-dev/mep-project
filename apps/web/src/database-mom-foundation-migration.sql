-- ============================================================
-- MOM FOUNDATION MIGRATION
-- ============================================================
-- This migration is intentionally NOT executed by the agent.
-- Run it manually in the Supabase SQL Editor only after reviewing it.
-- It is designed to be rerunnable for the additive objects in this file.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 0. Ensure the baseline Meetings/MOM schema exists first
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name VARCHAR(255) NOT NULL DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meeting_time VARCHAR(20),
  description TEXT,
  location TEXT,
  status VARCHAR(50) DEFAULT 'upcoming',
  participants TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS organisation_id UUID,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(50) DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS minutes_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS minutes_content TEXT,
  ADD COLUMN IF NOT EXISTS minutes_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS minutes_created_by UUID,
  ADD COLUMN IF NOT EXISTS reference_file_path TEXT,
  ADD COLUMN IF NOT EXISTS is_site_visit_meeting BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_visit_id UUID;

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(100) DEFAULT 'attendee',
  organisation VARCHAR(255),
  is_present BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  minutes_item_id UUID REFERENCES meeting_minutes_items(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  assigned_to UUID,
  assigned_to_name VARCHAR(255),
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'pending',
  task_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(255),
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS task_id UUID,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE meeting_attendees
  ADD COLUMN IF NOT EXISTS is_present BOOLEAN DEFAULT TRUE;

ALTER TABLE meeting_attachments
  ADD COLUMN IF NOT EXISTS file_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID;

-- ------------------------------------------------------------
-- 1. Add lineage and source fields to existing MOM tables
-- ------------------------------------------------------------
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS parent_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 2. Discussion topics and structured decisions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  serial_number INTEGER NOT NULL DEFAULT 1,
  title VARCHAR(500) NOT NULL,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'covered', 'deferred')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES meeting_topics(id) ON DELETE SET NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  owner_id UUID,
  owner_name VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'superseded', 'rejected')),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES meeting_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES meeting_decisions(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. Explicit MOM-to-work relationships
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('client', 'vendor', 'project', 'task', 'milestone', 'site_visit')),
  entity_id UUID NOT NULL,
  entity_name VARCHAR(500),
  source_type VARCHAR(30) NOT NULL DEFAULT 'meeting' CHECK (source_type IN ('meeting', 'topic', 'decision', 'action_item')),
  source_id UUID,
  source_title VARCHAR(500),
  snippet TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, entity_type, entity_id, source_type, source_id)
);

-- ------------------------------------------------------------
-- 4. Immutable versions and append-only audit events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('draft', 'in_review', 'finalized', 'superseded')),
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  supersedes_version_id UUID REFERENCES meeting_versions(id) ON DELETE RESTRICT,
  UNIQUE (meeting_id, version_number)
);

CREATE TABLE IF NOT EXISTS meeting_audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  event_type VARCHAR(40) NOT NULL,
  actor_id UUID,
  actor_name VARCHAR(255),
  entity_type VARCHAR(50),
  entity_id UUID,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 5. Search projection
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_search_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('meeting', 'topic', 'decision', 'action_item', 'attachment')),
  source_id UUID NOT NULL,
  source_title VARCHAR(500),
  search_text TEXT NOT NULL DEFAULT '',
  snippet TEXT,
  meeting_date DATE,
  meeting_type VARCHAR(50),
  client_id UUID,
  client_name VARCHAR(255),
  project_id UUID,
  project_name VARCHAR(500),
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_topics_meeting ON meeting_topics(meeting_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting ON meeting_decisions(meeting_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_links_entity ON meeting_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_meeting_links_meeting ON meeting_links(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_versions_meeting ON meeting_versions(meeting_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_audit_meeting ON meeting_audit_events(meeting_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_search_meeting ON meeting_search_documents(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_search_project ON meeting_search_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_search_date ON meeting_search_documents(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_search_text ON meeting_search_documents USING gin (to_tsvector('english', search_text));

-- ------------------------------------------------------------
-- 6. Search projection refresh helpers and triggers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_meeting_search_document(
  p_meeting_id UUID,
  p_source_type VARCHAR,
  p_source_id UUID,
  p_source_title VARCHAR,
  p_search_text TEXT,
  p_snippet TEXT
) RETURNS VOID AS $$
DECLARE
  m RECORD;
BEGIN
  SELECT
    mt.organisation_id,
    mt.meeting_date,
    mt.meeting_type,
    mt.client_id,
    mt.client_name,
    mt.project_id,
    COALESCE(p.project_name, '') AS project_name,
    (mt.minutes_status = 'finalized') AS is_finalized
  INTO m
  FROM meetings mt
  LEFT JOIN projects p ON p.id = mt.project_id
  WHERE mt.id = p_meeting_id;

  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO meeting_search_documents (
    organisation_id, meeting_id, source_type, source_id, source_title,
    search_text, snippet, meeting_date, meeting_type, client_id,
    client_name, project_id, project_name, is_finalized, updated_at
  ) VALUES (
    m.organisation_id, p_meeting_id, p_source_type, p_source_id, p_source_title,
    COALESCE(p_search_text, ''), p_snippet, m.meeting_date, m.meeting_type, m.client_id,
    m.client_name, m.project_id, m.project_name, m.is_finalized, NOW()
  )
  ON CONFLICT (meeting_id, source_type, source_id) DO UPDATE SET
    organisation_id = EXCLUDED.organisation_id,
    source_title = EXCLUDED.source_title,
    search_text = EXCLUDED.search_text,
    snippet = EXCLUDED.snippet,
    meeting_date = EXCLUDED.meeting_date,
    meeting_type = EXCLUDED.meeting_type,
    client_id = EXCLUDED.client_id,
    client_name = EXCLUDED.client_name,
    project_id = EXCLUDED.project_id,
    project_name = EXCLUDED.project_name,
    is_finalized = EXCLUDED.is_finalized,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_meeting_search_from_meeting() RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_meeting_search_document(
    NEW.id, 'meeting', NEW.id, NEW.client_name,
    CONCAT_WS(E'\n', NEW.client_name, NEW.vendor_name, NEW.description, NEW.participants, NEW.location, NEW.meeting_type),
    LEFT(COALESCE(NEW.description, NEW.client_name), 240)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_meeting_search_from_topic() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM meeting_search_documents WHERE meeting_id = OLD.meeting_id AND source_type = 'topic' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM refresh_meeting_search_document(NEW.meeting_id, 'topic', NEW.id, NEW.title, CONCAT_WS(E'\n', NEW.title, NEW.notes), LEFT(COALESCE(NEW.notes, NEW.title), 240));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_meeting_search_from_decision() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM meeting_search_documents WHERE meeting_id = OLD.meeting_id AND source_type = 'decision' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM refresh_meeting_search_document(NEW.meeting_id, 'decision', NEW.id, LEFT(NEW.decision, 500), CONCAT_WS(E'\n', NEW.decision, NEW.rationale, NEW.owner_name), LEFT(COALESCE(NEW.decision, NEW.rationale), 240));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_meeting_search_from_action_item() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM meeting_search_documents WHERE meeting_id = OLD.meeting_id AND source_type = 'action_item' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM refresh_meeting_search_document(NEW.meeting_id, 'action_item', NEW.id, NEW.title, CONCAT_WS(E'\n', NEW.title, NEW.description, NEW.assigned_to_name), LEFT(COALESCE(NEW.description, NEW.title), 240));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_meeting_search_meeting ON meetings;
CREATE TRIGGER trg_meeting_search_meeting AFTER INSERT OR UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION refresh_meeting_search_from_meeting();
DROP TRIGGER IF EXISTS trg_meeting_search_topic ON meeting_topics;
CREATE TRIGGER trg_meeting_search_topic AFTER INSERT OR UPDATE OR DELETE ON meeting_topics FOR EACH ROW EXECUTE FUNCTION refresh_meeting_search_from_topic();
DROP TRIGGER IF EXISTS trg_meeting_search_decision ON meeting_decisions;
CREATE TRIGGER trg_meeting_search_decision AFTER INSERT OR UPDATE OR DELETE ON meeting_decisions FOR EACH ROW EXECUTE FUNCTION refresh_meeting_search_from_decision();
DROP TRIGGER IF EXISTS trg_meeting_search_action_item ON meeting_action_items;
CREATE TRIGGER trg_meeting_search_action_item AFTER INSERT OR UPDATE OR DELETE ON meeting_action_items FOR EACH ROW EXECUTE FUNCTION refresh_meeting_search_from_action_item();

-- ------------------------------------------------------------
-- 7. Backfill existing meetings and structured records
-- ------------------------------------------------------------
INSERT INTO meeting_search_documents (
  organisation_id, meeting_id, source_type, source_id, source_title, search_text,
  snippet, meeting_date, meeting_type, client_id, client_name, project_id, project_name, is_finalized
)
SELECT
  m.organisation_id, m.id, 'meeting', m.id, m.client_name,
  CONCAT_WS(E'\n', m.client_name, m.vendor_name, m.description, m.participants, m.location, m.meeting_type),
  LEFT(COALESCE(m.description, m.client_name), 240), m.meeting_date, m.meeting_type,
  m.client_id, m.client_name, m.project_id, p.project_name, (m.minutes_status = 'finalized')
FROM meetings m
LEFT JOIN projects p ON p.id = m.project_id
ON CONFLICT (meeting_id, source_type, source_id) DO UPDATE SET
  search_text = EXCLUDED.search_text,
  snippet = EXCLUDED.snippet,
  is_finalized = EXCLUDED.is_finalized,
  updated_at = NOW();

INSERT INTO meeting_search_documents (
  organisation_id, meeting_id, source_type, source_id, source_title, search_text, snippet,
  meeting_date, meeting_type, client_name, project_id, project_name, is_finalized
)
SELECT
  m.organisation_id, t.meeting_id, 'topic', t.id, t.title, CONCAT_WS(E'\n', t.title, t.notes),
  LEFT(COALESCE(t.notes, t.title), 240), m.meeting_date, m.meeting_type, m.client_name,
  m.project_id, p.project_name, (m.minutes_status = 'finalized')
FROM meeting_topics t
JOIN meetings m ON m.id = t.meeting_id
LEFT JOIN projects p ON p.id = m.project_id
ON CONFLICT (meeting_id, source_type, source_id) DO UPDATE SET search_text = EXCLUDED.search_text, snippet = EXCLUDED.snippet, updated_at = NOW();

INSERT INTO meeting_search_documents (
  organisation_id, meeting_id, source_type, source_id, source_title, search_text, snippet,
  meeting_date, meeting_type, client_name, project_id, project_name, is_finalized
)
SELECT
  m.organisation_id, d.meeting_id, 'decision', d.id, LEFT(d.decision, 500), CONCAT_WS(E'\n', d.decision, d.rationale, d.owner_name),
  LEFT(COALESCE(d.decision, d.rationale), 240), m.meeting_date, m.meeting_type, m.client_name,
  m.project_id, p.project_name, (m.minutes_status = 'finalized')
FROM meeting_decisions d
JOIN meetings m ON m.id = d.meeting_id
LEFT JOIN projects p ON p.id = m.project_id
ON CONFLICT (meeting_id, source_type, source_id) DO UPDATE SET search_text = EXCLUDED.search_text, snippet = EXCLUDED.snippet, updated_at = NOW();

INSERT INTO meeting_search_documents (
  organisation_id, meeting_id, source_type, source_id, source_title, search_text, snippet,
  meeting_date, meeting_type, client_name, project_id, project_name, is_finalized
)
SELECT
  m.organisation_id, a.meeting_id, 'action_item', a.id, a.title, CONCAT_WS(E'\n', a.title, a.description, a.assigned_to_name),
  LEFT(COALESCE(a.description, a.title), 240), m.meeting_date, m.meeting_type, m.client_name,
  m.project_id, p.project_name, (m.minutes_status = 'finalized')
FROM meeting_action_items a
JOIN meetings m ON m.id = a.meeting_id
LEFT JOIN projects p ON p.id = m.project_id
ON CONFLICT (meeting_id, source_type, source_id) DO UPDATE SET search_text = EXCLUDED.search_text, snippet = EXCLUDED.snippet, updated_at = NOW();

-- ------------------------------------------------------------
-- 8. RLS policies
-- ------------------------------------------------------------
ALTER TABLE meeting_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_search_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "mom_topics_select" ON meeting_topics;
  DROP POLICY IF EXISTS "mom_topics_insert" ON meeting_topics;
  DROP POLICY IF EXISTS "mom_topics_update" ON meeting_topics;
  DROP POLICY IF EXISTS "mom_topics_delete" ON meeting_topics;
  DROP POLICY IF EXISTS "mom_decisions_select" ON meeting_decisions;
  DROP POLICY IF EXISTS "mom_decisions_insert" ON meeting_decisions;
  DROP POLICY IF EXISTS "mom_decisions_update" ON meeting_decisions;
  DROP POLICY IF EXISTS "mom_decisions_delete" ON meeting_decisions;
  DROP POLICY IF EXISTS "mom_links_select" ON meeting_links;
  DROP POLICY IF EXISTS "mom_links_insert" ON meeting_links;
  DROP POLICY IF EXISTS "mom_links_update" ON meeting_links;
  DROP POLICY IF EXISTS "mom_links_delete" ON meeting_links;
  DROP POLICY IF EXISTS "mom_versions_select" ON meeting_versions;
  DROP POLICY IF EXISTS "mom_versions_insert" ON meeting_versions;
  DROP POLICY IF EXISTS "mom_audit_select" ON meeting_audit_events;
  DROP POLICY IF EXISTS "mom_audit_insert" ON meeting_audit_events;
  DROP POLICY IF EXISTS "mom_search_select" ON meeting_search_documents;
END $$;

CREATE POLICY "mom_topics_select" ON meeting_topics FOR SELECT USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_topics_insert" ON meeting_topics FOR INSERT WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_topics_update" ON meeting_topics FOR UPDATE USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_topics_delete" ON meeting_topics FOR DELETE USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));

CREATE POLICY "mom_decisions_select" ON meeting_decisions FOR SELECT USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_decisions_insert" ON meeting_decisions FOR INSERT WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_decisions_update" ON meeting_decisions FOR UPDATE USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_decisions_delete" ON meeting_decisions FOR DELETE USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));

CREATE POLICY "mom_links_select" ON meeting_links FOR SELECT USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_links_insert" ON meeting_links FOR INSERT WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_links_update" ON meeting_links FOR UPDATE USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_links_delete" ON meeting_links FOR DELETE USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));

CREATE POLICY "mom_versions_select" ON meeting_versions FOR SELECT USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_versions_insert" ON meeting_versions FOR INSERT WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_audit_select" ON meeting_audit_events FOR SELECT USING (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_audit_insert" ON meeting_audit_events FOR INSERT WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())));
CREATE POLICY "mom_search_select" ON meeting_search_documents FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

-- Intentionally not executed by the agent. Review and run manually.
