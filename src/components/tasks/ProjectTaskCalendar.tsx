import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { ChevronLeft, ChevronRight, Calendar, RefreshCcw } from 'lucide-react';

interface ProjectTaskCalendarProps {
  projectId: string;
  organisationId: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  not_started: { bg: '#f8fafc', text: '#94a3b8' },
  in_progress: { bg: '#eff6ff', text: '#3b82f6' },
  under_review: { bg: '#fefce8', text: '#eab308' },
  on_hold: { bg: '#eef2ff', text: '#6366f1' },
  completed: { bg: '#f0fdf4', text: '#22c55e' },
  cancelled: { bg: '#fef2f2', text: '#ef4444' },
};

export default function ProjectTaskCalendar({ projectId, organisationId }: ProjectTaskCalendarProps) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const today = new Date();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['calendar-tasks', projectId],
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

  const updateTask = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ due_date })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks', projectId] });
    },
  });

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [daysInMonth, firstDayOfWeek]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    tasks.forEach((task) => {
      if (task.due_date) {
        if (!map[task.due_date]) map[task.due_date] = [];
        map[task.due_date].push(task);
      }
    });
    return map;
  }, [tasks]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = async (e: React.DragEvent, day: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    await updateTask.mutateAsync({ id: taskId, due_date: dateStr });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-zinc-400">Loading calendar...</div>;
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-bold text-zinc-900">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="rounded p-1 text-zinc-400 hover:bg-zinc-100">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Calendar size={14} />
          Today
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="border-b border-r border-zinc-100 bg-zinc-50/30" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate[dateStr] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isWeekend = idx % 7 === 0 || idx % 7 === 6;

          return (
            <div
              key={dateStr}
              className={`relative border-b border-r border-zinc-100 p-1 ${isWeekend ? 'bg-zinc-50/30' : 'bg-white'} ${isToday ? 'bg-blue-50/30' : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${isToday ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>
                  {day}
                </span>
              </div>
              <div className="mt-1 space-y-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map((task) => {
                  const cfg = STATUS_COLORS[task.status] || STATUS_COLORS.not_started;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                      className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:brightness-90 ${task.status === 'completed' ? 'opacity-50' : ''}`}
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && <span className="text-[10px] text-zinc-400">+{dayTasks.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
