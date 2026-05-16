// ============================================
// UNIFIED TASK MODULE — MAIN PAGE
// ============================================
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TaskListView, TaskBoard, TaskGantt, TaskCalendar, TaskDetailDrawer } from '../components/tasks';
import type { Task, TaskViewType } from '../components/tasks';
import { ListTodo, Kanban, BarChart3, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';

interface TasksPageProps {
  projectId?: string;
}

export default function TasksPage({ projectId }: TasksPageProps) {
  const { organisation } = useAuth();
  const [viewType, setViewType] = useState<TaskViewType>('table');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const orgId = organisation?.id || '';

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* View Switcher Bar */}
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-4 py-1.5">
        {[
          { key: 'table' as const, icon: ListTodo, label: 'Table' },
          { key: 'board' as const, icon: Kanban, label: 'Board' },
          { key: 'gantt' as const, icon: BarChart3, label: 'Gantt' },
          { key: 'calendar' as const, icon: CalendarDays, label: 'Calendar' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setViewType(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
              viewType === key
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {viewType === 'table' && (
          <TaskListView projectId={projectId} organisationId={orgId} />
        )}
        {viewType === 'board' && (
          <TaskBoard projectId={projectId} organisationId={orgId} />
        )}
        {viewType === 'gantt' && (
          <TaskGantt projectId={projectId} organisationId={orgId} />
        )}
        {viewType === 'calendar' && (
          <TaskCalendar
            projectId={projectId}
            organisationId={orgId}
            onTaskClick={(task) => setSelectedTask(task)}
          />
        )}
      </div>

      {/* Detail Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          taskId={selectedTask.id}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
