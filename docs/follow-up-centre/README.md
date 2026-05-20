# Follow-Up Centre Documentation

Operational follow-up module for the MEP / EPC ERP platform.

## Documents

| File | Purpose |
|------|---------|
| [PHASES.md](./PHASES.md) | **Master phased implementation plan** (Phases 0–12) |
| PRD.md | *(planned)* Full product requirements snapshot |

## Quick Links

- **Route:** `/follow-up`
- **Sidebar:** Tasks → Follow-Up Centre
- **Primary UX:** Desktop / laptop (1280px+)
- **Mobile:** Phase 12 (future)

## Phase Summary

| Phase | Focus |
|-------|--------|
| 0 | Documentation ✅ |
| 1 | Foundation + mock UI ✅ |
| 2 | Escalation engine, hooks, formatters ✅ |
| 3 | Quotation follow-up tab ✅ |
| 4 | PO/DC backlog tab ✅ |
| 5 | Invoice follow-up tab ✅ |
| 6 | Unified activity logs ✅ |
| 7 | Supabase schema ✅ |
| 8 | API integration ✅ |
| 9 | Performance (virtualized tables) ✅ |
| 10 | RBAC (role gate) ✅ |
| 11 | Polish & QA ✅ |
| 12 | Mobile adaptation |

**Supabase:** Run [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) or `src/database-follow-up-centre.sql`

See [PHASES.md](./PHASES.md) for acceptance criteria, file paths, and escalation matrix.
