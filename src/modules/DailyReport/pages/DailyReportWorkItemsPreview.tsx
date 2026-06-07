// ============================================
// DailyReportWorkItemsPreview — Phase 1f + 5.2 (T9) + 5.3 (T10)
// ============================================
// Standalone test page for Phase 1. Lets you verify the typeahead +
// work-item row components in isolation, against real Supabase data,
// WITHOUT touching src/pages/SiteReport.tsx.
//
// Mounted at /__preview/daily-report-work-items (see App.tsx change
// in this same commit). The route is gated by VITE_DAILY_REPORTS_V2.
//
// Phase 5.2 (T9) — keyboard nav grid (role="grid", arrow keys).
// Phase 5.3 (T10) — offline draft auto-save + restore with conflict.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Database, ListChecks, WifiOff, AlertTriangle, X } from 'lucide-react';
import { WorkItemRow, WORK_ITEM_ROW_COL_COUNT } from '../components/WorkItemRow';
import { TaskMiniDrawer } from '../components/TaskMiniDrawer';
import { useAuth } from '@/App';
import { useDailyReportWorkItems } from '@/hooks/useDailyReportWorkItems';
import type { DailyReportWorkItem } from '@/hooks/useDailyReportWorkItems';
import type { ProjectTaskSlim } from '@/hooks/useTasksForProject';
import type { TaskDiscipline } from '@/components/tasks/types';
import { IS_DAILY_REPORTS_V2 } from '../feature-flag';
import { useGridNavigation } from '@/hooks/useGridNavigation';
import { useOfflineDraft, buildSiteReportDraftKey } from '@/hooks/useOfflineDraft';
import { toast } from '@/lib/logger';

function makeFakeItem(
  organisationId: string,
  reportId: string,
  overrides: Partial<DailyReportWorkItem> = {}
): DailyReportWorkItem {
  return {
    id: overrides.id ?? `fake-${Math.random().toString(36).slice(2)}`,
    organisation_id: organisationId,
    daily_report_id: reportId,
    task_id: overrides.task_id ?? null,
    ad_hoc_title: overrides.ad_hoc_title ?? null,
    ad_hoc_discipline: overrides.ad_hoc_discipline ?? null,
    kind: overrides.kind ?? 'work',
    progress_before: overrides.progress_before ?? null,
    progress_after: overrides.progress_after ?? null,
    status_before: overrides.status_before ?? null,
    status_after: overrides.status_after ?? 'not_started',
    quantity_done: overrides.quantity_done ?? null,
    quantity_unit: overrides.quantity_unit ?? null,
    note: overrides.note ?? null,
    blocker_flag: overrides.blocker_flag ?? false,
    blocker_reason: overrides.blocker_reason ?? null,
    sort_order: overrides.sort_order ?? 0,
    created_by: overrides.created_by ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
    deleted_at: null,
  };
}

