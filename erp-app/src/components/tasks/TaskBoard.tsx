// ============================================
// UNIFIED TASK MODULE — KANBAN BOARD
// ============================================
import { useState, useMemo, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useTaskGroups, useUpdateTask, taskKeys } from './hooks';
import { useTaskPermissions } from './useTaskPermissions';
import type { Task, TaskStatus } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './types';
import { cn } from '../../lib/utils';
import {
  Plus,
  GripVertical,
  Clock,
  AlertCircle,
  Calendar,
  MoreHorizontal,
  RefreshCcw,
} from 'lucide-react';

interface TaskBoardProps {
  projectId?: string;
  organisationId: string;
}

const COLUMNS: { status: TaskStatus; icon: React.ElementType }[] = [
  { status: 'not_started', icon: Clock },
  { status: 'in_progress', icon: RefreshCcw },
  { status: 'under_review', icon: AlertCircle },
  { status: 'on_hold', icon: Calendar },
  { status: 'completed', icon: Clock },
];

export default function TaskBoard({ projectId, organisationId }: TaskBoardProps) {
  const { user } = useAuth();
  const { can } = useTaskPermissions();
  const { data: tasks = [], isLoading } = useTasks(organisationId, projectId);
  const { data: groups = [] } = useTaskGroups(organisationId, projectId);
  const updateTask = useUpdateTask();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const columns = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      not_started: [],
      in_progress: [],
      under_review: [],
      on_hold: [],
      completed: [],
    };
    tasks.forEach((t) => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [tasks]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeId) || null,
    [tasks, activeId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { over } = event;
    setActiveId(null);
    setOverColumn(null);

    if (!over?.id) return;
    const newStatus = over.id as TaskStatus;
    const taskId = event.active.id as string;
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus && can('tasks.change_status', task)) {
      await updateTask.mutateAsync({ id: taskId, status: newStatus });
    }
  }, [tasks, updateTask, can]);

  const handleDragOver = useCallback((event: DragStartEvent) => {
    // Track which column we're over
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map(({ status, icon: Icon }) => {
          const cfg = STATUS_CONFIG[status];
          const columnTasks = columns[status];

          return (
            <div
              key={status}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border transition-colors',
                overColumn === status ? 'border-blue-300 bg-blue-50/30' : 'border-zinc-200 bg-zinc-50/50'
              )}
              onDragOver={() => setOverColumn(status)}
              onDragLeave={() => setOverColumn(null)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: cfg.bg }}>
                  <Icon size={14} style={{ color: cfg.text }} />
                </div>
                <span className="text-[12px] font-bold text-zinc-700">{cfg.label}</span>
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} groups={groups} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="w-72 rotate-2 opacity-90">
            <TaskCard task={activeTask} groups={groups} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================
// TASK CARD
// ============================================

function TaskCard({ task, groups }: { task: Task; groups: { id: string; name: string }[] }) {
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const groupName = groups.find((g) => g.id === task.task_group_id)?.name;

  return (
    <div
      draggable
      className="group cursor-grab rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing"
    >
      {/* Top row: priority + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: priorityCfg.text, backgroundColor: priorityCfg.bg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityCfg.dot }} />
            {priorityCfg.label}
          </span>
          {task.color && (
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: task.color }} />
          )}
        </div>
        <button className="rounded p-0.5 text-zinc-300 opacity-0 transition-colors hover:bg-zinc-100 hover:text-zinc-500 group-hover:opacity-100">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Title */}
      <h4 className={cn(
        'mt-2 text-[13px] font-medium leading-snug',
        task.status === 'completed' ? 'text-zinc-400 line-through' : 'text-zinc-900'
      )}>
        {task.title}
      </h4>

      {/* Group */}
      {groupName && (
        <p className="mt-1 text-[10px] font-medium text-zinc-400">{groupName}</p>
      )}

      {/* Discipline */}
      {task.discipline && (
        <div className="mt-2">
          <span
            className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
            }}
          >
            {task.discipline.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* Bottom row: assignees + due date */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-50 pt-2">
        {/* Assignees */}
        {task.assignee_ids?.length > 0 ? (
          <div className="flex -space-x-1.5">
            {task.assignee_ids.slice(0, 3).map((id, i) => (
              <div
                key={id}
                className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[9px] font-bold text-zinc-600"
              >
                {String.fromCharCode(65 + (i % 26))}
              </div>
            ))}
            {task.assignee_ids.length > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-[9px] font-medium text-zinc-500">
                +{task.assignee_ids.length - 3}
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-zinc-300">Unassigned</span>
        )}

        {/* Due date */}
        {task.due_date && (
          <span className={cn(
            'flex items-center gap-1 text-[10px]',
            isOverdue(task.due_date, task.status) ? 'text-rose-500' : 'text-zinc-400'
          )}>
            <Calendar size={10} />
            {formatDate(task.due_date)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {task.completion_percentage > 0 && task.completion_percentage < 100 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${task.completion_percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function isOverdue(dueDate: string, status: TaskStatus): boolean {
  if (status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date();
}
