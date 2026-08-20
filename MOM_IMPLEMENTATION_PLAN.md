# Meetings and Minutes of Meeting (MOM)
## Phased Implementation Plan

**Repository:** `varankeerthi-dev/mep-project`
**Application:** `apps/web`
**Planning principle:** Build small vertical slices that can be reviewed, tested, and released independently. Avoid a single large Meetings rewrite.

## 1. Product outcome

The MOM feature should turn every meeting into a trusted, searchable, and actionable record. A user should be able to capture what was discussed, distinguish decisions from general discussion, assign accountable follow-up work, link that work to projects/tasks/milestones, and retrieve the exact context months later. A site engineer should be able to open a task or milestone and see the meetings, decisions, and action items that explain why the work exists.

The system must support client, internal, development, vendor, subcontractor, site, and project-execution meetings in one flexible model. A meeting may include internal and external participants, may have no project at all, and may link to several projects, tasks, or milestones when the discussion spans workstreams.

## 2. Non-monolithic architecture rules

| Rule | Application |
|---|---|
| One bounded feature area | Keep Meetings code under `src/meetings/` with separate pages, components, hooks, API functions, types, migrations, and tests. |
| Vertical slices | Each phase should include its schema/API/UI/tests rather than creating a large backend-first or frontend-only change. |
| One source of truth | The newer `src/meetings` module becomes canonical. The legacy `src/pages/Meetings.tsx` is removed only after route and data verification. |
| Explicit relations | Use relation records for meeting-to-project/task/milestone links instead of adding many nullable columns to `meetings`. |
| Immutable history | Finalized MOMs and historical relationships are never silently overwritten or hard-deleted. Amendments create new versions. |
| Stable contracts | Define typed API functions and shared domain types before adding dependent UI. |
| Progressive search | Start with deterministic full-text and contextual search; add semantic matching behind an interface so it can evolve independently. |
| Feature flags where needed | Gate Live Capture, offline sync, external sharing, and advanced search until their data contracts are verified. |

## 3. Current repository baseline

The repository already has an active Meetings module, a legacy page, a relational MOM SQL enhancement, structured minutes and attendee components, task synchronization logic, and routes for list/create/edit/view/minutes. The current implementation is therefore an extension and consolidation project, not a greenfield feature [1] [2] [3] [4].

The current `syncActionItemsWithTasks()` function creates unified tasks from meeting action items, but the existing schema and UI need to be expanded for explicit relationships, decisions, milestone links, versioning, search, and robust review workflows [5] [6].

## 4. Phase roadmap at a glance

| Phase | Name | Primary outcome | Release level |
|---:|---|---|---|
| 1 | Canonical boundaries | Confirm scope, vocabulary, ownership, and non-goals. | Planning gate |
| 2 | Repository inventory | Produce a dependency map and migration checklist. | Planning gate |
| 3 | Domain model | Normalize meetings, topics, decisions, actions, links, versions, and audit events. | Foundation |
| 4 | Security and history rules | Define permissions, versioning, audit, and no-delete behavior. | Foundation |
| 5 | Data migration | Preserve and normalize existing meetings without destructive deletion. | Foundation |
| 6 | Core MOM editor | Deliver overview, agenda, discussion, attendees, and draft save. | P0 |
| 7 | Decisions and action items | Deliver structured decisions and accountable follow-up records. | P0 |
| 8 | Task/milestone linking | Deliver Add to Task, existing-task linking, and milestone relationships. | P0/P1 |
| 9 | Search | Deliver permission-aware global and contextual search. | P0/P1 |
| 10 | Context surfaces | Show meeting history from project, task, milestone, and site workflows. | P1 |
| 11 | Live Capture/offline | Deliver fast capture and safe offline draft synchronization. | P1 |
| 12 | Review/finalization/sharing | Deliver immutable versions, amendments, and external read-only sharing. | P1 |
| 13 | Automation | Deliver reminders, overdue escalation, and notification preferences. | P1 |
| 14 | Attachments | Deliver secure basic attachment handling; defer advanced OCR/retention. | P2 |
| 15 | Legacy removal | Remove duplicate Meetings implementation after verification. | Cleanup |
| 16 | Validation | Run regression, security, accessibility, and performance checks. | Release gate |
| 17 | Release checklist | Produce rollout, monitoring, and acceptance documentation. | Delivery |

