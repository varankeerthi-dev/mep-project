// ============================================
// UNIFIED TASK MODULE — CALENDAR VIEW
// ============================================
import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTasks, useUpdateTask } from './hooks';
import type { Task } from './types';
import { STATUS_CONFIG } from './types';
import { cn } from '../../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCcw,
} from 'lucide-react';

interface TaskCalendarProps {
  projectId?: string;
  organisationId: string;
  onTaskClick?: (task: Task) => void;
}

export default function TaskCalendar({ projectId, organisationId, onTaskClick }: TaskCalendarProps) {
  const { data: tasks = [], isLoading } = useTasks(organisationId, projectId);
  const updateTask = useUpdateTask();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = new Date();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [daysInMonth, firstDayOfWeek]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (task.due_date) {
        const key = task.due_date;
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    });
    return map;
  }, [tasks]);

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, day: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const newDate = new Date(year, month, day);
    const dateStr = newDate.toISOString().split('T')[0];
    await updateTask.mutateAsync({ id: taskId, due_date: dateStr });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCcw className="h-6 w-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Calendar Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-zinc-900">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={goToPrevMonth} className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToNextMonth} className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={goToToday}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <Calendar size={14} />
          Today
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="border-b border-r border-zinc-100 bg-zinc-50/30" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate[dateStr] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isWeekend = idx % 7 === 0 || idx % 7 === 6;

          return (
            <div
              key={dateStr}
              className={cn(
                'relative border-b border-r border-zinc-100 p-1 transition-colors',
                isWeekend ? 'bg-zinc-50/30' : 'bg-white',
                isToday && 'bg-blue-50/30'
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium',
                    isToday ? 'bg-blue-600 text-white' : 'text-zinc-500'
                  )}
                >
                  {day}
                </span>
              </div>

              {/* Tasks */}
              <div className="mt-1 space-y-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map((task) => {
                  const cfg = STATUS_CONFIG[task.status];
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                      onClick={() => onTaskClick?.(task)}
                      className={cn(
                        'cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:brightness-90',
                        task.status === 'completed' && 'opacity-50'
                      )}
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-zinc-400">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
