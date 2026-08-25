# Work Completion Certificate Forensic Security Audit

**Audit date:** 2026-08-25
**Repository:** `varankeerthi-dev/mep-project`
**Audited feature:** Work Completion Certificate creator
**Audit style:** Evidence-first forensic review. File names, comments, route names, and function names were treated as claims only; live behavior and actual code paths were checked separately.

## Executive conclusion

The Work Completion Certificate feature is **not security-ready for production**. An experienced user can manipulate the browser request and change certificate fields because the feature writes directly from the browser to Supabase, with no Work Completion RPC and no server-side validation of the business rules. The browser can therefore submit forged recipient snapshots, GSTIN, address, state, company snapshot, dates, references, clauses, signature labels, and status values.

The exact impact on the live database could not be proven in this environment because the configured Supabase URL/session was unavailable and the local application failed to boot. The supplied RLS SQL is also located under `apps/web/src/database-work-completion-certificates.sql`, not the active `apps/web/supabase/migrations` directory, so its application to the live database was not evidenced. Until the migration is confirmed as applied and live authorization tests pass, the feature must be treated as **unverified and potentially writable by any authenticated organisation member**.

> Direct answer: **Yes, an experienced person can manipulate the document through the browser.** Browser-side fields and JavaScript are not trustworthy. RLS can limit which rows a user can access, but it does not validate that the document’s displayed snapshots, linked PO/invoice, status, or accounting meaning are correct. A secure implementation needs server-side validation through an RPC or equivalent backend boundary, plus database triggers/constraints for immutable and cross-record invariants.

## Scope and evidence sources

The audit covered the active web route, the certificate editor, the Documents hub, the mobile screen, the supplied SQL migration, the existing RBAC guard, organisation selection, and the local runtime.

| Area | Evidence inspected |
|---|---|
| Web route | `apps/web/src/App.tsx` route cases for `/work-completion`, `/work-completion/create`, and `/work-completion/edit` |
| Web editor | `apps/web/src/pages/WorkCompletionCertificatePage.tsx` |
| Documents hub | `apps/web/src/pages/ProjectManagementInternal.tsx` |
| Mobile editor | `apps/mobile/src/screens/WorkCompletionCertificate.tsx` and `apps/mobile/src/App.tsx` |
| RLS proposal | `apps/web/src/database-work-completion-certificates.sql` |
| RBAC implementation | `apps/web/src/rbac/PermissionGuard.tsx`, `apps/web/src/rbac/hooks.ts`, and `apps/web/src/rbac/schemas.ts` |
| Tenant selection | `apps/web/src/supabase.ts`, especially `getUserOrganisations` |
| Runtime | Local Vite server and Chromium browser at `/work-completion/create` and `/login` |

## Live reproduction log

### Test L-01: Open certificate route without an authenticated session

**Steps taken:**

1. Started the local web application with Vite on port 5173.
2. Navigated Chromium to `http://localhost:5173/work-completion/create`.
3. Waited for the application to render.

**Observed:** A blank white viewport was displayed. Only React Scan overlay controls were visible. No login redirect, editor, error page, or certificate controls appeared.

**Runtime evidence:** Vite reported a dependency-scan error in an existing module: `MeetingMinutesEditor.tsx` imports `useCreateMeetingAmendment`, but `useMeetings.ts` does not export that symbol.

**Result:** **Fail — live feature UI not reachable in the current checkout.** This proves a local availability problem, not a security pass.

### Test L-02: Open the login route

**Steps taken:**

1. Navigated Chromium to `http://localhost:5173/login`.
2. Waited for the application to render.

**Observed:** The login route also displayed a blank white viewport with only React Scan overlay controls. No login form was visible.

**Result:** **Fail — authenticated and unauthenticated browser flows could not be exercised.**

### Test L-03: Remove the first known boot error and retry

**Steps taken:**

