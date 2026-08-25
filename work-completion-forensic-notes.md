# Work Completion forensic audit notes

## Live browser evidence 1

Date: 2026-08-25.

Action: Started the local web application with Vite and navigated Chromium to `http://localhost:5173/work-completion/create`.

Observed: The first navigation rendered a blank white viewport. After waiting, the page still did not display the Work Completion UI; only the React Scan overlay controls were visible. The browser saved HTML for the route. The dev server reported an existing dependency-scan error before serving: `MeetingMinutesEditor.tsx` imports `useCreateMeetingAmendment`, which is not exported by `useMeetings.ts`. This means the live browser route was not successfully reproduced in the current local runtime. This is an observed availability failure, not proof of authorization behavior.

## Static evidence 1

The web feature uses direct Supabase browser calls, not an RPC: `supabase.from('work_completion_certificates').select`, `.insert`, and `.update` are invoked from `WorkCompletionCertificatePage.tsx`.

The route cases `/work-completion`, `/work-completion/create`, and `/work-completion/edit` return the page without a `PermissionGuard`. No Work Completion-specific permission key or sidebar permission guard was found.

The only certificate security policy is in `apps/web/src/database-work-completion-certificates.sql`, under `apps/web/src`, not under the repository's active `apps/web/supabase/migrations` directory. The policy references `org_members`, which is the name used by the mobile app, but this migration has not been shown to be applied to the live database.

The web save payload accepts browser-provided `client_address`, `client_gstin`, `client_state`, `company_snapshot`, and `client_snapshot`. The client-side filters for clients, projects, POs, and invoices are convenience filters; no server-side/RPC validation enforces that the selected PO, invoice, project, or snapshot belongs to the selected client and organisation.

The local Vite server reported an existing dependency-scan failure caused by `MeetingMinutesEditor.tsx` importing a non-exported `useCreateMeetingAmendment`; the live browser route consequently rendered blank and could not be reproduced through the UI in this environment.

## Live browser evidence 2

Action: Navigated Chromium to `http://localhost:5173/login` after the certificate route was blank.

Observed: The login route also rendered a blank white viewport with only the React Scan overlay controls. No login form and no authentication UI were visible. This confirms a local application boot/dependency issue prevents live UI reproduction of both protected and unauthenticated routes in the current checkout. It does not demonstrate that the certificate route is secure.

## Live browser evidence 3

Action: Created a reversible backup of `apps/web/src/meetings/hooks/useMeetings.ts`, appended a temporary alias export for the missing `useCreateMeetingAmendment`, restarted Vite on port 5174, and navigated to `/work-completion/create`.

Observed: The route remained a blank white viewport after waiting. The React Scan overlay controls were the only visible elements. This means the first known dependency error was not the only condition preventing live rendering, or the old server/cache was still serving the broken graph. The temporary shim is audit-only and must be restored before final status reporting.