---

# Detailed phases

## Phase 1 — Establish canonical Meetings/MOM boundaries

**Objective:** Convert the agreed product direction into a short feature charter before changing the schema.

**Decisions to record:**

- A meeting is a flexible record with optional client, vendor, project, task, milestone, and site context.
- A meeting can have multiple labels and multiple related work records.
- Discussion, Decisions, and Action Items are separate concepts.
- Action Items require a title and, before finalization, an owner and due date or an explicit “No due date” exception.
- External participants may be stored without accounts and may receive controlled read-only output.
- Finalized MOMs are immutable; corrections are amendments or new versions.
- Historical records and links are archived rather than hard-deleted.
- English-only is in scope for the first version. Multilingual translation is deferred.
- Advanced attachment OCR and complex retention policies are deferred.

**Deliverables:** `docs/mom-feature-charter.md`, glossary, scope table, non-goals, decision log, and initial acceptance criteria.

**Gate:** Product owner confirms that the charter is stable enough for schema design.

## Phase 2 — Inventory routes, schemas, APIs, and legacy dependencies

**Objective:** Identify every current entry point and dependency before consolidating code.

**Inspect and document:**

- `src/App.tsx` route cases and deep-link handling.
- `src/components/Sidebar.tsx` and `src/config/module-registry.ts` navigation.
- `src/meetings/pages/*` active pages.
- `src/pages/Meetings.tsx` legacy page.
- `src/meetings/api/meetings.ts` data operations and direct Supabase access.
- `src/meetings/hooks/useMeetings.ts` query keys, mutations, and cache invalidation.
- `src/database-meetings.sql` baseline schema.
- `src/database-meetings-mom.sql` MOM enhancement schema and RLS.
- `src/database-unified-tasks.sql` task fields and permissions.
- Project, milestone, site-visit, notification, and task detail surfaces.

**Deliverables:** route matrix, data-field mapping, legacy dependency graph, API inventory, and migration risks.

**Gate:** Every current Meetings route has an identified canonical replacement or explicit removal decision.

## Phase 3 — Design the normalized MOM domain model and relationships

**Objective:** Create a stable model that supports flexible meeting contexts without a monolithic table.

**Recommended entities:**

| Entity | Responsibility |
|---|---|
| `meetings` | Core meeting identity, type labels, date/time, organizer, primary context, status, and current version pointer. |
| `meeting_participants` | Internal users and external contacts, with role, organization, attendance, and contact metadata. |
| `meeting_topics` | Agenda/discussion topics with order, title, notes, and completion state. |
| `meeting_decisions` | Decision text, owner/approver, rationale, affected context, and source topic. |
| `meeting_action_items` | Title, description, owner, due date, priority, status, source topic/decision, and task link. |
| `meeting_links` | Polymorphic or typed relations to projects, tasks, milestones, clients, vendors, and site records. |
| `meeting_versions` | Draft, review, finalized, and superseded snapshots. |
| `meeting_audit_events` | Append-only event history with actor, timestamp, field/event, and before/after metadata. |
| `meeting_attachments` | File metadata and storage references; advanced OCR remains deferred. |
| `meeting_search_documents` | Optional denormalized search projection maintained from canonical records. |

**Relationship rules:**

- A meeting may have one primary project context and many related project/task/milestone links.
- A task or milestone may reference many meetings.
- An action item may link to one task initially; the data model should allow future relation expansion.
- A link should record its source context, such as discussion, decision, or action item.
- Store timestamps in UTC and display them in the user’s local timezone.

