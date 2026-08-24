# Common Work Order Ecosystem
## Forensic Security and Data-Protection Review

**Repository:** `varankeerthi-dev/mep-project`
**Review scope:** Work Orders, Bills, Payment Requests, approvals, templates, document snapshots, tenancy, RBAC, browser tampering, financial integrity, and auditability.
**Review date:** 23 August 2026
**Author:** Manus AI

## Executive conclusion

The new shared Work Order, Bills, Payment Request, and document-snapshot slices establish a safer boundary than the legacy screens: new browser code calls typed RPC adapters, client input is validated before transport, tenant and permission checks are intended to run inside PostgreSQL, financial totals are recomputed by the draft RPC, number allocation is row-locked, idempotency is serialized, bill-link over-allocation is rejected, and new append-only bridge tables do not expose browser write policies.

The implementation is **not yet safe for a production cut-over**. The forensic scan found substantial legacy direct browser reads and writes, including direct Work Order creation and issuance, direct invoice/payment mutations, direct Payment Request approval and paid-state updates, direct approval side effects, and direct template insertion/deletion. Existing legacy SQL also contains permissive `USING (true)` and `WITH CHECK (true)` policies. These paths must remain compatibility paths only until they are moved behind the new RPC boundary and their policies are replaced. The reviewed migration deliberately does not silently change those legacy policies because doing so without a live-schema and user-role verification could break existing modules or produce an unsafe partial deployment.

> **Release gate:** Deploy the new UI only as a read/draft canary until the migration is manually reviewed and run. Do not enable common Payment Request posting or remove legacy paths until source-specific settlement RPCs, approval adapters, policy hardening, and concurrency tests are complete.

## Review method and evidence

The review used static inspection of the repository, the implemented shared adapters and hooks, the active routes/sidebar, the existing purchase and subcontractor data-access paths, the approval side-effect code, and all relevant SQL migration sources. PostgreSQL was not connected to, and no SQL was executed by the agent.

The central design evidence is the new additive bridge migration at [`apps/web/src/database/common_work_order_bridge.sql`](apps/web/src/database/common_work_order_bridge.sql), the Work Order contracts and adapter at [`apps/web/src/work-orders/types/index.ts`](apps/web/src/work-orders/types/index.ts) and [`apps/web/src/work-orders/api/rpc.ts`](apps/web/src/work-orders/api/rpc.ts), the Bills bridge at [`apps/web/src/bills/api/rpc.ts`](apps/web/src/bills/api/rpc.ts), the Payment Request bridge at [`apps/web/src/payment-requests/api/rpc.ts`](apps/web/src/payment-requests/api/rpc.ts), and the immutable snapshot adapter at [`apps/web/src/documents/api/rpc.ts`](apps/web/src/documents/api/rpc.ts). The main legacy sources are [`apps/web/src/modules/Purchase/hooks/usePurchaseQueries.ts`](apps/web/src/modules/Purchase/hooks/usePurchaseQueries.ts), [`apps/web/src/approvals/api.ts`](apps/web/src/approvals/api.ts), [`apps/web/src/approvals/integration.ts`](apps/web/src/approvals/integration.ts), [`apps/web/src/features/subcontractor-v2/components/WorkOrders/SubcontractorWorkOrderCreate.tsx`](apps/web/src/features/subcontractor-v2/components/WorkOrders/SubcontractorWorkOrderCreate.tsx), and [`apps/web/src/pages/TemplateSettings.tsx`](apps/web/src/pages/TemplateSettings.tsx).

## Findings summary

