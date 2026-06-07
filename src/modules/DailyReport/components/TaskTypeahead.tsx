// ============================================
// TaskTypeahead — Phase 1c
// ============================================
// Project-scoped task picker for the daily-report work-item row.
// Recency-ranks open tasks on top, soft-sorts by reporter discipline,
// supports keyboard nav, and exposes a "+ New task" footer that
// the parent uses to open the TaskMiniDrawer (Phase 2).
//
// Phase 1 ships the typeahead in READ-ONLY mode (no creation).
// The "+ New task" button shows a toast for now; the drawer wires up
// in Phase 2.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTasksForProject, type ProjectTaskSlim } from '@/hooks/useTasksForProject';
import type { TaskStatus } from '@/components/tasks/types';

export interface TaskTypeaheadProps {
  organisationId: string | null | undefined;
  projectId: string | null | undefined;
  /** Currently selected task id (controlled) */
  value: string | null;
  onChange: (taskId: string | null, task: ProjectTaskSlim | null) => void;
  preferredDiscipline?: string | null;
  disabled?: boolean;
  /** Render in compact mode (used inside dense work-item rows) */
  compact?: boolean;
  /** Phase 2 wires this to TaskMiniDrawer; Phase 1 shows a placeholder */
  onRequestCreate?: (initialTitle?: string) => void;
}

// Map the task module's STATUS_CONFIG dot colors to a small palette
const STATUS_DOT: Record<string, string> = {
  not_started: 'bg-zinc-400',
  in_progress: 'bg-blue-500',
  under_review: 'bg-amber-500',
  on_hold: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-500',
};

const PRIORITY_DOT: Record<string, string> = {
  None: 'bg-zinc-300',
  low: 'bg-sky-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const TYPE_ICON: Record<string, string> = {
  task: '📋',
  milestone: '🏁',
  deliverable: '📦',
  inspection: '🔍',
  rfi: '❓',
  ncr: '⚠️',
};

export function TaskTypeahead({
  organisationId,
  projectId,
  value,
  onChange,
  preferredDiscipline,
  disabled = false,
  compact = false,
  onRequestCreate,
}: TaskTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tasks = [], isLoading } = useTasksForProject({
    organisationId,
    projectId,
    preferredDiscipline,
    search,
    enabled: !!organisationId && !!projectId,
    limit: 50,
  });

  const selected = useMemo(
    () => tasks.find((t) => t.id === value) ?? null,
    [tasks, value]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch('');
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Auto-focus the search input when opening
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset highlight on search change
  useEffect(() => {
    setActiveIdx(-1);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, tasks.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < tasks.length) {
        const picked = tasks[activeIdx];
        onChange(picked.id, picked);
        setOpen(false);
        setSearch('');
        setActiveIdx(-1);
      } else if (search.trim() && onRequestCreate) {
        onRequestCreate(search.trim());
        setOpen(false);
        setSearch('');
        setActiveIdx(-1);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      setActiveIdx(-1);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
  };

  // Render the selected task as a chip-style label
  const renderChip = (task: ProjectTaskSlim) => (
    <span className="inline-flex items-center gap-1.5 truncate">
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          STATUS_DOT[task.status as TaskStatus] || 'bg-zinc-300'
        )}
      />
      {task.task_no != null && (
        <span className="font-mono text-[11px] font-medium text-zinc-500">
          #{task.task_no}
        </span>
      )}
      <span className="truncate text-zinc-900">{task.title}</span>
    </span>
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', compact ? 'min-w-[180px]' : 'min-w-[260px]')}
    >
      {/* Display / trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'flex w-full items-center gap-1.5 rounded border border-zinc-200 bg-white px-2 py-1 text-left text-sm transition-colors',
          !disabled && 'hover:border-zinc-300 hover:bg-zinc-50/80',
          disabled && 'cursor-not-allowed opacity-60',
          open && 'border-blue-500 ring-1 ring-blue-500'
        )}
      >
        {selected ? (
          <>
            <span className="flex-1 truncate">{renderChip(selected)}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="ml-1 cursor-pointer rounded px-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Clear selection"
            >
              ×
            </span>
          </>
        ) : (
          <span className="flex flex-1 items-center gap-1.5 text-zinc-400">
            <Search className="h-3.5 w-3.5" />
            <span>Pick a task…</span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg',
            'animate-in fade-in slide-in-from-top-1 duration-150'
          )}
        >
          {/* Search input */}
          <div className="border-b border-zinc-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name or task #…"
                className="w-full rounded border border-zinc-200 bg-zinc-50/80 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto py-1">
            {isLoading && (
              <div className="px-3 py-2 text-xs text-zinc-400">Loading…</div>
            )}
            {!isLoading && tasks.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">
                No matching tasks in this project.
              </div>
            )}
            {!isLoading &&
              tasks.map((t, i) => {
                const isActive = i === activeIdx;
                const isSelected = t.id === value;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onChange(t.id, t);
                      setOpen(false);
                      setSearch('');
                      setActiveIdx(-1);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
                      isActive && 'bg-blue-50',
                      isSelected && 'bg-emerald-50/60'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                        STATUS_DOT[t.status as TaskStatus] || 'bg-zinc-300'
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="text-[10px]">
                          {TYPE_ICON[t.task_type] || '📋'}
                        </span>
                        {t.task_no != null && (
                          <span className="font-mono text-[10px] text-zinc-400">
                            #{t.task_no}
                          </span>
                        )}
                        <span
                          className={cn(
                            'truncate font-medium',
                            t.status === 'completed' ? 'text-zinc-400 line-through' : 'text-zinc-900'
                          )}
                          title={t.title}
                        >
                          {t.title}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span
                          className={cn(
                            'h-1 w-1 rounded-full',
                            PRIORITY_DOT[t.priority] || 'bg-zinc-300'
                          )}
                        />
                        <span className="capitalize">
                          {t.priority !== 'None' ? t.priority : 'no priority'}
                        </span>
                        {t.discipline && (
                          <>
                            <span className="text-zinc-300">·</span>
                            <span className="capitalize">{t.discipline}</span>
                          </>
                        )}
                        {t.completion_percentage > 0 && t.completion_percentage < 100 && (
                          <>
                            <span className="text-zinc-300">·</span>
                            <span className="tabular-nums">{t.completion_percentage}%</span>
                          </>
                        )}
                        {t.due_date && (
                          <>
                            <span className="text-zinc-300">·</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {t.due_date}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    )}
                  </button>
                );
              })}
          </div>

          {/* Footer: create new task */}
          {onRequestCreate && (
            <div className="border-t border-zinc-100 p-1">
              <button
                type="button"
                onClick={() => {
                  onRequestCreate(search.trim() || undefined);
                  setOpen(false);
                  setSearch('');
                  setActiveIdx(-1);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-blue-700 transition-colors hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>
                  {search.trim()
                    ? `Create new task "${search.trim()}"`
                    : 'Create new task'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskTypeahead;
