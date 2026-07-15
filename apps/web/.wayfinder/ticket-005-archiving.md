# Ticket: Project archiving — add Archived status to lifecycle

## Question

Where does 'Archived' fit in the project lifecycle, and what behavior changes when a project is archived?

**Context**: User chose "Archive status" — add an 'Archived' status alongside Draft, Active, Execution Completed, Financially Closed, Closed.

**Decision needed**:
1. Lifecycle position: Is 'Archived' a terminal state (after Closed) or a parallel state (any status → Archived)?
2. Behavior: What does archiving affect? Hide from ProjectList default view? Prevent edits? Freeze financials? Allow unarchive?
3. UI: Where does the Archive action live? Is there an unarchive flow? How does the user find archived projects?
4. Permissions: Who can archive/unarchive? (Blocks on Ticket 001 for `projects.archive` permission)

**Resolution**: Post the lifecycle diagram update, archived-state behavior spec, and UI changes.

- **Type**: `wayfinder:grilling` (HITL)
- **Blocked by**: Ticket 001 (needs RBAC for archive permissions)
