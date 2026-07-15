# Wayfinder Map: Project Module Critical Gaps

## Destination

Fill the five most critical gaps in the project module — RBAC permissions, formal closure checklist, structured scope management, dedicated edit route, and archiving — so the project module is hardened for production use with proper access control, lifecycle governance, and navigation.

## Notes

- **Domain**: MEP ERP app (React + TypeScript + Supabase + TanStack Query)
- **Codebase**: `apps/web/src/pages/` for UI, `apps/web/src/rbac/` for permission system
- **Skills**: `/domain-modeling` for glossary alignment, existing PRDs (PRD.md, statemanagement.md) for context
- **Pattern**: Follow existing conventions (RBAC matches `permission-catalog.ts` pattern, UI matches shadcn/ui + Tailwind)
- **Scope**: Only the 5 gaps selected by the user; stubs (SiteMaterials, ToolsList, etc.) are intentionally excluded

## Tickets

| # | Ticket | Type | Blocking | Blocked By |
|---|--------|------|----------|------------|
| 001 | [RBAC permissions for projects](ticket-001-rbac-permissions.md) | task | 002, 005 | — |
| 002 | [Formal closure checklist](ticket-002-closure-checklist.md) | prototype | — | 001 |
| 003 | [Structured scope with versioning](ticket-003-structured-scope.md) | prototype | — | — |
| 004 | [Dedicated edit route](ticket-004-edit-route.md) | task | — | — |
| 005 | [Project archiving — Archived status](ticket-005-archiving.md) | grilling | — | 001 |

## Frontier (unblocked + unclaimed)
1. **Ticket 001** — RBAC permissions (blocks 2 others, unblocked)
2. **Ticket 003** — Structured scope (independent)
3. **Ticket 004** — Edit route (independent)

## Decisions so far

<!-- one line per closed ticket — gist + link -->

## Not yet specified

<!-- fog — suspected questions not yet sharp enough to ticket -->

## Out of scope

- **ProjectManagementInternal stubs** (SiteMaterials, ToolsList, ClientComm, Documents) — placeholders not blocking production use
- **Budget vs actual tracking** — product decision to defer
- **Gantt chart / schedule visualization** — nice-to-have, not critical
- **Change order / variation workflow** — complex, separate effort
- **Formal approval workflow for status transitions** — covered implicitly by RBAC + closure checklist
