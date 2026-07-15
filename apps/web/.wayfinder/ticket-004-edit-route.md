# Ticket: Dedicated project edit route

## Question

What is the cleanest way to add a standalone edit page for projects, decoupled from the create-wizard flow?

**Context**: Currently `CreateProject.tsx` doubles as an edit page via `?id=` query param. This works but is implicit — no dedicated `/projects/:id/edit` route.

**Decision needed**:
1. Route: Add `/projects/:id/edit` to the router, or keep the query-param approach and just make it more explicit?
2. Component split: Should `CreateProject.tsx` be refactored into `CreateProject.tsx` + `EditProject.tsx` that share a form component, or is a single file with mode-switching acceptable?
3. Navigation: Where does the "Edit" link live — only in the ProjectList context menu, or also in the ProjectOverview detail view?

**Resolution**: Post the route config, component structure, and navigation changes.

- **Type**: `wayfinder:task` (AFK)
