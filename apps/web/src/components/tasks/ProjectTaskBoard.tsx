import { useState, useMemo, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import {
  Clock,
  AlertCircle,
  Calendar,
  RefreshCcw,
  Plus,
  MoreHorizontal,
} from 'lucide-react';

interface ProjectTaskBoardProps {
  projectId: string;
  organisationId: string;
  userId: string;
}

const COLUMNS = [
  { status: 'not_started', label: 'Not Started', icon: Clock, color: '#94a3b8', bg: '#f8fafc' },
  { status: 'in_progress', label: 'In Progress', icon: RefreshCcw, color: '#3b82f6', bg: '#eff6ff' },
  { status: 'under_review', label: 'Possible Delay', icon: AlertCircle, color: '#eab308', bg: '#fefce8' },
  { status: 'on_hold', label: 'On Hold', icon: Calendar, color: '#6366f1', bg: '#eef2ff' },
  { status: 'completed', label: 'Completed', icon: Clock, color: '#22c55e', bg: '#f0fdf4' },
];

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  None:      { bg: '#f8fafc', text: '#94a3b8', dot: '#cbd5e1' },
  low:       { bg: '#f0f9ff', text: '#0369a1', dot: '#0ea5e9' },
  medium:    { bg: '#fefce8', text: '#a16207', dot: '#eab308' },
  high:      { bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  critical:  { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
};

export default function ProjectTaskBoard({ projectId, organisationId, userId }: ProjectTaskBoardProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['board-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .is('deleted_at', null)
        .order('task_no', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['board-groups', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_groups')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-tasks', projectId] });
    },
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async ({ title, task_group_id, status }: { title: string; task_group_id?: string | null; status: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          task_group_id: task_group_id || null,
          title,
          status: status || 'not_started',
          priority: 'medium',
          task_type: 'task',
          completion_percentage: 0,
          is_following: false,
          is_archived: false,
          tags: [],
          assignee_ids: [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-tasks', projectId] });
      setShowCreate(null);
      setNewTaskName('');
    },
  });

  const columns = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    COLUMNS.forEach((col) => { map[col.status] = []; });
    tasks.forEach((t) => {
      if (map[t.status] !== undefined) map[t.status].push(t);
    });
    return map;
  }, [tasks]);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId) || null, [tasks, activeId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { over } = event;
    setActiveId(null);
    if (!over?.id) return;
    const newStatus = over.id as string;
    const taskId = event.active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      await updateTask.mutateAsync({ id: taskId, status: newStatus });
    }
  }, [tasks, updateTask]);

  const handleCreate = useCallback(() => {
    if (!newTaskName.trim() || !showCreate) return;
    createTask.mutateAsync({ title: newTaskName.trim(), status: showCreate });
  }, [newTaskName, showCreate, createTask]);

  const getGroupName = (taskGroupId: string | null) => {
    return groups.find((g) => g.id === taskGroupId)?.name || '';
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-zinc-400">Loading board...</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4 overflow-x-auto p-4" style={{ background: '#faf9f7' }}>
        {COLUMNS.map(({ status, label, icon: Icon, color, bg }) => {
          const columnTasks = columns[status] || [];
          return (
            <div
              key={status}
              className="flex w-72 shrink-0 flex-col rounded-xl"
              style={{ background: '#fff', border: '1px solid #e5e7eb' }}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: bg }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span className="text-[12px] font-bold" style={{ color: '#374151' }}>{label}</span>
                <span
                  className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: '#e5e7eb', color: '#6b7280' }}
                >
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {columnTasks.map((task) => {
                  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.None;
                  const groupName = getGroupName(task.task_group_id);
                  return (
                    <div
                      key={task.id}
                      data-id={task.id}
                      className="group cursor-grab rounded-lg border p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing"
                      style={{ borderColor: '#e5e7eb', background: '#fff' }}
                    >
                      {/* Priority + Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ color: priorityCfg.text, backgroundColor: priorityCfg.bg }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityCfg.dot }} />
                            {task.priority}
                          </span>
                          {task.color && (
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: task.color }} />
                          )}
                        </div>
                        <button className="rounded p-0.5 text-zinc-300 opacity-0 transition-colors hover:bg-zinc-100 group-hover:opacity-100">
                          <MoreHorizontal size={14} />
                        </button>
                      </div>

                      {/* Title */}
                      <h4
                        className="mt-2 text-[13px] font-medium leading-snug"
                        style={{ color: task.status === 'completed' ? '#9ca3af' : '#1f2937' }}
                      >
                        {task.title}
                      </h4>

                      {/* Group */}
                      {groupName && (
                        <p className="mt-1 text-[10px] font-medium text-zinc-400">{groupName}</p>
                      )}

                      {/* Tags */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.tags.slice(0, 2).map((tag: string) => (
                            <span
                              key={tag}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: '#f3f4f6', color: '#6b7280' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Bottom: Assignees + Due Date */}
                      <div className="mt-3 flex items-center justify-between border-t border-zinc-50 pt-2">
                        {/* Assignees */}
                        {task.assignee_ids && task.assignee_ids.length > 0 ? (
                          <div className="flex -space-x-1.5">
                            {task.assignee_ids.slice(0, 3).map((id: string, i: number) => (
                              <div
                                key={i}
                                className="flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white"
                                style={{
                                  background: `linear-gradient(135deg, hsl(${i * 60}, 70%, 60%), hsl(${i * 60 + 30}, 70%, 50%))`,
                                  borderColor: '#fff',
                                }}
                              >
                                {id.slice(0, 2).toUpperCase()}
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
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: '#9ca3af' }}>
                            <Calendar size={10} />
                            {task.due_date}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {task.completion_percentage > 0 && task.completion_percentage < 100 && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: '#e5e7eb' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${task.completion_percentage}%`,
                              background: task.completion_percentage >= 80 ? '#22c55e' : task.completion_percentage >= 50 ? '#3b82f6' : task.completion_percentage >= 20 ? '#eab308' : '#d1d5db',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Quick Add */}
                {showCreate === status ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                    <input
                      type="text"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(null); }}
                      placeholder="Task name..."
                      className="w-full rounded border border-blue-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-900 outline-none"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={handleCreate}
                        className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setShowCreate(null); setNewTaskName(''); }}
                        className="rounded px-2 py-1 text-[11px] text-zinc-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreate(status)}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-200 p-2 text-[11px] text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-500"
                  >
                    <Plus size={12} />
                    Add task
                  </button>
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
            <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
              <h4 className="text-[13px] font-medium text-zinc-900">{activeTask.title}</h4>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