**Deliverables:** ERD, migration SQL, Drizzle/Supabase type definitions, relation constraints, and API contract draft.

**Gate:** Schema supports all agreed relationships without adding separate tables for each meeting type.

## Phase 4 — Define permissions, versioning, audit, and non-deletion rules

**Objective:** Make historical MOMs trustworthy and access-safe before exposing sharing or search.

**Permission roles:**

| Role | Draft | Review | Finalize | Share | Administer |
|---|---:|---:|---:|---:|---:|
| Viewer | Read | No | No | No | No |
| Contributor | Create/edit permitted drafts | Request review | No | No | No |
| Meeting owner | Edit | Submit | If permitted | Yes | No |
| Project manager/reviewer | Comment/request changes | Yes | Yes | Yes | No |
| Administrator | Exceptional audited correction | Yes | Yes | Yes | Configure |
| External recipient | Read shared content only | No | No | No | No |

**Rules:**

- Project-linked meetings inherit project access where appropriate.
- Standalone internal meetings use organization-level policies.
- Finalized versions cannot be edited in place.
- Amendments point to the superseded version and preserve the original.
- Historical links remain visible when related work is archived.
- Hard deletion is prohibited for finalized MOMs, versions, audit events, and relationship history.

**Deliverables:** RLS policies, permission matrix, version-state machine, audit event catalog, and amendment contract.

**Gate:** Security review confirms no cross-organization or unauthorized project access path.

## Phase 5 — Migrate and normalize existing meeting data safely

**Objective:** Preserve current records while moving them into the canonical model.

**Approach:**

1. Map legacy meeting fields into the new core record.
2. Convert comma-separated participants into participant rows where possible.
3. Mark ambiguous client/project references as unresolved rather than guessing.
4. Preserve original IDs and source metadata.
5. Mark imported records as historical/imported and do not finalize them automatically.
6. Generate review queues for records missing organization, owner, date, or context.
7. Keep the migration idempotent so it can be rerun safely.

**Deliverables:** migration script, dry-run report, data-quality report, unresolved-reference queue, and post-migration reconciliation query.

**Gate:** Record counts and key fields reconcile before and after migration; no historical meeting is silently lost.

## Phase 6 — Build the core meeting and MOM editing workflow

**Objective:** Deliver the first usable, non-automated MOM experience.

**Frontend slices:**

- Meeting list with context-aware filters and stable empty/loading/error states.
- Create/edit meeting overview with flexible type labels.
- Agenda and topic-based discussion editor.
- Attendee management for internal users and external contacts.
- Draft save, unsaved-change protection, and last-saved state.
- Responsive desktop/tablet/mobile layouts.
- Read-only preview that matches the finalized document structure.

**Backend slices:**

- Typed list/detail/create/update procedures.
- Topic and participant CRUD with organization/project checks.
- Transactional draft save or an explicit compensating-operation strategy.
- Query invalidation for list, detail, relations, and search projections.

**Deliverables:** canonical list page, create/edit page, topic editor, attendee editor, draft preview, and tests.

**Gate:** A user can create a meeting, add agenda/discussion/attendees, save a draft, reload it, and see the same data.

## Phase 7 — Add structured Decisions and accountable Action Items

**Objective:** Convert discussion into explicit outcomes and responsibilities.

**Decision UI:**

- Add decision, decision owner/approver, rationale, affected context, source topic, and status.
- Distinguish proposed, confirmed, superseded, and rejected decisions.
- Make decisions searchable and visible in project/task/milestone history.

**Action-item UI:**

- Add title, description, owner, due date, priority, status, source topic/decision, and related work.
- Require owner and due date before review/finalization, with an explicit exception for “No due date.”
- Show open, due-soon, overdue, completed, and linked-task states.
- Reconcile deletions when saving rows.