| ID | Area | Severity | Finding | Current disposition |
|---|---|---:|---|---|
| F-01 | Legacy RLS | Critical | Legacy Work Order, purchase, bill, payment, and related migrations contain permissive policies that do not enforce tenant membership. | **Open blocker.** The new bridge does not copy them; manual policy hardening is required before cut-over. |
| F-02 | Direct browser writes | Critical | Existing pages and hooks directly insert/update/delete Work Orders, invoices, source payments, Payment Requests, and templates. | **Open blocker.** Replace incrementally with the new bounded RPC adapters. |
| F-03 | Approval side effects | Critical | Approval code directly mutates source-document statuses and settlement records using reference IDs. | **Open blocker.** Route transitions through source-aware RPCs with tenant and state checks. |
| F-04 | Payment posting | Critical | Legacy purchase hooks perform client-side settlement inserts and mark Payment Requests paid from the browser. | **Open blocker.** `payment_request_release` intentionally fails closed until source-specific posting RPCs exist. |
| F-05 | Number allocation | High | Legacy Work Order and Payment Request numbering scans rows/browser state and is race-prone. | **Mitigated for new bridge procedures** by `domain_number_series` row locking; legacy paths remain unsafe until removed. |
| F-06 | Idempotency | High | Legacy mutations do not consistently use server idempotency. | **Mitigated for new bridge procedures** with `domain_idempotency_keys` and transaction advisory locks. |
| F-07 | Financial integrity | High | Legacy clients can submit totals, status, deductions, and payment values directly. | **Mitigated for new Work Order draft and bill-link procedures**; source-bill writes and settlement posting still require RPCs. |
| F-08 | Cross-tenant references | High | Legacy `.eq('id', reference_id)` mutations do not consistently bind the reference to the active organization. | **Mitigated in new bridge procedures**; legacy approval paths remain an IDOR risk until replaced. |
| F-09 | Auditability | High | Legacy direct mutations can bypass a consistent audit event, immutable version, and request ID. | **Partially mitigated** by new Work Order versions/audit rows; approval and settlement adapters remain open. |
| F-10 | Snapshot exposure | Medium | Snapshot metadata includes storage paths and may include signed URLs. | **Controlled by tenant-scoped read RPC**, but snapshot generation must issue short-lived signed URLs and never expose unrestricted storage objects. |
| F-11 | RBAC schema dependency | Medium | The repository uses `org_members` and `role_permissions`, while earlier design notes also referenced `user_organisations`. | **Controlled by Step 0 preflight.** The migration fails closed if the confirmed membership/RBAC columns are absent. |
| F-12 | Full type-check coverage | Medium | Focused transpilation/tests passed, but a full monorepo TypeScript build was not used as the release gate because previous runs were memory-sensitive. | **Open validation item.** Run the project’s normal CI type-check/build in an adequately provisioned environment. |

## Detailed security analysis

### Multi-tenancy and IDOR resistance

The new RPC procedures accept an organization identifier as a routing input, but do not treat it as proof of access. Security-definer procedures call an internal membership/permission helper that resolves `auth.uid()` against `org_members` and `role_permissions`. Every new bridge table carries `organisation_id`, and new read policies use the same membership predicate. Work Order detail, bill linking, Payment Request creation/approval, and document snapshots also require the organization identifier to match the source row or bridge row.

The new bill-link procedure additionally verifies that the selected source bill or invoice belongs to the requested organization and that the Work Order belongs to the same organization before inserting a link. It serializes allocations per source and rejects aggregate allocation above the source amount. This prevents a caller from using a valid UUID from another tenant or from allocating the same source claim beyond its contract amount.

The legacy system remains exposed until cut-over. The forensic scan found many direct mutations filtered by record ID only, particularly in approval and payment code. A valid record UUID must never be sufficient to authorize an update. The final cut-over must require both tenant scope and permission inside a transaction, not merely add another browser-side `.eq('organisation_id', ...)` predicate.

### RBAC and function security

New security-definer functions set `search_path = public`, qualify table names, resolve the authenticated user, and invoke explicit permission checks. The migration explicitly revokes default `PUBLIC` execution for the helpers and RPC procedures and grants the intended RPC surface only to `authenticated`. New append-only tables have read policies but no browser write policies; controlled procedures are the intended write path.

The migration currently maps permissions such as `work_orders.read`, `work_orders.create`, `work_orders.edit`, `work_orders.submit`, `work_orders.issue`, `work_orders.link`, `bills.read`, `payment_requests.read`, `payment_requests.create`, `payment_requests.approve`, and `payments.post`. These permission keys must be seeded or mapped to the organization’s actual role configuration before the corresponding screens are enabled. If the production RBAC model uses different names, do not substitute a broad admin check; update the mapping in a reviewed migration.

