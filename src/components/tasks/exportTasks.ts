// ============================================
// UNIFIED TASK MODULE — EXPORT UTILITIES
// CSV + PDF export for task lists
// ============================================
import type { Task, TaskGroup } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG, DISCIPLINE_CONFIG, TASK_TYPE_CONFIG } from './types';

export function exportTasksToCSV(tasks: Task[], groups: TaskGroup[]): string {
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  const headers = [
    'Task No',
    'Title',
    'Type',
    'Group',
    'Status',
    'Priority',
    'Discipline',
    'Assignee IDs',
    'Start Date',
    'Due Date',
    'Duration (days)',
    'Est. Hours',
    'Act. Hours',
    'Progress %',
    'Location',
    'Drawing Ref',
    'WBS Code',
    'Tags',
    'Created At',
    'Updated At',
  ];

  const rows = tasks.map((t) => [
    t.task_no,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    TASK_TYPE_CONFIG[t.task_type]?.label || t.task_type,
    groupMap.get(t.task_group_id || '') || '',
    STATUS_CONFIG[t.status]?.label || t.status,
    PRIORITY_CONFIG[t.priority]?.label || t.priority,
    t.discipline ? DISCIPLINE_CONFIG[t.discipline]?.label : '',
    (t.assignee_ids || []).join('; '),
    t.start_date || '',
    t.due_date || '',
    t.duration_days ?? '',
    t.estimated_hours ?? '',
    t.actual_hours ?? '',
    t.completion_percentage,
    t.location || '',
    t.drawing_ref || '',
    t.wbs_code || '',
    (t.tags || []).join('; '),
    t.created_at,
    t.updated_at,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTasksSummary(tasks: Task[]): string {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const overdue = tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled' || !t.due_date) return false;
    return new Date(t.due_date) < new Date();
  }).length;
  const avgProgress = total > 0
    ? Math.round(tasks.reduce((sum, t) => sum + t.completion_percentage, 0) / total)
    : 0;
  const totalEstHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActHours = tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

  return [
    'Task Summary Report',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    `Total Tasks: ${total}`,
    `Completed: ${completed}`,
    `In Progress: ${inProgress}`,
    `Overdue: ${overdue}`,
    `Average Progress: ${avgProgress}%`,
    `Total Estimated Hours: ${totalEstHours.toFixed(1)}`,
    `Total Actual Hours: ${totalActHours.toFixed(1)}`,
    '',
    'By Status:',
    ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
      const count = tasks.filter((t) => t.status === key).length;
      return `  ${cfg.label}: ${count}`;
    }),
    '',
    'By Priority:',
    ...Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
      const count = tasks.filter((t) => t.priority === key).length;
      return `  ${cfg.label}: ${count}`;
    }),
    '',
    'By Discipline:',
    ...Object.entries(DISCIPLINE_CONFIG).map(([key, cfg]) => {
      const count = tasks.filter((t) => t.discipline === key).length;
      return `  ${cfg.label}: ${count}`;
    }),
  ].join('\n');
}
