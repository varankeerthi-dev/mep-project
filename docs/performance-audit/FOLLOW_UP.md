# Performance audit follow-up

This is a handoff for a later resume. **The audit remains paused.** None of the steps below were executed as part of the checkpoint; no deployment or migration is authorized by this document.

## Resume checklist

1. **Establish a controlled comparison environment.** Use a configured local production preview or an authorized preview deployment with the same app/backend, host/CDN, browser version, viewport, cache policy, and test account for baseline and candidate. The earlier baseline was on the deployed host while the final subset was local; do not attribute the observed differences to code alone. Keep credentials in the approved secret manager/environment, never in a command literal, repo file, or result artifact.
2. **Resolve route/tab coverage.** Use a clean test profile or otherwise dismiss the visible onboarding overlay through normal UI. Do not force-click obscured controls. Re-run direct route states and tab sweeps for the same 157-state source inventory, including the source-only Settings checklist tab if it is now present. Report matched, unmatched, blocked, and unmeasured states separately.
3. **Measure interactions correctly.** Exercise representative tab changes and interactions after they are reachable. Record synthetic Event Timing only as lab diagnostics; obtain CrUX or approved RUM data before making an INP/p75 claim. Keep navigation-only timings distinct from interaction metrics.
4. **Reproduce and diagnose Warehouse fan-out.** Repeat the Warehouse dashboard sample and the cold `/warehouse` route. Group requests by table/RPC and initiator, distinguish completed from pending/incomplete, and verify whether hidden siblings still mount before or after first visit. Investigate why `get_or_create_company_channel` is attempted; keep it blocked unless its behavior is proven read-only and explicitly approved for the harness. The current 102/33/~691 ms sample is not enough to identify a backend, network, or rendering root cause.
5. **Trace the CLS changes on the four routes.** Capture repeat samples with identical conditions for `/issue`, `/settings?tab=modules`, invoices, and payments; inspect shift timing/source geometry and whether loading-state changes avoid layout replacement. Treat the earlier local values as promising observations, not a production-wide result.
6. **Prioritize source-only risks with runtime evidence.** For high-fan-out or unbounded-list candidates in the three source reports, capture request duration, row counts, transfer bytes, cache state, and visible-row count before changing query limits/pagination or render paths. Keep source-inferred counts separate from observed requests. Avoid changing unrelated data flows while the Warehouse question is open.
7. **Establish field Core Web Vitals.** Use CrUX or an approved RUM source and report the 75th-percentile window and route/device coverage. The reference thresholds are LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1; lab samples do not establish these field cutoffs.
8. **Verify code changes independently.** Run the focused document-checklist test script, the Warehouse route test, the relevant app test suite, and the production build. Record the actual command outcomes. Revisit the full TypeScript diagnostics only when needed to establish whether the 807-diagnostic baseline changed.
9. **Handle migrations and release separately.** The two checklist migrations are still unapplied. Review their SQL and deployment order independently; only apply them under the appropriate migration process and explicit authorization. Do not deploy this checkpoint as part of simply resuming measurement.

## Suggested rerun commands

From the repository root, first review [`harness/README.md`](harness/README.md). The inventory generator writes only to `/tmp/mep-perf-audit-run/`; the browser run and analysis outputs also stay outside the repository. Do not copy raw run outputs into Git. Inspect and sanitize any results before sharing them.

## Reporting template

For each resumed run, record:

- build/commit, host/CDN, browser, viewport, cache/throttling and account class;
- source states, direct route samples, matched deployment states, and tab-click attempts by outcome;
- route-ready, FCP, LCP, CLS, request totals, completed/pending counts, and interaction metrics as separate measures;
- source-inferred call-site counts separately from observed network request counts;
- write-guard attempts/blocks and any test-profile or overlay limitations;
- field p75 source/window, if available, otherwise `not collected`;
- changes since the prior run and whether a same-host control exists;
- test/build/typecheck status, plus explicit deployment/migration status.