The legacy policies are a separate critical concern. The existing migrations use unrestricted policies for several financial and operational tables. The bridge migration intentionally does not drop or rewrite them automatically. That is safer for a compatibility deployment, but it means the application is not protected merely because the new bridge tables are protected.

### Browser tampering and input validation

New Zod contracts reject malformed UUIDs, dates, unknown mutation fields, non-finite numbers, negative values where prohibited, and unbounded pagination. The browser adapters validate input and validate the returned JSON shape. The database procedures remain authoritative: the Work Order draft procedure recalculates line taxable amounts, tax amounts, totals, advance, TDS, and retention rather than trusting submitted totals. The bill-link procedure computes the source contract amount and existing allocations in PostgreSQL.

The editor’s browser calculations are therefore presentation aids only. They must not be used as evidence of financial correctness. A future bill-draft RPC must apply the same treatment to quantity, rate, tax, TDS, retention, advance recovery, currency, exchange rate, duplicate supplier invoice checks, and approved-measurement limits.

### State transitions and approvals

The new Work Order procedures enforce a narrow draft-to-review transition and an approved-to-issued transition. Issuance allocates a final number, captures an immutable version snapshot, updates the Work Order, and records an audit event in one transaction. Payment Request approval similarly requires the approved permission, locks the row through the transaction, checks an allowed source state, and records idempotency.

The implementation does not yet replace the legacy approval engine. The scan found direct post-approval updates in [`apps/web/src/approvals/api.ts`](apps/web/src/approvals/api.ts) and direct approval-request markers in [`apps/web/src/approvals/integration.ts`](apps/web/src/approvals/integration.ts). Those functions must become thin orchestration adapters that call source-specific transition procedures. They must not accept an arbitrary approval reference ID and decide which source table to update from browser-controlled values.

### Numbering and concurrency

The new `app_next_number` helper inserts or locks one organization/series row with `FOR UPDATE`, increments it, and returns the generated number inside the same transaction as Work Order issuance or Payment Request creation. New idempotent procedures also take an advisory transaction lock keyed by organization, operation, and client request ID before reading and inserting the idempotency record.

This protects the new path against duplicate numbers and retry storms. It does not repair legacy browser number generation. The existing Work Order creation screen and purchase hooks must stop scanning recent rows or generating numbers in JavaScript before production cut-over.

### Idempotency and duplicate financial actions

The new bridge uses `domain_idempotency_keys` for draft save, Work Order submission/issue, bill linking, Payment Request creation, and Payment Request approval. Repeated requests with the same organization, operation, and client request ID return the stored response. Source Payment Request creation also guards one active request per purchase bill or subcontractor invoice with a source-key advisory lock and a trigger-level duplicate check.

The source-specific payment posting procedure is intentionally fail-closed. This is safer than pretending to post a payment or marking a request paid without inserting the authoritative `purchase_payments` or `subcontractor_payments` record. A production implementation must make posting idempotent across both the settlement row and the Payment Request state update.

### Auditability, immutable versions, and templates

The bridge adds Work Order versions with snapshot hashes and audit events carrying actor, request ID, before/after state, and timestamps. The document snapshot table stores organization, document identity, version, template identity/revision, source and snapshot hashes, storage path, and expiry metadata. The Settings → Templates UI is extended through a shared document registry rather than a second template system.

The audit and version tables intentionally have no browser write policies. However, existing document-template screens still contain direct browser inserts/deletes. Those must be migrated behind a `templates.save`-style RPC with organization scope, version checks, immutable revision history, and a safe default-template uniqueness rule. Template content can contain tax, pricing, bank, and party information; it must not be exposed through unrestricted storage or global template reads.

Snapshot generation must be server-side. A storage path is not a public download authorization, and a signed URL must be short-lived, tenant-scoped, and issued only after the source document permission check. Do not log signed URLs, invoice attachments, PAN/bank data, or full financial snapshots in client analytics or error telemetry.

### Sensitive data and attachments

The new normalized bridge stores display-name and tax-ID snapshots for historical rendering. These values require organization-scoped access and should be minimized in list responses. PAN, bank-account, tax, payment, and supplier-invoice attachments require separate storage policies and should use opaque object paths. The application should return only the minimum metadata needed for the current screen.

