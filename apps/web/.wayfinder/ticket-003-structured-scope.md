# Ticket: Structured scope management with versioning

## Question

What data model and UX replace the current plain-text scope fields with structured, versioned scope items?

**Context**: Currently `contractor_scope`, `client_scope`, `excluded_scope`, `pending_approval`, `site_instructions` are all TEXT fields. User chose "Structured + versioning".

**Decision needed**:
1. Data model: New `scope_items` table with fields for scope type (contractor/client/excluded/pending/site_instruction), description, quantity/unit/rate (for commercial items), version number, created_by, superseded_at? Or extend the existing `projects` table with a JSONB scope_log?
2. Versioning approach: Full audit table (`scope_item_versions`) vs soft-edit with snapshot?
3. UX: Inline editable list vs modal-based management? How does the user view scope history/diff?

**Resolution**: Post the schema design, versioning strategy, and UI mockup for the scope editor in the project create/edit form.

- **Type**: `wayfinder:prototype`