export default function DailyReportWorkItemsPreview() {
  const { organisation, user } = useAuth();

  // Pick a project. For Phase 1 preview we let the user pick from a small
  // list, fetched once. We keep this page offline-friendly: if no
  // project list is reachable, we still render with a fake project id
  // so the components can be inspected.
  const [projectId, setProjectId] = useState<string>('');
  const [reportId, setReportId] = useState<string>(
    'preview-' + Math.random().toString(36).slice(2, 9)
  );
  const [items, setItems] = useState<DailyReportWorkItem[]>([]);
  const [locked, setLocked] = useState(false);
  const [createTaskFor, setCreateTaskFor] = useState<
    | { itemId: string; initialTitle: string }
    | null
  >(null);

  // ============================================
  // T9 — Keyboard nav grid (Phase 5.2)
  // ============================================
  // The parent owns the active cell state so Up/Down can move
  // between rows. Roving tabindex is enabled (alwaysTabStop=false)
  // so the grid is a single tab stop. This is the WAI-ARIA
  // Authoring Practices grid pattern.
  const grid = useGridNavigation({
    rowCount: items.length,
    colCount: WORK_ITEM_ROW_COL_COUNT,
    initial: { row: 0, col: 0 },
    alwaysTabStop: false,
  });

  // ============================================
  // T10 — Offline draft (Phase 5.3)
  // ============================================
  // The structured daily-report work-items list survives an
  // app reload via localStorage. FR-13:
  //   key  = site-report-draft:{projectId}:{date}:{userId}
  //   ttl  = 24h
  //   debounce = 1.5s
  //   conflict = server.updated_at newer than draft.savedAt
  // The preview page can use the fake `projectId` (or a real
  // one if the engineer pasted it) to demonstrate the loop.
  const reportDate = useMemo(
    () => new Date().toISOString().split('T')[0],
    []
  );
  const draftKey = useMemo(
    () =>
      buildSiteReportDraftKey({
        projectId: projectId || null,
        date: reportDate,
        userId: user?.id ?? null,
      }),
    [projectId, reportDate, user?.id]
  );
  const draft = useOfflineDraft<DailyReportWorkItem[]>({
    storageKey: draftKey,
    data: items,
    // For the preview, we have no server updated_at — skip
    // conflict detection. The real SiteReport.tsx will pass
    // the report's `updated_at` as a number.
    serverTimestamp: null,
  });

  // If a draft is restored, swap it in. We keep the items
  // state authoritative; the user clicks "Restore" explicitly.
  const [pendingDraft, setPendingDraft] = useState<DailyReportWorkItem[] | null>(null);
  useEffect(() => {
    if (draft.hasDraft && draft.draft && items.length === 0) {
      // Defer the prompt to the next paint so the user sees the
      // page first, then the "Restore draft?" banner.
      setPendingDraft(draft.draft);
    }
  }, [draft.hasDraft, draft.draft, items.length]);

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    setItems(pendingDraft);
    setPendingDraft(null);
    toast.success('Draft restored.');
  };
  const handleDiscardDraft = () => {
    draft.discard();
    setPendingDraft(null);
  };

  // Optional: try to load a real project's tasks (skips the query if no
  // project is chosen — the work-item row still renders for inspection)
  // Real query is wired through the typeahead; we don't need it here.

  if (!IS_DAILY_REPORTS_V2) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-lg font-semibold">Feature flag is off</h1>
          <p className="mt-2 text-sm">
            Set <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">VITE_DAILY_REPORTS_V2=1</code> in
            your <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env.local</code> and restart
            the dev server to see the Phase 1 preview.
          </p>
        </div>
      </div>
    );
  }

  const addLinkedItem = () => {
    setItems((prev) => [
      ...prev,
      makeFakeItem(organisation?.id ?? 'preview-org', reportId, {
        id: `linked-${prev.length}-${Math.random().toString(36).slice(2)}`,
        kind: 'work',
        sort_order: prev.length,
        status_after: 'in_progress',
        progress_after: 0,
      }),
    ]);
  };

  const addAdHocItem = () => {
    setItems((prev) => [
      ...prev,
      makeFakeItem(organisation?.id ?? 'preview-org', reportId, {
        id: `adhoc-${prev.length}-${Math.random().toString(36).slice(2)}`,
        task_id: null,
        ad_hoc_title: '',
        kind: 'work',
        sort_order: prev.length,
      }),
    ]);
  };

  const addMilestoneItem = () => {
    setItems((prev) => [
      ...prev,
      makeFakeItem(organisation?.id ?? 'preview-org', reportId, {
        id: `mile-${prev.length}-${Math.random().toString(36).slice(2)}`,
        kind: 'milestone',
        status_after: 'completed',
        progress_after: 100,
        sort_order: prev.length,
      }),
    ]);
  };

  const updateItem = (id: string, patch: Partial<DailyReportWorkItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch, updated_at: new Date().toISOString() } : it))
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-zinc-900">
            Phase 1 preview — Daily Report Work Items
          </h1>
        </div>
        <p className="text-sm text-zinc-500">
          Standalone test page. Phase 1 is read-only — inline edit cells
          log a console warning when you change a value. No data is sent
          to Supabase from this page (a fake <code className="font-mono">reportId</code> is used).
        </p>
      </header>

      {/* Controls */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700">Organisation</span>
            <input
              type="text"
              readOnly
              value={organisation?.id ?? '— (not logged in)'}
              className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700">Project ID (real or fake)</span>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Paste a real project UUID to test the typeahead…"
              className="rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-zinc-700">Report ID (fake)</span>
            <input
              type="text"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              className="rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setLocked(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600"
            />
            <span>Simulate locked report (post-approval)</span>
          </label>
          {/* T10 — offline draft saving indicator */}
          {draftKey && (
            <span
              className="ml-auto inline-flex items-center gap-2 text-[10px] text-zinc-400"
              data-testid="offline-draft-status"
              aria-live="polite"
            >
              <Database className="h-3 w-3" />
              <span>{items.length} row{items.length === 1 ? '' : 's'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {draft.isPending
                  ? 'Saving draft…'
                  : draft.savedAt
                  ? `Draft ${formatRelative(draft.savedAt)}`
                  : 'No draft yet'}
              </span>
            </span>
          )}
          {!draftKey && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-400">
              <Database className="h-3 w-3" />
              {items.length} row{items.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </section>

      {/* T10 — Restore draft banner (Phase 5.3). Shown when a
          non-stale draft is detected in localStorage on mount.
          Replaced by the conflict UI when the server's
          updated_at is newer than the draft's savedAt. */}
      {pendingDraft && (
        <section
          data-testid="offline-draft-banner"
          role={draft.hasConflict ? 'alert' : 'status'}
          className={
            draft.hasConflict
              ? 'flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'
              : 'flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700'
          }
        >
          {draft.hasConflict ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          ) : (
            <WifiOff className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {draft.hasConflict
                ? 'Server has newer changes'
                : `Restore ${pendingDraft.length} unsaved item${pendingDraft.length === 1 ? '' : 's'}?`}
            </div>
            <div className="text-xs opacity-80">
              {draft.hasConflict
                ? 'Your local draft is older than the server. Keep yours or replace with server data.'
                : draft.savedAt
                ? `Draft saved ${formatRelative(draft.savedAt)} to this device.`
                : 'A draft was found on this device.'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-800 hover:bg-blue-100"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {draft.hasConflict ? 'Use server' : 'Discard'}
            </button>
            <button
              type="button"
              onClick={() => setPendingDraft(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Add buttons */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addLinkedItem}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add linked work item
        </button>
        <button
          type="button"
          onClick={addMilestoneItem}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Add milestone
        </button>
        <button
          type="button"
          onClick={addAdHocItem}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add ad-hoc work item
        </button>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setItems([])}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </section>

      {/* Rows — T9: role="grid" wraps the row list, each WorkItemRow
          is role="row" with arrow-key nav via useGridNavigation. */}
      <section
        className="space-y-2"
        role="grid"
        aria-label="Daily report work items"
        aria-rowcount={items.length === 0 ? 0 : items.length}
        aria-colcount={WORK_ITEM_ROW_COL_COUNT}
        onKeyDown={grid.onRowKeyDown}
      >
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
            No work items yet. Click one of the buttons above to add a row.
          </div>
        ) : (
          items.map((item, idx) => (
            <WorkItemRow
              key={item.id}
              item={item}
              organisationId={organisation?.id ?? null}
              projectId={projectId || null}
              locked={locked}
              rowIndex={idx}
              grid={grid}
              onChange={(patch) => updateItem(item.id, patch)}
              onDelete={() => deleteItem(item.id)}
              onRequestCreateTask={(initial) => {
                setCreateTaskFor({
                  itemId: item.id,
                  initialTitle: initial ?? '',
                });
              }}
            />
          ))
        )}
      </section>

      {/* Footer note */}
      <footer className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-xs text-zinc-500">
        <p>
          <strong>What to test:</strong>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Click any cell — it should turn into an input.</li>
          <li>Drag the progress slider — it should debounce-save (optimistic in Phase 2).</li>
          <li>Click the task picker on a linked item — typeahead opens, recency-ranks open tasks.</li>
          <li>Click the <span className="font-mono">→</span> icon next to a task chip — TaskDetailDrawer opens.</li>
          <li>Click <span className="font-mono">+ New task</span> in the typeahead — TaskMiniDrawer opens with the search string pre-filled.</li>
          <li>If a real project UUID is in the input, the typeahead queries Supabase.</li>
          <li>Press <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">Enter</kbd> to save, <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">Esc</kbd> to cancel.</li>
          <li>Toggle "Simulate locked report" — all cells become read-only.</li>
          <li>
            Items are debounce-saved (1.5s) to{' '}
            <code className="font-mono">localStorage</code> under{' '}
            <code className="font-mono">site-report-draft:&#123;projectId&#125;:&#123;date&#125;:&#123;userId&#125;</code>{' '}
            (T10). Reload the page to see the "Restore draft?" prompt.
          </li>
          <li>Press <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">Tab</kbd> to step through cells, <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">←</kbd>/<kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">→</kbd> to move within a row, <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">↑</kbd>/<kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">↓</kbd> between rows (T9).</li>
        </ul>
      </footer>

      {/* TaskMiniDrawer (Phase 2.3) — opens from the typeahead's
          "+ New task" footer. On create, snaps the row to in_progress
          at 30% and links the new task_id. */}
      {createTaskFor && (
        <TaskMiniDrawer
          projectId={projectId || null}
          initialTitle={createTaskFor.initialTitle}
          preferredDiscipline={
            (items.find((it) => it.id === createTaskFor.itemId)
              ?.ad_hoc_discipline as TaskDiscipline | null) ?? null
          }
          onCreated={(task: ProjectTaskSlim) => {
            updateItem(createTaskFor.itemId, {
              task_id: task.id,
              status_after: 'in_progress',
              progress_after: 30,
            });
            setCreateTaskFor(null);
          }}
          onClose={() => setCreateTaskFor(null)}
        />
      )}
    </div>
  );
}

// ============================================
// SMALL HELPERS
// ============================================

/** Human-friendly "saved 3m ago" formatter for the offline draft banner. */
function formatRelative(savedAt: number): string {
  const diff = Date.now() - savedAt;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
