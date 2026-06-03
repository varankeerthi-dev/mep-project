# Approval Tab Refactor — TODO & Cross-Tab Work

Status of phases. Each phase ends with a git commit (rollback checkpoint).

| Phase | Title | Status | Commit |
|---|---|---|---|---|
| 1 | Information density (denorm columns, stepper, requester/project/ref) | done | `21a0240` |
| 2 | Row interactions (hover quick-approve/reject, action menu, bulk) | done | `c7abb57` |
| 3 | Above-table layer (stats, filter bar, pill nav) | done | `30657be` |
| 4 | Modal → Drawer (side drawer, tabs) | done | `00aa2af` |
| 5 | Polish (empty states, overdue SLA, loading/error states) | done | `a116d3e` |
| — | Full end-to-end test of approval tab | pending | — |

## Out of scope (per user)
- Type icons in columns
- Mobile / responsive stacked card view
- Keyboard shortcuts (J/K/A/R/Enter)

## Cross-tab work discovered during refactor

These are the *only* related-tab edits needed to make the approval tab's new fields work. Everything else is contained inside `src/pages/Approvals.tsx`, `src/components/ui/AppTable.tsx`, `src/approvals/*`, and `src/hooks/useApprovals.ts`.

| Tab | Item | Notes |
|---|---|---|
| `src/components/ApprovalSettings.tsx` | Extend the existing "Backfill missing approvals" button to also populate the new denorm fields (`requester_name`, `requester_role`, `project_id`, `project_name`, `reference_number`) for historical rows. | Same file we already touched last session. No schema change. |
| `src/modules/Purchase/hooks/usePurchaseQueries.ts` | After `useCreatePaymentRequest` creates a `payment_requests` row, the new denorm data is enriched inside `ApprovalIntegration.createPaymentApproval` → `ApprovalAPI.createApprovalRequest`. No change required to the call site, but worth a smoke test that the approval row contains `reference_number = PMR-...`. | Not edited — verified the flow. |
| `src/database-approvals.sql` line 18 | `approvals.requested_by REFERENCES users(id)` is still the old FK. The migration `sql/fix_approvals_requested_by_fk.sql` (last session) must be run before Phase 1 denorm inserts work. If you skip it, `createApprovalRequest` will fail with a FK violation. | Reminder only — not a new task. |

## Data model additions (Phase 1, additive only)

`approvals` table — new nullable columns:

| Column | Type | Source at create time |
|---|---|---|
| `requester_name` | TEXT | `user_profiles.full_name` for the auth user |
| `requester_role` | TEXT | `org_members.role` (falls back to `user_profiles.role`) |
| `project_id` | UUID | Source table (e.g. `purchase_orders.project_id`); null for payment tables |
| `project_name` | TEXT | `projects.name` joined from `project_id` |
| `reference_number` | TEXT | Source table's human doc no (`po_number`, `voucher_no`, `request_no`, etc.) |

All columns are nullable so the migration is zero-risk. Missing data shows as `—` in the row. The existing "Backfill" button in `ApprovalSettings` will be extended to populate these for historical rows.
