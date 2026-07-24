Review this feature/module before implementing.

Check for:
- Files over 800-1000 lines
- Components with too many responsibilities
- Repeated logic
- Hooks that are too large
- State that should be separated
- JSX that should become components

If restructuring is needed, STOP.

Do not implement the feature.

Instead, produce:
1. Architecture review
2. Refactoring plan
3. Risk assessment
4. File tree after refactor

Only after I approve the plan should implementation begin.


Implement ONLY the approved refactor.

Do not add unrelated improvements.
Do not introduce new architecture patterns.
Do not change business logic.
Keep commits small.