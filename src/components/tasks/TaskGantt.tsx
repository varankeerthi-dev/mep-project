// ============================================
// UNIFIED TASK MODULE — GANTT CHART VIEW
// MS Project-inspired split-pane Gantt
// ============================================
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useTaskGroups, useUpdateTask, useTaskDependencies, useCreateDependency, useDeleteDependency } from './hooks';
import { useTaskPermissions } from './useTaskPermissions';
import type { Task, TaskGroup, TaskStatus, DependencyType } from './types';
import { STATUS_CONFIG, DEPENDENCY_LABELS } from './types';
import { cn } from '../../lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Link,
  X,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
  GripVertical,
} from 'lucide-react';

interface TaskGanttProps {
  projectId?: string;
  organisationId: string;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

const ZOOM_CONFIG: Record<ZoomLevel, { cellWidth: number; label: string; format: Intl.DateTimeFormatOptions }> = {
  day: { cellWidth: 40, label: 'Day', format: { day: '2-digit', month: 'short' } },
  week: { cellWidth: 24, label: 'Week', format: { day: '2-digit', month: 'short' } },
  month: { cellWidth: 8, label: 'Month', format: { month: 'short', year: '2-digit' } },
  quarter: { cellWidth: 3, label: 'Quarter', format: { month: 'short' } },
};

export default function TaskGantt({ projectId, organisationId }: TaskGanttProps) {
  const { user } = useAuth();
  const { can } = useTaskPermissions();
  const { data: tasks = [], isLoading } = useTasks(organisationId, projectId);
  const { data: groups = [] } = useTaskGroups(organisationId, projectId);
  const updateTask = useUpdateTask();

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(
    groups.map((g) => g.id)
  ));
  const [splitPos, setSplitPos] = useState(35); // percentage
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [showDependencyModal, setShowDependencyModal] = useState<string | null>(null);
  const [depTargetId, setDepTargetId] = useState('');
  const [depType, setDepType] = useState<DependencyType>('FS');
  const createDependency = useCreateDependency();
  const deleteDependency = useDeleteDependency();

  // Dependencies for all tasks
  const allDeps = useTaskDependencies(tasks.length > 0 ? tasks[0].id : null);

