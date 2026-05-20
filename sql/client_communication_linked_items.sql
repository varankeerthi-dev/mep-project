-- Link client_communication to quotations, invoices, PO/DC backlog
-- Run this after client_communication.sql and 051_follow_up_centre.sql

BEGIN;

ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS linked_type VARCHAR(50);
ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS linked_id UUID;

CREATE INDEX IF NOT EXISTS idx_client_communication_linked
  ON client_communication(linked_type, linked_id)
  WHERE linked_id IS NOT NULL;

COMMENT ON COLUMN client_communication.linked_type IS 'quotation | invoice | podc | site_visit';
COMMENT ON COLUMN client_communication.linked_id IS 'ID of the linked item (quotation_header.id, invoices.id, follow_up_podc_backlog.id, site_visits.id)';

COMMIT;
