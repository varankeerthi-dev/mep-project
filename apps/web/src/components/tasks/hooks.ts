// ============================================
// UNIFIED TASK MODULE — REACT QUERY HOOKS
// ============================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  Task,
  TaskChecklistItem,
  TaskGroup,
  TaskDependency,
  TaskComment,
  TaskAttachment,
  TaskTimeLog,
  TaskActivity,
  TaskView,
  TaskCustomField,
  TaskCustomFieldValue,
  TaskCreateInput,
  TaskUpdateInput,
  GroupCreateInput,
  GroupUpdateInput,
  DependencyCreateInput,
  CommentCreateInput,
  TimeLogCreateInput,
  TaskFilters,
  SortConfig,
} from './types';

// ============================================
// QUERY KEY FACTORIES
// ============================================
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters, projectId?: string | null) =>
    [...taskKeys.lists(), { filters, projectId }] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  groups: (projectId?: string | null) => [...taskKeys.all, 'groups', projectId] as const,
  dependencies: (taskId: string) => [...taskKeys.all, 'dependencies', taskId] as const,
  comments: (taskId: string) => [...taskKeys.all, 'comments', taskId] as const,
  attachments: (taskId: string) => [...taskKeys.all, 'attachments', taskId] as const,
  timeLogs: (taskId: string) => [...taskKeys.all, 'time-logs', taskId] as const,
  activity: (taskId: string) => [...taskKeys.all, 'activity', taskId] as const,
  views: (userId: string, projectId?: string | null) =>
    [...taskKeys.all, 'views', userId, projectId] as const,
  customFields: (orgId: string) => [...taskKeys.all, 'custom-fields', orgId] as const,
  assignees: (orgId: string) => [...taskKeys.all, 'assignees', orgId] as const,
  checklist: (taskId: string) => [...taskKeys.all, 'checklist', taskId] as const,
};

// ============================================
// TASKS
// ============================================

export function useTasks(
  orgId: string | undefined,
  projectId?: string | null,
  filters?: TaskFilters,
  sortBy?: SortConfig[]
) {
  return useQuery({
    queryKey: taskKeys.list(filters || {}, projectId),
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('organisation_id', orgId!)
        .is('deleted_at', null);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (filters?.status?.length) {
        query = query.in('status', filters.status);
      }
      if (filters?.priority?.length) {
        query = query.in('priority', filters.priority);
      }
      if (filters?.discipline?.length) {
        query = query.in('discipline', filters.discipline);
      }
      if (filters?.task_type?.length) {
        query = query.in('task_type', filters.task_type);
      }
      if (filters?.assignee_ids?.length) {
        query = query.overlaps('assignee_ids', filters.assignee_ids);
      }
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      if (filters?.date_range) {
        query = query.gte('due_date', filters.date_range.from).lte('due_date', filters.date_range.to);
      }

      if (sortBy?.length) {
        for (const sort of sortBy) {
          query = query.order(sort.field, { ascending: sort.direction === 'asc' });
        }
      } else {
        query = query.order('task_no', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Task[];
    },
    enabled: !!orgId,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Task;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskCreateInput & { organisation_id: string; created_by: string }) => {
      const { checklist_titles, subcontractor_ids: _ignoredSubs, ...taskInput } = input;
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...taskInput,
          status: taskInput.status || 'not_started',
          priority: taskInput.priority || 'medium',
          task_type: taskInput.task_type || 'task',
          completion_percentage: 0,
          is_following: false,
          is_archived: false,
          tags: taskInput.tags || [],
          assignee_ids: taskInput.assignee_ids || [],
        })
        .select()
        .single();
      if (error) throw error;
      const task = data as unknown as Task;
      // Checklist items are created with the task (spec §12). If the bulk
      // insert fails, the orphan task is removed so callers never see a
      // task whose checklist silently vanished.
      if (checklist_titles && checklist_titles.length > 0) {
        const { error: checklistError } = await supabase
          .from('task_checklist_items')
          .insert(
            checklist_titles.map((title, index) => ({
              task_id: task.id,
              organisation_id: task.organisation_id,
              title,
              sort_order: index,
            })),
          );
        if (checklistError) {
          await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', task.id);
          throw checklistError;
        }
      }
      return task;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: taskKeys.list({}, variables.project_id) });
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdateInput & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Task;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(id) });
      const previous = queryClient.getQueryData<Task>(taskKeys.detail(id));
      if (previous) {
        queryClient.setQueryData(taskKeys.detail(id), { ...previous, ...updates });
      }
      return { previous };
    },
    onError: (_, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.detail(id), context.previous);
      }
    },
    onSettled: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: taskKeys.detail((data as Task).id) });
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      }
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: TaskUpdateInput }) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ============================================
// TASK GROUPS
// ============================================

