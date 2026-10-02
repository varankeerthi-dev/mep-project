# Packaged browser-audit harness

This is the reviewed harness from the paused investigation. Its only changes are path portability and output placement: it resolves the source tree relative to this file and keeps generated run artifacts under `/tmp/mep-perf-audit-run/`, outside the repository. **It was not run during checkpoint packaging.**

## Scope and safety

The harness performs authenticated browser navigation and visible-tab selection. It allows the authentication token exchange and source-defined read-style RPCs, blocks REST table `POST`/`PUT`/`PATCH`/`DELETE`, and blocks unknown or mutating RPCs. Do not widen that allowlist without separately proving a procedure is read-only and explicitly authorizing the change. It does not capture request URLs, filters, headers, tokens, request bodies, or response content; the metrics are synthetic lab data, not a real-user p75 sample. Its raw output remains outside Git and must still be reviewed before sharing.

Use this only when the investigation is deliberately resumed, against an authorized target and appropriate test account. The source-only phase did fetch public static HTML/JavaScript/source-map payloads for deployment correlation; that scope deviation is documented in the source reports and overview.

## Requirements

- Node.js, the repository's installed TypeScript package, Python 3, Playwright for Python, and `/usr/bin/chromium`.
- Run from any location; `inventory.mjs` discovers the repository as the third parent directory above `docs/performance-audit/harness/`.
- Provide `MEP_PERF_EMAIL` and `MEP_PERF_PASSWORD` to the process through an approved local secret manager. Never put credential values in shell history, source, or result files.
- Optional `MEP_PERF_BASE_URL` must be an HTTP(S) origin without a path, query, or fragment. The manifest default is the public deployed app.

## Rerun

From the repository root:

```bash
node docs/performance-audit/harness/inventory.mjs
# Writes /tmp/mep-perf-audit-run/manifest.json.

python3 docs/performance-audit/harness/audit.py \
  --manifest /tmp/mep-perf-audit-run/manifest.json \
  --runs 2 \
  --output /tmp/mep-perf-audit-run/baseline.json

python3 docs/performance-audit/harness/analyze.py \
  --input /tmp/mep-perf-audit-run/baseline.json \
  --scenario baseline \
  --db /tmp/mep-perf-audit-run/results.sqlite \
  --analysis-output /tmp/mep-perf-audit-run/analysis.json
```

For a preview build, set `MEP_PERF_BASE_URL` to its origin. Pilot-only `--module NAME` or `--limit N` arguments are not substitutes for full coverage. The harness measures direct route entries twice and attempts tab sweeps only when the visible target is not occluded; it does not force-click blocked tabs.

Keep `baseline.json`, `analysis.json`, SQLite databases, logs, and browser profiles out of version control. The packaged `manifest.json` is a source-derived route inventory, not runtime/business data. Recheck privacy and scope before retaining or sharing any newly generated artifact.

## Included files

- `inventory.mjs` — extracts route/tab states from navigation and module registries.
- `manifest.json` — the 157-state source inventory used for the checkpoint.
- `audit.py` — authenticated synthetic browser run with a read-only network guard.
- `analyze.py` — summary, reference-threshold and comparison analysis.
- `cwv-reference.md` — official threshold context and the distinction between field p75 and lab samples.
