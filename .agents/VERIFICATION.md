# ERP Verification Authority

## Completion standard

A feature is not complete merely because it compiles or a unit test passes.

Verification must reflect how the ERP is actually used.

## Required layers

Use the layers relevant to the change:

1. Build/typecheck
2. Unit/component tests
3. Real user workflow
4. Database/data-integrity verification
5. Authorization/RLS/tenant isolation
6. Regression verification
7. Failure/retry verification
8. Performance verification when materially affected

## Real-use-case scenarios

Verification should use realistic ERP workflows, not synthetic CRUD-only checks.

Examples:

- quotation creation and revision;
- purchase order;
- material inward;
- material outward;
- delivery challan;
- project/site updates;
- task creation/update;
- payment/ledger transitions.

## Security scenarios

At minimum where relevant:

- correct organization can access;
- another organization cannot;
- authorized role can perform;
- unauthorized role cannot;
- forged IDs cannot cross tenant boundaries;
- privileged RPC cannot be abused;
- AI-agent permissions remain bounded.

## Data integrity scenarios

Where relevant:

- successful transition produces correct state;
- failure does not create invalid partial state;
- repeated request does not duplicate the transition;
- concurrent operations preserve invariants;
- reversal/cancellation produces correct state.

## Verification evidence

Record what was actually tested.

Never report PASS from:

- static inspection alone when runtime behavior is required;
- UI visibility alone for authorization;
- a successful happy path when failure/retry behavior matters.

## Change → verify → fix → reverify

The preferred coding-agent loop is:

1. Make the smallest implementation.
2. Run verification.
3. Identify failures.
4. Fix the root cause.
5. Re-run affected verification.
6. Re-run relevant regression/security checks.
7. Stop only when the evidence supports completion.

## Verification skill

The project-local verification skill is the operational execution layer.

This document defines the principles; the skill defines how the repository's actual scenarios are executed.
