-- Employee linkage for site visits + visit FK on tasks
-- Date: 2026-10-08
-- 1) site_visits.employee_id: the engineer select historically stored only a name string
--    (site_visits.engineer is TEXT). This adds the keyed employee reference so downstream
--    consumers (attendance planning, task assignment) can resolve the person.
-- 2) tasks.site_visit_id: lets a task point back at the visit that caused it. Today the
--    link survives only on the site_report_stoppages intent row.

ALTER TABLE site_visits
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS site_visit_id UUID REFERENCES site_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_visits_employee_id ON site_visits(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_site_visit_id ON tasks(site_visit_id);
