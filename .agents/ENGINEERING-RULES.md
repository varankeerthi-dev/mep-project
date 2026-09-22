# ERP Engineering Rules

## 1. Investigate before changing

Read the relevant authority documents and inspect the actual implementation.

## 2. Evidence before assumptions

Search the repository and, when relevant, the live database/runtime.

Classify findings using `.agents/README.md`.

## 3. Reuse before duplication

Search for existing:

- components;
- hooks;
- queries;
- RPCs;
- database tables;
- business concepts;
- permissions;
- verification scenarios.

## 4. No speculative refactoring

Do not refactor unrelated code unless required for security, correctness, performance, or the feature.

## 5. No security shortcuts

Never bypass RLS, tenant boundaries, authorization, or atomicity merely to simplify implementation.

## 6. No silent architecture changes

If an idea requires a new architectural pattern, stop at the design/decision boundary and document it.

## 7. Product idea ≠ implementation instruction

A Linear idea means investigate the problem and produce a grounded design.

It does not authorize coding.

## 8. PRD before substantial implementation

Preferred lifecycle:

Idea → technical investigation → PRD → approval → implementation plan → code → verification.

## 9. Smallest safe change

Prefer minimal changes that preserve established behavior and boundaries.

## 10. Performance is evidence-driven

Measure before claiming a performance problem or improvement.

## 11. Database changes must be reproducible

Every database change must have an explicit migration/source-of-truth path.

## 12. Verification is part of implementation

Completion requires relevant real-use-case, security, integrity, and regression verification.

## 13. Keep failures observable

Do not create silent failure paths for important business operations.

## 14. AI-agent changes need additional scrutiny

Any new AI tool/action must define:

- allowed operations;
- tenant scope;
- authorization;
- data access;
- mutation boundaries;
- auditability;
- failure/retry behavior.
