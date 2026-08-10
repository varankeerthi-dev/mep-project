# Manufacturing – Machine Board, Tooling & Shot Counter (Final Implementation Plan)

## Goal
Create a robust manufacturing workflow that:
* Removes unsafe shot‑counter columns and replaces them with computed values.
* Enforces tooling reservation to prevent double‑booking.
* Implements the adaptive "Plan This Machine" drawer.
* Makes the Machine Board the default landing tab for all users.
* Defines entry‑field container UI with glassmorphism styling and enforces 12 px left padding on card bodies.

## User Review Required
> [!IMPORTANT]
> The migration will drop two columns from `manufacturing_tooling` and adds a unique index on `job_cards`. This requires a short maintenance window. Approve the plan before we schedule the migration.

## Open Questions
> [!WARNING]
> None – all design decisions have been locked in (G2‑G8, UI spec).

## Proposed Changes
---
### Database
* **File:** `database/migrations/20230804_remove_shot_counters.sql`
  * **[MODIFY]** `manufacturing_tooling` – `DROP COLUMN total_shots_lifetime`, `DROP COLUMN shots_since_last_maintenance`.
  * **[ADD]** Unique partial index `uq_tooling_reserved` on `job_cards(tooling_id)` where `status NOT IN ('completed','cancelled')` to enforce reservation.
* **File:** `src/queries/shotCounters.ts`
  * **[NEW]** Functions `getTotalShots(toolingId)` and `getShotsSinceMaintenance(toolingId)` implementing the SQL shown in the plan.
---
### Backend Logic (TypeScript / Node)
* **File:** `src/services/toolingService.ts`
  * **[MODIFY]** `mountTooling` – set `status = 'mounted'` on first Production Entry.
  * **[MODIFY]** `releaseTooling` – set `status = 'available'` when Job Card is `completed` or `cancelled`.
* **File:** `src/services/jobCardService.ts`
  * **[MODIFY]** `createJobCard` – does **not** change tooling status; relies on reservation index.
* **File:** `src/services/productionEntryService.ts`
  * **[MODIFY]** After saving the first entry for a Job Card, invoke `mountTooling`.
* **File:** `src/api/machineBoard.ts`
  * **[NEW]** Endpoint `GET /machines` returns machine data including tooling reservation flag (via the unique index) and computed shot counters.
---
### Front‑end UI
* **File:** `apps/web/src/pages/manufacturing/machine-board/MachineBoardDrawer.tsx`
  * **[MODIFY]** Adaptive flow: if `machine.current_tooling_id` exists, pre‑fill tooling; else prompt product → tooling selection.
* **File:** `apps/web/src/components/ui/EntryContainer.tsx`
  * **[NEW]** Reusable entry container component implementing the glass‑morphism spec, 12 px padding, focus/hover animations.
* **File:** `apps/web/src/pages/manufacturing/ManufacturingShell.tsx`
  * **[MODIFY]** Reorder `TABS` so the first entry is `{ id: 'machines', label: 'Machine Board', path: '/manufacturing/machines', matchPrefix: '/manufacturing/machines' }`.
* **File:** `apps/web/src/components/cards/CardBody.tsx`
  * **[MODIFY]** Add class `card-body-left-pad` with `padding-left: 12px;` (override global CSS).
* **File:** `apps/web/src/pages/manufacturing/entryform.md`
  * **[NEW]** Documentation of entry‑field container styles (generated as artifact, also stored for reference).
---
### Tests
* **File:** `tests/unit/shotCounters.test.ts`
  * Verify the two helper functions return correct sums on mock data.
* **File:** `tests/integration/jobCardReservation.test.ts`
  * Attempt to create two overlapping job cards for the same tooling – second should fail with reservation error.
* **File:** `tests/e2e/machineBoardDrawer.test.ts`
  * Cypress test covering both branches of the adaptive drawer (mounted vs. empty).
---
### Verification Plan
**Automated Tests**
- Run unit, integration, and e2e suites (`npm test`).
- Ensure migration script runs cleanly on a staging DB (`npm run migrate:stage`).

**Manual Checks**
1. After migration, open a tooling list – "Pending" badge appears for any tooling linked to an active job card.
2. Open a machine board card – shows correct PM badge using computed `shotsSinceMaintenance`.
3. Use "Plan This Machine" drawer on a machine with a mounted mould – tooling field is pre‑filled.
4. Use the drawer on an idle machine – product selection followed by filtered tooling list.
5. Verify entry fields across the app render with the glass‑morphism container and have 12 px left padding on card bodies.

---
## Timeline (approx.)
| Phase | Effort | Owner |
|---|---|---|
| **DB migration & backend services** | 2 days | Backend team |
| **UI components & adaptive drawer** | 3 days | Front‑end team |
| **Tests & QA** | 1 day | QA squad |
| **Staging verification & release** | 1 day | DevOps |

**Total:** ~7 working days.

---
**Ready to build.** Approve to start Phase 1.

---
*All file paths are relative to the workspace root (`c:\Users\admin\mep-project`).*
