// Project Tasks Module Types

export type TaskPriority = 'None' | 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Possible Delay' | 'On Hold' | 'Completed';

export interface TaskAssignee {
  id: string;
  name: string;
  avatar?: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  task_group_id: string | null;
  parent_task_id: string | null;
  task_no: number;
  name: string;
  description?: string;
  assignees: TaskAssignee[];
  status: TaskStatus;
  tags: string[];
  start_date: string | null;
  due_date: string | null;
  duration?: string;
  priority: TaskPriority;
  completion_percentage: number;
  color?: string;
  is_following: boolean;
  organisation_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  subtasks?: ProjectTask[];
  subtask_count?: number;
}

export interface TaskGroup {
  id: string;
  project_id: string;
  name: string;
  start_date: string | null;
  due_date: string | null;
  is_collapsed: boolean;
  sort_order: number;
  organisation_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  tasks?: ProjectTask[];
  task_count?: number;
}

export interface TaskView {
  id: string;
  user_id: string;
  project_id: string;
  view_name: string;
  columns: TaskColumns;
  sort_order: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskColumns {
  task_no: boolean;
  name: boolean;
  assignees: boolean;
  status: boolean;
  tags: boolean;
  start_date: boolean;
  due_date: boolean;
  duration: boolean;
  priority: boolean;
  completion_percentage: boolean;
}

export interface TaskCreateInput {
  project_id: string;
  task_group_id?: string | null;
  parent_task_id?: string | null;
  name: string;
  description?: string;
  assignees?: TaskAssignee[];
  status?: TaskStatus;
  tags?: string[];
  start_date?: string | null;
  due_date?: string | null;
  duration?: string;
  priority?: TaskPriority;
  completion_percentage?: number;
  color?: string;
}

export interface TaskUpdateInput {
  name?: string;
  description?: string;
  task_group_id?: string | null;
  parent_task_id?: string | null;
  assignees?: TaskAssignee[];
  status?: TaskStatus;
  tags?: string[];
  start_date?: string | null;
  due_date?: string | null;
  duration?: string;
  priority?: TaskPriority;
  completion_percentage?: number;
  color?: string;
  is_following?: boolean;
  task_no?: number;
}

export interface GroupCreateInput {
  project_id: string;
  name: string;
  start_date?: string | null;
  due_date?: string | null;
}

export interface GroupUpdateInput {
  name?: string;
  start_date?: string | null;
  due_date?: string | null;
  is_collapsed?: boolean;
  sort_order?: number;
}

// Column visibility defaults
export const DEFAULT_TASK_COLUMNS: TaskColumns = {
  task_no: true,
  name: true,
  assignees: true,
  status: true,
  tags: false,
  start_date: true,
  due_date: true,
  duration: true,
  priority: true,
  completion_percentage: true,
};

// Column labels
export const COLUMN_LABELS: Record<keyof TaskColumns, string> = {
  task_no: 'S.No',
  name: 'Task Name',
  assignees: 'Assignees',
  status: 'Status',
  tags: 'Tags',
  start_date: 'Start Date',
  due_date: 'Due Date',
  duration: 'Duration',
  priority: 'Priority',
  completion_percentage: '% Complete',
};

// Priority colors
export const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; dot: string }> = {
  None: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  Low: { bg: '#dbeafe', text: '#2563eb', dot: '#3b82f6' },
  Medium: { bg: '#fef3c7', text: '#d97706', dot: '#f59e0b' },
  High: { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
};

// Status colors
export const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  'Not Started': { bg: '#f1f5f9', text: '#64748b' },
  'In Progress': { bg: '#dbeafe', text: '#2563eb' },
  'Possible Delay': { bg: '#fef3c7', text: '#d97706' },
  'On Hold': { bg: '#e0e7ff', text: '#4f46e5' },
  'Completed': { bg: '#dcfce7', text: '#16a34a' },
};

// Task color presets
export const TASK_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];