1. Created a backup of `apps/web/src/meetings/hooks/useMeetings.ts`.
2. Appended a temporary alias export mapping `useCreateMeetingAmendment` to the existing `useCreateAmendment` function.
3. Started a second Vite instance on port 5174.
4. Navigated Chromium to `http://localhost:5174/work-completion/create`.
5. Waited for the application to render.
6. Restored the original `useMeetings.ts` from the backup and stopped the temporary server.

**Observed:** The route remained a blank white viewport. No certificate editor appeared.

**Result:** **Fail — the first dependency error was not the only reason live reproduction was unavailable, or the running graph/cache still contained the failure.** The audit shim was removed; the original file was restored and `git diff --check` passed.

### Test L-04: Direct live Supabase probe

**Steps taken:** Checked shell environment variables and local environment files for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then attempted an anonymous REST probe only if those values were available.

**Observed:** No Supabase browser environment variables were available in the audit environment. No anonymous database request was sent.

**Result:** **Not executable — no live endpoint or authenticated session was available.** Table existence, live RLS behavior, and live insert/update behavior remain unproven.

## Static findings

### Finding F-01 — Direct browser writes with no Work Completion RPC

**Severity:** High

`WorkCompletionCertificatePage.tsx` calls Supabase directly from the browser:

```ts
supabase.from('work_completion_certificates').select('*')
supabase.from('work_completion_certificates').update(payload)
supabase.from('work_completion_certificates').insert(payload)
```

No `supabase.rpc(...)` call exists in the feature, and no `work_completion` RPC was found in the active migration directory. The browser is therefore the caller that constructs the entire document payload.

**Why this matters:** An experienced user can open DevTools, modify the request body, replay it, or call the Supabase client directly. React state, disabled buttons, dropdown filtering, and hidden fields are not security boundaries.

**Recommended fix:** Create `create_work_completion_certificate` and `update_work_completion_certificate` RPCs with `SECURITY DEFINER`, `SET search_path = public`, explicit `auth.uid()` checks, organisation membership checks, RBAC checks, linked-record checks, snapshot generation from authoritative tables, and immutable-field rules.

### Finding F-02 — No route-level or save-level RBAC enforcement

**Severity:** High

The active router returns the certificate page directly:

```tsx
case '/work-completion/create': return <WorkCompletionCertificatePage />;
case '/work-completion/edit': return <WorkCompletionCertificatePage />;
```

There is no `PermissionGuard` around these routes and no Work Completion permission key was found. The existing RBAC system has `PermissionGuard` and `useHasPermission`, but the certificate feature does not use them.

The authenticated shell prevents unauthenticated users from reaching normal application routes, but authentication is not the same as permission. Any authenticated user who can obtain an organisation context can navigate directly to the URL.

**Recommended fix:** Add explicit permissions such as `work_completion.read`, `work_completion.create`, `work_completion.update`, `work_completion.delete`, and `work_completion.approve`. Enforce them in both the route/UI and the RPC/database boundary. The database check must be authoritative because a user can bypass the UI.

### Finding F-03 — RLS migration is not evidenced as applied

**Severity:** Critical/Unverified

The only Work Completion RLS definition found is `apps/web/src/database-work-completion-certificates.sql`. The active repository migrations are under `apps/web/supabase/migrations`; no Work Completion migration was found there. No database execution log, Supabase migration record, or live query was available to prove that the table or policy exists in the live database.

The proposed policy uses `org_members`, which matches application code, but the policy’s existence in a source file does not prove that it exists in Supabase.

**Recommended fix:** Move the SQL into a timestamped active migration, apply it through the project’s migration process, and verify from the live database. Record evidence for table existence, RLS enabled state, policies, grants, and trigger definitions.

### Finding F-04 — Organisation membership RLS is not enough for role authorization

**Severity:** High

The proposed policy checks whether the user appears in `org_members` for the organisation. It does not check the member’s role or the Work Completion permission. Therefore, if applied exactly as written, every active member who can satisfy the membership subquery may receive row-level access regardless of whether the application role should permit certificate creation or editing.

