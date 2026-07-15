# Ticket: Formal project closure checklist

## Question

What is the data model and UX for a configurable closure checklist that gates project closure?

**Context**: User chose "Configurable template" — admin can define closure gates per org. Currently `can_close_project` RPC only checks outstanding invoices.

**Decision needed**:
1. Data model: `closure_templates` (org-level template definition), `closure_gates` (individual gates within a template), `project_closure_checklist` (per-project instance of gates with pass/fail/notes)?
2. UI: Where do admins define templates? Where do users see the checklist before closing? Should closure be blocked until all gates pass, or advisory?
3. Integration: Does the checklist replace or augment the existing `can_close_project` RPC?

**Resolution**: Post the schema design, admin template UI sketch, project closure checklist UI sketch, and integration plan with existing close flow.

- **Type**: `wayfinder:prototype`
- **Blocked by**: Ticket 001 (needs RBAC for closure permissions)
