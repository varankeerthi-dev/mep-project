# Meetings and Minutes of Meeting Audit

**Repository:** `varankeerthi-dev/mep-project`
**Application:** `apps/web`
**Audit conclusion:** The application already contains an active Meetings module and a substantial Minutes of Meeting (MOM) workflow. The strongest path is to harden and complete the existing module rather than build a second Meetings feature from scratch.

## Executive conclusion

Meetings are already exposed in the live application routing. The active route `/meetings` renders the newer `src/meetings/pages/MeetingsList.tsx` implementation, while `/meetings/create`, `/meetings/:id/minutes`, `/meetings/:id/view`, and `/meetings/edit/:id` provide creation, editing, read-only viewing, and deep-link support. The older `src/pages/Meetings.tsx` is a simpler legacy implementation and is not the primary route selected by `App.tsx` [1] [2].

The current feature is more than a placeholder. It supports meeting search and filtering, status and Minutes status badges, statistics, archive/restore/delete/duplicate actions, meeting metadata, attendee editing, structured MOM rows, draft saving, finalization, reopening, printing, and PDF export [3] [4] [5].

## Existing capability inventory

| Capability | Current state | Evidence |
|---|---|---|
| Meeting list | Implemented. Includes search, status/type filters, archive toggle, pagination, sorting, empty/loading/error states, and statistics. | `src/meetings/pages/MeetingsList.tsx` |
| Meeting creation/editing | Implemented with client/project lookup, vendor, date/time, duration, location type, meeting link, meeting type, tags, and description/agenda. | `src/meetings/pages/CreateMeeting.tsx` |
| Attendees | Implemented in the MOM editor and as a visible section in meeting creation. | `src/meetings/components/AttendeeList.tsx`, `MeetingMinutesEditor.tsx` |
| Minutes editor | Implemented as a structured editable table with serial number, description, client scope, vendor scope, target date, remarks, and requirement. | `src/meetings/components/MinutesTable.tsx`, `MeetingMinutesEditor.tsx` |
| Draft/finalized workflow | Implemented. Drafts can be saved, minutes can be finalized, and finalized minutes can be reopened. | `src/meetings/hooks/useMeetings.ts`, `MeetingMinutesEditor.tsx` |
| Read-only MOM view | Implemented with meeting information, attendees, minutes rows, print, and PDF export. | `MeetingMinutesView.tsx` |
| Attachments | Partially implemented. API/storage helpers and presentational components exist, but the creation form currently only holds a selected file locally. | `src/meetings/api/meetings.ts`, `CreateMeeting.tsx` |
| Action items | Backend/data-layer support exists, including task synchronization, but no active action-item editor is rendered in the MOM editor/viewer. | `src/meetings/api/meetings.ts`, `useMeetings.ts`, `database-meetings-mom.sql` |
| Recurrence | UI exists, but the recurrence component is rendered without an `onChange` handler and the selected recurrence is not included in meeting submission. | `CreateMeeting.tsx`, `RecurrenceConfig.tsx` |
| Data model and security | Relational tables for minutes, attendees, and action items exist, with indexes and organization-scoped RLS policies in the SQL enhancement script. | `src/database-meetings-mom.sql` |

## Recommended UX and robustness improvements

### 1. Make the MOM workflow action-oriented

The current editor is primarily a minutes table. A robust MOM experience should add a dedicated **Action Items** section beside or below the minutes table, with owner, due date, priority, status, and a clear “Create task” or “Sync to tasks” action. This will turn meeting notes into accountable follow-up work instead of leaving action-item support hidden in the API.

The list page should also surface action-item health, such as “Open actions,” “Overdue actions,” and “Due this week,” and allow users to open the MOM directly from those indicators.

### 2. Fix persistence gaps before expanding the UI

The creation form visibly collects attendees, reference documents, and recurrence settings, but its submit handler currently persists only the core meeting record. The selected attendee list is not saved, the reference file is not uploaded, and recurrence settings are not passed to the recurrence creation API. This creates a serious UX trust issue: the interface implies that the information has been saved when it has not.

The implementation should either persist those sections during creation or clearly label them as post-creation steps. The better experience is a single transactional flow: create the meeting, save attendees, upload the reference document, and optionally generate recurring meetings while showing section-level progress and retry states.

### 3. Improve save safety and draft recovery

