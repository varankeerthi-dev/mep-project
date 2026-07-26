// ============================================
// TASK DRAG & DROP HOOK
// Extracted from TaskBoard/TaskListView for reuse
// ============================================
import { useState, useCallback } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useUpdateTask, useReorderTasks } from './hooks';
import { useTaskPermissions } from './useTaskPermissions';
import type { Task, TaskStatus } from './types';

interface UseTaskDnDOptions {
  projectId?: string;
  organisationId: string;
  tasks: Task[];
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onReorder?: (updates: { id: string; task_no: number }[]) => void;
}

export function useTaskDnD({
  tasks,
  onStatusChange,
  onReorder,
}: UseTaskDnDOptions) {
  const { can } = useTaskPermissions();
  const updateTask = useUpdateTask();
  const reorderTasks = useReorderTasks();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } })
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) || null : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (
    event: DragEndEvent,
    columns?: Record<TaskStatus, Task[]>
  ) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);

    if (!task) return;

    // Check if dropped on a column header (status change)
    const isColumnDrop = columns ? overId in columns : false;
    if (isColumnDrop) {
      const newStatus = overId as TaskStatus;
      if (task.status !== newStatus && can('tasks.change_status', task)) {
        if (onStatusChange) {
          onStatusChange(taskId, newStatus);
        } else {
          await updateTask.mutateAsync({ id: taskId, status: newStatus });
        }
      }
      return;
    }

    // Within-column reorder
    if (columns) {
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

          if (onReorder) {
            onReorder(updates);
          } else {
            await reorderTasks.mutateAsync(updates);
          }
        }
      }
    }
  }, [tasks, updateTask, reorderTasks, can, onStatusChange, onReorder]);

  return {
    sensors,
    activeId,
    activeTask,
    handleDragStart,
    handleDragEnd,
  };
}