**Deliverables:** Decisions section, Action Items section, validation rules, persistence helpers, and unit tests.

**Gate:** Finalization is blocked when an actionable item lacks required accountability data.

## Phase 8 — Implement task and milestone linking with Add to Task

**Objective:** Make MOM follow-up operational without duplicating project work.

**Task behavior:**

- Add **Add to Task** at the action-item level and as a bulk action.
- Create one task per eligible action item.
- Skip items already linked to a task.
- Require or clearly explain missing due dates.
- Preserve the source MOM/action-item link on the created task.
- Return created/skipped/failed results with retry support.
- Allow selecting an existing task instead of creating a new one.

**Milestone behavior:**

- Link decisions and action items to existing milestones.
- Expose milestone selection from the MOM editor.
- Show linked MOM context on milestone detail.

**Backend safeguards:**

- Use idempotency keys or a unique relation constraint to prevent duplicate task creation.
- Enforce organization/project ownership for task and milestone links.
- Use transaction boundaries or compensating updates so a task is not created without its source relation.

**Deliverables:** Add to Task controls, existing-task selector, milestone selector, link relation API, sync result model, and integration tests.

**Gate:** Repeated clicks, retries, and refreshes do not create duplicate tasks.

## Phase 9 — Implement permission-aware global and contextual search

**Objective:** Find a past discussion quickly and open the exact context.

**Searchable content:**

- Meeting overview, type labels, agenda, topic notes, decisions, action-item text, attendee names/organizations, linked client/project/task/milestone names, and eligible attachment text where available.
- Drafts are visible only to users with draft permission.
- Finalized versions remain searchable as immutable records.

**Search experience:**

- Organization-wide search by default.
- Contextual default filters when opened from a client, project, task, milestone, or site workflow.
- Filters for date range, meeting type, client, project, attendee, status, task, milestone, and version.
- Exact and partial keyword matching first; semantic/synonym matching behind a replaceable search interface.
- Result highlighting, source labels, snippets, and deep links to the exact topic/decision/action item/attachment page.

**Backend slices:**

- Deterministic search projection or database full-text index.
- Permission filtering before ranking or result return.
- Debounced query endpoint with pagination and stable ranking.
- Search indexing events after draft save and finalization.

**Deliverables:** global search page, contextual search panel, search index/projection, filters, deep links, and search tests.

**Gate:** Representative historical queries return the correct MOM and context within the agreed 30-second user goal.

## Phase 10 — Add project, task, milestone, and site-engineer discussion history surfaces

**Objective:** Put MOM context where execution users already work.

**Surfaces:**

- Project page: Meetings and Decisions timeline.
- Task detail: Meeting history panel with linked topic/decision/action-item excerpts.
- Milestone detail: Related MOMs and decision history.
- Site workflow: relevant project/client/site discussions with date and source links.
- Global notifications: concise discussion excerpt on newly assigned task or milestone.

**UX rules:**

- Keep context panels lightweight and paginated.
- Show archived related records with a clear label.
- Deep-link to exact MOM content.
- Respect the viewer’s permission scope.

**Deliverables:** reusable `MeetingHistoryPanel`, `MeetingContextTimeline`, task/milestone integrations, and access tests.

**Gate:** A site engineer can open a task or milestone and trace it back to the relevant MOM without navigating through unrelated modules.

## Phase 11 — Build Live Capture and offline draft synchronization

**Objective:** Support fast meeting capture in the field without risking silent data loss.

**Live Capture:**

- Start from a scheduled meeting or create an ad hoc meeting.
- Quick-add topic, note, decision, and action item controls.
- Keyboard-first desktop behavior and touch-friendly mobile layout.
- Minimal required fields during capture; enforce completeness at review/finalization.
- Autosave indicator and explicit offline/online status.

**Offline model:**

- Cache permitted meeting drafts locally.
- Queue mutations with operation IDs.
- Replay operations when online.
- Preserve conflicting edits and present a conflict resolver; never silently overwrite.
- Disable finalization and external sharing until synchronization succeeds.

