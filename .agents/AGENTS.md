# Workspace Customization Rules

These rules govern the development of the monorepo, specifically when implementing features across the web app (`apps/web`) and the mobile app (`apps/mobile`).

## 1. Feature Parity & Mobile Porting
- Whenever a new user-facing feature, workflow, or module is added or updated in the web app (`apps/web`), a mobile-friendly equivalent must be enabled or implemented in the mobile app (`apps/mobile`).
- The mobile equivalent should focus on core actionable tasks (e.g., approval list, details, creation forms, status updates) optimized for mobile layouts and touch interfaces.

## 2. Design System Alignment
- All mobile modules and screens must strictly follow the tokens, layout metrics, HSL color theme, glassmorphism card styling, and typography defined in [Mobile_app_design.md](file:///c:/Users/admin/mep-project/Mobile_app_design.md).
- Avoid raw colors, non-standard border-radius, or custom fonts that deviate from the core design language.
- **Table Alignment Rule**: All Amount, Price, and monetary value columns across tables must always be left-aligned (`align: 'left'`).


## 3. Role-Based Access Control (RBAC) Integration
- The mobile app must respect and dynamically enforce the same Role-Based Access Control (RBAC) settings and permissions declared in the web application database schema.
- Modules, navigation tabs, action buttons, and screens must be hidden, disabled, or shown dynamically based on the authenticated user's role (e.g., Administrator, Project Manager, Approver, Employee) queried from the database.

## 4. Capacitor Build and Sync Verification
- After making any code changes in `apps/mobile/`, you must compile the application and sync the assets to the native Android directory:
  ```bash
  pnpm --filter=mobile build && pnpm --filter=mobile exec cap sync
  ```
- Verify that the build completes with zero compilation warnings or TypeScript errors before completing a task.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues. See [issue-tracker.md](file:///c:/Users/admin/mep-project/docs/agents/issue-tracker.md).

### Triage labels

Triage roles are mapped to standard label strings. See [triage-labels.md](file:///c:/Users/admin/mep-project/docs/agents/triage-labels.md).

### Domain docs

Single-context layout, with domain glossary and architectural decisions under `apps/web/`. See [domain.md](file:///c:/Users/admin/mep-project/docs/agents/domain.md).