export function useTaskGroups(orgId: string | undefined, projectId?: string | null) {
  return useQuery({
    queryKey: taskKeys.groups(projectId),
    queryFn: async () => {
      let query = supabase
        .from('task_groups')
        .select('*')
        .eq('organisation_id', orgId!);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      query = query.order('sort_order', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as TaskGroup[];
    },
    enabled: !!orgId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GroupCreateInput & { organisation_id: string; created_by: string }) => {
      const { data, error } = await supabase
        .from('task_groups')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskGroup;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.groups(variables.project_id) });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: GroupUpdateInput & { id: string }) => {
      const { data, error } = await supabase
        .from('task_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskGroup;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.groups() });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_groups').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.groups() });
    },
  });
}

// ============================================
// DEPENDENCIES
// ============================================

export function useTaskDependencies(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.dependencies(taskId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select('*')
        .eq('task_id', taskId!);
      if (error) throw error;
      return data as unknown as TaskDependency[];
    },
    enabled: !!taskId,
  });
}

export function useCreateDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DependencyCreateInput) => {
      const { data, error } = await supabase
        .from('task_dependencies')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskDependency;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies((data as TaskDependency).task_id) });
    },
  });
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_dependencies').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// ============================================
// COMMENTS
// ============================================

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.comments(taskId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId!)
        .is('parent_id', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as TaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CommentCreateInput & { user_id: string }) => {
      const { data, error } = await supabase
        .from('task_comments')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskComment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments((data as TaskComment).task_id) });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', id)
        .select('task_id')
        .single();
      if (error) throw error;
      return data as { task_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.comments(data.task_id) });
    },
  });
}

// ============================================
// ATTACHMENTS
// ============================================

export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.attachments(taskId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as TaskAttachment[];
    },
    enabled: !!taskId,
  });
}

export function useCreateAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      task_id: string;
      user_id: string;
      file_name: string;
      file_type?: string;
      file_size?: number;
      storage_path: string;
      thumbnail_path?: string;
    }) => {
      const { data, error } = await supabase
        .from('task_attachments')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskAttachment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.attachments((data as TaskAttachment).task_id) });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([storagePath]);
      if (storageError) throw storageError;

      const { data, error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', id)
        .select('task_id')
        .single();
      if (error) throw error;
      return data as { task_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.attachments(data.task_id) });
    },
  });
}

// ============================================
// TIME LOGS
// ============================================

export function useTaskTimeLogs(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.timeLogs(taskId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .select('*')
        .eq('task_id', taskId!)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data as unknown as TaskTimeLog[];
    },
    enabled: !!taskId,
  });
}

export function useCreateTimeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TimeLogCreateInput & { user_id: string }) => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskTimeLog;
    },
    onSuccess: (data) => {
      const taskId = (data as TaskTimeLog).task_id;
      queryClient.invalidateQueries({ queryKey: taskKeys.timeLogs(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useUpdateTimeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TimeLogCreateInput>) => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskTimeLog;
    },
    onSuccess: (data) => {
      const taskId = (data as TaskTimeLog).task_id;
      queryClient.invalidateQueries({ queryKey: taskKeys.timeLogs(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

export function useDeleteTimeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .delete()
        .eq('id', id)
        .select('task_id')
        .single();
      if (error) throw error;
      return data as { task_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.timeLogs(data.task_id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.task_id) });
    },
  });
}

// ============================================
// ACTIVITY LOG
// ============================================

export function useTaskActivity(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.activity(taskId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_activity_log')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as TaskActivity[];
    },
    enabled: !!taskId,
  });
}

// ============================================
// SAVED VIEWS
// ============================================

export function useTaskViews(userId: string | undefined, projectId?: string | null) {
  return useQuery({
    queryKey: taskKeys.views(userId!, projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_views')
        .select('*')
        .eq('user_id', userId!)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as unknown as TaskView[];
    },
    enabled: !!userId,
  });
}

