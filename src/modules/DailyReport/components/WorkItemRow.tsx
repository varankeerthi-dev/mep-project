// ============================================
// WorkItemRow — Phase 1d
// ============================================
// Read-only row that represents one "today's completed work" or
// "milestone completed" entry in the daily report. Composes
// TaskTypeahead + InlineEditableCell.
//
// Phase 1: all cells are read-only display (no inline edit yet —
// Phase 2 wires the optimistic update + debounced save).
// The shape is final so Phase 2 is purely a wiring change.
//
// Lock-after-approval gate: when the parent report's pm_status is
// in ('Pending Approval','Approved','Reported'), the row is
// disabled — same gate as SiteReport.tsx's updateMutation.
// ============================================

import { useMemo } from 'react';
import { Trash2, Lock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineEditableCell, type InlineSelectOption } from '@/components/ui/inline-editable-cell';
import { TaskTypeahead } from './TaskTypeahead';
import type { DailyReportWorkItem } from '@/hooks/useDailyReportWorkItems';
import { STATUS_CONFIG } from '@/components/tasks/types';
import type { ProjectTaskSlim } from '@/hooks/useTasksForProject';

// ============================================
// STATUS OPTIONS
// ============================================

const STATUS_OPTIONS: InlineSelectOption<string>[] = Object.entries(STATUS_CONFIG).map(
  ([value, cfg]) => ({
    value,
    label: cfg.label,
    color: cfg.dot.replace('bg-', 'bg-'),
  })
);

const DISCIPLINE_OPTIONS: InlineSelectOption<string>[] = [
  { value: '', label: '— none —' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'fire_protection', label: 'Fire Protection' },
  { value: 'elv', label: 'ELV' },
  { value: 'civil', label: 'Civil' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'general', label: 'General' },
];

const UNIT_OPTIONS: InlineSelectOption<string>[] = [
  { value: '', label: '—' },
  { value: 'nos', label: 'nos' },
  { value: 'm', label: 'm' },
  { value: 'm²', label: 'm²' },
  { value: 'm³', label: 'm³' },
  { value: 'kg', label: 'kg' },
  { value: 'tonne', label: 't' },
  { value: 'l', label: 'L' },
  { value: 'hr', label: 'hr' },
  { value: 'shift', label: 'shift' },
  { value: '%', label: '%' },
];

// ============================================
// PROPS
// ============================================

