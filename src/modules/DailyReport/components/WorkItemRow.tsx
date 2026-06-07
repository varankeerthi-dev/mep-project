// ============================================
// WorkItemRow — Phase 2 (Phase 1d baseline + T1 + T15 + FR-14.1 + T9)
// ============================================
// One row in the daily report's "Today's Completed Work" /
// "Milestones Completed" accordion. Composes TaskTypeahead +
// InlineEditableCell.
//
// Phase 2: optimistic inline edit (no save buttons in the row,
// 500–800ms debounce). Section-level lock banner replaces the
// per-row lock indicator (FR-14.1). The `→` icon (T15) opens
// TaskDetailDrawer — separate click target from the chip.
//
// Touch targets: every interactive control is 44×44px minimum
// per WCAG 2.5.5 (T1). Trash, blocker, qty, unit, status,
// progress, discipline — all bumped.
//
// Phase 5.2 (T9) — keyboard nav grid: every focusable cell in
// the row is part of a WAI-ARIA grid (role="gridcell") with
// aria-colindex. Roving tabindex + arrow keys are driven by
// useGridNavigation (parent owns the active cell state).
// ============================================

// ============================================
// T9 — Column layout
// ============================================
// Each focusable cell in the row gets a stable col index.
// Linked rows render all 9 cells (0..8); ad-hoc rows skip
// cols 1,2,3,6 and have 5 cells. The parent grid uses the
// max (9) as aria-colcount. Cells that don't apply are
// simply not rendered — their col index is "empty".
//
//   col 0  task picker (linked)  |  ad-hoc title (ad-hoc)
//   col 1  → detail icon         |  (skipped ad-hoc)
//   col 2  status pill           |  (skipped ad-hoc)
//   col 3  progress slider       |  (skipped ad-hoc)
//   col 4  quantity
//   col 5  quantity unit
//   col 6  discipline (ad-hoc)   |  (skipped linked)
//   col 7  blocker flag
//   col 8  note
// (Delete is a separate control outside the grid — Tab
// reaches it; arrow keys do not. Destructive actions
// shouldn't share a nav space with editable cells.)

export const WORK_ITEM_ROW_COL_COUNT = 9;

