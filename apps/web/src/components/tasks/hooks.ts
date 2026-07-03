// ============================================
// UNIFIED TASK MODULE — REACT QUERY HOOKS
// ============================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import type {
  Task,
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
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...input,
          status: input.status || 'not_started',
          priority: input.priority || 'medium',
          task_type: input.task_type || 'task',
          completion_percentage: 0,
          is_following: false,
          is_archived: false,
          tags: input.tags || [],
          assignee_ids: input.assignee_ids || [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Task;
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