export interface WorkItemRowProps {
  item: DailyReportWorkItem;
  organisationId: string | null | undefined;
  projectId: string | null | undefined;
  preferredDiscipline?: string | null;
  /** When true, all cells are read-only (report locked after approval). */
  locked?: boolean;
  /** Phase 1: no-op. Phase 2: optimistic update. */
  onChange?: (patch: Partial<DailyReportWorkItem>) => void;
  onDelete?: () => void;
  /** Phase 2: opens the TaskMiniDrawer. Phase 1: shows a placeholder. */
  onRequestCreateTask?: (initialTitle?: string) => void;
  /** Hide the delete button entirely (e.g. read-only view mode) */
  hideDelete?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function WorkItemRow({
  item,
  organisationId,
  projectId,
  preferredDiscipline,
  locked = false,
  onChange,
  onDelete,
  onRequestCreateTask,
  hideDelete = false,
}: WorkItemRowProps) {
  const isAdHoc = item.task_id == null;
  const titleText = isAdHoc
    ? item.ad_hoc_title || ''
    : ''; // task title is shown by TaskTypeahead
  const disabled = locked;

  // Helper: turn "no-op save" into a console.warn in Phase 1
  // so devs notice the placeholder wiring. Phase 2 replaces these
  // with real onSave handlers that hit the API.
  const phase1Save = <T,>(_next: T) => {
    // eslint-disable-next-line no-console
    console.warn(
      '[WorkItemRow] Phase 1 is read-only. Inline save wires up in Phase 2.'
    );
  };

  const taskStatusOptions = useMemo(() => STATUS_OPTIONS, []);

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border bg-white px-3 py-2.5 transition-colors',
        locked
          ? 'border-zinc-200 bg-zinc-50/40 opacity-80'
          : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/30'
      )}
      role="row"
      aria-label={isAdHoc ? `Ad-hoc work item: ${item.ad_hoc_title || 'untitled'}` : `Linked work item`}
    >
      {/* Top row: task picker | kind badge | status | progress | delete */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Kind badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            item.kind === 'milestone'
              ? 'bg-violet-50 text-violet-700'
              : 'bg-sky-50 text-sky-700'
          )}
          aria-label={item.kind === 'milestone' ? 'Milestone' : 'Work item'}
        >
          {item.kind === 'milestone' ? '🏁 Milestone' : '📋 Work'}
        </span>

        {/* Task picker (or ad-hoc title) */}
        <div className="flex-1 min-w-[180px]">
          {isAdHoc ? (
            <span className="inline-flex w-full items-center gap-1.5 rounded border border-dashed border-zinc-300 bg-zinc-50/40 px-2 py-1 text-sm text-zinc-700">
              <span className="text-zinc-400">Ad-hoc:</span>
              <InlineEditableCell
                value={item.ad_hoc_title || ''}
                onSave={(next) => {
                  phase1Save(next);
                  onChange?.({ ad_hoc_title: next as string });
                }}
                mode="text"
                placeholder="Describe the work…"
                disabled={disabled}
                showEditIcon={false}
                ariaLabel="Ad-hoc work item title"
              />
            </span>
          ) : (
            <TaskTypeahead
              organisationId={organisationId}
              projectId={projectId}
              value={item.task_id}
              onChange={(taskId, _task) => {
                // Phase 1: no-op
                // eslint-disable-next-line no-console
                console.warn('[WorkItemRow] Task change wires up in Phase 2.');
                if (onChange) {
                  onChange({ task_id: taskId });
                }
              }}
              preferredDiscipline={preferredDiscipline}
              disabled={disabled}
              compact
              onRequestCreate={onRequestCreateTask}
            />
          )}
        </div>

        {/* Status pill (only when linked to a task) */}
        {!isAdHoc && (
          <InlineEditableCell
            value={item.status_after || 'not_started'}
            onSave={(next) => {
              phase1Save(next);
              onChange?.({ status_after: next as string });
            }}
            mode="select"
            options={taskStatusOptions}
            disabled={disabled}
            ariaLabel="Task status"
          />
        )}

        {/* Progress slider (only when linked to a task) */}
        {!isAdHoc && (
          <div className="w-32">
            <InlineEditableCell
              value={item.progress_after ?? 0}
              onSave={(next) => {
                phase1Save(next);
                onChange?.({ progress_after: next as number });
              }}
              mode="slider"
              min={0}
              max={100}
              step={5}
              debounceMs={800}
              disabled={disabled}
              ariaLabel="Task progress"
            />
          </div>
        )}

        {/* Delete (unless hidden) */}
        {!hideDelete && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors',
              !disabled && 'hover:bg-red-50 hover:text-red-600',
              disabled && 'cursor-not-allowed opacity-40'
            )}
            aria-label="Delete work item"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Second row: qty + unit + note + blocker flag */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Quantity */}
        <div className="inline-flex items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            Qty
          </span>
          <span className="w-16">
            <InlineEditableCell
              value={item.quantity_done ?? null}
              onSave={(next) => {
                phase1Save(next);
                onChange?.({ quantity_done: next as number | null });
              }}
              mode="number"
              min={0}
              step={0.01}
              debounceMs={0}
              disabled={disabled}
              placeholder="0"
              showEditIcon={false}
              ariaLabel="Quantity done"
            />
          </span>
          <span className="w-16">
            <InlineEditableCell
              value={item.quantity_unit ?? ''}
              onSave={(next) => {
                phase1Save(next);
                onChange?.({ quantity_unit: next as string });
              }}
              mode="select"
              options={UNIT_OPTIONS}
              disabled={disabled}
              showEditIcon={false}
              ariaLabel="Quantity unit"
            />
          </span>
        </div>

        {/* Ad-hoc discipline (only for ad-hoc items) */}
        {isAdHoc && (
          <div className="inline-flex items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Discipline
            </span>
            <span className="w-32">
              <InlineEditableCell
                value={item.ad_hoc_discipline || ''}
                onSave={(next) => {
                  phase1Save(next);
                  onChange?.({ ad_hoc_discipline: next as string });
                }}
                mode="select"
                options={DISCIPLINE_OPTIONS}
                disabled={disabled}
                showEditIcon={false}
                ariaLabel="Ad-hoc discipline"
              />
            </span>
          </div>
        )}

        {/* Blocker flag */}
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            onChange?.({ blocker_flag: !item.blocker_flag });
          }}
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
            item.blocker_flag
              ? 'bg-red-100 text-red-700'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
            disabled && 'cursor-not-allowed'
          )}
          aria-pressed={item.blocker_flag}
          title={item.blocker_flag ? 'Blocker raised' : 'Mark as blocker'}
        >
          <AlertTriangle className="h-3 w-3" />
          {item.blocker_flag ? 'Blocker' : 'Mark blocker'}
        </button>

        {/* Note (flex-1 textarea) */}
        <div className="min-w-[180px] flex-1">
          <InlineEditableCell
            value={item.note || ''}
            onSave={(next) => {
              phase1Save(next);
              onChange?.({ note: next as string });
            }}
            mode="textarea"
            debounceMs={800}
            disabled={disabled}
            placeholder="Add a note…"
            showEditIcon={false}
            ariaLabel="Work item note"
          />
        </div>

        {/* Lock indicator (shown only when locked) */}
        {locked && (
          <span
            className="inline-flex items-center gap-1 self-center text-[10px] text-zinc-400"
            title="Report is locked after approval"
          >
            <Lock className="h-3 w-3" />
            Locked
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// SMALL HELPER: re-export for parent
// ============================================

export type { ProjectTaskSlim };

export default WorkItemRow;
