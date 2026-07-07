# PRD: Work Stoppages — Two-Date Model & Calendar Integration

## Problem Statement

Site engineers reporting work stoppages in daily site reports have a single field called "Expected restart date." In practice, there are two distinct dates:

1. **Expected restart** — when the blocking issue is estimated to clear (tentative, may shift)
2. **Planned restart** — when work will actually resume (confirmed, action-oriented)

For example, a planned shutdown may clear on Wednesday (expected), but recommissioning means work resumes Thursday (planned). The current single field conflates these, leading to ambiguity on the ProjectOverview dashboard and no way to push confirmed restart dates into the site visit calendar.

Additionally, work stoppages are currently only saved during report **edit**, not during **create**, meaning a newly created report loses any stoppage data the engineer entered.

## Solution

Introduce a two-date model for work stoppages with an optional integration to the site visit calendar:

- **Expected restart date** (existing) — remains as the tentative estimate
- **Planned restart date** (new) — the confirmed date when work resumes
- **Create site visit checkbox** (new) — when checked, auto-creates a site visit entry for the planned restart date
- **Fix create-flow bug** — stoppages now save on initial report creation, not just edit

## User Stories

1. As a site engineer, I want to record both an expected restart date and a planned restart date for a work stoppage, so that I can distinguish between "when the block clears" and "when we resume work"
2. As a site engineer, I want the expected restart date to remain as a simple estimate field, so that I can quickly note when I think the issue will be resolved without committing to a firm date
3. As a site engineer, I want a separate planned restart date field, so that I can record the confirmed date when work will actually resume once I know it
4. As a site engineer, I want a "Create site visit" checkbox next to the planned restart date, so that I can optionally push the restart date into the site visit calendar without leaving the report
5. As a site engineer, I want the checkbox to only appear when a planned restart date is filled in, so that I'm not confused by an option that has no effect without a date
6. As a site engineer, I want the checkbox to reset to unchecked if I clear the planned restart date, so that stale checkbox state doesn't create accidental site visits
7. As a site engineer, I want the auto-created site visit to include the project, client, affected work description, and reason, so that the visit entry is immediately useful without manual editing
8. As a site engineer, I want the auto-created site visit to be linked back to the stoppage record, so that I can trace the connection between the stoppage and the calendar entry
9. As a site engineer, I want stoppages to be saved when I first create a report (not just when I edit it), so that I don't lose stoppage data I entered during initial report creation
10. As a project manager viewing the ProjectOverview dashboard, I want to see "Planned restart" badges on stoppages that have a planned date, so that I can distinguish confirmed restarts from tentative estimates at a glance
11. As a project manager, I want the dashboard to show separate visual indicators for "overdue expected" vs "past planned" stoppages, so that I can prioritize differently based on whether the date was an estimate or a commitment
12. As a project manager, I want to see a link from the stoppage to the auto-created site visit (if one exists), so that I can quickly navigate to the calendar entry
13. As a project manager, I want the planned restart date to be visible in the stoppage detail view and resolve dialog, so that I have full context when resolving a stoppage
14. As a site engineer using the mobile app, I want the same two-date model and checkbox available on the mobile site report screen, so that the experience is consistent across devices
15. As a site engineer, I want the "No Equipment Fault" toggle (recently added) to work independently of the work stoppages section, so that equipment status and work stoppages remain separate concerns

## Implementation Decisions

### Database Changes

- Add `planned_restart_date DATE` column to `site_report_work_stoppages` table
- Add `planned_restart_visit_id UUID REFERENCES site_visits(id) ON DELETE SET NULL` column to link to auto-created site visits
- Create a migration SQL file `database-stoppage-planned-restart.sql`

### StoppageDraft Type Extension

The local `StoppageDraft` type in SiteReport.tsx gains two new fields:
- `planned_restart_date: string` — the confirmed restart date (persisted to DB)
- `create_site_visit: boolean` — transient flag (not persisted, used only at save time to decide whether to create a site visit)

### Save Logic Changes

**Create flow (saveMutation):** Add stoppage save logic after the `create_complete_site_report` RPC call. Currently stoppages are only saved in the edit flow. The create flow will use the same pattern: filter non-empty stoppages → insert → optionally create site visits.

**Edit flow (updateMutation):** Extend the existing stoppage save logic to include `planned_restart_date` in the insert rows, and add site visit creation after stoppage insertion.

**Site visit creation:** For each stoppage where `create_site_visit=true` and `planned_restart_date` is set:
1. Insert a `site_visits` row with: `organisation_id`, `project_id`, `client_id` (from the report), `visit_date` = planned_restart_date, `purpose_of_visit` = "Restart: {affected_work}", `status` = "scheduled", `visit_type` = "Maintenance"
2. Update the stoppage row with `planned_restart_visit_id` pointing to the created visit

### UI Changes

**SiteReport.tsx (Work Stoppages section):**
- Replace single "Expected restart date" field with a 2-column grid: "Expected restart (estimate)" | "Planned restart (confirmed)"
- Add "Create site visit for planned restart" checkbox below the date fields, visible only when planned_restart_date is filled
- Checkbox defaults to false, resets to false when planned date is cleared

**ProjectOverview.tsx:**
- Show "Planned restart" badge when `planned_restart_date` is set on a stoppage
- Distinguish overdue indicators: "overdue expected" (expected_date < today) vs "past planned" (planned_date < today)
- Show link to site visit if `planned_restart_visit_id` exists

**Mobile SiteReport.tsx:**
- Add `planned_restart_date` and `create_site_visit` to form state
- Add two-date UI with same layout adapted for mobile
- Include `create_site_visit` in submit payload

### Module Integration

- **Site Visits Calendar:** Auto-created visits appear as standard "scheduled" visits. No special treatment needed.
- **Work Plan Next Day:** No integration. Separate concern.
- **Tasks:** No new integration. Existing `task_id` link already handles task association.
- **Approvals:** No changes.

### Query Cache Invalidation

Add invalidation for `['site-visits', organisationId]` after creating a site visit from a stoppage.

## Testing Decisions

- Test that stoppages save correctly on report **create** (not just edit)
- Test that the planned restart date is persisted and displayed in ProjectOverview
- Test that the "Create site visit" checkbox only appears when planned_restart_date is filled
- Test that checking the checkbox creates a site visit with correct fields
- Test that the auto-created site visit is linked back via `planned_restart_visit_id`
- Test that clearing the planned date resets the checkbox
- Test that mobile form has the same behavior
- Test overdue detection for both expected and planned dates

## Out of Scope

- Auto-modification of Work Plan Next Day based on stoppage dates
- Auto-resolution of stoppages when the planned date arrives
- Notifications or alerts when planned restart date passes
- Bulk operations on stoppages from the dashboard
- Changes to stoppage category or blocking party enums
- Approval workflow integration for stoppages
- History/audit trail for planned restart date changes

## Further Notes

- `create_site_visit` is transient — not stored in DB, only used at save time
- If user creates a site visit from a stoppage and later edits the report, the existing visit is NOT auto-updated
- Migration is additive only (new columns with defaults) — no existing data affected
