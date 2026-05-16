// ============================================
// UNIFIED TASK MODULE — TYPES
// ============================================

export type TaskStatus = 'not_started' | 'in_progress' | 'under_review' | 'on_hold' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'task' | 'milestone' | 'deliverable' | 'inspection' | 'rfi' | 'ncr';
export type TaskDiscipline = 'mechanical' | 'electrical' | 'plumbing' | 'fire_protection' | 'elv' | 'civil' | 'architectural' | 'general';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type TaskViewType = 'table' | 'board' | 'gantt' | 'calendar';
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';

// ============================================
// CORE ENTITIES
// ============================================

export interface TaskGroup {
  id: string;
  organisation_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  start_date: string | null;
  due_date: string | null;
  is_collapsed: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  task_count?: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  organisation_id: string;
  project_id: string | null;
  task_group_id: string | null;
  parent_task_id: string | null;
  task_no: number;

  title: string;
  description: string | null;
  task_type: TaskType;

  status: TaskStatus;
  priority: TaskPriority;

  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  duration_days: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;

  assignee_ids: string[];
  reporter_id: string | null;
  approved_by_id: string | null;

  completion_percentage: number;

  tags: string[];
  color: string | null;
  is_following: boolean;
  is_archived: boolean;

  discipline: TaskDiscipline | null;
  location: string | null;
  drawing_ref: string | null;
  wbs_code: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  // Computed/joined
  subtasks?: Task[];
  subtask_count?: number;
  assignees?: TaskAssignee[];
  dependencies?: TaskDependency[];
  comments_count?: number;
  attachments_count?: number;
}

export interface TaskAssignee {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role?: string;
}

// ============================================
// DEPENDENCIES
// ============================================

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  created_at: string;
  // Joined
  depends_on_task?: Task;
}

// ============================================
// COMMENTS
// ============================================

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  replies?: TaskComment[];
  reply_count?: number;
}

// ============================================
// ATTACHMENTS
// ============================================

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  thumbnail_path: string | null;
  created_at: string;
}

// ============================================
// TIME LOGS
// ============================================

