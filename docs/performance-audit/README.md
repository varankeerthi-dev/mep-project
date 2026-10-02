# Paused performance audit checkpoint

- **Status:** The performance investigation is paused at the user's request. This document records the completed evidence and the exact next steps for a later resume; it does not represent a deployment or a completed performance remediation.
- **Checkpoint date:** 2026-10-02
- **Base commit:** `1533b47dfb12e858b1b33fc6fffe41da77c12b1c`
- **Branch:** `audit/performance-checkpoint-20261002`

## Executive summary

The work combines the existing document-checklist feature changes with a focused set of layout/loading changes prompted by synthetic performance observations. The route-wide baseline is from the deployed app; the final comparison is only a small local production-preview subset. The samples show lower CLS on four previously high-CLS routes, but the environment mismatch and limited post-fix coverage prevent a causal or app-wide conclusion. The Warehouse request anomaly remains unresolved.

**Nothing was deployed, neither checklist migration was applied, and no business data was changed as part of this checkpoint.** The audit was not rerun while preparing the checkpoint.

## Evidence and measurement scope

Three detailed **source-only** reviews are preserved under [`source-audits/`](source-audits/):

- [App shell and requested route groups](source-audits/app-shell-and-route-groups.md)
- [Business modules](source-audits/business-modules.md)
- [Supply-chain modules](source-audits/supply-chain.md)

Those reviews distinguish source-inferred query/RPC call sites from browser-observed request counts. Source call-site totals are hypotheses about cold-route fan-out, not network measurements or measured slowdowns.

The browser harness used a source-derived manifest of **157 route/tab states**: 38 authenticated sidebar module families plus the Quick Lookup route family. The deployed baseline navigated each state twice (**314 route entries**); **156 states matched the deployed app**, while the source-only Settings checklist tab did not exist in that deployment. Of 105 possible local tab clicks, the visible onboarding overlay blocked the attempts. Local-only tabs, interaction coverage, and INP were therefore not established. Seven `get_or_create_company_channel` RPC POST attempts were blocked by the read-only request guard.

The post-change browser run used a **local production preview**, not the deployed baseline host, and covered only **13 states × 2 samples (26 route entries)**. The local Vite dev setup could not be used because the frontend Supabase URL/anon key were unavailable. Both runs used the same app/backend, but host/CDN and build context differed, so the before/after comparison is not a controlled same-host experiment.

### Observations

| Route | Baseline CLS (two samples) | Local post-change CLS (two samples) |
|---|---:|---:|
| `/issue` | 0.2603, 0.2693 | 0.0179, 0.0179 |
| `/settings?tab=modules` | 0.1460, 0.1507 | 0.0021, 0.0021 |
| `/subcontractors-v2/invoices` | 0.1186, 0.1186 | 0.0028, 0.0029 |
| `/subcontractors-v2/payments` | 0.2752, 0.2752 | 0.0028, 0.0028 |

For the final local subset, route-ready p50 was **473.95 ms**; no sampled LCP exceeded 2.5 s and no sampled CLS exceeded 0.1. There were **57 console-error events**, no page errors, and no write attempts. These are synthetic lab observations, not field percentiles. LCP over 2.5 s occurred in two individual baseline samples but was not repeatable on a route across its repeated samples.

One Warehouse dashboard sample recorded **102 table requests**, **33 pending or incomplete**, and table-request p95 of about **691 ms**. This is an investigation lead, not a diagnosis: the audit stopped before root cause or fix confirmation.

The good-reference Core Web Vitals cutoffs are **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1** ([web.dev Core Web Vitals](https://web.dev/articles/vitals)). No CrUX/RUM field p75 was collected, and INP was not established. Do **not** claim field Core Web Vitals compliance from these lab samples.

## Scope and privacy notes

The source-only reviews did not call application APIs or read business-record responses. One scope deviation is explicitly retained in the reports: public static app HTML, JavaScript, and source-map payloads were fetched to correlate deployed assets. After this was recognized, later deployment checks used HTTP HEAD headers only. No API/business-record response bodies, real records, secrets, browser profiles, or environment files are included here.

The authenticated lab harness collected limited request metadata (resource category/table/RPC name, method, counts, status class, and timing) and performance measurements; it did not record request URLs, query filters, headers, tokens, request bodies, or response content. It blocked REST mutations and unapproved RPCs (apart from the authentication token exchange and the source-defined read-style RPC allowlist). The raw browser snapshots, SQLite databases, and logs were deliberately excluded from this branch; the snapshots contained numeric strings that could resemble identifiers and were not necessary to preserve the findings.

The [packaged harness](harness/README.md) and manifest are provided for a future controlled rerun. No browser measurement was performed during this checkpoint.

## Current code changes in this checkpoint

The new branch preserves the complete task-owned working-tree checkpoint:

- **Document checklists:** checklist domain/API/gating and assignment/settings work; checklist integrations/tests across quotations, invoices, sales orders, and purchase-document flows; plus the focused verification script and two Supabase migrations. Both migrations remain **unapplied**.
- **Performance-related UI changes:** remove the remote Google Fonts import and set explicit filter widths on `/issue`; suppress the initial expanded-panel animation in Module Settings; keep invoice and payment page shells visible while loading, using table loading/skeleton states (and disabled payment actions); and mount Warehouse sibling panels only when first visited while preserving visited panels. A Warehouse route regression test is included.

This inventory describes the code present; it does not claim each change has been proven to improve production performance. In particular, the Warehouse request sample has no confirmed root cause and the local post-change run was not full-route coverage.

## Verification status

Saved post-change verification artifacts report:

- **Tests:** 15 test files and 282 tests passed, including Warehouse route cases.
- **Production build:** passed in **43.80 s**; Vite emitted its existing large-chunk warning (>600 KB).
- **Full TypeScript check:** exited 2 with **807 diagnostics**. The saved final, post-issue, and earlier typecheck logs are byte-identical, so this is unchanged from the earlier audit run.

Checkpoint verification also reran the focused checklist script (**10 files / 53 tests passed**) and the Warehouse route regression test (**1 file / 9 tests passed**) against the preserved task changes. In the checkpoint worktree, `git diff --check`, JavaScript/Python syntax checks, JSON parsing, 157-state inventory regeneration, and byte-for-byte checks of all three copied source audits passed. Raw verification logs are not committed.

## Files

- [`FOLLOW_UP.md`](FOLLOW_UP.md) — ordered, actionable steps for resuming the investigation.
- [`harness/README.md`](harness/README.md) — safe rerun instructions and output handling.
- [`harness/manifest.json`](harness/manifest.json) — source-derived route/tab-state inventory.
- [`summary.json`](summary.json) — minimized machine-readable measurement and verification summary.
- [`harness/audit.py`](harness/audit.py), [`harness/inventory.mjs`](harness/inventory.mjs), [`harness/analyze.py`](harness/analyze.py) — reviewed harness code, with only path/output-location adjustments for this packaged copy.
- [`harness/cwv-reference.md`](harness/cwv-reference.md) — official threshold and field-data distinction.

No raw per-route measurement snapshots, database, browser profile, or logs are included.