**Deliverables:** Live Capture page/mode, local draft store, sync queue, conflict UI, and offline tests.

**Gate:** A site engineer can capture notes offline, close the app, reconnect later, and recover the complete draft without silent loss.

## Phase 12 — Implement review, immutable finalization, amendments, and sharing

**Objective:** Turn drafts into trusted records and controlled external outputs.

**Workflow:**

- Draft → In Review → Finalized → Superseded/Amended.
- Reviewer can comment/request changes.
- Finalization requires required decision/action-item fields and successful sync.
- Finalized content is read-only.
- Amendment creates a new version linked to the original.
- External sharing selects the approved version and approved content.

**Sharing:**

- Secure read-only link or PDF for external clients.
- No account required for external recipients in the first version.
- No internal notes, private attachments, or unapproved action metadata in external output.
- Expiration/revocation hooks should be designed even if advanced retention is deferred.

**Deliverables:** review state UI, version viewer, amendment flow, sharing controls, PDF/print output, and audit tests.

**Gate:** A finalized MOM cannot be silently changed, and an external recipient cannot access internal-only context.

## Phase 13 — Add automatic reminders, escalations, and notification preferences

**Objective:** Ensure action items remain active after the meeting.

**Automation:**

- Notify owner on assignment.
- Remind before due date.
- Mark overdue automatically.
- Escalate overdue items to meeting owner/project manager.
- Show open/due-soon/overdue counts in dashboards and project views.
- Avoid duplicate notifications through event IDs and idempotent jobs.

**Preferences:**

- Organization defaults for reminder timing, escalation recipients, and channels.
- User-level overrides for in-app/email/digest preferences.
- Critical safety/compliance notifications remain visible and cannot be silently muted.

**Deliverables:** notification events, scheduled jobs, preference UI, escalation rules, and delivery tests.

**Gate:** A test action item generates exactly the intended assignment, reminder, and escalation events.

## Phase 14 — Add basic attachment handling and defer advanced OCR/search policies

**Objective:** Provide reliable reference-file support without expanding scope into a separate document-management system.

**First release:**

- Private organization-scoped storage.
- Attach PDF, image, drawing, photo, and office-document metadata.
- Show file name, type, size, uploader, and linked MOM version.
- Permission-aware download and removal.
- Audit upload/download/removal events.

**Deferred:**

- OCR pipeline for scanned documents and images.
- Attachment semantic search.
- Complex legal/safety retention policies.
- Automatic translation.

**Deliverables:** upload/download UI, storage policies, attachment relations, and basic security tests.

**Gate:** Attachments cannot be accessed across organizations or through an external share unless explicitly included.

## Phase 15 — Retire the legacy Meetings implementation after verification

**Objective:** Remove duplicate code only after the canonical flow is proven.

**Sequence:**

1. Confirm all old routes map to canonical routes or are intentionally removed.
2. Confirm sidebar and module registry point only to the canonical module.
3. Confirm data migration and history links are complete.
4. Remove `src/pages/Meetings.tsx` and unused legacy imports/components.
5. Remove obsolete SQL/API paths only after database usage verification.
6. Search the repository for old route and table references.

**Deliverables:** cleanup commit, route-reference report, dead-code report, and regression results.

**Gate:** No production navigation or supported integration depends on the deleted legacy page.

## Phase 16 — Run integration, security, accessibility, performance, and regression validation

**Objective:** Validate the complete feature without relying on a single large build as the only quality gate.

**Test layers:**