export interface TaskTimeLog {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  description: string | null;
  billable: boolean;
  created_at: string;
  // Joined
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

// ============================================
// ACTIVITY LOG
// ============================================

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  // Joined
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

// ============================================
// CUSTOM FIELDS
// ============================================

export interface TaskCustomField {
  id: string;
  organisation_id: string;
  field_name: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export interface TaskCustomFieldValue {
  id: string;
  task_id: string;
  custom_field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
}

// ============================================
// SAVED VIEWS
// ============================================

export interface TaskView {
  id: string;
  user_id: string;
  organisation_id: string;
  project_id: string | null;
  view_name: string;
  view_type: TaskViewType;
  filters: TaskFilters;
  columns: TaskColumnConfig;
  sort_by: SortConfig[];
  group_by: string | null;
  is_default: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignee_ids?: string[];
  discipline?: TaskDiscipline[];
  task_type?: TaskType[];
  tags?: string[];
  date_range?: { from: string; to: string };
  search?: string;
  [key: string]: unknown;
}

export interface TaskColumnConfig {
  [key: string]: {
    visible: boolean;
    width?: number;
    order: number;
  };
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// ============================================
// INPUT TYPES (for create/update)
// ============================================

export interface TaskCreateInput {
  project_id?: string | null;
  task_group_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  description?: string;
  task_type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
  duration_days?: number | null;
  estimated_hours?: number | null;
  assignee_ids?: string[];
  tags?: string[];
  color?: string | null;
  discipline?: TaskDiscipline | null;
  location?: string | null;
  drawing_ref?: string | null;
  wbs_code?: string | null;
}

export interface TaskUpdateInput {
  title?: string;
  description?: string | null;
  task_type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  task_group_id?: string | null;
  parent_task_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  duration_days?: number | null;
  estimated_hours?: number | null;
  assignee_ids?: string[];
  tags?: string[];
  color?: string | null;
  is_following?: boolean;
  is_archived?: boolean;
  completion_percentage?: number;
  discipline?: TaskDiscipline | null;
  location?: string | null;
  drawing_ref?: string | null;
  wbs_code?: string | null;
  task_no?: number;
}

export interface GroupCreateInput {
  project_id?: string | null;
  name: string;
  description?: string;
  color?: string | null;
  start_date?: string | null;
  due_date?: string | null;
}

export interface GroupUpdateInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  is_collapsed?: boolean;
  sort_order?: number;
}

export interface DependencyCreateInput {
  task_id: string;
  depends_on_id: string;
  dependency_type?: DependencyType;
  lag_days?: number;
}

export interface CommentCreateInput {
  task_id: string;
  content: string;
  mentions?: string[];
  parent_id?: string | null;
}

export interface TimeLogCreateInput {
  task_id: string;
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  description?: string;
  billable?: boolean;
}

// ============================================
// CONSTANTS & CONFIG
// ============================================

export const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}> = {
  not_started:  { label: 'Not Started',  bg: '#f4f4f5', text: '#52525b', border: '#e4e4e7', dot: '#a1a1aa' },
  in_progress:  { label: 'In Progress',  bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  under_review: { label: 'Under Review', bg: '#fef3c7', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  on_hold:      { label: 'On Hold',      bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe', dot: '#6366f1' },
  completed:    { label: 'Completed',    bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  cancelled:    { label: 'Cancelled',    bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
};

export const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  bg: string;
  text: string;
  dot: string;
}> = {
  low:      { label: 'Low',      bg: '#f0f9ff', text: '#0369a1', dot: '#0ea5e9' },
  medium:   { label: 'Medium',   bg: '#fefce8', text: '#a16207', dot: '#eab308' },
  high:     { label: 'High',     bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  critical: { label: 'Critical', bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
};

export const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string }> = {
  task:        { label: 'Task',        icon: '📋' },
  milestone:   { label: 'Milestone',   icon: '🏁' },
  deliverable: { label: 'Deliverable', icon: '📦' },
  inspection:  { label: 'Inspection',  icon: '🔍' },
  rfi:         { label: 'RFI',         icon: '❓' },
  ncr:         { label: 'NCR',         icon: '⚠️' },
};

export const DISCIPLINE_CONFIG: Record<TaskDiscipline, { label: string; color: string }> = {
  mechanical:      { label: 'Mechanical',      color: '#3b82f6' },
  electrical:      { label: 'Electrical',      color: '#eab308' },
  plumbing:        { label: 'Plumbing',        color: '#06b6d4' },
  fire_protection: { label: 'Fire Protection', color: '#ef4444' },
  elv:             { label: 'ELV',             color: '#8b5cf6' },
  civil:           { label: 'Civil',           color: '#78716c' },
  architectural:   { label: 'Architectural',   color: '#ec4899' },
  general:         { label: 'General',         color: '#6b7280' },
};

export const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  FS: 'Finish-to-Start',
  SS: 'Start-to-Start',
  FF: 'Finish-to-Finish',
  SF: 'Start-to-Finish',
};

// Default column config for table view
export const DEFAULT_COLUMNS: TaskColumnConfig = {
  task_no:             { visible: true,  width: 60,  order: 0 },
  title:               { visible: true,  width: 300, order: 1 },
  status:              { visible: true,  width: 120, order: 2 },
  priority:            { visible: true,  width: 100, order: 3 },
  assignees:           { visible: true,  width: 140, order: 4 },
  discipline:          { visible: true,  width: 120, order: 5 },
  start_date:          { visible: true,  width: 110, order: 6 },
  due_date:            { visible: true,  width: 110, order: 7 },
  duration_days:       { visible: false, width: 80,  order: 8 },
  completion_percentage: { visible: true,  width: 100, order: 9 },
  tags:                { visible: false, width: 140, order: 10 },
  location:            { visible: false, width: 120, order: 11 },
  drawing_ref:         { visible: false, width: 120, order: 12 },
  wbs_code:            { visible: false, width: 100, order: 13 },
  estimated_hours:     { visible: false, width: 100, order: 14 },
  actual_hours:        { visible: false, width: 100, order: 15 },
};

// ============================================
// PERMISSIONS
// ============================================

export type TaskPermission =
  | 'tasks.read'
  | 'tasks.create'
  | 'tasks.update'
  | 'tasks.delete'
  | 'tasks.assign'
  | 'tasks.change_status'
  | 'tasks.add_comment'
  | 'tasks.add_attachment'
  | 'tasks.log_time'
  | 'tasks.manage_dependencies'
  | 'tasks.bulk_edit'
  | 'tasks.export'
  | 'tasks.manage_views'
  | 'tasks.manage_custom_fields';

export const ROLE_PERMISSIONS: Record<string, TaskPermission[]> = {
  admin: [
    'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete',
    'tasks.assign', 'tasks.change_status', 'tasks.add_comment',
    'tasks.add_attachment', 'tasks.log_time', 'tasks.manage_dependencies',
    'tasks.bulk_edit', 'tasks.export', 'tasks.manage_views',
    'tasks.manage_custom_fields',
  ],
  project_manager: [
    'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete',
    'tasks.assign', 'tasks.change_status', 'tasks.add_comment',
    'tasks.add_attachment', 'tasks.log_time', 'tasks.manage_dependencies',
    'tasks.bulk_edit', 'tasks.export', 'tasks.manage_views',
  ],
  engineer: [
    'tasks.read', 'tasks.create', 'tasks.update',
    'tasks.change_status', 'tasks.add_comment',
    'tasks.add_attachment', 'tasks.log_time', 'tasks.export',
    'tasks.manage_views',
  ],
  supervisor: [
    'tasks.read', 'tasks.create', 'tasks.update', 'tasks.assign',
    'tasks.change_status', 'tasks.add_comment',
    'tasks.add_attachment', 'tasks.log_time', 'tasks.bulk_edit',
    'tasks.export', 'tasks.manage_views',
  ],
  viewer: [
    'tasks.read', 'tasks.add_comment', 'tasks.export', 'tasks.manage_views',
  ],
  subcontractor: [
    'tasks.read', 'tasks.update', 'tasks.change_status',
    'tasks.add_comment', 'tasks.add_attachment', 'tasks.log_time',
    'tasks.manage_views',
  ],
};
