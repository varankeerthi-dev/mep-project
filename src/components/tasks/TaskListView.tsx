// ============================================
// UNIFIED TASK MODULE — TASK LIST VIEW
// MS Project-style table with inline editing
// ============================================
import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useTasks,
  useTaskGroups,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCreateGroup,
  useBulkUpdateTasks,
  taskKeys,
} from './hooks';
import { useTaskPermissions } from './useTaskPermissions';
import type {
  Task,
  TaskGroup,
  TaskStatus,
  TaskPriority,
  TaskDiscipline,
  TaskType,
  TaskFilters,
  SortConfig,
  TaskColumnConfig,
} from './types';
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TASK_TYPE_CONFIG,
  DISCIPLINE_CONFIG,
  DEFAULT_COLUMNS,
} from './types';
import { exportTasksToCSV, downloadCSV, exportTasksSummary } from './exportTasks';
import { cn } from '../../lib/utils';
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layout,
  Trash2,
  RefreshCcw,
  Check,
  X,
  Columns,
  Save,
  FolderPlus,
} from 'lucide-react';

interface TaskListViewProps {
  projectId?: string;
  organisationId: string;
}

export default function TaskListView({ projectId, organisationId }: TaskListViewProps) {
  const { user } = useAuth();
  const { can } = useTaskPermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<TaskFilters>({});
  const [sortBy, setSortBy] = useState<SortConfig[]>([]);
  const [columns, setColumns] = useState<TaskColumnConfig>(DEFAULT_COLUMNS);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'status' | 'priority' | 'assignee' | null>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddGroupId, setQuickAddGroupId] = useState<string | null>(null);

  // Data fetching
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(
    organisationId,
    projectId,
    { ...activeFilters, search: searchTerm || undefined },
    sortBy
  );
  const { data: groups = [], isLoading: groupsLoading } = useTaskGroups(organisationId, projectId);

  // Mutations
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createGroup = useCreateGroup();
  const bulkUpdate = useBulkUpdateTasks();

  // Bulk operations
  const toggleSelectAll = useCallback(() => {
    const allIds = tasks.map((t) => t.id);
    setSelectedTaskIds((prev) => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }, [tasks]);

  const toggleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async () => {
    if (selectedTaskIds.size === 0 || !bulkValue) return;
    const updates: Record<string, unknown> = {};
    if (bulkAction === 'status') updates.status = bulkValue;
    if (bulkAction === 'priority') updates.priority = bulkValue;
    await bulkUpdate.mutateAsync({ ids: Array.from(selectedTaskIds), updates: updates as any });
    setSelectedTaskIds(new Set());
    setBulkAction(null);
    setBulkValue('');
  }, [selectedTaskIds, bulkAction, bulkValue, bulkUpdate]);

  // Export
  const handleExportCSV = useCallback(() => {
    const csv = exportTasksToCSV(tasks, groups);
    downloadCSV(csv, `tasks-${projectId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
  }, [tasks, groups, projectId]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const groupId = task.task_group_id || '__ungrouped__';
      if (!map[groupId]) map[groupId] = [];
      map[groupId].push(task);
    });
    return map;
  }, [tasks]);

  const sortedGroups = useMemo(() => {
    const ungrouped = groups.filter((g) => groupedTasks[g.id]);
    const hasUngrouped = groupedTasks['__ungrouped__'];
    return { groups: ungrouped, hasUngrouped };
  }, [groups, groupedTasks]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const toggleColumn = useCallback((key: string) => {
    setColumns((prev) => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key]?.visible },
    }));
  }, []);

  const handleQuickAdd = useCallback(async () => {
    if (!quickAddTitle.trim() || !user?.id) return;
    await createTask.mutateAsync({
      organisation_id: organisationId,
      project_id: projectId || null,
      created_by: user.id,
      title: quickAddTitle.trim(),
      task_group_id: quickAddGroupId,
      status: 'not_started',
      priority: 'medium',
      task_type: 'task',
    });
    setQuickAddTitle('');
  }, [quickAddTitle, quickAddGroupId, organisationId, projectId, user?.id, createTask]);

  const handleStatusChange = useCallback(async (taskId: string, status: TaskStatus) => {
    await updateTask.mutateAsync({ id: taskId, status });
  }, [updateTask]);

  const handlePriorityChange = useCallback(async (taskId: string, priority: TaskPriority) => {
    await updateTask.mutateAsync({ id: taskId, priority });
  }, [updateTask]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (confirm('Delete this task?')) {
      await deleteTask.mutateAsync(taskId);
    }
  }, [deleteTask]);

  const handleCreateGroup = useCallback(async () => {
    const name = prompt('Group name:');
    if (!name?.trim() || !user?.id) return;
    await createGroup.mutateAsync({
      organisation_id: organisationId,
      project_id: projectId || null,
      created_by: user.id,
      name: name.trim(),
    });
  }, [organisationId, projectId, user?.id, createGroup]);

  const isLoading = tasksLoading || groupsLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  const col = columns;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Command Bar */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2 px-4 py-2">
          {/* New Task */}
          {can('tasks.create') && (
            <button
              onClick={() => setShowQuickAdd('__top__')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={14} />
              New Task
            </button>
          )}

          {/* New Group */}
          {can('tasks.create') && (
            <button
              onClick={handleCreateGroup}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <FolderPlus size={14} />
              New Group
            </button>
          )}

          <div className="h-5 w-px bg-zinc-200" />

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..."
              className="h-8 w-56 rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-[12px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-100"
            />
          </div>

          {/* Filter */}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
              Object.keys(activeFilters).length > 0
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
            )}
          >
            <Filter size={14} />
            Filter
            {Object.keys(activeFilters).length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {Object.keys(activeFilters).length}
              </span>
            )}
          </button>

          {/* Column Visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Columns size={14} />
              Columns
              <ChevronDown size={12} />
            </button>
            {showColumnDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
                <p className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Toggle Columns
                </p>
                {Object.entries(col).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => toggleColumn(key)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    <div
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded border',
                        cfg.visible ? 'border-blue-600 bg-blue-600' : 'border-zinc-300'
                      )}
                    >
                      {cfg.visible && <Check size={10} className="text-white" />}
                    </div>
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Bulk Operations Bar */}
          {selectedTaskIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5">
              <span className="text-[11px] font-semibold text-blue-700">
                {selectedTaskIds.size} selected
              </span>
              <select
                value={bulkAction || ''}
                onChange={(e) => { setBulkAction(e.target.value as any); setBulkValue(''); }}
                className="rounded border border-blue-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 outline-none"
              >
                <option value="">Action...</option>
                <option value="status">Change Status</option>
                <option value="priority">Change Priority</option>
              </select>
              {bulkAction && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="rounded border border-blue-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 outline-none"
                >
                  <option value="">Select...</option>
                  {bulkAction === 'status' && Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                  {bulkAction === 'priority' && Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              )}
              {bulkValue && (
                <button
                  onClick={handleBulkAction}
                  className="rounded bg-blue-600 px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700"
                >
                  Apply
                </button>
              )}
              <button
                onClick={() => { setSelectedTaskIds(new Set()); setBulkAction(null); setBulkValue(''); }}
                className="rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-100"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Export */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Export CSV
          </button>

          {/* Task count */}
          <span className="text-[11px] text-zinc-400">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <FilterChip
                label="Status"
                values={activeFilters.status || []}
                options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                onChange={(values) =>
                  setActiveFilters((prev) =>
                    values.length ? { ...prev, status: values as TaskStatus[] } : { ...prev, status: undefined }
                  )
                }
              />
              <FilterChip
                label="Priority"
                values={activeFilters.priority || []}
                options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                onChange={(values) =>
                  setActiveFilters((prev) =>
                    values.length ? { ...prev, priority: values as TaskPriority[] } : { ...prev, priority: undefined }
                  )
                }
              />
              <FilterChip
                label="Discipline"
                values={activeFilters.discipline || []}
                options={Object.entries(DISCIPLINE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                onChange={(values) =>
                  setActiveFilters((prev) =>
                    values.length
                      ? { ...prev, discipline: values as TaskDiscipline[] }
                      : { ...prev, discipline: undefined }
                  )
                }
              />
              <FilterChip
                label="Type"
                values={activeFilters.task_type || []}
                options={Object.entries(TASK_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
                onChange={(values) =>
                  setActiveFilters((prev) =>
                    values.length
                      ? { ...prev, task_type: values as TaskType[] }
                      : { ...prev, task_type: undefined }
                  )
                }
              />
              <div className="flex-1" />
              {Object.keys(activeFilters).length > 0 && (
                <button
                  onClick={() => setActiveFilters({})}
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-700"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table Header */}
      <div className="sticky top-[49px] z-10 border-b border-zinc-200 bg-zinc-50">
        <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <div className="flex w-8 shrink-0 items-center justify-center px-1 py-2.5">
            <GripVertical size={12} className="text-zinc-300" />
          </div>
          {col.task_no?.visible && <div className="w-12 shrink-0 px-2 py-2.5 text-center">No.</div>}
          <div className="min-w-[280px] flex-1 px-3 py-2.5">Task Name</div>
          {col.status?.visible && <div className="w-28 shrink-0 px-2 py-2.5 text-center">Status</div>}
          {col.priority?.visible && <div className="w-24 shrink-0 px-2 py-2.5 text-center">Priority</div>}
          {col.discipline?.visible && <div className="w-28 shrink-0 px-2 py-2.5 text-center">Discipline</div>}
          {col.assignees?.visible && <div className="w-32 shrink-0 px-2 py-2.5 text-center">Assignees</div>}
          {col.start_date?.visible && <div className="w-24 shrink-0 px-2 py-2.5 text-center">Start</div>}
          {col.due_date?.visible && <div className="w-24 shrink-0 px-2 py-2.5 text-center">Due</div>}
          {col.completion_percentage?.visible && (
            <div className="w-24 shrink-0 px-2 py-2.5 text-center">Progress</div>
          )}
          {col.tags?.visible && <div className="w-28 shrink-0 px-2 py-2.5 text-center">Tags</div>}
          {col.location?.visible && <div className="w-28 shrink-0 px-2 py-2.5 text-center">Location</div>}
          {col.drawing_ref?.visible && <div className="w-28 shrink-0 px-2 py-2.5 text-center">Drawing</div>}
          {col.wbs_code?.visible && <div className="w-24 shrink-0 px-2 py-2.5 text-center">WBS</div>}
          {col.estimated_hours?.visible && <div className="w-20 shrink-0 px-2 py-2.5 text-center">Est. Hrs</div>}
          {col.actual_hours?.visible && <div className="w-20 shrink-0 px-2 py-2.5 text-center">Act. Hrs</div>}
          <div className="w-10 shrink-0 px-1 py-2.5"></div>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Layout size={32} className="text-zinc-200" />
            <p className="text-sm font-medium text-zinc-400">No tasks yet</p>
            {can('tasks.create') && (
              <button
                onClick={() => setShowQuickAdd('__top__')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={14} />
                Add first task
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Quick Add at top */}
            {showQuickAdd === '__top__' && (
              <QuickAddRow
                value={quickAddTitle}
                onChange={setQuickAddTitle}
                onAdd={handleQuickAdd}
                onCancel={() => { setShowQuickAdd(null); setQuickAddTitle(''); }}
                groups={groups}
                selectedGroupId={quickAddGroupId}
                onSelectGroup={setQuickAddGroupId}
              />
            )}

            {/* Groups */}
            {sortedGroups.groups.map((group) => (
              <TaskGroupSection
                key={group.id}
                group={group}
                tasks={groupedTasks[group.id] || []}
                isExpanded={expandedGroups.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
                columns={columns}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDelete={handleDeleteTask}
                onQuickAdd={() => {
                  setShowQuickAdd(group.id);
                  setQuickAddGroupId(group.id);
                  setQuickAddTitle('');
                }}
                showQuickAdd={showQuickAdd === group.id}
                quickAddValue={quickAddTitle}
                onQuickAddChange={setQuickAddTitle}
                onQuickAddSubmit={handleQuickAdd}
                onQuickAddCancel={() => { setShowQuickAdd(null); setQuickAddTitle(''); }}
                canEdit={can('tasks.update')}
                canDelete={can('tasks.delete')}
              />
            ))}

            {/* Ungrouped tasks */}
            {sortedGroups.hasUngrouped && (
              <TaskGroupSection
                group={null}
                tasks={groupedTasks['__ungrouped__'] || []}
                isExpanded={expandedGroups.has('__ungrouped__')}
                onToggle={() => toggleGroup('__ungrouped__')}
                columns={columns}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDelete={handleDeleteTask}
                onQuickAdd={() => {
                  setShowQuickAdd('__ungrouped__');
                  setQuickAddGroupId(null);
                  setQuickAddTitle('');
                }}
                showQuickAdd={showQuickAdd === '__ungrouped__'}
                quickAddValue={quickAddTitle}
                onQuickAddChange={setQuickAddTitle}
                onQuickAddSubmit={handleQuickAdd}
                onQuickAddCancel={() => { setShowQuickAdd(null); setQuickAddTitle(''); }}
                canEdit={can('tasks.update')}
                canDelete={can('tasks.delete')}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// TASK GROUP SECTION
// ============================================

function TaskGroupSection({
  group,
  tasks,
  isExpanded,
  onToggle,
  columns,
  selectedTaskId,
  onSelectTask,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onQuickAdd,
  showQuickAdd,
  quickAddValue,
  onQuickAddChange,
  onQuickAddSubmit,
  onQuickAddCancel,
  canEdit,
  canDelete,
}: {
  group: TaskGroup | null;
  tasks: Task[];
  isExpanded: boolean;
  onToggle: () => void;
  columns: Record<string, { visible: boolean }>;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  onDelete: (id: string) => void;
  onQuickAdd: () => void;
  showQuickAdd: boolean;
  quickAddValue: string;
  onQuickAddChange: (v: string) => void;
  onQuickAddSubmit: () => void;
  onQuickAddCancel: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const col = columns;

  return (
    <div>
      {/* Group Header */}
      <button
        onClick={onToggle}
        className="group flex w-full items-center border-b border-zinc-100 bg-zinc-50/50 px-2 py-2 text-left transition-colors hover:bg-zinc-100"
      >
        <div className="flex w-8 shrink-0 items-center justify-center">
          {isExpanded ? (
            <ChevronDown size={14} className="text-zinc-400" />
          ) : (
            <ChevronRight size={14} className="text-zinc-400" />
          )}
        </div>
        <div
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: group?.color || '#94a3b8' }}
        />
        <span className="ml-2 text-[12px] font-bold text-zinc-700">
          {group?.name || 'Ungrouped'}
        </span>
        <span className="ml-2 text-[10px] font-medium text-zinc-400">
          ({tasks.length})
        </span>
      </button>

      {/* Tasks */}
      {isExpanded &&
        tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            columns={columns}
            isSelected={selectedTaskId === task.id}
            onSelect={() => onSelectTask(task.id === selectedTaskId ? null : task.id)}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}

      {/* Quick Add within group */}
      {showQuickAdd && (
        <QuickAddRow
          value={quickAddValue}
          onChange={onQuickAddChange}
          onAdd={onQuickAddSubmit}
          onCancel={onQuickAddCancel}
          indent
        />
      )}

      {/* Add task button */}
      {isExpanded && canEdit && !showQuickAdd && (
        <button
          onClick={onQuickAdd}
          className="flex w-full items-center gap-2 border-b border-zinc-50 px-10 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
        >
          <Plus size={12} />
          Add task
        </button>
      )}
    </div>
  );
}

// ============================================
// TASK ROW
// ============================================

function TaskRow({
  task,
  columns,
  isSelected,
  onSelect,
  onStatusChange,
  onPriorityChange,
  onDelete,
  canEdit,
  canDelete,
}: {
  task: Task;
  columns: Record<string, { visible: boolean }>;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const col = columns;
  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];

  return (
    <div
      className={cn(
        'group flex items-center border-b border-zinc-50 text-[12px] transition-colors',
        isSelected ? 'bg-blue-50/50' : 'hover:bg-zinc-50/70'
      )}
      onClick={onSelect}
    >
      {/* Grip */}
      <div className="flex w-8 shrink-0 items-center justify-center px-1 py-2.5">
        <GripVertical size={12} className="text-zinc-200 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Task No */}
      {col.task_no?.visible && (
        <div className="w-12 shrink-0 px-2 py-2.5 text-center text-[11px] text-zinc-400 tabular-nums">
          {task.task_no}
        </div>
      )}

      {/* Title */}
      <div className="min-w-[280px] flex-1 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {task.color && <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: task.color }} />}
          <span className={cn(
            'truncate font-medium',
            task.status === 'completed' ? 'text-zinc-400 line-through' : 'text-zinc-900'
          )}>
            {task.title}
          </span>
          {task.task_type !== 'task' && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              {TASK_TYPE_CONFIG[task.task_type].icon}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      {col.status?.visible && canEdit && (
        <div className="w-28 shrink-0 px-2 py-2.5">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] font-medium outline-none transition-colors hover:border-zinc-200 focus:border-blue-400"
            style={{ color: statusCfg.text, backgroundColor: statusCfg.bg }}
          >
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key} style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {col.status?.visible && !canEdit && (
        <div className="w-28 shrink-0 px-2 py-2.5 text-center">
          <span
            className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ color: statusCfg.text, backgroundColor: statusCfg.bg }}
          >
            {statusCfg.label}
          </span>
        </div>
      )}

      {/* Priority */}
      {col.priority?.visible && canEdit && (
        <div className="w-24 shrink-0 px-2 py-2.5">
          <select
            value={task.priority}
            onChange={(e) => onPriorityChange(task.id, e.target.value as TaskPriority)}
            className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] font-medium outline-none transition-colors hover:border-zinc-200 focus:border-blue-400"
            style={{ color: priorityCfg.text, backgroundColor: priorityCfg.bg }}
          >
            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      )}
      {col.priority?.visible && !canEdit && (
        <div className="w-24 shrink-0 px-2 py-2.5 text-center">
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{ color: priorityCfg.text, backgroundColor: priorityCfg.bg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityCfg.dot }} />
            {priorityCfg.label}
          </span>
        </div>
      )}

      {/* Discipline */}
      {col.discipline?.visible && (
        <div className="w-28 shrink-0 px-2 py-2.5 text-center">
          {task.discipline ? (
            <span
              className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                color: DISCIPLINE_CONFIG[task.discipline].color,
                backgroundColor: `${DISCIPLINE_CONFIG[task.discipline].color}15`,
              }}
            >
              {DISCIPLINE_CONFIG[task.discipline].label}
            </span>
          ) : (
            <span className="text-zinc-300">—</span>
          )}
        </div>
      )}

      {/* Assignees */}
      {col.assignees?.visible && (
        <div className="w-32 shrink-0 px-2 py-2.5 text-center text-[11px] text-zinc-500">
          {task.assignee_ids?.length > 0 ? (
            <div className="flex items-center justify-center gap-0.5">
              {task.assignee_ids.slice(0, 3).map((id, i) => (
                <div
                  key={id}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-600"
                  style={{ marginLeft: i > 0 ? -4 : 0 }}
                >
                  {String.fromCharCode(65 + (i % 26))}
                </div>
              ))}
              {task.assignee_ids.length > 3 && (
                <span className="text-[10px] text-zinc-400">+{task.assignee_ids.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-zinc-300">Unassigned</span>
          )}
        </div>
      )}

      {/* Start Date */}
      {col.start_date?.visible && (
        <div className="w-24 shrink-0 px-2 py-2.5 text-center text-[11px] tabular-nums text-zinc-500">
          {task.start_date ? formatDate(task.start_date) : '—'}
        </div>
      )}

      {/* Due Date */}
      {col.due_date?.visible && (
        <div className="w-24 shrink-0 px-2 py-2.5 text-center">
          {task.due_date ? (
            <span
              className={cn(
                'text-[11px] tabular-nums',
                isOverdue(task.due_date, task.status) ? 'font-semibold text-rose-600' : 'text-zinc-500'
              )}
            >
              {formatDate(task.due_date)}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-300">—</span>
          )}
        </div>
      )}

      {/* Progress */}
      {col.completion_percentage?.visible && (
        <div className="w-24 shrink-0 px-2 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${task.completion_percentage}%`,
                  backgroundColor: task.completion_percentage === 100 ? '#22c55e' : '#3b82f6',
                }}
              />
            </div>
            <span className="w-7 text-right text-[10px] tabular-nums text-zinc-500">
              {task.completion_percentage}%
            </span>
          </div>
        </div>
      )}

      {/* Tags */}
      {col.tags?.visible && (
        <div className="w-28 shrink-0 px-2 py-2.5 text-center">
          {task.tags?.length > 0 ? (
            <div className="flex flex-wrap gap-0.5">
              {task.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                  {tag}
                </span>
              ))}
              {task.tags.length > 2 && (
                <span className="text-[10px] text-zinc-400">+{task.tags.length - 2}</span>
              )}
            </div>
          ) : (
            <span className="text-zinc-300">—</span>
          )}
        </div>
      )}

      {/* Location */}
      {col.location?.visible && (
        <div className="w-28 shrink-0 px-2 py-2.5 text-center text-[11px] text-zinc-500">
          {task.location || <span className="text-zinc-300">—</span>}
        </div>
      )}

      {/* Drawing Ref */}
      {col.drawing_ref?.visible && (
        <div className="w-28 shrink-0 px-2 py-2.5 text-center text-[11px] font-mono text-zinc-500">
          {task.drawing_ref || <span className="text-zinc-300">—</span>}
        </div>
      )}

      {/* WBS Code */}
      {col.wbs_code?.visible && (
        <div className="w-24 shrink-0 px-2 py-2.5 text-center text-[11px] font-mono text-zinc-500">
          {task.wbs_code || <span className="text-zinc-300">—</span>}
        </div>
      )}

      {/* Est. Hours */}
      {col.estimated_hours?.visible && (
        <div className="w-20 shrink-0 px-2 py-2.5 text-center text-[11px] tabular-nums text-zinc-500">
          {task.estimated_hours ?? <span className="text-zinc-300">—</span>}
        </div>
      )}

      {/* Act. Hours */}
      {col.actual_hours?.visible && (
        <div className="w-20 shrink-0 px-2 py-2.5 text-center text-[11px] tabular-nums text-zinc-500">
          {task.actual_hours ?? <span className="text-zinc-300">—</span>}
        </div>
      )}

      {/* Actions */}
      <div className="w-10 shrink-0 px-1 py-2.5 text-center">
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="rounded p-1 text-zinc-300 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// QUICK ADD ROW
// ============================================

