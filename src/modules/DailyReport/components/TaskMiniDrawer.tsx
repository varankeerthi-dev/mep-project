// ============================================
// TaskMiniDrawer — Phase 2.3 (T4)
// ============================================
// Slim inline task creation drawer used by the daily-report flow.
// Mirrors the right-edge slide pattern of TaskDetailDrawer but
// keeps the form short on purpose: an engineer in the field
// needs the "create new task and link to this work-item row"
// flow to feel like one tap, not five.
//
// Layout:
//   - 480px wide right-edge slide-in
//   - 4 sections, 2 visible by default (Title, Discipline) and
//     2 collapsed (Priority, Assignees)
//   - Sticky footer with Cancel + Create
//   - On submit:
//       1. useCreateTask (with organisation_id, created_by)
//       2. Parent receives the new task via onCreated()
//       3. Parent persists { task_id, status_after:'in_progress',
//          progress_after: 30 } on the work-item row, and shows
//          a "Task T-XXXX created. Marked 30% — adjust if needed."
//          toast.
//   - If a similarly-titled open task exists in `possibleMatches`,
//     a "Looks similar to T-XXXX 'title'. Link to it instead?"
//     warning is shown above the footer with a [Link] shortcut.
//
//   Touch targets are 44px throughout (DESIGN.md / WCAG 2.5.5).
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateTask } from '@/components/tasks/hooks';
import {
  DISCIPLINE_CONFIG,
  PRIORITY_CONFIG,
  type TaskDiscipline,
  type TaskPriority,
} from '@/components/tasks/types';
import { useMyDiscipline } from '@/hooks/useMyDiscipline';
import { useTasksForProject, type ProjectTaskSlim } from '@/hooks/useTasksForProject';
import { toast } from '@/lib/logger';

// ============================================
// PROPS
// ============================================

export interface TaskMiniDrawerProps {
  projectId: string | null | undefined;
  organisationId?: string | null | undefined;
  /** Pre-fill from the typeahead's search string. */
  initialTitle?: string;
  /** Soft default discipline (e.g. from a previous row or org role). */
  preferredDiscipline?: TaskDiscipline | null;
  /**
   * Tasks the typeahead has already loaded for this project. The
   * drawer uses these to surface a duplicate-task warning before
   * create. Pass an empty array if not available.
   */
  possibleMatches?: ProjectTaskSlim[];
  /** Notified on successful create. */
  onCreated: (task: ProjectTaskSlim) => void;
  onClose: () => void;
}

// ============================================
// DISCIPLINE / PRIORITY OPTIONS
// ============================================

const DISCIPLINE_OPTIONS: { value: string; label: string }[] = (
  Object.entries(DISCIPLINE_CONFIG) as [TaskDiscipline, { label: string; color: string }][]
).map(([value, cfg]) => ({ value, label: cfg.label }));

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = (
  Object.entries(PRIORITY_CONFIG) as [TaskPriority, { label: string }][]
).map(([value, cfg]) => ({ value, label: cfg.label }));

// ============================================
// HELPERS
// ============================================

/**
 * Trivial fuzzy match: substring of either side, case-insensitive,
 * and a coarse Jaccard on word-set ≥ 0.5. Good enough to catch
 * "Install AHU" vs "AHU install" without false positives across
 * distinct topics.
 */
function titlesAreSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let inter = 0;
  for (const w of wordsA) if (wordsB.has(w)) inter++;
  const jaccard = inter / (wordsA.size + wordsB.size - inter);
  return jaccard >= 0.5;
}