export function useCreateTaskView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      organisation_id: string;
      project_id?: string | null;
      view_name: string;
      view_type?: string;
      filters?: Record<string, unknown>;
      columns?: Record<string, unknown>;
      sort_by?: unknown[];
      group_by?: string | null;
      is_default?: boolean;
      is_shared?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('task_views')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskView;
    },
    onSuccess: (data) => {
      const view = data as TaskView;
      queryClient.invalidateQueries({ queryKey: taskKeys.views(view.user_id, view.project_id) });
    },
  });
}

export function useUpdateTaskView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<TaskView, 'id'>>) => {
      const { data, error } = await supabase
        .from('task_views')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskView;
    },
    onSuccess: (data) => {
      const view = data as TaskView;
      queryClient.invalidateQueries({ queryKey: taskKeys.views(view.user_id, view.project_id) });
    },
  });
}

export function useDeleteTaskView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_views').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

// ============================================
// CUSTOM FIELDS
// ============================================

export function useCustomFields(orgId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.customFields(orgId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_custom_fields')
        .select('*')
        .eq('organisation_id', orgId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as unknown as TaskCustomField[];
    },
    enabled: !!orgId,
  });
}

export function useCustomFieldValues(taskId: string | null) {
  return useQuery({
    queryKey: [...taskKeys.all, 'custom-field-values', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_custom_field_values')
        .select('*')
        .eq('task_id', taskId!);
      if (error) throw error;
      return data as unknown as TaskCustomFieldValue[];
    },
    enabled: !!taskId,
  });
}

// ============================================
// TEAM MEMBERS (for assignee selection)
// ============================================

export function useTeamMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.assignees(orgId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_members')
        .select('user_id, role')
        .eq('organisation_id', orgId!);
      if (error) throw error;
      return (data || []).map((m: { user_id: string; role: string }) => ({
        id: m.user_id,
        role: m.role,
      }));
    },
    enabled: !!orgId,
  });
}

// ============================================
// REORDER TASKS (Phase 1 — Feature #15)
// ============================================

export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; task_no: number; task_group_id?: string }[]) => {
      const promises = updates.map(({ id, ...data }) =>
        supabase.from('tasks').update(data).eq('id', id)
      );
      const results = await Promise.all(promises);
      const error = results.find((r) => r.error);
      if (error) throw error.error;
      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ============================================
// BULK ASSIGN TASKS (Phase 1 — Feature #18)
// ============================================

export type TimeHealth = 'on-track' | 'warning' | 'over-budget' | 'no-estimate';

export function getTimeHealth(estimated: number | null | undefined, actual: number | null | undefined): TimeHealth {
  if (!estimated || !actual) return 'no-estimate';
  const ratio = actual / estimated;
  if (ratio < 0.8) return 'on-track';
  if (ratio <= 1.0) return 'warning';
  return 'over-budget';
}

export function useBulkAssignTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskIds, assigneeId }: { taskIds: string[]; assigneeId: string }) => {
      const { data: tasks, error: fetchError } = await supabase
        .from('tasks')
        .select('id, assignee_ids')
        .in('id', taskIds);

      if (fetchError) throw fetchError;

      const promises = (tasks || []).map((task) => {
        const current: string[] = task.assignee_ids || [];
        if (current.includes(assigneeId)) return null;
        return supabase
          .from('tasks')
          .update({ assignee_ids: [...current, assigneeId] })
          .eq('id', task.id);
      });

      const results = await Promise.all(promises);
      const error = results.find((r) => r?.error);
      if (error) throw error.error;
      return taskIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useBulkUnassignTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskIds, assigneeId }: { taskIds: string[]; assigneeId: string }) => {
      const { data: tasks, error: fetchError } = await supabase
        .from('tasks')
        .select('id, assignee_ids')
        .in('id', taskIds);

      if (fetchError) throw fetchError;

      const promises = (tasks || []).map((task) => {
        const current: string[] = task.assignee_ids || [];
        const updated = current.filter((id) => id !== assigneeId);
        return supabase
          .from('tasks')
          .update({ assignee_ids: updated })
          .eq('id', task.id);
      });

      const results = await Promise.all(promises);
      const error = results.find((r) => r.error);
      if (error) throw error.error;
      return taskIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ============================================
// ACTIVE TIMER (Phase 1 — Feature #19)
// ============================================

export function useActiveTimer(userId: string | undefined) {
  return useQuery({
    queryKey: ['active-timer', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .select('*, tasks!inner(id, title, project_id)')
        .eq('user_id', userId!)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as (TaskTimeLog & { tasks: { id: string; title: string; project_id: string } }) | null;
    },
    enabled: !!userId,
    refetchInterval: 1000,
  });
}

export function useStartTimer(orgId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (taskId: string) => {
      // Stop any existing active timer first
      const { data: active } = await supabase
        .from('task_time_logs')
        .select('id')
        .eq('user_id', user!.id)
        .is('end_time', null);

      if (active?.length) {
        await supabase
          .from('task_time_logs')
          .update({ end_time: new Date().toISOString() })
          .in('id', active.map((a) => a.id));
      }

      // Start new timer
      const { data, error } = await supabase
        .from('task_time_logs')
        .insert({
          task_id: taskId,
          user_id: user!.id,
          organisation_id: orgId,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as TaskTimeLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string) => {
      const { data, error } = await supabase
        .from('task_time_logs')
        .update({ end_time: new Date().toISOString() })
        .eq('id', logId)
        .select()
        .single();
      if (error) throw error;
      return data as TaskTimeLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ============================================
// TASK CHECKLIST (Phase 1 — Collaboration → Tasks)
// ============================================

export function useTaskChecklist(taskId: string | null | undefined) {
  return useQuery({
    queryKey: taskKeys.checklist(taskId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('task_id', taskId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as TaskChecklistItem[];
    },
    enabled: !!taskId,
  });
}

export function useCreateChecklistItem(taskId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string }) => {
      if (!taskId) throw new Error('no_task');
      const { data: existing, error: existingError } = await supabase
        .from('task_checklist_items')
        .select('sort_order')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: false })
        .limit(1);
      if (existingError) throw existingError;
      const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0;
      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert({ task_id: taskId, title: input.title, sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskChecklistItem;
    },
    onSuccess: () => {
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.checklist(taskId) });
      }
    },
  });
}