The static scan also found broad direct reads of payment, invoice, Work Order, purchase-bill, and template tables in legacy pages. Those reads should be replaced with narrow read-model RPCs or organization-scoped views. Any external share or PDF download endpoint must check document identity, tenant, permission, expiry, and revocation; a browser-visible source UUID or storage path must not act as a bearer credential.

## Required remediation before production cut-over

| Priority | Action | Acceptance evidence |
|---|---|---|
| P0 | Replace permissive RLS on Work Order, purchase bills, Payment Requests, source payments, invoice, and template tables with organization membership and role-aware policies. | Policy inventory shows no unrestricted financial policy; cross-tenant read/write tests fail closed. |
| P0 | Move approval side effects and Payment Request settlement posting behind transaction-safe RPCs. | Approval, return, cancellation, and post tests show one authorized state transition and one source settlement. |
| P0 | Remove or disable direct legacy browser writes for Work Orders, invoices, payments, Payment Requests, and templates after adapter cut-over. | Repository scan shows no mutation of sensitive tables outside approved adapters/server modules. |
| P1 | Add Work Order detail, submit, issue, and source-aware bill/payment integration tests against a disposable Supabase database. | Tenant, RBAC, IDOR, invalid-transition, over-allocation, retry, and concurrency suites pass. |
| P1 | Add a source-specific `payment_request_release` procedure for purchase and subcontractor settlement tables. | Repeated post requests create one settlement record and reconcile source balance exactly once. |
| P1 | Add template-save RPCs and server PDF generation/signed URL issuance. | Template revisions are immutable and PDF output is tied to a stored document snapshot hash. |
| P1 | Seed and verify exact organization permission keys and role mappings. | Least-privilege role matrix is approved and automated authorization tests pass. |
| P2 | Run full CI TypeScript/build validation and dependency/security scanning. | CI artifacts are retained with the release candidate. |

## Validation performed

The focused contract tests passed: **2 test files and 6 tests**. Focused browser transpilation with esbuild passed for the shared Work Order, Bills, Payment Request, documents, template registry, route, sidebar, and Settings Template files. `git diff --check` passed. The migration was statically reviewed for additive behavior, ordered prerequisites, explicit search paths, tenant predicates, function privilege revocation, no active `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` statements, and corrected pagination before JSON aggregation.

These checks do not prove that the SQL compiles against the user’s live Supabase schema. The migration includes a read-only Step 0 preflight because the repository has schema variation and the previous MOM migration failure demonstrated that assumed columns can be absent. The user must review and run the SQL manually, one staged transaction at a time.

## References

[1]: [`apps/web/src/database/common_work_order_bridge.sql`](apps/web/src/database/common_work_order_bridge.sql) — reviewed additive bridge migration and RPC/security boundary.
[2]: [`apps/web/src/work-orders/types/index.ts`](apps/web/src/work-orders/types/index.ts) — shared Work Order contracts and server-response validation.
[3]: [`apps/web/src/work-orders/api/rpc.ts`](apps/web/src/work-orders/api/rpc.ts) — Work Order RPC adapter.
[4]: [`apps/web/src/bills/api/rpc.ts`](apps/web/src/bills/api/rpc.ts) — Bills inbox/link adapter.
[5]: [`apps/web/src/payment-requests/api/rpc.ts`](apps/web/src/payment-requests/api/rpc.ts) — Payment Request RPC adapter.
[6]: [`apps/web/src/documents/api/rpc.ts`](apps/web/src/documents/api/rpc.ts) — immutable document-snapshot adapter.
[7]: [`apps/web/src/database/work_orders_migration.sql`](apps/web/src/database/work_orders_migration.sql) — legacy Work Order schema and permissive policy.
[8]: [`apps/web/src/database-purchase-module.sql`](apps/web/src/database-purchase-module.sql) — legacy purchase bills, payments, and Payment Requests.
[9]: [`apps/web/src/approvals/api.ts`](apps/web/src/approvals/api.ts) — legacy approval side effects and source mutations.
[10]: [`apps/web/src/approvals/integration.ts`](apps/web/src/approvals/integration.ts) — approval creation and source-state integration.
[11]: [`apps/web/src/modules/Purchase/hooks/usePurchaseQueries.ts`](apps/web/src/modules/Purchase/hooks/usePurchaseQueries.ts) — legacy client-side payment request and settlement flows.
[12]: [`apps/web/src/pages/TemplateSettings.tsx`](apps/web/src/pages/TemplateSettings.tsx) — Settings → Templates configuration and remaining direct mutations.