The editor has a 30-second auto-save and an unsaved-changes indicator, which is a good foundation. It should additionally show the exact last-save time, distinguish “saving,” “saved,” and “save failed,” retry failed saves, warn before leaving with unsaved edits, and preserve a local draft if the browser loses connection. A version history or at least a recoverable revision snapshot would make finalization safer.

The attendee save helper currently returns immediately when the local attendee array is empty, so removing all attendees from an existing meeting may leave the old database rows in place. The save operation should reconcile deletions in the same way the minutes and action-item helpers do.

### 4. Clarify finalized-minute behavior

The editor says finalized minutes cannot be edited, while the read-only view offers an Edit action and asks whether the user wants to create a new version. The current navigation then returns to the same editor, where the user must reopen the minutes. This is confusing. The product should choose one explicit behavior: either require a deliberate “Reopen for editing” action, or implement true versioning that creates a new draft while preserving the finalized document.

### 5. Consolidate the data layer

The feature currently mixes a legacy page-level Supabase implementation with a newer meetings module, and the read-only viewer loads data directly rather than using the same query/cache hooks as the editor and list. The codebase should retain one active Meetings implementation, use shared typed hooks for list/detail/relations, and invalidate the correct caches after every mutation. This will reduce stale data and prevent behavior from diverging between list, editor, and viewer.

### 6. Strengthen validation, permissions, and error handling

Meeting creation should validate the relationship between location type and meeting link, validate date/time with an explicit timezone policy, prevent duplicate submissions, and give accessible inline field errors rather than relying mainly on toast messages and native `confirm`/`prompt` dialogs. Destructive actions should use the application’s consistent confirmation dialog.

The API layer should check and surface errors from related-record deletes, avoid partial hard-delete outcomes, and enforce organization ownership consistently for every meeting and related-record operation. The current SQL enhancement script provides organization-scoped RLS for the core meeting and MOM tables, which is a good base, but storage and attachment flows must be verified against the same organization boundary.

## Verification note

A full typecheck could not be completed in the sandbox because `apps/web/node_modules` is not installed and the `tsc` binary is unavailable. The repository should be dependency-installed and typechecked before implementation changes are considered complete. The audit also found likely cleanup candidates, including unused creation-form state/imports and a `useMeetingForm` callback that calls `useAuth()` from inside the callback instead of reading the hook value at the top level.

## Suggested implementation order

| Priority | Workstream | Outcome |
|---|---|---|
| P0 | Persist attendees, recurrence, and reference documents; reconcile attendee deletions; install dependencies and typecheck. | Removes data-loss and trust issues. |
| P1 | Add action-item editor, task synchronization controls, overdue indicators, and owner/due-date workflows. | Makes MOM operational and accountable. |
| P1 | Add reliable draft autosave states, leave protection, retry, and local recovery. | Makes the editor safer for real meetings. |
| P2 | Resolve finalized-version UX and consolidate viewer/list data access. | Creates a consistent end-to-end experience. |
| P2 | Replace native prompts with accessible dialogs and improve responsive/mobile table behavior. | Improves polish and accessibility. |

## Final answer

**Yes, Meetings and Minutes of Meeting are already present in the app.** They are routed and usable today, with a fairly complete foundation. However, the feature is not yet fully robust: the most important gaps are persistence of visible creation-form fields, the missing action-item workflow, draft/finalization clarity, and consistent error/recovery behavior. The recommended approach is to improve the existing `src/meetings` module rather than create a new one.

## References

[1]: file:///home/ubuntu/mep-project/apps/web/src/App.tsx "Application routing and Meetings deep links"

[2]: file:///home/ubuntu/mep-project/apps/web/src/components/Sidebar.tsx "Sidebar Meetings navigation entry"

[3]: file:///home/ubuntu/mep-project/apps/web/src/meetings/pages/MeetingsList.tsx "Active Meetings list page"

[4]: file:///home/ubuntu/mep-project/apps/web/src/meetings/pages/MeetingMinutesEditor.tsx "Minutes of Meeting editor"

[5]: file:///home/ubuntu/mep-project/apps/web/src/meetings/pages/MeetingMinutesView.tsx "Read-only Minutes of Meeting view"

[6]: file:///home/ubuntu/mep-project/apps/web/src/meetings/api/meetings.ts "Meetings and MOM data API"

[7]: file:///home/ubuntu/mep-project/apps/web/src/database-meetings-mom.sql "Meetings/MOM schema and RLS policies"

[8]: file:///home/ubuntu/mep-project/apps/web/src/meetings/pages/CreateMeeting.tsx "Meeting creation and editing form"