function QuickAddRow({
  value,
  onChange,
  onAdd,
  onCancel,
  groups,
  selectedGroupId,
  onSelectGroup,
  indent,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  groups?: TaskGroup[];
  selectedGroupId?: string | null;
  onSelectGroup?: (id: string | null) => void;
  indent?: boolean;
}) {
  return (
    <div className={cn('flex items-center border-b border-blue-100 bg-blue-50/30', indent && 'pl-10')}>
      <div className="flex w-8 shrink-0 items-center justify-center">
        <Plus size={12} className="text-blue-400" />
      </div>
      <div className="min-w-[280px] flex-1 px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onAdd();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Type task name and press Enter..."
          className="w-full rounded border border-blue-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          autoFocus
        />
      </div>
      {groups && onSelectGroup && (
        <div className="w-32 shrink-0 px-2">
          <select
            value={selectedGroupId || ''}
            onChange={(e) => onSelectGroup(e.target.value || null)}
            className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-zinc-700 outline-none"
          >
            <option value="">No Group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={onAdd}
          disabled={!value.trim()}
          className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="rounded px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================
// FILTER CHIP
// ============================================

function FilterChip({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
          values.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
        )}
      >
        {label}
        <ChevronDown size={10} />
        {values.length > 0 && (
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white">
            {values.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <div
                  className={cn(
                    'flex h-3 w-3 items-center justify-center rounded border',
                    values.includes(opt.value) ? 'border-blue-600 bg-blue-600' : 'border-zinc-300'
                  )}
                >
                  {values.includes(opt.value) && <Check size={8} className="text-white" />}
                </div>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function isOverdue(dueDate: string, status: TaskStatus): boolean {
  if (status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date();
}