| Layer | Coverage |
|---|---|
| Unit | Validation, search tokenization, version transitions, sync result accounting, notification rules. |
| API/data | Organization isolation, project permissions, idempotent linking, migration reconciliation, audit events. |
| Component | Editor sections, action-item controls, Add to Task states, decisions, filters, empty/loading/error states. |
| Integration | Create → edit → link → review → finalize → share → search → task history. |
| Offline | Queue replay, retries, conflicts, reconnect, duplicate prevention. |
| Accessibility | Keyboard navigation, focus management, labels, dialogs, screen-reader states, responsive layout. |
| Performance | Search latency, large meeting lists, long MOMs, history panels, pagination, notification jobs. |
| Security | RLS, private storage, external share boundaries, audit immutability, permission inheritance. |

**Release acceptance:**

- Search finds representative discussion in under 30 seconds for a trained user.
- At least 90% of finalized action items have an owner and due date.
- No finalized MOM is silently edited or lost.
- No duplicate task is created through retries or repeated clicks.
- Site engineers can reach related MOM context from task/milestone pages.
- Offline capture recovers without silent data loss.
- External recipients see only approved read-only content.

**Gate:** Release is blocked by cross-organization access, silent data loss, duplicate task creation, broken finalization invariants, or inaccessible critical workflows.

## Phase 17 — Deliver the release roadmap and checklist

**Objective:** Produce the implementation package needed for execution and review.

**Final deliverables:**

- Feature charter and glossary.
- ERD and migration plan.
- Permission/version/audit specification.
- API and UI contracts.
- Phase-by-phase issue breakdown.
- Test matrix and acceptance checklist.
- Legacy cleanup checklist.
- Rollout plan with feature flags and rollback criteria.
- Monitoring dashboard definition for search latency, sync failures, notification failures, and permission errors.

## Suggested issue breakdown

Each phase should be decomposed into small issues that can be reviewed independently. A typical issue should change one bounded concern, such as one migration, one API contract, one UI section, one search projection, or one integration surface.

| Issue type | Example |
|---|---|
| Schema | Add `meeting_decisions` table and RLS policies. |
| API | Add typed decision list/create/update procedures. |
| UI | Add Decisions card to the MOM editor. |
| Integration | Show decisions in project timeline. |
| Search | Index decision text and return deep links. |
| Automation | Emit action-item assignment notification. |
| Validation | Add permission and idempotency tests. |
| Cleanup | Remove legacy route after route matrix passes. |

Avoid issues that combine schema migration, API design, editor redesign, search indexing, notifications, and legacy deletion in one change.

## Recommended first implementation sprint

The first sprint should not attempt to build the entire roadmap. It should establish the foundation and produce a thin vertical slice:

1. Confirm the feature charter and route inventory.
2. Add the normalized decisions and explicit link model without removing legacy code.
3. Add a single canonical MOM editor slice with discussion, one decision, and one action item.
4. Persist drafts with permissions and audit events.
5. Add the first Add to Task flow with idempotent linking.
6. Add one contextual history panel on task detail.
7. Write integration tests for create, save, link, search-context placeholder, and finalization rules.

This first sprint should end with a working, reviewable MOM slice and a stable foundation—not a partially implemented all-in-one rewrite.

## References

[1]: file:///home/ubuntu/mep-project/apps/web/src/App.tsx "Application routes and Meetings deep links"

[2]: file:///home/ubuntu/mep-project/apps/web/src/meetings/pages/MeetingsList.tsx "Active Meetings list page"

[3]: file:///home/ubuntu/mep-project/apps/web/src/pages/Meetings.tsx "Legacy Meetings page"

[4]: file:///home/ubuntu/mep-project/apps/web/src/meetings/pages/MeetingMinutesEditor.tsx "Current Minutes of Meeting editor"

[5]: file:///home/ubuntu/mep-project/apps/web/src/meetings/api/meetings.ts "Meetings API and task synchronization"

[6]: file:///home/ubuntu/mep-project/apps/web/src/database-meetings-mom.sql "MOM schema enhancement and RLS policies"

[7]: file:///home/ubuntu/mep-project/apps/web/src/database-unified-tasks.sql "Unified task schema and policies"