**Recommended fix:** Use a stable `user_can_access_org` helper only for tenant isolation, and add a separate `user_has_permission(organisation_id, permission_key)` predicate or enforce permission inside the SECURITY DEFINER RPC. Apply least-privilege table grants and expose writes only through approved RPCs where possible.

### Finding F-05 — Browser-controlled snapshots and displayed identity fields

**Severity:** High

The save payload includes browser-controlled values such as:

```ts
client_address
client_gstin
client_state
company_snapshot
client_snapshot
body_intro
clauses
footer_text
left_signature_label
right_signature_label
status
created_by
updated_by
```

The UI initially derives some values from the client master, but the browser can change them before saving. A forged request can make the document display a different customer name, address, GSTIN, state, company details, or signature text while retaining the original `client_id`.

**Recommended fix:** On the server, load the client and organisation from the database and generate the snapshots. Treat user edits as explicitly separate override fields, record who changed them, validate them, and require approval for sensitive identity/tax overrides. Never trust `created_by`, `updated_by`, or `status` from the browser; derive the actor from `auth.uid()`.

### Finding F-06 — PO, invoice, and project links are filtered in the UI but not validated on save

**Severity:** High

The editor loads POs and invoices using the selected client ID, but the final payload accepts `po_id`, `invoice_id`, and `project_id` as browser values. The database foreign keys only prove that an ID exists; they do not, by themselves, prove that the linked row belongs to the same organisation and selected client.

A crafted request can attempt to associate a certificate with a PO, invoice, or project belonging to another client within the same organisation, or use an ID from another organisation if row access and foreign-key behavior allow it.

**Recommended fix:** In the RPC, validate each link with a compound predicate: `id = p_id`, `organisation_id = p_organisation_id`, and the relevant client/party relationship. Reject mismatches. Add database constraints or triggers where practical.

### Finding F-07 — Certificate number is generated in the browser

**Severity:** Medium

The new form generates a number using the current year and a suffix derived from `Date.now()`. The database has a per-organisation uniqueness constraint, which helps prevent exact duplicates, but the browser can submit any certificate number. There is no server-side sequence or permissioned numbering rule in the Work Completion implementation.

**Recommended fix:** Generate certificate numbers server-side with a per-organisation sequence or locked numbering function. Treat certificate number as immutable after finalization.

### Finding F-08 — Edit route is organisation-filtered but not permissioned or state-controlled

**Severity:** High

The edit loader filters by `id` and `organisation_id`, and the update also filters by both. That is useful tenant scoping, but it does not check whether the user has update permission, whether the certificate is final/approved, or whether protected fields may be changed after issuance.

**Recommended fix:** Add explicit status transitions and immutability rules. Drafts may be edited by users with `work_completion.update`; finalized certificates should require a revision flow or controlled amendment RPC.

## Partial or fake implementation findings

| Claimed capability | Evidence-based status | What was actually observed |
|---|---|---|
| Optional standalone certificate | Implemented in source | The form does not require an invoice or PO; the Documents hub has a separate create action. Live UI confirmation failed because the app booted blank. |
| Two output formats | Partially implemented | `letterhead` and `simple_a4` change rendering behavior. The simple A4 “inbuilt logo” is not a distinct uploaded asset; it uses the organisation logo when present and a `LOGO` placeholder when absent. |
| Uploaded letterhead/company footer | Partially implemented | The feature reads `organisation.logo_url` and optional footer text. No Work Completion-specific upload or letterpad asset selection was found. |
| Editable text | Implemented in source | Opening text, clauses, closing text, footer, and signature labels are React-controlled text fields. They are not sanitized HTML, which avoids an obvious HTML injection path, but they are still untrusted business data. |
| PO/invoice linking | Partially implemented | Client-scoped dropdowns and editable reference fields exist. No server-side relationship validation or live links from invoice/PO screens into certificate creation were found. |
| Existing invoice/PO auto-linking | Not evidenced | Only query parameters `clientId`, `invoiceId`, and `poId` are read by the new page. Search found no invoice or PO page navigation caller that supplies them. |
| Print | Implemented in source | Calls `window.print()` with CSS that hides the editor and prints the preview. Live browser reproduction failed. |
| PDF download | Implemented in source | Uses `html2canvas` and `jsPDF` against the browser preview. It is client-generated and not an authoritative stored PDF. |
| Saved certificate history | Implemented in source | Documents page queries the certificate table by organisation and opens edit routes. Live table existence was not verified. |
| Mobile parity | Partial | Mobile creation supports core fields and save, but does not include the full clauses editor, preview, print, or PDF download present in web. |
| RPC security | Not implemented | No Work Completion RPC was found. |
| RBAC | Not implemented for this feature | No route guard, permission key, or server-side permission check was found. |
| RLS | Proposed but unverified | SQL exists in a source file, but application to the live database was not evidenced. |