import { useMemo, useState, useRef, useCallback, useImperativeHandle, type Ref } from 'react';
import { Trash2, ListChecks, Flag, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineEditableCell, type InlineSelectOption } from '@/components/ui/inline-editable-cell';
import { TaskTypeahead } from './TaskTypeahead';
import { TaskDetailDrawer } from '@/components/tasks';
import type { DailyReportWorkItem } from '@/hooks/useDailyReportWorkItems';
import { STATUS_CONFIG } from '@/components/tasks/types';
import type { ProjectTaskSlim } from '@/hooks/useTasksForProject';
import { useUpdateWorkItem, useDeleteWorkItem } from '@/hooks/useDailyReportWorkItems';
import { toast } from '@/lib/logger';
import type { GridNavigationApi, GridCellRef } from '@/hooks/useGridNavigation';

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
  onChange?: (patch: Partial<DailyReportWorkItem>) => void;
  onDelete?: () => void;
  /** Phase 2: opens the TaskMiniDrawer. */
  onRequestCreateTask?: (initialTitle?: string) => void;
  /** Hide the delete button entirely (e.g. read-only view mode) */
  hideDelete?: boolean;
  // ============================================
  // T9 — Keyboard nav grid (Phase 5.2)
  // ============================================
  /** 0-indexed row position in the grid. */
  rowIndex?: number;
  /** Grid navigation API from useGridNavigation (parent owns state). */
  grid?: GridNavigationApi | null;
  /**
   * Optional forwarded ref so the parent grid can focus this row's
   * cells imperatively. Falls back to grid.registerCell when omitted.
   */
  cellRefHandle?: Ref<{ focusCell: (col: number) => void }> | null;
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
  // T9 — grid nav
  rowIndex = 0,
  grid = null,
  cellRefHandle = null,
}: WorkItemRowProps) {
  const isAdHoc = item.task_id == null;
  const disabled = locked;
  const updateMutation = useUpdateWorkItem();
  const deleteMutation = useDeleteWorkItem();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Task title for the typeahead is sourced from the task; here we only
  // need the chip display. The detail drawer reads from its own hook.
  const taskStatusOptions = useMemo(() => STATUS_OPTIONS, []);

  // ============================================
  // T9 — Cell focus refs
  // ============================================
  // Each cell in the row gets a ref so the parent grid can focus it
  // via arrow keys. The ref points at the InlineEditableCell's display
  // layer span (the focusable tabIndex=0 element). Cells that aren't
  // present in a particular row (e.g. ad-hoc discipline) get `null`.
  const cellRefs = useRef<(HTMLElement | null)[]>([]);
  const setCellRef = useCallback(
    (col: number) => (el: HTMLElement | null) => {
      cellRefs.current[col] = el;
      if (grid) {
        grid.registerCell(rowIndex, col, el ? { focus: () => el.focus() } : null);
      }
    },
    [grid, rowIndex]
  );

  useImperativeHandle(
    cellRefHandle,
    () => ({
      focusCell: (col: number) => {
        const el = cellRefs.current[col];
        el?.focus();
      },
    }),
    []
  );

  // ============================================
  // T9 — Tabindex / aria-colindex helpers
  // ============================================
  const cellTabIndex = useCallback(
    (col: number) => (grid ? grid.getTabIndex(rowIndex, col) : 0),
    [grid, rowIndex]
  );
  const cellAriaCol = useCallback(
    (col: number) => (grid ? grid.getAriaColIndex(col) : col + 1),
    [grid]
  );
  const cellKeyDown = useCallback(
    (col: number) => (e: React.KeyboardEvent<HTMLElement>) => {
      grid?.onCellKeyDown(rowIndex, col)(e as any);
    },
    [grid, rowIndex]
  );

  // Phase 2: optimistic patch + rollback. The `onChange` callback is the
  // optimistic write. The mutation handles the actual API call + rollback.
  // Status badge is handled inside InlineEditableCell already (Check icon
  // flashes 1.2s on success).
  const persist = async (patch: Partial<DailyReportWorkItem>) => {
    onChange?.(patch);
    try {
      await updateMutation.mutateAsync({ id: item.id, ...patch });
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || 'unknown error'}`);
    }
  };

  const handleDelete = async () => {
    // Optimistic: soft-delete via deleted_at. Undo restores it.
    const prev = item;
    onChange?.({ deleted_at: new Date().toISOString() } as any);
    // onDelete is called by the parent to remove from local list; the
    // mutation below does the actual DB write. If the mutation fails, we
    // surface a toast; the parent's local-state update is one-way.
    try {
      await deleteMutation.mutateAsync({ id: item.id, reportId: item.daily_report_id });
      const t = toast.info(
        'Work item deleted.',
        {
          description: 'Tap Undo to restore',
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                await updateMutation.mutateAsync({ id: item.id, deleted_at: null } as any);
                onChange?.({ ...prev, deleted_at: null });
                toast.success('Restored.');
              } catch (e: any) {
                toast.error(`Restore failed: ${e?.message || 'unknown'}`);
              }
            },
          },
        }
      );
    } catch (e: any) {
      toast.error(`Delete failed: ${e?.message || 'unknown error'}`);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border bg-pure px-3 py-2.5 transition-colors',
        locked
          ? 'border-whisper bg-canvas/40 opacity-80'
          : 'border-whisper hover:border-ink/15 hover:bg-canvas/30'
      )}
      role="row"
      aria-rowindex={grid ? grid.getAriaRowIndex(rowIndex) : rowIndex + 1}
      aria-label={isAdHoc ? `Ad-hoc work item: ${item.ad_hoc_title || 'untitled'}` : `Linked work item`}
    >
      {/* Top row: kind badge | task picker (+ → icon when linked) | status | progress | delete */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Kind badge (info-only, not interactive) */}
        <span
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] font-medium uppercase tracking-wide',
            item.kind === 'milestone'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-blue-50 text-blue-700'
          )}
          aria-label={item.kind === 'milestone' ? 'Milestone' : 'Work item'}
        >
          {item.kind === 'milestone' ? (
            <Flag className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ListChecks className="h-3 w-3" aria-hidden="true" />
          )}
          {item.kind === 'milestone' ? 'Milestone' : 'Work'}
        </span>

        {/* Task picker (or ad-hoc title) + → icon — T9: cols 0 + 1 */}
        <div className="flex min-w-0 basis-full items-center gap-1 sm:basis-auto sm:min-w-[180px] sm:flex-1">
          <div className="min-w-0 flex-1">
            {isAdHoc ? (
              <span className="inline-flex w-full items-center gap-1.5 rounded border border-dashed border-ink/15 bg-canvas/40 px-2 py-1 text-sm text-ink">
                <span className="text-steel">Ad-hoc:</span>
                <InlineEditableCell
                  value={item.ad_hoc_title || ''}
                  onSave={(next) => persist({ ad_hoc_title: next as string })}
                  mode="text"
                  placeholder="Describe the work…"
                  disabled={disabled}
                  showEditIcon={false}
                  ariaLabel="Ad-hoc work item title"
                  tabIndex={cellTabIndex(0)}
                  ariaColIndex={cellAriaCol(0)}
                  cellRef={setCellRef(0)}
                  onGridKeyDown={cellKeyDown(0)}
                />
              </span>
            ) : (
              <TaskTypeahead
                organisationId={organisationId}
                projectId={projectId}
                value={item.task_id}
                onChange={(taskId) => {
                  if (taskId !== item.task_id) {
                    persist({ task_id: taskId });
                  }
                }}
                preferredDiscipline={preferredDiscipline}
                disabled={disabled}
                compact
                onRequestCreate={onRequestCreateTask}
                tabIndex={cellTabIndex(0)}
                ariaColIndex={cellAriaCol(0)}
                triggerRef={setCellRef(0) as React.Ref<HTMLButtonElement>}
                onGridKeyDown={cellKeyDown(0) as any}
              />
            )}
          </div>
          {/* T15: → icon opens TaskDetailDrawer. Stop event propagation so
              picking the chip and opening detail don't collide. T9: col 1. */}
          {!isAdHoc && item.task_id && (
            <button
              type="button"
              ref={setCellRef(1) as any}
              tabIndex={disabled ? -1 : cellTabIndex(1)}
              aria-colindex={cellAriaCol(1)}
              onKeyDown={cellKeyDown(1) as any}
              onClick={(e) => {
                e.stopPropagation();
                setDetailTaskId(item.task_id);
              }}
              disabled={disabled}
              className={cn(
                'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-steel transition-colors',
                !disabled && 'hover:bg-canvas hover:text-ink',
                disabled && 'cursor-not-allowed opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-executive focus-visible:ring-offset-1 focus-visible:ring-offset-pure'
              )}
              aria-label="Open task detail"
              title="Open task detail"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          </div>
      </div>

      {/* Second row: qty + unit | (ad-hoc discipline) | blocker | note
          Phase 5.5 (T2) mobile reflow: each cell uses min-w-0 to
          allow text truncation, and the blocker/note wrap to full
          width on narrow screens so 375px viewports stay usable. */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Quantity — T9: col 4 */}
        <div className="inline-flex min-w-0 items-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            Qty
          </span>
          <span className="w-20">
            <InlineEditableCell
              value={item.quantity_done ?? null}
              onSave={(next) => persist({ quantity_done: next as number | null })}
              mode="number"
              min={0}
              step={0.01}
              debounceMs={0}
              disabled={disabled}
              placeholder="0"
              showEditIcon={false}
              ariaLabel="Quantity done"
              tabIndex={cellTabIndex(4)}
              ariaColIndex={cellAriaCol(4)}
              cellRef={setCellRef(4) as React.Ref<HTMLSpanElement>}
              onGridKeyDown={cellKeyDown(4)}
            />
          </span>
          <span className="w-20">
            {/* T9: col 5 — quantity unit */}
            <InlineEditableCell
              value={item.quantity_unit ?? ''}
              onSave={(next) => persist({ quantity_unit: next as string })}
              mode="select"
              options={UNIT_OPTIONS}
              disabled={disabled}
              showEditIcon={false}
              ariaLabel="Quantity unit"
              tabIndex={cellTabIndex(5)}
              ariaColIndex={cellAriaCol(5)}
              cellRef={setCellRef(5) as React.Ref<HTMLSpanElement>}
              onGridKeyDown={cellKeyDown(5)}
            />
          </span>
        </div>

        {/* Ad-hoc discipline (only for ad-hoc items) — T9: col 6 */}
        {isAdHoc && (
          <div className="inline-flex items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Discipline
            </span>
            <span className="w-32">
              <InlineEditableCell
                value={item.ad_hoc_discipline || ''}
                onSave={(next) => persist({ ad_hoc_discipline: next as string })}
                mode="select"
                options={DISCIPLINE_OPTIONS}
                disabled={disabled}
                showEditIcon={false}
                ariaLabel="Ad-hoc discipline"
                tabIndex={cellTabIndex(6)}
                ariaColIndex={cellAriaCol(6)}
                cellRef={setCellRef(6) as React.Ref<HTMLSpanElement>}
                onGridKeyDown={cellKeyDown(6)}
              />
            </span>
          </div>
        )}

        {/* Blocker flag (44px min-height, T1) — T9: col 7 */}
        <button
          type="button"
          ref={setCellRef(7) as any}
          tabIndex={disabled ? -1 : cellTabIndex(7)}
          aria-colindex={cellAriaCol(7)}
          onKeyDown={cellKeyDown(7) as any}
          onClick={() => {
            if (disabled) return;
            persist({ blocker_flag: !item.blocker_flag });
          }}
          disabled={disabled}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-1 rounded px-3 text-xs font-medium transition-colors',
            'basis-full sm:basis-auto',
            item.blocker_flag
              ? 'bg-red-100 text-red-700'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
            disabled && 'cursor-not-allowed',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white'
          )}
          aria-pressed={item.blocker_flag}
          title={item.blocker_flag ? 'Blocker raised' : 'Mark as blocker'}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {item.blocker_flag ? 'Blocker' : 'Mark blocker'}
        </button>

        {/* Note (flex-1 textarea) — T9: col 8 */}
        <div className="min-w-0 basis-full flex-1 sm:basis-auto sm:min-w-[180px]">
          <InlineEditableCell
            value={item.note || ''}
            onSave={(next) => persist({ note: next as string })}
            mode="textarea"
            debounceMs={800}
            disabled={disabled}
            placeholder="Add a note…"
            showEditIcon={false}
            ariaLabel="Work item note"
            tabIndex={cellTabIndex(8)}
            ariaColIndex={cellAriaCol(8)}
            cellRef={setCellRef(8) as React.Ref<HTMLSpanElement>}
            onGridKeyDown={cellKeyDown(8)}
          />
        </div>
      </div>

      {/* Phase 2: T15 — TaskDetailDrawer (controlled by detailTaskId) */}
      {detailTaskId && (
        <TaskDetailDrawer
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </div>
  );
}

// ============================================
// SMALL HELPERS
// ============================================

export type { ProjectTaskSlim };

export default WorkItemRow;