## Critical remediation pass

A follow-up remediation pass was completed after the original forensic review. The changes prioritize eliminating exploitable browser mutation paths over preserving unsafe legacy functionality.

| Finding | Remediation | Result |
|---|---|---|
| F-01 permissive tenant policies | Added [`apps/web/src/database/common_work_order_legacy_rls_hardening.sql`](apps/web/src/database/common_work_order_legacy_rls_hardening.sql). It is manual-only, has a fail-closed preflight, removes the known unrestricted policies, and adds organization-member read policies. Sensitive Work Order, source-bill, invoice, Payment Request, and settlement tables receive no browser write policy. | **Blocked by default after manual migration execution.** Existing legacy tables are preserved. |
| F-02 direct Work Order writes | Rewired the active subcontractor Work Order editor to `workOrderRpc.saveDraft` and `workOrderRpc.issue`. Browser number scanning was removed. The server recalculates totals and allocates final numbers. | **Fixed for the active Work Order editor.** Legacy direct writes fail once the hardening SQL is applied. |
| F-03 approval side effects | Added `approval_transition` and bounded `approvals/rpc.ts`. Work Order, Payment Request, purchase-payment, and subcontractor-payment approval/return/resubmit actions now use tenant-scoped RPC transitions. Approval references are bound through `work_order_bind_approval` and `payment_request_bind_approval`. | **Fixed for the covered source types after migration.** Other approval document types remain legacy and outside this bridge scope. |
| F-04 direct payment posting | Purchase-payment creation, release, bulk mark-paid, bulk deletion, and bulk reapproval hooks now fail closed. PO-to-Payment-Request creation also fails closed because a PO is not a payable source bill. | **Exploit path removed; feature intentionally unavailable** until idempotent source-specific settlement RPCs are implemented. |
| F-05/F-06 numbering and idempotency | Added advisory transaction locks around approval, Work Order, bill-link, Payment Request, and draft operations; new number allocation remains row-locked. | **Fixed for new bridge/RPC paths.** Legacy paths are blocked or no longer used for covered operations. |
| F-07 financial tampering | The active Work Order editor sends only a typed draft input; PostgreSQL recalculates commercial values. Payment/settlement mutations are blocked rather than trusted. | **Fixed for covered Work Order paths; settlement capability remains deferred.** |
| F-08 IDOR/cross-tenant references | New approval and binding procedures require organization membership, permission, source organization equality, and organization-scoped row predicates. | **Fixed for covered bridge operations.** Legacy unrelated approval document types still require separate migration. |

The remediation intentionally leaves the purchase-order editing path and unrelated quotation/invoice approval paths outside this cut-over. They are not silently treated as secure by the bridge. The hardening migration preserves them only where their existing module requires continued operation; the report’s remaining release gates still apply.

## New release condition

The hardening SQL must be manually reviewed and run before the new fail-closed behavior can be considered active in Supabase. Until then, repository changes alone do not alter production RLS. After migration, users will see explicit errors for direct payment posting, bulk payment actions, and bill creation paths that lack the new source-aware RPC. This is deliberate: an unavailable financial action is safer than a browser-authorized ledger mutation.

## Additional validation

The remediation regression suite passed **3 test files and 9 tests** after adding approval-transition boundary tests. Focused esbuild transpilation passed for the modified Work Order editor, approval API/integration/RPC adapter, purchase hooks, and shared Work Order/Payment Request adapters. `git diff --check` passed. A post-change scan found no executable direct mutation call for `subcontractor_work_orders`, `payment_requests`, `purchase_payments`, or `subcontractor_payments` in the covered Work Order, approval, and purchase-hook paths; the remaining occurrences are reads, RPC adapters, or explicit fail-closed guards.
