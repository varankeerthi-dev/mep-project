import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ProjectTaskGanttProps {
  projectId: string;
  projectName?: string;
  organisationId: string;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

const ZOOM_CONFIG: Record<ZoomLevel, { cellWidth: number; label: string }> = {
  day: { cellWidth: 40, label: 'Day' },
  week: { cellWidth: 24, label: 'Week' },
  month: { cellWidth: 8, label: 'Month' },
  quarter: { cellWidth: 3, label: 'Quarter' },
};

const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  under_review: '#eab308',
  on_hold: '#6366f1',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

export default function ProjectTaskGantt({ projectId, projectName, organisationId }: ProjectTaskGanttProps) {
  const queryClient = useQueryClient();
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [splitPos, setSplitPos] = useState(35);
  const [draggingSplit, setDraggingSplit] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['gantt-tasks', projectId],
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
    mutationFn: async ({ id, start_date, due_date }: { id: string; start_date?: string | null; due_date?: string | null }) => {
      const updates: Record<string, unknown> = {};
      if (start_date !== undefined) updates.start_date = start_date;
      if (due_date !== undefined) updates.due_date = due_date;
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gantt-tasks', projectId] });
    },
  });

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
    return getDaysBetween(startDate, new Date(dateStr));
  }, [startDate]);

  const getBarStyle = useCallback((task: any) => {
    const startOffset = getDayOffset(task.start_date);
    const endOffset = getDayOffset(task.due_date);
    if (startOffset === null || endOffset === null) return null;
    const left = startOffset * cellWidth;
    const width = Math.max((endOffset - startOffset + 1) * cellWidth, cellWidth);
    return { left: `${left}px`, width: `${width}px` };
  }, [getDayOffset, cellWidth]);

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

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-zinc-400">Loading Gantt...</div>;
  }

  return (
    <div id="gantt-container" className="flex h-full flex-col" style={{ background: '#faf9f7' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2">
        <span className="text-[11px] font-medium text-zinc-500">Zoom:</span>
        <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {(['day', 'week', 'month', 'quarter'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${zoom === z ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
            >
              {ZOOM_CONFIG[z].label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-zinc-200" />
        <span className="text-[11px] text-zinc-400">{tasks.length} tasks · {days} days</span>
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Task List */}
        <div style={{ width: `${splitPos}%` }} className="flex flex-col border-r border-zinc-200 bg-white">
          <div className="flex items-center border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <div className="w-10 shrink-0 px-2 py-2.5 text-center">No.</div>
            <div className="flex-1 px-3 py-2.5">Task Name</div>
            <div className="w-24 shrink-0 px-2 py-2.5 text-center">Status</div>
            <div className="w-20 shrink-0 px-2 py-2.5 text-center">Due</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center border-b border-zinc-50 text-[12px] hover:bg-zinc-50/50">
                <div className="w-10 shrink-0 px-2 py-2.5 text-center text-[11px] tabular-nums text-zinc-400">{task.task_no}</div>
                <div className="flex-1 truncate px-3 py-2.5 font-medium text-zinc-900">{task.title}</div>
                <div className="w-24 shrink-0 px-2 py-2.5 text-center">
                  <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: STATUS_COLORS[task.status] || '#6b7280', backgroundColor: `${STATUS_COLORS[task.status] || '#6b7280'}15` }}>
                    {task.status}
                  </span>
                </div>
                <div className="w-20 shrink-0 px-2 py-2.5 text-center text-[11px] tabular-nums text-zinc-500">{task.due_date || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Splitter */}
        <div
          className={`w-1 cursor-col-resize bg-zinc-200 transition-colors hover:bg-blue-400 ${draggingSplit ? 'bg-blue-500' : ''}`}
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
                    className={`flex flex-col items-center border-r border-zinc-100 py-1 text-[9px] ${isToday ? 'bg-blue-50 text-blue-600' : isWeekend ? 'bg-zinc-100/50 text-zinc-400' : 'text-zinc-500'}`}
                    style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }}
                  >
                    <span className="font-medium">{date.getDate()}</span>
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
                <div key={task.id} className="relative h-[41px] border-b border-zinc-50">
                  {/* Background grid */}
                  {Array.from({ length: days }).map((_, i) => {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + i);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0 h-full border-r ${isToday ? 'bg-blue-50/30 border-blue-200' : isWeekend ? 'bg-zinc-50/50 border-zinc-100' : 'border-zinc-50'}`}
                        style={{ left: `${i * cellWidth}px`, width: `${cellWidth}px` }}
                      />
                    );
                  })}
                  {/* Today line */}
                  {(() => {
                    const todayOffset = getDayOffset(new Date().toISOString().split('T')[0]);
                    if (todayOffset === null) return null;
                    return <div className="absolute top-0 h-full w-px bg-red-400" style={{ left: `${todayOffset * cellWidth}px` }} />;
                  })()}
                  {/* Task Bar */}
                  {barStyle && (
                    <div
                      className={`absolute top-2 h-6 rounded-md transition-all hover:brightness-90 ${isCompleted ? 'opacity-60' : ''}`}
                      style={{ ...barStyle, backgroundColor: isCompleted ? '#22c55e' : (task.color || '#3b82f6') }}
                      title={`${task.title} (${task.completion_percentage}%)`}
                    >
                      <div
                        className="absolute left-0 top-0 h-full rounded-l-md"
                        style={{
                          width: `${task.completion_percentage}%`,
                          backgroundColor: isCompleted ? '#16a34a' : (task.color ? darkenColor(task.color, 0.8) : '#2563eb'),
                        }}
                      />
                      {parseInt(barStyle.width) > 60 && (
                        <span className="relative z-10 ml-2 text-[10px] font-medium text-white drop-shadow-sm">{task.title}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function getDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}
