// ============================================
// useDailyReportWorkItems — Phase 0/1/2 hooks
// ============================================
// Hooks for the daily_report_work_items table introduced by
// src/database-daily-report-tasks.sql.
//
// Phase 0: read + create + delete stubs.
// Phase 1: read is production-grade, hooks shape final.
// Phase 2: useUpdateWorkItem ships with optimistic update + rollback,
//          useDeleteWorkItem uses optimistic onMutate to hide the row
//          immediately, usePromoteAdHocToTask converts ad-hoc → task-linked.
//
// Pattern mirrors src/components/tasks/hooks.ts:
//   - React Query v5
//   - Query key factory
//   - Optimistic updates with rollback
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
// UPDATE (Phase 2): useUpdateWorkItem — optimistic
// ============================================

/**
 * Optimistic inline-edit for a single work item. Mirrors `useUpdateTask`:
 *  - onMutate: snapshot the list, apply the patch optimistically.
 *  - onError: roll back to the snapshot.
 *  - onSettled: invalidate to re-sync with the DB (and run the trigger).
 */
export function useUpdateWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DailyReportWorkItemUpdate & { id: string }) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from('daily_report_work_items')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DailyReportWorkItem;
    },
    onMutate: async (input) => {
      // Find the report id from the cache so we know which list to update.
      const lists = queryClient.getQueriesData<DailyReportWorkItem[]>({
        queryKey: drwiKeys.lists(),
      });
      let reportId: string | null = null;
      for (const [, list] of lists) {
        if (Array.isArray(list) && list.some((it) => it.id === input.id)) {
          reportId = list[0]?.daily_report_id ?? null;
          break;
        }
      }
      if (!reportId) return { reportId: null, snapshot: null };

      const key = drwiKeys.byReport(reportId);
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<DailyReportWorkItem[]>(key);
      queryClient.setQueryData<DailyReportWorkItem[]>(key, (prev) => {
        if (!prev) return prev;
        return prev.map((it) =>
          it.id === input.id ? { ...it, ...input } : it
        );
      });
      return { reportId, snapshot };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.reportId && ctx.snapshot) {
        queryClient.setQueryData(
          drwiKeys.byReport(ctx.reportId),
          ctx.snapshot
        );
      }
    },
    onSettled: (_data, _err, _input, ctx) => {
      if (ctx?.reportId) {
        queryClient.invalidateQueries({
          queryKey: drwiKeys.byReport(ctx.reportId),
        });
      }
    },
  });
}

// ============================================
// DELETE (soft, Phase 2): useDeleteWorkItem — optimistic
// ============================================

export function useDeleteWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; reportId: string }) => {
      const { error } = await supabase
        .from('daily_report_work_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { id };
    },
    onMutate: async ({ id, reportId }) => {
      const key = drwiKeys.byReport(reportId);
      await queryClient.cancelQueries({ queryKey: key });
      const snapshot = queryClient.getQueryData<DailyReportWorkItem[]>(key);
      queryClient.setQueryData<DailyReportWorkItem[]>(key, (prev) => {
        if (!prev) return prev;
        return prev.filter((it) => it.id !== id);
      });
      return { reportId, snapshot };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.reportId && ctx.snapshot) {
        queryClient.setQueryData(
          drwiKeys.byReport(ctx.reportId),
          ctx.snapshot
        );
      }
    },
    onSettled: (_data, _err, _input, ctx) => {
      if (ctx?.reportId) {
        queryClient.invalidateQueries({
          queryKey: drwiKeys.byReport(ctx.reportId),
        });
      }
    },
  });
}

// ============================================
// PROMOTE AD-HOC (Phase 2): usePromoteAdHocToTask
// ============================================

/**
 * Convert an ad-hoc work-item row into a task-linked one. Used by the
 * "Promote to task" affordance on ad-hoc rows (R7 mitigation, D7 follow-up).
 */
export function usePromoteAdHocToTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workItemId,
      taskId,
    }: {
      workItemId: string;
      taskId: string;
    }) => {
      const { data, error } = await supabase
        .from('daily_report_work_items')
        .update({ task_id: taskId, ad_hoc_title: null, ad_hoc_discipline: null })
        .eq('id', workItemId)
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
// PHOTO UPLOAD (Phase 3): re-export
// ============================================
// The dedicated photo-upload hook lives in
// src/hooks/useDailyReportPhotoUpload.ts — it includes the
// retry queue (1s, 3s, 9s) and offline short-circuit. We
// re-export here for backwards compatibility with existing
// import sites.

export {
  useDailyReportPhotoUpload,
  type DailyReportPhotoInput,
  type DailyReportPhotoResult,
} from './useDailyReportPhotoUpload';
