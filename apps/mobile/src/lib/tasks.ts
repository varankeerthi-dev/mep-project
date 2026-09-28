// lib/tasks.ts — Mobile data layer for the unified Task module.
// Mirrors apps/web/src/components/tasks (same tables, RPCs, status model).

import { supabase } from './supabase';

// ── Types (subset of web Task module relevant to mobile) ────────────────────

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'under_review'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
/** Personal tasks use low/medium/high/urgent (web PersonalTaskListView). */
export type PersonalPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  organisation_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_date: string | null;
  completion_percentage: number;
  assignee_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  organisation_id: string;
  title: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
}

export interface PersonalTask {
  id: string;
  user_id: string;
  organisation_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  priority?: PersonalPriority | string | null;
  created_at: string;
}

// ── UI metadata (mirrors web STATUS_CONFIG / PRIORITY_CONFIG) ───────────────

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  not_started: { label: 'Not Started', bg: 'bg-secondary', text: 'text-muted-foreground', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  on_hold: { label: 'On Hold', bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; text: string; bg: string }> = {
  low: { label: 'Low', text: 'text-slate-500', bg: 'bg-secondary' },
  medium: { label: 'Medium', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  high: { label: 'High', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
  critical: { label: 'Critical', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
};

/** Personal tasks additionally support 'urgent' (web PersonalTaskListView). */
export const PERSONAL_PRIORITY_META: Record<PersonalPriority, { label: string; text: string; bg: string }> = {
  ...TASK_PRIORITY_META,
  urgent: { label: 'Urgent', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
} as Record<PersonalPriority, { label: string; text: string; bg: string }>;

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * "My Tasks": tasks where I'm an assignee (assignee_ids array overlaps my id),
 * open first, then by due date — same semantics as web useTasks with
 * assignee_ids filter, scoped to the mobile "My Tasks" view.
 */
export async function fetchMyTasks(orgId: string, userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organisation_id', orgId)
    .is('deleted_at', null)
    .overlaps('assignee_ids', [userId])
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Task[];
}

/** Company tasks: everything in the org (web useTasks without assignee filter). */
export async function fetchCompanyTasks(orgId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organisation_id', orgId)
    .is('deleted_at', null)
    .is('parent_task_id', null)
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as Task[];
}

export interface CreateTaskInput {
  organisationId: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  /** 'YYYY-MM-DD' — sent as-is to the date column (no TZ conversion). */
  dueDate?: string | null;
  assigneeIds?: string[];
  checklistTitles?: string[];
  createdBy: string;
  status?: TaskStatus;
}

/**
 * Create a task + optional checklist in one go (mirrors web useCreateTask):
 * if the checklist insert fails, the orphan task is soft-deleted so callers
 * never see a task whose checklist silently vanished.
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      organisation_id: input.organisationId,
      project_id: input.projectId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'not_started',
      priority: input.priority ?? 'medium',
      task_type: 'task',
      due_date: input.dueDate ?? null,
      assignee_ids: input.assigneeIds ?? [],
      completion_percentage: 0,
      is_following: false,
      is_archived: false,
      tags: [],
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.checklistTitles && input.checklistTitles.length > 0) {
    const { error: checklistError } = await supabase
      .from('task_checklist_items')
      .insert(
        input.checklistTitles.map((title, index) => ({
          task_id: task.id,
          organisation_id: input.organisationId,
          title,
          sort_order: index,
        })),
      );
    if (checklistError) {
      await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', task.id);
      throw checklistError;
    }
  }
  return task as Task;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** 'YYYY-MM-DD' or null — sent as-is (date column integrity). */
  due_date?: string | null;
  assignee_ids?: string[];
  completion_percentage?: number;
}

/** Field edits (web useUpdateTask does a direct update — same here). */
export async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

/** Soft delete (web useDeleteTask) — preserves history and RLS trail. */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw error;
}

/** Org members for assignee selection (web TaskEditDrawer fetchMembers). */
export interface OrgMemberOption {
  id: string;
  name: string;
}

/**
 * Org members with display names. There is no FK between org_members and
 * user_profiles on this database, so the embedded join fails (PGRST200);
 * resolve via user_profiles(id IN ...) instead, resiliently.
 */
export async function fetchOrgMembers(orgId: string): Promise<OrgMemberOption[]> {
  const { data: members, error } = await supabase
    .from('org_members')
    .select('user_id, role')
    .eq('organisation_id', orgId);
  if (error) throw error;

  const ids = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
  if (ids.length === 0) return [];

  let names: Record<string, string> = {};
  try {
    names = await resolveUserNames(ids);
  } catch {
    names = {};
  }

  return ids.map((id: string) => ({
    id,
    name: names[id] || id.slice(0, 8),
  }));
}

/** Fetch a single task with live values (used by the detail sheet). */
export async function fetchTask(taskId: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  return (data as Task) ?? null;
}

/**
 * Status change — direct update, exactly like web ProjectTaskBoard and
 * useUpdateTask (this database has no update_task_status RPC; verified live).
 * completed_date is stamped here; completion_percentage follows web semantics.
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      status,
      completion_percentage: status === 'completed' ? 100 : 0,
      completed_date: status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', taskId);
  if (error) throw error;
}

// ── Checklist ────────────────────────────────────────────────────────────────

export async function fetchChecklist(taskId: string): Promise<TaskChecklistItem[]> {
  const { data, error } = await supabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskChecklistItem[];
}

/**
 * Completion goes through the server-side RPC so completed_by / completed_at
 * are always stamped by the database (same as web useToggleChecklistItem).
 */
export async function toggleChecklistItem(
  itemId: string,
  isCompleted: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('toggle_task_checklist_item', {
    p_item_id: itemId,
    p_is_completed: isCompleted,
  });
  if (error) throw error;
}

export async function addChecklistItem(taskId: string, title: string): Promise<void> {
  // Next sort_order = max + 1 (mirrors web useCreateChecklistItem)
  const { data: existing, error: existingError } = await supabase
    .from('task_checklist_items')
    .select('sort_order')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0;

  const { error } = await supabase
    .from('task_checklist_items')
    .insert({ task_id: taskId, title, sort_order: nextOrder });
  if (error) throw error;
}

// ── Personal tasks ("Add to My Task" from collab messages) ───────────────────

export async function fetchPersonalTasks(userId: string): Promise<PersonalTask[]> {
  const { data, error } = await supabase
    .from('personal_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PersonalTask[];
}

/** Toggle personal task completion (same RPC as web useTogglePersonalTask). */
export async function togglePersonalTask(taskId: string, isCompleted: boolean): Promise<void> {
  const { error } = await supabase.rpc('toggle_personal_task', {
    p_task_id: taskId,
    p_is_completed: isCompleted,
  });
  if (error) throw error;
}

export interface CreatePersonalTaskInput {
  userId: string;
  organisationId: string;
  title: string;
  description?: string | null;
  /** 'YYYY-MM-DD' or null — sent as-is (date column integrity). */
  dueDate?: string | null;
  priority?: PersonalPriority;
}

/** Create a private personal task (web PersonalTaskListView.handleCreate). */
export async function createPersonalTask(input: CreatePersonalTaskInput): Promise<PersonalTask> {
  const { data, error } = await supabase
    .from('personal_tasks')
    .insert({
      user_id: input.userId,
      organisation_id: input.organisationId,
      title: input.title,
      description: input.description ?? null,
      due_date: input.dueDate ?? null,
      priority: input.priority ?? 'medium',
    })
    .select()
    .single();
  if (error) throw error;
  return data as PersonalTask;
}

/** Hard delete a personal task (web PersonalTaskListView.handleDelete). */
export async function deletePersonalTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('personal_tasks').delete().eq('id', taskId);
  if (error) throw error;
}

// ── Resolve names for assignees / creators (batched profile lookup) ─────────

export async function resolveUserNames(
  userIds: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', unique);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as any[]) {
    map[row.id] = row.full_name ?? 'Member';
  }
  return map;
}

// ── Time tracking (web useActiveTimer / useStartTimer / useStopTimer) ───────

export interface ActiveTimer {
  id: string;
  task_id: string;
  start_time: string;
  task_title: string;
}

export async function fetchActiveTimer(userId: string): Promise<ActiveTimer | null> {
  const { data, error } = await supabase
    .from('task_time_logs')
    .select('id, task_id, start_time, tasks!inner(id, title)')
    .eq('user_id', userId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return {
    id: row.id,
    task_id: row.task_id,
    start_time: row.start_time,
    task_title: row.tasks?.title ?? 'Task',
  };
}

/** Start a timer: stops any open timer first (mirrors web useStartTimer). */
export async function startTimer(orgId: string, userId: string, taskId: string): Promise<void> {
  const { data: active } = await supabase
    .from('task_time_logs')
    .select('id')
    .eq('user_id', userId)
    .is('end_time', null);
  if (active?.length) {
    await supabase
      .from('task_time_logs')
      .update({ end_time: new Date().toISOString() })
      .in('id', active.map((a) => a.id));
  }
  const { error } = await supabase.from('task_time_logs').insert({
    task_id: taskId,
    user_id: userId,
    organisation_id: orgId,
    start_time: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function stopTimer(logId: string): Promise<void> {
  const { error } = await supabase
    .from('task_time_logs')
    .update({ end_time: new Date().toISOString() })
    .eq('id', logId);
  if (error) throw error;
}
