-- Normalize legacy status casing on site_visits
-- Date: 2026-10-08
-- The app enum uses lowercase statuses (pending/scheduled/in_progress/completed/cancelled/postponed).
-- Two sales-side writers historically inserted 'Scheduled' (capital S), which misses the
-- status maps and filters in the UI. There is no CHECK constraint on site_visits.status,
-- so these rows landed silently.

UPDATE site_visits
SET status = 'scheduled'
WHERE status = 'Scheduled';
