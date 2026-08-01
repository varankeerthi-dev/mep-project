import { useMemo, useState } from 'react';
import { Gantt } from '@/components/reui/gantt/gantt';
import { GanttNav } from '@/components/reui/gantt/gantt-nav';
import { GanttView } from '@/components/reui/gantt/gantt-view';
import { Card, CardContent } from '@/components/ui/Card';
import type { GanttEvent, GanttResource } from '@/components/reui/gantt/gantt-types';
import { useGanttData, type TaskGroup, type ProjectTask, type ProjectMilestone } from '@/hooks/useGanttData';
import { Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  'not_started': 'var(--color-slate-400)',
  'in_progress': 'var(--color-blue-500)',
  'under_review': 'var(--color-amber-500)',
  'on_hold': 'var(--color-orange-500)',
  'completed': 'var(--color-emerald-500)',
  'cancelled': 'var(--color-red-400)',
};

const MILESTONE_COLORS: Record<string, string> = {
  equipment_testing: 'var(--color-violet-500)',
  inspection: 'var(--color-cyan-500)',
  handover: 'var(--color-emerald-500)',
  other: 'var(--color-slate-500)',
};

function toDateOrNull(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildResources(
  taskGroups: TaskGroup[],
  tasks: ProjectTask[],
  milestones: ProjectMilestone[]
): GanttResource[] {
  const groupMap = new Map<string, TaskGroup>();
  taskGroups.forEach((g) => groupMap.set(g.id, g));

  const groupsByProject = new Map<string, TaskGroup[]>();
  taskGroups.forEach((g) => {
    const list = groupsByProject.get(g.project_id) || [];
    list.push(g);
    groupsByProject.set(g.project_id, list);
  });

  const resources: GanttResource[] = [];

  taskGroups.forEach((group) => {
    const groupTasks = tasks.filter((t) => t.task_group_id === group.id);
    resources.push({
      id: `group-${group.id}`,
      title: group.name,
      children: groupTasks.map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
      })),
    });
  });

  const ungroupedTasks = tasks.filter((t) => !t.task_group_id);
  if (ungroupedTasks.length > 0) {
    resources.push({
      id: 'ungrouped',
      title: 'Tasks',
      children: ungroupedTasks.map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
      })),
    });
  }

  if (milestones.length > 0) {
    resources.push({
      id: 'milestones',
      title: 'Milestones',
      children: milestones.map((m) => ({
        id: `milestone-${m.id}`,
        title: m.name,
      })),
    });
  }

  return resources;
}

function buildEvents(
  taskGroups: TaskGroup[],
  tasks: ProjectTask[],
  milestones: ProjectMilestone[],
  projectStartDate: string | null,
  projectEndDate: string | null
): GanttEvent[] {
  const events: GanttEvent[] = [];

  const pStart = toDateOrNull(projectStartDate);
  const pEnd = toDateOrNull(projectEndDate);

  if (pStart && pEnd) {
    events.push({
      id: 'project-span',
      title: 'Project Duration',
      start: pStart,
      end: pEnd,
      allDay: true,
      color: 'var(--color-slate-300)',
      readOnly: true,
      progress: undefined,
    });
  }

  taskGroups.forEach((group) => {
    const start = toDateOrNull(group.start_date);
    const end = toDateOrNull(group.due_date);
    if (start && end) {
      const groupTasks = tasks.filter((t) => t.task_group_id === group.id);
      const completedCount = groupTasks.filter((t) => t.status === 'completed').length;
      const progress = groupTasks.length > 0 ? Math.round((completedCount / groupTasks.length) * 100) : 0;

      events.push({
        id: `group-bar-${group.id}`,
        title: group.name,
        start,
        end: addDays(end, 1),
        allDay: true,
        color: 'var(--color-indigo-400)',
        resourceId: `group-${group.id}`,
        progress,
        readOnly: true,
      });
    }
  });

  tasks.forEach((task) => {
    const start = toDateOrNull(task.start_date);
    const end = toDateOrNull(task.due_date);
    if (start && end) {
      events.push({
        id: `task-bar-${task.id}`,
        title: task.title,
        start,
        end: addDays(end, 1),
        allDay: true,
        color: task.color || STATUS_COLORS[task.status] || 'var(--color-blue-500)',
        resourceId: `task-${task.id}`,
        progress: task.completion_percentage,
        readOnly: true,
      });
    }
  });

  milestones.forEach((milestone) => {
    const date = toDateOrNull(milestone.milestone_date);
    if (date) {
      events.push({
        id: `milestone-bar-${milestone.id}`,
        title: milestone.name,
        start: date,
        end: addDays(date, 1),
        allDay: true,
        color: milestone.is_completed
          ? 'var(--color-emerald-500)'
          : MILESTONE_COLORS[milestone.type] || 'var(--color-amber-500)',
        resourceId: `milestone-${milestone.id}`,
        progress: milestone.is_completed ? 100 : 0,
        readOnly: true,
      });
    }
  });

  return events;
}

interface ProjectGanttProps {
  projectId: string;
  projectName?: string;
}

export default function ProjectGantt({ projectId, projectName }: ProjectGanttProps) {
  const { data, isLoading, error } = useGanttData(projectId);
  const [scale, setScale] = useState<'day' | 'week' | 'month'>('month');

  const resources = useMemo(() => {
    if (!data) return [];
    return buildResources(data.taskGroups, data.tasks, data.milestones);
  }, [data]);

  const events = useMemo(() => {
    if (!data) return [];
    return buildEvents(
      data.taskGroups,
      data.tasks,
      data.milestones,
      data.projectStartDate,
      data.projectEndDate
    );
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, completed: 0, inProgress: 0, delayed: 0 };
    const total = data.tasks.length;
    const completed = data.tasks.filter((t) => t.status === 'completed').length;
    const inProgress = data.tasks.filter((t) => t.status === 'in_progress').length;
    const delayed = data.tasks.filter((t) => t.status === 'on_hold' || t.status === 'under_review').length;
    return { total, completed, inProgress, delayed };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading Gantt chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-destructive">Failed to load Gantt data</div>
      </div>
    );
  }

  if (!data || (resources.length === 0 && events.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Calendar className="w-10 h-10 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">No timeline data</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add task groups and tasks with dates to see the Gantt chart
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">
              <span className="font-medium">{stats.completed}</span>
              <span className="text-muted-foreground"> / {stats.total} completed</span>
            </span>
          </div>
          {stats.inProgress > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm">
                <span className="font-medium">{stats.inProgress}</span>
                <span className="text-muted-foreground"> in progress</span>
              </span>
            </div>
          )}
          {stats.delayed > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm">
                <span className="font-medium">{stats.delayed}</span>
                <span className="text-muted-foreground"> delayed</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted">
          {(['day', 'week', 'month'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                scale === s
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Card className="py-0 overflow-hidden">
        <CardContent className="p-0">
          <Gantt
            defaultEvents={events}
            resources={resources}
            defaultScale={scale}
            treePanel={{ width: 240 }}
            className="h-[500px] w-full"
          >
            <GanttNav />
            <GanttView />
          </Gantt>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--color-emerald-500)' }} />
          Completed
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--color-blue-500)' }} />
          In Progress
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--color-amber-500)' }} />
          Possible Delay
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--color-indigo-400)' }} />
          Task Group
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--color-violet-500)' }} />
          Milestone
        </div>
      </div>
    </div>
  );
}
