# Architecture Decision Records

ADRs capture decisions that should not be casually reversed.

## Required structure

Each ADR should contain:

- Status
- Date
- Context
- Decision
- Alternatives considered
- Consequences
- Evidence/verification
- Supersedes/superseded-by, if applicable

## Status values

Suggested:

- PROPOSED
- ACCEPTED
- SUPERSEDED
- REJECTED

## Rule

If a new idea conflicts with an ACCEPTED ADR, the agent must surface the conflict.

It must not silently replace the decision inside a feature implementation.
