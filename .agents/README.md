# ERP Engineering Authority

**Status: AUTHORITATIVE BASELINE — verify/update when the live system materially changes**

This directory is the shared engineering authority for AI agents and humans working on the ERP.

It is intentionally agent-independent. OpenCode, Antigravity, and future agents must use the same engineering rules.

## Authority model

The three sources of truth have different roles:

1. **Live database/runtime** — authoritative for deployed database objects, RLS policies, functions, triggers, and runtime behavior.
2. **Repository** — authoritative for application code, migrations, configuration, and what the application can reach.
3. **These documents + accepted ADRs** — authoritative for established engineering constraints and decisions.

When sources disagree, do not silently choose one. Classify the mismatch and investigate.

## Evidence labels

Every material technical/security statement must be classified when its status matters:

- **CONFIRMED** — directly verified against current code, live DB, configuration, or runtime.
- **PARTIALLY VERIFIED** — evidence exists but verification is incomplete.
- **NOT VERIFIED** — no sufficient evidence yet.
- **KNOWN DEFECT** — a documented defect/risk that remains unresolved.
- **DECISION** — explicitly accepted architectural/product rule.

Never turn an assumption or historical audit note into a confirmed current fact.

## Live-vs-local reconciliation

For database/security work, reconcile:

- local migrations/SQL;
- current application code;
- live Supabase schema;
- live RLS policies;
- live functions/RPCs;
- live triggers/constraints/indexes where relevant.

Classify discrepancies as:

- MATCHING
- LIVE-ONLY
- LOCAL-ONLY
- CONFLICTING

## Agent operating rule

Before designing or implementing a meaningful feature:

1. Read the relevant authority documents.
2. Read relevant ADRs.
3. Read the Linear product requirement/idea.
4. Inspect the current repository.
5. Inspect the relevant live database/runtime state when the feature touches it.
6. Identify security, data-integrity, architecture, performance, and verification constraints.
7. Reuse established patterns.
8. Surface conflicts instead of silently overriding decisions.

## No silent architecture drift

A product idea does not override security or architecture.

If a feature requires changing an established boundary:

- identify the conflict;
- explain the consequence;
- propose the required decision;
- create/update an ADR only after explicit approval.

## Discovery is not implementation

Idea → investigation → PRD → approval → implementation → verification.

Do not implement a feature merely because an idea exists.

## Current authority documents

- `ARCHITECTURE.md`
- `SECURITY.md`
- `DATA-INTEGRITY.md`
- `ENGINEERING-RULES.md`
- `VERIFICATION.md`
- `CURRENT-STATE.md`
- `decisions/`
