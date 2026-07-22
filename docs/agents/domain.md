# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`apps/web/CONTEXT.md`** — the domain glossary and context for the project.
- **`apps/web/docs/adr/`** — read ADRs in this directory that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (located in `apps/web/` component):

```
apps/web/
├── CONTEXT.md
└── docs/adr/
    └── 0001-snapshot-warranty-dates-on-escalation.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `apps/web/CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR under `apps/web/docs/adr/`, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (snapshot warranty dates on escalation) — but worth reopening because…_