## Browser tampering assessment

An experienced person does not need to modify the React source permanently. They can use DevTools or a request-replay tool. A safe test procedure in a controlled tenant is:

1. Log in as a normal organisation member with no Work Completion create permission.
2. Navigate directly to `/work-completion/create`.
3. If the UI is hidden, call the underlying Supabase REST/RPC endpoint from the browser session or replay an observed request.
4. Change `client_gstin`, `client_address`, `client_snapshot`, `company_snapshot`, `status`, `created_by`, `updated_by`, `po_id`, or `invoice_id` in the request body.
5. Submit the request and inspect whether the database accepts it.
6. Repeat with a different organisation ID and a linked record belonging to another client.

The current source predicts that browser-side checks will not stop steps 3–5 because the feature uses direct browser writes and does not contain a server-side business-validation boundary. The actual accept/reject result was **not executed against the live database** because no authenticated Supabase session or endpoint was available in this audit environment.

## Security controls that did work or were not found vulnerable

The application has a global authenticated-shell check in `App.tsx`, so the route is not intentionally rendered for a missing application user once the app boots. The certificate page also includes `organisation_id` filters on its list, load, and update queries. The proposed table has organisation indexes and a uniqueness constraint. Certificate body text is rendered as React text rather than `dangerouslySetInnerHTML`, so the current implementation does not show an obvious stored-HTML/XSS sink in the certificate preview.

These controls are useful but insufficient. They do not replace live RLS verification, server-side ownership checks, RBAC, immutable state transitions, or linked-record validation.

## Required remediation order

| Priority | Action | Acceptance evidence |
|---|---|---|
| P0 | Move the table/policy into an active migration and apply it | Live SQL evidence: table exists, RLS enabled, exact policies/grants present |
| P0 | Replace direct insert/update with SECURITY DEFINER create/update RPCs | Source and live RPC calls; anonymous and unauthorized calls rejected |
| P0 | Validate organisation, actor, RBAC permission, client, PO, invoice, and project relationships server-side | Negative tests reject cross-tenant and cross-client payloads |
| P0 | Stop accepting authoritative snapshots, actor IDs, and status from the browser | Server-generated snapshots and `auth.uid()` actor evidence |
| P1 | Add Work Completion RBAC permissions and route guards | Normal member without permission receives denial both in UI and database |
| P1 | Add draft/final/approved state transitions and revision controls | Finalized documents cannot be silently edited or overwritten |
| P1 | Add server-side certificate numbering | Concurrent creation produces unique, policy-compliant numbers |
| P1 | Add live links from invoice/PO/project pages, if required | Browser reproduction shows correct query parameters and records loaded |
| P2 | Complete mobile parity for preview/print/PDF or explicitly document mobile scope | Mobile acceptance checklist passes |
| P2 | Add automated security tests and a controlled browser tamper test suite | CI tests cover cross-tenant, cross-client, role, and forged-field cases |

## Final risk rating

**Overall:** High risk / not production-ready.
**Primary reason:** Direct browser writes with no RPC and no feature-specific RBAC, combined with unverified RLS deployment.
**Live confidence:** Limited. The browser audit was reproducible only up to the application boot failure; live database authorization could not be exercised without a configured endpoint and authenticated session.
