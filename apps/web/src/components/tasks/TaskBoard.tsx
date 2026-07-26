// ============================================
// UNIFIED TASK MODULE — KANBAN BOARD
// Enhanced with within-column reorder + touch + context menu
// ============================================
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useTaskGroups, useUpdateTask, useReorderTasks, useTeamMembers, useBulkAssignTasks, getTimeHealth, taskKeys } from './hooks';
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
  UserPlus,
  Timer,
  Check,
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
  const reorderTasks = useReorderTasks();
  const { data: members = [] } = useTeamMembers(organisationId);
  const bulkAssign = useBulkAssignTasks();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [contextMenu, setContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [assignMenuTaskId, setAssignMenuTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  );

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

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
    // Sort each column by task_no
    Object.keys(map).forEach((key) => {
      map[key as TaskStatus].sort((a, b) => a.task_no - b.task_no);
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
    const { active, over } = event;
    setActiveId(null);
    setOverColumn(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);

    if (!task) return;

    // Check if dropped on a column header (status change)
    const isColumnDrop = COLUMNS.some((c) => c.status === overId);
    if (isColumnDrop) {
      const newStatus = overId as TaskStatus;
      if (task.status !== newStatus && can('tasks.change_status', task)) {
        await updateTask.mutateAsync({ id: taskId, status: newStatus });
      }
      return;
    }

    // Within-column reorder: find which column both tasks are in
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && task.status === overTask.status && task.id !== overTask.id) {
      const columnTasks = columns[task.status];
      const oldIndex = columnTasks.findIndex((t) => t.id === task.id);
      const newIndex = columnTasks.findIndex((t) => t.id === overTask.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        const updates = reordered.map((t, i) => ({
          id: t.id,
          task_no: i + 1,
        }));
        await reorderTasks.mutateAsync(updates);
      }
    }
  }, [tasks, columns, updateTask, reorderTasks, can]);

  const handleContextMenu = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setContextMenu({ taskId, x: e.clientX, y: e.clientY });
  }, []);

  const handleQuickAssign = useCallback(async (taskId: string, assigneeId: string) => {
    await bulkAssign.mutateAsync({ taskIds: [taskId], assigneeId });
    setContextMenu(null);
    setAssignMenuTaskId(null);
  }, [bulkAssign]);

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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map(({ status, icon: Icon }) => {
          const cfg = STATUS_CONFIG[status];
          const columnTasks = columns[status];
          const isOver = overColumn === status;

          return (
            <div
              key={status}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border transition-colors',
                isOver ? 'border-blue-300 bg-blue-50/30' : 'border-zinc-200 bg-zinc-50/50'
              )}
              onDragOver={(e) => { e.preventDefault(); setOverColumn(status); }}
              onDragLeave={() => setOverColumn(null)}
              onDrop={() => setOverColumn(null)}
            >
              {/* Column Header — drop target */}
              <div
                className={cn(
                  'flex items-center gap-2 border-b px-3 py-3 transition-colors',
                  isOver ? 'border-blue-200 bg-blue-50' : 'border-zinc-100'
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: cfg.bg }}>
                  <Icon size={14} style={{ color: cfg.text }} />
                </div>
                <span className="text-[12px] font-bold text-zinc-700">{cfg.label}</span>
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards — sortable context */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2 min-h-[100px]">
                <SortableContext items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {columnTasks.map((task) => (
                    <SortableCard
                      key={task.id}
                      task={task}
                      groups={groups}
                      onContextMenu={handleContextMenu}
                      onQuickAssign={handleQuickAssign}
                      members={members}
                    />
                  ))}
                </SortableContext>
                {columnTasks.length === 0 && (
                  <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 text-[11px] text-zinc-400">
                    Drop tasks here
                  </div>
                )}
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          taskId={contextMenu.taskId}
          onAssign={() => { setAssignMenuTaskId(contextMenu.taskId); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Quick Assign Dropdown */}
      {assignMenuTaskId && (
        <QuickAssignDropdown
          taskId={assignMenuTaskId}
          members={members}
          onSelect={(assigneeId) => handleQuickAssign(assignMenuTaskId, assigneeId)}
          onClose={() => setAssignMenuTaskId(null)}
        />
      )}
    </DndContext>
  );
}

// ============================================
// SORTABLE CARD
// ============================================

function SortableCard({
  task,
  groups,
  onContextMenu,
  onQuickAssign,
  members,
}: {
  task: Task;
  groups: { id: string; name: string }[];
  onContextMenu: (e: React.MouseEvent, taskId: string) => void;
  onQuickAssign: (taskId: string, assigneeId: string) => void;
  members: { id: string; role: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        groups={groups}
        onContextMenu={onContextMenu}
        isDragging={isDragging}
      />
    </div>
  );
}

// ============================================
// TASK CARD
// ============================================

function TaskCard({
  task,
  groups,
  onContextMenu,
  isDragging,
}: {
  task: Task;
  groups: { id: string; name: string }[];
  onContextMenu?: (e: React.MouseEvent, taskId: string) => void;
  isDragging?: boolean;
}) {
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const groupName = groups.find((g) => g.id === task.task_group_id)?.name;
  const health = getTimeHealth(task.estimated_hours, task.actual_hours);
  const healthDot = health === 'on-track' ? 'bg-emerald-500' :
    health === 'warning' ? 'bg-amber-500' :
    health === 'over-budget' ? 'bg-red-500' : null;

  return (
    <div
      className={cn(
        'group rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md',
        isDragging ? 'border-blue-300 shadow-lg' : 'border-zinc-200'
      )}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, task.id) : undefined}
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
        <GripVertical size={14} className="text-zinc-300 opacity-0 group-hover:opacity-100 cursor-grab" />
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
          <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 bg-zinc-100">
            {task.discipline.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* Bottom row: assignees + due date + time */}
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

        <div className="flex items-center gap-2">
          {/* Time health */}
          {healthDot && (
            <span className={`h-1.5 w-1.5 rounded-full ${healthDot}`} title={`Time: ${health}`} />
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

// ============================================
// CONTEXT MENU
// ============================================

function ContextMenu({
  x,
  y,
  taskId,
  onAssign,
  onClose,
}: {
  x: number;
  y: number;
  taskId: string;
  onAssign: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) menuRef.current.style.left = `${x - rect.width}px`;
    if (rect.bottom > vh) menuRef.current.style.top = `${y - rect.height}px`;
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[1100] w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onAssign}
        className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-zinc-700 hover:bg-zinc-50"
      >
        <UserPlus size={14} className="text-zinc-400" />
        Assign to...
      </button>
    </div>
  );
}

// ============================================
// QUICK ASSIGN DROPDOWN
// ============================================

function QuickAssignDropdown({
  taskId,
  members,
  onSelect,
  onClose,
}: {
  taskId: string;
  members: { id: string; role: string }[];
  onSelect: (assigneeId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filtered = members.filter((m) =>
    !search || m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[1100]" onClick={onClose}>
      <div
        ref={ref}
        className="absolute w-64 rounded-lg border border-zinc-200 bg-white shadow-lg overflow-hidden"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 p-2">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full rounded border border-zinc-200 px-2 py-1.5 text-[12px] outline-none focus:border-blue-400"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-zinc-400">No members found</div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-zinc-700 hover:bg-zinc-50"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-600">
                  {m.id.slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{m.id}</span>
                <span className="ml-auto text-[10px] text-zinc-400 capitalize">{m.role}</span>
              </button>
            ))
          )}
        </div>
      </div>
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
