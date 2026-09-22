---
name: idea-to-prd
description: Turn a Linear ERP product idea into a technically grounded PRD using the repository's authoritative architecture, security, data-integrity, engineering, verification, current-state, and ADR rules. Discovery only; do not implement code.
---

# ERP Idea → PRD

## Mission

When the user asks to read a Linear idea and prepare a PRD, do not treat the idea as a complete technical specification.

Use:

- Linear = product intent
- `.agents/` = engineering authority
- repository = application implementation evidence
- live Supabase/database/runtime = deployed-state evidence
- ADRs = accepted architectural decisions

The resulting PRD must fit the ERP's established architecture and security model.

## Mandatory authority reading

Before producing the PRD:

1. Read `.agents/README.md`
2. Read `.agents/CURRENT-STATE.md`
3. Read `.agents/ARCHITECTURE.md`
4. Read `.agents/SECURITY.md`
5. Read `.agents/DATA-INTEGRITY.md`
6. Read `.agents/ENGINEERING-RULES.md`
7. Read `.agents/VERIFICATION.md`
8. Read relevant `.agents/decisions/*`
9. Read the requested Linear idea
10. Inspect the current repository
11. Inspect the live DB/runtime when the feature affects database/security/runtime behavior

## Investigation method

### Step 1 — Understand the idea

Extract:

- problem;
- intended user;
- desired outcome;
- explicit requirements;
- stated target/timing;
- unknowns.

Do not invent missing requirements.

### Step 2 — Find current behavior

Search the repository for:

- relevant routes/pages;
- components;
- hooks;
- queries;
- RPCs/functions;
- tables;
- policies;
- migrations;
- permissions;
- verification scenarios.

Understand the actual current workflow before proposing changes.

### Step 3 — Apply architecture authority

Determine:

- existing module ownership;
- client/server boundary;
- reuse opportunities;
- performance implications;
- migration implications.

### Step 4 — Apply security authority

Determine:

- tenant boundary;
- authentication;
- authorization;
- RLS;
- privileged operations;
- AI-agent access;
- audit requirements;
- new trust boundaries.

### Step 5 — Apply data-integrity authority

Determine:

- affected records;
- critical transitions;
- atomicity;
- idempotency;
- concurrency;
- duplicate execution;
- reversal/cancellation;
- database constraints.

### Step 6 — Apply verification authority

Determine:

- real user scenarios;
- security scenarios;
- data-integrity scenarios;
- regression scenarios;
- failure/retry scenarios;
- performance checks.

## Evidence discipline

For every important technical finding, use one of:

- **CONFIRMED**
- **PARTIALLY VERIFIED**
- **NOT VERIFIED**
- **KNOWN DEFECT**
- **DECISION**

If repository and live DB disagree, classify the discrepancy:

- MATCHING
- LIVE-ONLY
- LOCAL-ONLY
- CONFLICTING

Do not silently reconcile conflicting evidence.

## Architectural conflict

If the idea conflicts with an established rule:

1. Identify the conflict.
2. Name the authority document/ADR.
3. Explain why the conflict matters.
4. Propose compliant alternatives.
5. Identify whether an ADR is required.
6. Do not implement or silently change the rule.

## PRD structure

Produce:

# PRD — [Feature]

## 1. Problem
## 2. Users
## 3. Goal
## 4. Non-goals
## 5. Current-state findings
Include evidence status.

## 6. Proposed user workflow
Describe the user-facing behavior without prematurely locking implementation details.

## 7. Functional requirements

## 8. Business rules

## 9. Permissions and security

## 10. Data impact
Tables, fields, RPCs/functions, migrations, constraints, and source-of-truth implications.

## 11. Architecture impact
Reuse, new boundaries, client/server responsibilities, and performance considerations.

## 12. Integration impact

## 13. Verification scenarios

## 14. Acceptance criteria

## 15. Risks and known defects

## 16. Open questions

## 17. Architectural decisions required

## Important boundary

This skill is DISCOVERY/PRD ONLY.

Do not:

- modify application code;
- modify database schema;
- create migrations;
- alter RLS;
- implement the feature;
- silently create implementation work.

Implementation begins only after explicit product approval.

## Quality bar

The PRD must answer:

> "Given what this ERP actually is today, how should this idea be built without violating our established architecture, security, data integrity, or verification model?"

If the evidence is insufficient, say so rather than guessing.