function findSimilarTask(
  title: string,
  candidates: ProjectTaskSlim[]
): ProjectTaskSlim | null {
  if (!title.trim()) return null;
  let best: ProjectTaskSlim | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (c.status === 'completed' || c.status === 'cancelled') continue;
    if (!titlesAreSimilar(title, c.title)) continue;
    const norm = (s: string) => s.trim().toLowerCase();
    const a = norm(title);
    const b = norm(c.title);
    const score = (a === b ? 2 : 0) + (a.includes(b) || b.includes(a) ? 1 : 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

// ============================================
// COMPONENT
// ============================================

export function TaskMiniDrawer({
  projectId,
  organisationId,
  initialTitle = '',
  preferredDiscipline = null,
  possibleMatches = [],
  onCreated,
  onClose,
}: TaskMiniDrawerProps) {
  const { user, organisation: orgFromContext, selectedOrganisation } = useAuth();
  const resolvedOrgId = organisationId ?? selectedOrganisation?.id ?? orgFromContext?.id ?? null;

  // Form state
  const [title, setTitle] = useState(initialTitle);
  const [discipline, setDiscipline] = useState<TaskDiscipline | null>(preferredDiscipline);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus the title field on open
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  // Discipline inference from org_members.role
  const { discipline: inferredDiscipline, isLoading: disciplineLoading } = useMyDiscipline(
    resolvedOrgId,
    user?.id ?? null
  );

  // Pre-fill discipline if not already set
  useEffect(() => {
    if (!discipline && (preferredDiscipline || inferredDiscipline)) {
      setDiscipline(preferredDiscipline ?? inferredDiscipline);
    }
  }, [discipline, preferredDiscipline, inferredDiscipline]);

  // Refresh the duplicate-match candidates. If we got an empty
  // array from the typeahead, fetch a small fresh list so the
  // warning actually fires.
  const { data: liveMatches = [] } = useTasksForProject({
    organisationId: resolvedOrgId,
    projectId,
    search: title,
    limit: 30,
    enabled: !!resolvedOrgId && !!projectId && possibleMatches.length === 0,
  });
  const candidates = useMemo(
    () => (possibleMatches.length > 0 ? possibleMatches : liveMatches),
    [possibleMatches, liveMatches]
  );

  const similar = useMemo(
    () => findSimilarTask(title, candidates),
    [title, candidates]
  );

  const createMutation = useCreateTask();

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.warning('Title is required.');
      titleRef.current?.focus();
      return;
    }
    if (!resolvedOrgId || !user?.id) {
      toast.error('Missing org or user context. Cannot create task.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createMutation.mutateAsync({
        organisation_id: resolvedOrgId,
        created_by: user.id,
        project_id: projectId ?? null,
        title: trimmed,
        status: 'not_started',
        priority,
        task_type: 'task',
        discipline: discipline ?? null,
        assignee_ids: assigneeIds.length > 0 ? assigneeIds : [],
        // The note from the work-item row is intentionally NOT copied
        // here — the row's note belongs to the report, not the task.
      });
      toast.success(
        `Task #${created.task_no ?? '—'} created. Marked 30% — adjust if needed.`
      );
      onCreated(created as unknown as ProjectTaskSlim);
    } catch (e: any) {
      toast.error(`Create failed: ${e?.message || 'unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkSimilar = () => {
    if (!similar) return;
    // Skip create; the parent will persist the existing task_id.
    onCreated(similar);
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => !submitting && onClose()}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-mini-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="task-mini-drawer-title"
              className="text-sm font-semibold text-zinc-900"
            >
              New task
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Title (always visible, focused on open) */}
          <div className="mb-4">
            <label
              htmlFor="task-mini-title"
              className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
            >
              Title
            </label>
            <input
              ref={titleRef}
              id="task-mini-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Install AHU-01 on Level 3"
              disabled={submitting}
              maxLength={200}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>

          {/* Discipline (always visible) */}
          <div className="mb-4">
            <label
              htmlFor="task-mini-discipline"
              className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
            >
              Discipline
            </label>
            <select
              id="task-mini-discipline"
              value={discipline ?? ''}
              onChange={(e) =>
                setDiscipline((e.target.value || null) as TaskDiscipline | null)
              }
              disabled={submitting}
              className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              style={
                discipline
                  ? {
                      borderLeft: `3px solid ${
                        DISCIPLINE_CONFIG[discipline]?.color || '#6b7280'
                      }`,
                    }
                  : undefined
              }
            >
              <option value="">
                {disciplineLoading ? 'Loading…' : 'Select discipline'}
              </option>
              {DISCIPLINE_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            {discipline && (
              <p className="mt-1 text-[11px] text-zinc-500">
                Inferred from your role. Change if needed.
              </p>
            )}
          </div>

          {/* Priority (collapsed under "Advanced") */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex h-9 items-center gap-1 rounded text-xs font-medium text-zinc-600 hover:text-zinc-900"
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {showAdvanced ? 'Hide details' : 'Show details'}
            </button>
          </div>

          {showAdvanced && (
            <div className="mb-4 space-y-4 rounded-md border border-zinc-100 bg-zinc-50/50 p-3">
              {/* Priority */}
              <div>
                <label
                  htmlFor="task-mini-priority"
                  className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                >
                  Priority
                </label>
                <select
                  id="task-mini-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  disabled={submitting}
                  className="h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignees — minimal single-select list (full MultiSelect lives in TaskCreateDrawer) */}
              <div>
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Assign to me
                </span>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:border-zinc-300">
                  <input
                    type="checkbox"
                    checked={assigneeIds.length > 0 && assigneeIds[0] === user?.id}
                    onChange={(e) =>
                      setAssigneeIds(
                        e.target.checked && user?.id ? [user.id] : []
                      )
                    }
                    disabled={submitting || !user?.id}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600"
                  />
                  <span>Me ({user?.email ?? 'current user'})</span>
                </label>
                <p className="mt-1 text-[11px] text-zinc-500">
                  For more assignees, edit the task after creation.
                </p>
              </div>
            </div>
          )}

          {/* Duplicate-task warning (T5) */}
          {similar && (
            <div
              className={cn(
                'mt-2 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3'
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-900">
                  Looks similar to{' '}
                  <span className="font-mono font-medium">
                    {similar.task_no != null ? `T-${similar.task_no}` : 'existing task'}
                  </span>{' '}
                  “{similar.title}”. Link to it instead?
                </p>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <button
                  type="button"
                  onClick={handleLinkSimilar}
                  disabled={submitting}
                  className="inline-flex h-9 items-center rounded-md border border-amber-300 bg-white px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  Link
                </button>
                <button
                  type="button"
                  onClick={() => {/* keep typing */}}
                  className="inline-flex h-9 items-center rounded-md px-2.5 text-xs text-amber-700 hover:bg-amber-100"
                >
                  Create anyway
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || !title.trim()}
            className={cn(
              'inline-flex h-11 items-center gap-1.5 rounded-md px-4 text-sm font-medium text-white transition-colors',
              !submitting && title.trim()
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-zinc-300'
            )}
          >
            {submitting ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Create task
              </>
            )}
          </button>
        </footer>
      </div>
    </>
  );
}

export default TaskMiniDrawer;
