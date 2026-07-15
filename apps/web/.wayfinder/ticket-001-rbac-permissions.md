# Ticket: RBAC permissions for projects module

## Question

What permissions should the projects module expose in the permission catalog, and where in the UI should each permission gate be wired?

**Context**: User chose "Default RBAC pattern" — follow existing modules (clients, invoices, etc.). Admin role gets full access via existing `org_members.role === 'admin'` check.

**Existing pattern**: Each module defines `read`, `create`, `update`, `delete`. Some add `approve`. Custom modules add domain-specific actions (e.g., `material_intents.assign`, `material_intents.create_dc`).

**Decision needed**:
1. Permission keys — start with `read`, `create`, `update`, `delete` matching the default pattern? Add `close`, `archive`, `manage_scope` for lifecycle governance?
2. UI wiring — which buttons/sections hide behind each permission key in CreateProject.tsx, ProjectList.tsx, ProjectOverview.tsx?

**Resolution**: Post the final permission key list, the `permission-catalog.ts` entry, and a mapping of UI elements to permission gates.

- **Type**: `wayfinder:task`
- **Blocking**: Ticket 002 (closure checklist needs RBAC for close permission), Ticket 005 (archiving needs RBAC for archive permission)
