// ============================================
// useDailyReportWorkItems — Phase 0 hook skeleton
// ============================================
// Hooks for the daily_report_work_items table introduced by
// src/database-daily-report-tasks.sql.
//
// Phase 0 ships READ-ONLY + create + delete hooks.
// Phase 2 will add useUpdateWorkItem (optimistic inline edit)
// and usePromoteAdHocToTask.
//
// Pattern mirrors src/components/tasks/hooks.ts:
//   - React Query v5
//   - Query key factory
//   - Optimistic updates with rollback (added in Phase 2)
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export type WorkItemKind = 'work' | 'milestone';

export interface DailyReportWorkItem {
  id: string;
  organisation_id: string;
  daily_report_id: string;
  task_id: string | null;
  ad_hoc_title: string | null;
  ad_hoc_discipline: string | null;
  kind: WorkItemKind;
  progress_before: number | null;
  progress_after: number | null;
  status_before: string | null;
  status_after: string | null;
  quantity_done: number | null;
  quantity_unit: string | null;
  note: string | null;
  blocker_flag: boolean;
  blocker_reason: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type DailyReportWorkItemInsert = Omit<
  DailyReportWorkItem,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'progress_before'
  | 'progress_after'
  | 'status_before'
  | 'status_after'
  | 'sort_order'
  | 'created_by'
> & {
  progress_before?: number | null;
  progress_after?: number | null;
  status_before?: string | null;
  status_after?: string | null;
  sort_order?: number;
  created_by?: string | null;
};

export type DailyReportWorkItemUpdate = Partial<
  Omit<
    DailyReportWorkItem,
    | 'id'
    | 'organisation_id'
    | 'daily_report_id'
    | 'created_at'
    | 'updated_at'
    | 'deleted_at'
  >
>;

// ============================================
// QUERY KEY FACTORY
// ============================================

export const drwiKeys = {
  all: ['daily-report-work-items'] as const,
  lists: () => [...drwiKeys.all, 'list'] as const,
  byReport: (reportId: string | null) =>
    [...drwiKeys.lists(), { reportId }] as const,
  detail: (id: string) => [...drwiKeys.all, 'detail', id] as const,
};

// ============================================
// READ: useDailyReportWorkItems
// ============================================

export function useDailyReportWorkItems(reportId: string | null) {
  return useQuery({
    queryKey: drwiKeys.byReport(reportId),
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_report_work_items')
        .select('*')
        .eq('daily_report_id', reportId as string)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as DailyReportWorkItem[];
    },
    staleTime: 1000 * 30,
  });
}

// ============================================
// CREATE: useAddWorkItem
// ============================================

export function useAddWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: DailyReportWorkItemInsert & { organisation_id: string }
    ) => {
      const { data, error } = await supabase
        .from('daily_report_work_items')
        .insert({
          ...input,
          sort_order: input.sort_order ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DailyReportWorkItem;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({
        queryKey: drwiKeys.byReport(row.daily_report_id),
      });
    },
  });
}

// ============================================
// DELETE (soft): useDeleteWorkItem
// ============================================

export function useDeleteWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reportId }: { id: string; reportId: string }) => {
      const { error } = await supabase
        .from('daily_report_work_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { id, reportId };
    },
    onSuccess: ({ reportId }) => {
      queryClient.invalidateQueries({
        queryKey: drwiKeys.byReport(reportId),
      });
    },
  });
}

// ============================================
// Phase 2 placeholders (not implemented yet)
// ============================================

/**
 * Phase 2: optimistic inline edit (mirrors useUpdateTask.onMutate).
 * Stub now so call-sites can compile.
 */
export function useUpdateWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DailyReportWorkItemUpdate & { id: string }) => {
      throw new Error('useUpdateWorkItem ships in Phase 2');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: drwiKeys.all });
    },
  });
}

/**
 * Phase 2: convert an ad-hoc row to a task-linked row.
 * Stub now so call-sites can compile.
 */
export function usePromoteAdHocToTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workItemId: string; taskId: string }) => {
      throw new Error('usePromoteAdHocToTask ships in Phase 2');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: drwiKeys.all });
    },
  });
}

/**
 * Phase 3: photo upload that calls fn_link_daily_report_photo RPC.
 * Stub now so call-sites can compile.
 */
export function useDailyReportPhotoUpload() {
  return useMutation({
    mutationFn: async (input: {
      reportId: string;
      workItemId: string | null;
      taskId: string | null;
      fileName: string;
      storagePath: string;
      thumbnailPath?: string;
      fileSize?: number;
      mimeType?: string;
      caption?: string;
      userId: string;
    }) => {
      const { data, error } = await supabase.rpc('fn_link_daily_report_photo', {
        p_report_id: input.reportId,
        p_work_item: input.workItemId,
        p_task_id: input.taskId,
        p_file_name: input.fileName,
        p_storage: input.storagePath,
        p_thumb: input.thumbnailPath ?? null,
        p_size: input.fileSize ?? null,
        p_mime: input.mimeType ?? null,
        p_caption: input.caption ?? null,
        p_user_id: input.userId,
      });
      if (error) throw error;
      return data;
    },
  });
}
