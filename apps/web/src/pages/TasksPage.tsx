// ============================================
// UNIFIED TASK MODULE — MAIN PAGE
// Frozen sub-tabs: Company Tasks | My Tasks | Reminders
// ============================================
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  TaskListView,
  TaskBoard,
  TaskGantt,
  TaskCalendar,
  TaskDetailDrawer,
  PersonalTaskListView,
  ReminderListView,
} from '../components/tasks';
import type { Task, TaskViewType } from '../components/tasks';
import {
  ListTodo,
  Kanban,
  BarChart3,
  CalendarDays,
  Building2,
  Bookmark,
  Bell,
} from 'lucide-react';
import { cn } from '../lib/utils';

type MainTab = 'company' | 'my-tasks' | 'reminders';

interface TasksPageProps {
  projectId?: string;
}

export default function TasksPage({ projectId }: TasksPageProps) {
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as MainTab) || 'company';

  const [viewType, setViewType] = useState<TaskViewType>('table');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const orgId = organisation?.id || '';

  const handleTabChange = (tab: MainTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'company') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col" data-testid="unified-tasks-page">
      {/* Top Header with Level 1 Frozen Sub-Tabs + View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'company' as const, label: 'Company Tasks', icon: Building2 },
            { id: 'my-tasks' as const, label: 'My Tasks', icon: Bookmark },
            { id: 'reminders' as const, label: 'Reminders', icon: Bell },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                currentTab === id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
              data-testid={`tasks-subtab-${id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {currentTab === 'company' && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
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
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer',
                  viewType === key
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                )}
                data-testid={`tasks-view-${key}`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {currentTab === 'company' && (
          <>
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
          </>
        )}

        {currentTab === 'my-tasks' && <PersonalTaskListView />}

        {currentTab === 'reminders' && <ReminderListView />}
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