  // Calculate date range
  const { startDate, endDate, days } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      return { startDate: start, endDate: end, days: getDaysBetween(start, end) };
    }

    let minDate = new Date();
    let maxDate = new Date();
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 30);

    tasks.forEach((t) => {
      if (t.start_date) {
        const d = new Date(t.start_date);
        if (d < minDate) minDate = d;
      }
      if (t.due_date) {
        const d = new Date(t.due_date);
        if (d > maxDate) maxDate = d;
      }
    });

    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);

    return { startDate: minDate, endDate: maxDate, days: getDaysBetween(minDate, maxDate) };
  }, [tasks]);

  const { cellWidth } = ZOOM_CONFIG[zoom];
  const timelineWidth = days * cellWidth;

  const getDayOffset = useCallback((dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return getDaysBetween(startDate, d);
  }, [startDate]);

  const getBarStyle = useCallback((task: Task) => {
    const startOffset = getDayOffset(task.start_date);
    const endOffset = getDayOffset(task.due_date);

    if (startOffset === null || endOffset === null) return null;

    const left = startOffset * cellWidth;
    const width = Math.max((endOffset - startOffset + 1) * cellWidth, cellWidth);

    return { left: `${left}px`, width: `${width}px` };
  }, [getDayOffset, cellWidth]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Split pane drag
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingSplit(true);
  }, []);

  useEffect(() => {
    if (!draggingSplit) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('gantt-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(20, Math.min(60, pct)));
    };
    const handleMouseUp = () => setDraggingSplit(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingSplit]);

  // Handle bar drag to reschedule
  const handleBarDragEnd = useCallback(async (task: Task, newStartOffset: number) => {
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() + newStartOffset);
    const duration = task.due_date && task.start_date
      ? getDaysBetween(new Date(task.start_date), new Date(task.due_date))
      : 1;
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + duration);

    await updateTask.mutateAsync({
      id: task.id,
      start_date: newStart.toISOString().split('T')[0],
      due_date: newEnd.toISOString().split('T')[0],
    });
  }, [startDate, updateTask]);

  const handleAddDependency = useCallback(async () => {
    if (!showDependencyModal || !depTargetId) return;
    await createDependency.mutateAsync({
      task_id: showDependencyModal,
      depends_on_id: depTargetId,
      dependency_type: depType,
    });
    setShowDependencyModal(null);
    setDepTargetId('');
    setDepType('FS');
  }, [showDependencyModal, depTargetId, depType, createDependency]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div id="gantt-container" className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2">
        <span className="text-[11px] font-medium text-zinc-500">Zoom:</span>
        <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {(['day', 'week', 'month', 'quarter'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                zoom === z ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              )}
            >
              {ZOOM_CONFIG[z].label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-zinc-200" />
        <span className="text-[11px] text-zinc-400">
          {tasks.length} tasks · {days} days
        </span>
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Task List */}
        <div style={{ width: `${splitPos}%` }} className="flex flex-col border-r border-zinc-200 bg-white">
          {/* Header */}
          <div className="flex items-center border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <div className="flex w-6 shrink-0 items-center justify-center px-1 py-2.5"></div>
            <div className="flex-1 px-3 py-2.5">Task Name</div>
            <div className="w-20 shrink-0 px-2 py-2.5 text-center">Status</div>
            <div className="w-20 shrink-0 px-2 py-2.5 text-center">Due</div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center border-b border-zinc-50 text-[12px] hover:bg-zinc-50/50"
              >
                <div className="flex w-6 shrink-0 items-center justify-center px-1 py-2.5">
                  <GripVertical size={10} className="text-zinc-200" />
                </div>
                <div className="flex-1 truncate px-3 py-2.5 font-medium text-zinc-900">
                  {task.title}
                </div>
                <div className="w-20 shrink-0 px-2 py-2.5 text-center">
                  <span
                    className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ color: STATUS_CONFIG[task.status].text, backgroundColor: STATUS_CONFIG[task.status].bg }}
                  >
                    {STATUS_CONFIG[task.status].label}
                  </span>
                </div>
                <div className="w-20 shrink-0 px-2 py-2.5 text-center text-[11px] tabular-nums text-zinc-500">
                  {task.due_date ? formatDate(task.due_date) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Splitter */}
        <div
          className={cn(
            'w-1 cursor-col-resize bg-zinc-200 transition-colors hover:bg-blue-400',
            draggingSplit && 'bg-blue-500'
          )}
          onMouseDown={handleSplitMouseDown}
        />

        {/* Right: Timeline */}
        <div className="flex-1 overflow-auto">
          {/* Timeline Header */}
          <div className="sticky top-0 z-10 bg-zinc-50" style={{ width: `${timelineWidth}px` }}>
            <div className="flex border-b border-zinc-200">
              {Array.from({ length: days }).map((_, i) => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i);
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col items-center border-r border-zinc-100 py-1 text-[9px]',
                      isToday ? 'bg-blue-50 text-blue-600' : isWeekend ? 'bg-zinc-100/50 text-zinc-400' : 'text-zinc-500',
                    )}
                    style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                  >
                    <span className="font-medium">{date.getDate()}</span>
                    {zoom === 'day' && (
                      <span className="text-[8px] text-zinc-400">
                        {date.toLocaleDateString('en', { weekday: 'narrow' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Body */}
          <div style={{ width: `${timelineWidth}px` }}>
            {tasks.map((task) => {
              const barStyle = getBarStyle(task);
              const isCompleted = task.status === 'completed';

              return (
                <div
                  key={task.id}
                  className="relative h-[41px] border-b border-zinc-50"
                >
                  {/* Background grid */}
                  {Array.from({ length: days }).map((_, i) => {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + i);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                    return (
                      <div
                        key={i}
                        className={cn(
                          'absolute top-0 h-full border-r',
                          isToday ? 'bg-blue-50/30 border-blue-200' : isWeekend ? 'bg-zinc-50/50 border-zinc-100' : 'border-zinc-50',
                        )}
                        style={{ left: `${i * cellWidth}px`, width: `${cellWidth}px` }}
                      />
                    );
                  })}

                  {/* Today line */}
                  {(() => {
                    const todayOffset = getDayOffset(new Date().toISOString().split('T')[0]);
                    if (todayOffset === null) return null;
                    return (
                      <div
                        className="absolute top-0 h-full w-px bg-red-400"
                        style={{ left: `${todayOffset * cellWidth}px` }}
                      />
                    );
                  })()}

                  {/* Task Bar */}
                  {barStyle && (
                    <div
                      className={cn(
                        'absolute top-2 h-6 cursor-pointer rounded-md transition-all hover:brightness-90',
                        isCompleted ? 'opacity-60' : ''
                      )}
                      style={{
                        ...barStyle,
                        backgroundColor: isCompleted ? '#22c55e' : task.color || '#3b82f6',
                      }}
                      title={`${task.title} (${task.completion_percentage}%)`}
                    >
                      {/* Progress fill */}
                      <div
                        className="absolute left-0 top-0 h-full rounded-l-md"
                        style={{
                          width: `${task.completion_percentage}%`,
                          backgroundColor: isCompleted ? '#16a34a' : (task.color ? darkenColor(task.color, 0.8) : '#2563eb'),
                        }}
                      />
                      {/* Label */}
                      {parseInt(barStyle.width) > 60 && (
                        <span className="relative z-10 ml-2 text-[10px] font-medium text-white drop-shadow-sm">
                          {task.title}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Dependency indicator */}
                  {task.due_date && (
                    <button
                      onClick={() => {
                        setShowDependencyModal(task.id);
                        setDepTargetId('');
                      }}
                      className="absolute right-1 top-3 rounded p-0.5 text-zinc-300 opacity-0 transition-colors hover:bg-zinc-100 hover:text-zinc-500 group-hover:opacity-100"
                    >
                      <Link size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dependency Modal */}
      {showDependencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="w-80 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-zinc-900">Add Dependency</h3>
              <button onClick={() => setShowDependencyModal(null)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500">This task depends on:</label>
                <select
                  value={depTargetId}
                  onChange={(e) => setDepTargetId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none focus:border-blue-400"
                >
                  <option value="">Select task...</option>
                  {tasks
                    .filter((t) => t.id !== showDependencyModal)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-500">Dependency type:</label>
                <select
                  value={depType}
                  onChange={(e) => setDepType(e.target.value as DependencyType)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[12px] text-zinc-900 outline-none focus:border-blue-400"
                >
                  {Object.entries(DEPENDENCY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{key} — {label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAddDependency}
                disabled={!depTargetId}
                className="w-full rounded-lg bg-blue-600 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                Add Dependency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}
