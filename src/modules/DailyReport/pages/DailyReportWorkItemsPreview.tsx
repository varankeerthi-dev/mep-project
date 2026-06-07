// ============================================
// DailyReportWorkItemsPreview — Phase 1f
// ============================================
// Standalone test page for Phase 1. Lets you verify the typeahead +
// work-item row components in isolation, against real Supabase data,
// WITHOUT touching src/pages/SiteReport.tsx.
//
// Mounted at /__preview/daily-report-work-items (see App.tsx change
// in this same commit). The route is gated by VITE_DAILY_REPORTS_V2.
// ============================================

import { useState } from 'react';
import { Plus, RefreshCw, Database, ListChecks } from 'lucide-react';
import { WorkItemRow } from '../components/WorkItemRow';
import { useAuth } from '@/App';
import { useDailyReportWorkItems } from '@/hooks/useDailyReportWorkItems';
import type { DailyReportWorkItem } from '@/hooks/useDailyReportWorkItems';
import { IS_DAILY_REPORTS_V2 } from '../feature-flag';

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
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-400">
            <Database className="h-3 w-3" />
            {items.length} row{items.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

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

      {/* Rows */}
      <section className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
            No work items yet. Click one of the buttons above to add a row.
          </div>
        ) : (
          items.map((item) => (
            <WorkItemRow
              key={item.id}
              item={item}
              organisationId={organisation?.id ?? null}
              projectId={projectId || null}
              locked={locked}
              onChange={(patch) => updateItem(item.id, patch)}
              onDelete={() => deleteItem(item.id)}
              onRequestCreateTask={(initial) => {
                // Phase 1: surface the request in the console
                // Phase 2: opens TaskMiniDrawer
                // eslint-disable-next-line no-console
                console.log('[preview] Request create task:', initial);
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
          <li>Drag the progress slider — it should debounce-save (console warning in Phase 1).</li>
          <li>Click the task picker on a linked item — typeahead opens, recency-ranks open tasks.</li>
          <li>If a real project UUID is in the input, the typeahead queries Supabase.</li>
          <li>Press <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">Enter</kbd> to save, <kbd className="rounded border border-zinc-300 bg-white px-1 font-mono">Esc</kbd> to cancel.</li>
          <li>Toggle "Simulate locked report" — all cells become read-only, lock icon appears.</li>
        </ul>
      </footer>
    </div>
  );
}
