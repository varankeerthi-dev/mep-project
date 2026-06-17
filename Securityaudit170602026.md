# Security Audit Report

## Diagnostic Scan

Run comprehensive checks across multiple security and architecture dimensions on `mep-project`.

### 1. Missing Role-Based Access Control in Frontend Routes (P2 - Minor)
**Check for:**
- Proper route guards based on user roles (e.g., admin vs member).

**Finding:**
- **[P2] Global access to all pages**
- **Location:** `src/App.tsx`
- **Impact:** While the application requires authentication (`if (!user)`) and an organization check, there is no granular Role-Based Access Control (RBAC) in the frontend router. Any authenticated user within the organization can access administrative routes like `/settings/organisation`, `/settings/access-control`, `/settings/discounts`, and `/approval-settings`. If backend RLS policies are not properly checking the `role` in `org_members`, a regular user could view or modify global settings.
- **Recommendation:** Introduce a role check (e.g., checking if the current member's role is `admin`) in `App.tsx` for administrative routes.

### 2. Frontend Validation & Sanitization (P3 - Polish)
**Check for:**
- XSS vulnerabilities, usage of `dangerouslySetInnerHTML`, and insecure data rendering.

**Finding:**
- **[P3] Stored / Self-XSS using `dangerouslySetInnerHTML`**
- **Locations:** 
  - `src/pages/TemplateSettings.tsx`
  - `src/pages/DCList.tsx`
  - `src/pages/QuotationView.tsx`
  - `src/templates/VerticalTemplate.tsx`
- **Impact:** The application constructs raw HTML strings using user inputs and renders them using `dangerouslySetInnerHTML` for template previews and final document rendering. A malicious user could inject JavaScript (e.g., `<img src=x onerror=alert(1)>`) into a column label name or other text fields. When viewed by other users, the script will execute (Stored XSS).
- **Recommendation:** Use a DOM sanitizer (like DOMPurify) before passing the string to `dangerouslySetInnerHTML`, or construct the views using standard React components instead of raw HTML strings.

### 3. Local Storage of Sensitive Settings (P3 - Polish)
**Check for:**
- Insecure storage of sensitive UI settings.

**Finding:**
- **Location:** `src/pages/CreateDC.tsx`, `src/pages/CreateNonBillableDC.tsx`, `src/pages/EnhancedLogin.tsx`, etc.
- **Impact:** The application uses `localStorage` for certain permissions/preferences like `dc_allow_insufficient_stock`. While mostly UI states, relying on client-side storage for permissions logic (if any) can be bypassed. Furthermore, `EnhancedLogin.tsx` briefly handles passwords in state, which is normal for React, but ensure no sensitive tokens/passwords are persisted unnecessarily.

## Executive Summary
- **Audit Health Score:** Good
- **Total issues found:** 3 (P1: 0, P2: 1, P3: 2, P0: 0)
- **Top critical issues:**
  1. Missing RBAC for frontend admin routes in `App.tsx`.
- **Recommended next steps:** Implement route-level role checks to prevent unauthorized access to organization settings.

## Positive Findings
- Supabase credentials (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) are properly secured using environment variables and are **not** hardcoded in the codebase.
- The application effectively prevents XSS anti-patterns across most components.

## Recommended Actions
1. **[P2] `/harden`** — Implement role-based routing checks in `src/App.tsx` for admin routes.
2. **[P3] `/harden`** — Add `DOMPurify` or sanitize HTML before passing to `dangerouslySetInnerHTML` in template and view pages.

> You can ask me to run these one at a time, all at once, or in any order you prefer.
