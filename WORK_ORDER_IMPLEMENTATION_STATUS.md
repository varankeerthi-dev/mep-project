# Common Work Order Ecosystem
## Implementation Status and Manual Rollout Runbook

**Repository:** `varankeerthi-dev/mep-project`
**Status:** Phased implementation slice complete; production cut-over pending manual SQL review and legacy-path remediation.

## Delivered source slices

| Slice | Delivered result |
|---|---|
| Shared Work Order contracts | Zod contracts for tenant-scoped filters, parties, items, requirements, commercial terms, list metrics, and strict mutation inputs. |
| RPC adapter boundary | Work Order browser code uses the Supabase RPC adapter for list, draft save, submit, and issue procedure names; no new shared Work Order page writes tables directly. |
| Work Order dashboard | Quotation List-inspired metrics, search, status/recipient filters, pagination, configurable Work Order columns, migration-pending state, and preview/download actions connected to immutable snapshot metadata. |
| Modular Work Order editor | Separate party, context, scope, item, commercial, and payment-term sections; client totals are presentation-only and the mutation is sent through the draft RPC. |
| Common Bills inbox | Normalized read model for existing `purchase_bills` and `subcontractor_invoices`; no duplicate bill table. Work Order linking uses a dedicated relation table. |
| Common Payment Request queue | Normalized approval-envelope read model and RPC adapter for idempotent source-linked creation/approval; source-specific payment tables remain authoritative. Posting intentionally fails closed until settlement adapters are installed. |
| Shared templates registry | Settings → Templates extended through a document registry for Work Order, Bill, Payment Request, and Amendment types; quotation behavior remains in the existing template system. |
| Immutable document snapshot adapter | Browser preview/download actions request stored snapshot metadata through RPC rather than rendering financial PDFs from untrusted browser state. |
| Additive migration draft | Self-contained ordered preflight, compatibility columns, normalized links/versions/audit tables, RLS for bridge tables, idempotency, atomic numbering, read RPCs, draft/submit/issue procedures, bill-link checks, Payment Request procedures, and snapshot read RPC. |
| Forensic review | Static review of direct sensitive-table writes, permissive policies, approval side effects, IDOR risk, browser tampering, financial calculations, number races, idempotency, auditability, and document exposure. |

## Validation completed

Focused contract tests passed with **2 test files and 6 tests**. Focused esbuild transpilation passed for the changed Work Order, Bills, Payment Request, document, template, route, sidebar, and Settings Template files. `git diff --check` passed. No SQL was executed, and no live Supabase schema was assumed beyond the repository evidence and the migration’s read-only preflight requirements.

## Manual rollout order

1. Review [`apps/web/src/database/common_work_order_bridge.sql`](apps/web/src/database/common_work_order_bridge.sql) in the repository. Run only its read-only **Step 0** queries first and save the result.
2. Compare the live `org_members`, `role_permissions`, source-table columns, UUID types, existing policies, and existing function names with the assumptions recorded in Step 0. Stop if the membership table is `user_organisations` or if any required source column differs.
3. Run the numbered migration transactions one at a time, with a database backup or rollback plan. Do not run the legacy destructive Work Order migration; it contains a drop-table branch that is not part of this bridge.
4. Seed or map the exact permission keys used by the procedures before exposing the common routes to non-admin users.
5. Verify tenant isolation, IDOR rejection, invalid state transitions, duplicate retries, concurrent numbering, bill over-allocation, and source-link uniqueness with disposable test users and organizations.
6. Keep legacy Work Order, Purchase, invoice, payment, approval, and template paths enabled only as compatibility paths while the RPC adapters are canaried.
7. Before production cut-over, replace the permissive legacy RLS policies and route all writes through source-aware RPCs. Do not enable payment posting until the purchase and subcontractor settlement adapters reconcile exactly once.
8. After cut-over validation, remove or disable direct browser mutation paths in the legacy pages and update the security regression scan as a release artifact.

## Intentionally not completed in this slice

The following remain explicit follow-up work rather than silently unsafe behavior: full bill draft/match/verify/approve RPCs, source-specific Payment Request posting into `purchase_payments` and `subcontractor_payments`, approval-engine adapter replacement, template-save RPCs, server PDF generation, live-schema verification, and replacement of permissive legacy policies. The forensic report marks these as release-gate findings.

## Files

| File | Purpose |
|---|---|
| [`apps/web/src/database/common_work_order_bridge.sql`](apps/web/src/database/common_work_order_bridge.sql) | Reviewed SQL migration draft for manual execution only. |
| [`WORK_ORDER_FORENSIC_SECURITY_REPORT.md`](WORK_ORDER_FORENSIC_SECURITY_REPORT.md) | Detailed security findings and remediation gates. |
| [`apps/web/src/work-orders/`](apps/web/src/work-orders/) | Shared Work Order contracts, RPC adapter, hooks, dashboard, editor, and tests. |
| [`apps/web/src/bills/`](apps/web/src/bills/) | Common Bills contracts, RPC adapter, hooks, and inbox. |
| [`apps/web/src/payment-requests/`](apps/web/src/payment-requests/) | Common Payment Request contracts, RPC adapter, hooks, and queue. |
| [`apps/web/src/templates/documentRegistry.ts`](apps/web/src/templates/documentRegistry.ts) | Shared document-specific template/field registry. |
| [`apps/web/src/documents/`](apps/web/src/documents/) | Immutable document snapshot contracts, adapter, and hook. |

## Critical remediation completed

The follow-up security pass now removes the highest-risk executable paths. The active legacy subcontractor Work Order editor no longer scans browser rows for numbers or writes `subcontractor_work_orders` directly; it uses the shared draft and issue RPCs. Approval side effects for Work Orders, Payment Requests, purchase payments, and subcontractor payments use the new tenant-scoped approval-transition RPC. Approval identifiers are bound through dedicated Work Order and Payment Request RPCs.

A separate manual-only [`apps/web/src/database/common_work_order_legacy_rls_hardening.sql`](apps/web/src/database/common_work_order_legacy_rls_hardening.sql) migration removes known unrestricted policies and gives sensitive Work Order, bill, invoice, Payment Request, and settlement tables read-only browser access. The new security-definer RPCs remain the controlled mutation path. No SQL was executed by the agent.

The legacy purchase-payment creation, release, bulk mark-paid, bulk deletion, and bulk reapproval hooks now fail closed with explicit messages. PO-to-Payment-Request creation also fails closed because a purchase order is not a payable source bill. These features remain unavailable until source-specific, idempotent settlement and archival RPCs are implemented; this is intentional and prevents browser-authorized financial posting.

The additional approval boundary tests passed together with the existing focused tests: **3 test files and 9 tests**. Focused transpilation and `git diff --check` also passed. Full database integration tests remain the user’s manual responsibility because the agent did not connect to or execute PostgreSQL.
