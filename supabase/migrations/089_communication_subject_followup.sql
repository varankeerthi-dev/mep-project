-- Migration: Add subject and follow_up_date columns to client_communication
-- These support the new Communication Log UI design

ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS follow_up_date date;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_communication_follow_up_date
  ON client_communication (follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_communication_subject
  ON client_communication USING gin (to_tsvector('english', coalesce(subject, '')))
  WHERE subject IS NOT NULL;