export function useUpdateChecklistItem(taskId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, sort_order }: { id: string; title?: string; sort_order?: number }) => {
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (sort_order !== undefined) updates.sort_order = sort_order;
      const { data, error } = await supabase
        .from('task_checklist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TaskChecklistItem;
    },
    onSuccess: () => {
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.checklist(taskId) });
      }
    },
  });
}

/**
 * Completion goes through the server-side RPC so completed_by / completed_at
 * are always stamped by the database (spec §14). RLS enforces visibility.
 */
export function useToggleChecklistItem(taskId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { data, error } = await supabase.rpc('toggle_task_checklist_item', {
        p_item_id: id,
        p_is_completed: isCompleted,
      });
      if (error) throw error;
      return data as unknown as TaskChecklistItem;
    },
    onMutate: async ({ id, isCompleted }) => {
      if (!taskId) return;
      await queryClient.cancelQueries({ queryKey: taskKeys.checklist(taskId) });
      const previous = queryClient.getQueryData<TaskChecklistItem[]>(taskKeys.checklist(taskId));
      if (previous) {
        queryClient.setQueryData<TaskChecklistItem[]>(taskKeys.checklist(taskId), (old) =>
          old
            ? old.map((item) =>
                item.id === id ? { ...item, is_completed: isCompleted } : item,
              )
            : old,
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && taskId) {
        queryClient.setQueryData(taskKeys.checklist(taskId), context.previous);
      }
    },
    onSettled: () => {
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.checklist(taskId) });
      }
    },
  });
}

export function useDeleteChecklistItem(taskId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_checklist_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.checklist(taskId) });
      }
    },
  });
}

/** Reorder via sequential updates, mirroring useReorderTasks. */
export function useReorderChecklistItems(taskId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const promises = orderedIds.map((id, index) =>
        supabase.from('task_checklist_items').update({ sort_order: index }).eq('id', id),
      );
      const results = await Promise.all(promises);
      const error = results.find((r) => r.error);
      if (error) throw error.error;
      return orderedIds;
    },
    onSuccess: () => {
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.checklist(taskId) });
      }
    },
  });
}

/** Progress = derived, never stored (spec §15 — no second status system). */
export function getChecklistProgress(items: TaskChecklistItem[] | undefined | null): {
  completed: number;
  total: number;
} {
  if (!items || items.length === 0) return { completed: 0, total: 0 };
  return {
    completed: items.filter((i) => i.is_completed).length,
    total: items.length,
  };
}
