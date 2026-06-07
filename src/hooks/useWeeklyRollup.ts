// ============================================
// useWeeklyRollup — Phase 4.1
// ============================================
// Project-scoped rollup of daily-report activity for a
// given week. Aggregates daily_report_work_items with
// task joins, returning a flat list of "task updates
// this week" sorted by progress delta (default).
//
// Aggregations per task:
//   - progress_before / progress_after (min/max within week)
//   - status_before / status_after (last value)
//   - blocker_raised (any row with blocker_flag = true)
//   - update_count (rows in week)
//   - days_touched (distinct days touched in week)
//   - last_photo_at (max site_report_photos.uploaded_at for
//     rows referencing this task)
//
// Views:
//   - 'detail' — one row per task
//   - 'matrix' — one column per discipline, one row per task
//   - 'blocker' — only tasks with blocker_raised = true
//
// Filter chips:
//   - discipline — narrows to one of the DISCIPLINE_CONFIG values
//   - engineer   — narrows to one assignee
//   - hasBlocker — same as view='blocker'
//   - overdue    — narrows to tasks where due_date < today
//                   AND status_after != 'completed'
// ============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type RollupView = 'detail' | 'matrix' | 'blocker';

export interface RollupFilters {
  discipline?: string | null;
  engineerId?: string | null;
  hasBlocker?: boolean;
  overdue?: boolean;
}

export interface RollupTaskRow {
  task_id: string;
  task_no: number | null;
  title: string;
  status: string | null;
  discipline: string | null;
  priority: string | null;
  due_date: string | null;
  progress_before: number | null;
  progress_after: number | null;
  progress_delta: number;
  blocker_raised: boolean;
  update_count: number;
  days_touched: number;
  last_photo_at: string | null;
  /** Engineer = the task's primary assignee, or null. */
  engineer_id: string | null;
  engineer_name: string | null;
}

export interface UseWeeklyRollupArgs {
  organisationId: string | null | undefined;
  projectId: string | null | undefined;
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
  view?: RollupView;
  filters?: RollupFilters;
  enabled?: boolean;
}

export const rollupKeys = {
  all: ['weekly-rollup'] as const,
  byProject: (
    orgId: string | null | undefined,
    projectId: string | null | undefined,
    from: string,
    to: string,
    view: RollupView,
    filters: RollupFilters
  ) =>
    [
      ...rollupKeys.all,
      { orgId, projectId, from, to, view, filters },
    ] as const,
};

export function useWeeklyRollup({
  organisationId,
  projectId,
  from,
  to,
  view = 'detail',
  filters = {},
  enabled = true,
}: UseWeeklyRollupArgs) {
  return useQuery({
    queryKey: rollupKeys.byProject(organisationId, projectId, from, to, view, filters),
    enabled: !!organisationId && !!projectId && enabled,
    queryFn: async (): Promise<RollupTaskRow[]> => {
      // 1. Pull all work-item rows for the project within the
      //    week, joined with the task row.
      const { data, error } = await supabase
        .from('daily_report_work_items')
        .select(
          `
            id, task_id, kind, progress_before, progress_after,
            status_before, status_after, blocker_flag, daily_report_id,
            daily_reports!inner(report_date, organisation_id, project_id),
            tasks:tasks!daily_report_work_items_task_id_fkey(
              id, task_no, title, status, priority, discipline,
              due_date, completion_percentage,
              assignee_ids
            )
          `
        )
        .eq('daily_reports.organisation_id', organisationId as string)
        .eq('daily_reports.project_id', projectId as string)
        .is('deleted_at', null)
        .gte('daily_reports.report_date', from)
        .lte('daily_reports.report_date', to);

      if (error) throw error;

      type Row = {
        id: string;
        task_id: string | null;
        kind: string;
        progress_before: number | null;
        progress_after: number | null;
        status_before: string | null;
        status_after: string | null;
        blocker_flag: boolean;
        daily_reports: {
          report_date: string;
        } | null;
        tasks: {
          id: string;
          task_no: number | null;
          title: string;
          status: string;
          priority: string | null;
          discipline: string | null;
          due_date: string | null;
          completion_percentage: number;
          assignee_ids: string[] | null;
        } | null;
      };

      const rows = (data || []) as unknown as Row[];

      // 2. Aggregate per task.
      const byTask = new Map<string, RollupTaskRow>();
      for (const r of rows) {
        if (!r.task_id || !r.tasks) continue;
        const existing = byTask.get(r.task_id);
        const pb = r.progress_before ?? 0;
        const pa = r.progress_after ?? 0;
        const date = r.daily_reports?.report_date ?? '';
        if (!existing) {
          byTask.set(r.task_id, {
            task_id: r.task_id,
            task_no: r.tasks.task_no,
            title: r.tasks.title,
            status: r.status_after ?? r.tasks.status,
            discipline: r.tasks.discipline,
            priority: r.tasks.priority,
            due_date: r.tasks.due_date,
            progress_before: pb,
            progress_after: pa,
            progress_delta: pa - pb,
            blocker_raised: r.blocker_flag,
            update_count: 1,
            days_touched: 1,
            last_photo_at: null,
            engineer_id: r.tasks.assignee_ids?.[0] ?? null,
            engineer_name: null,
          });
        } else {
          existing.update_count++;
          if (r.blocker_flag) existing.blocker_raised = true;
          if (pa > (existing.progress_after ?? -1)) existing.progress_after = pa;
          if (pb < (existing.progress_before ?? 101)) existing.progress_before = pb;
          existing.progress_delta =
            (existing.progress_after ?? 0) - (existing.progress_before ?? 0);
        }
        // Track distinct days
        if (existing && date) {
          const key = `${existing.task_id}:${date}`;
          // best-effort dedupe via a Set on the parent
          if (!(existing as any)._days) (existing as any)._days = new Set<string>();
          (existing as any)._days.add(date);
        }
      }

      // 3. Compute days_touched.
      const aggregated: RollupTaskRow[] = [];
      for (const v of byTask.values()) {
        const days = (v as any)._days as Set<string> | undefined;
        v.days_touched = days ? days.size : 0;
        delete (v as any)._days;
        aggregated.push(v);
      }

      // 4. Fetch last_photo_at for each task (one query).
      const taskIds = aggregated.map((a) => a.task_id);
      if (taskIds.length > 0) {
        const { data: photos, error: photoErr } = await supabase
          .from('site_report_photos')
          .select('uploaded_at, daily_report_work_items!inner(task_id)')
          .eq('daily_report_work_items.task_id', taskIds.length === 1 ? taskIds[0] : undefined)
          .in('daily_report_work_items.task_id', taskIds)
          .order('uploaded_at', { ascending: false })
          .limit(500);
        if (!photoErr && photos) {
          const latest: Record<string, string> = {};
          for (const p of photos as any[]) {
            const tid = p.daily_report_work_items?.task_id;
            if (tid && !latest[tid]) latest[tid] = p.uploaded_at;
          }
          for (const a of aggregated) {
            a.last_photo_at = latest[a.task_id] ?? null;
          }
        }
      }

      // 5. Resolve engineer names (single batched query).
      const engineerIds = Array.from(
        new Set(aggregated.map((a) => a.engineer_id).filter((x): x is string => !!x))
      );
      if (engineerIds.length > 0) {
        const { data: users, error: userErr } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', engineerIds);
        if (!userErr && users) {
          const map = new Map<string, string>();
          for (const u of users as any[]) map.set(u.id, u.full_name ?? 'Unknown');
          for (const a of aggregated) {
            if (a.engineer_id) a.engineer_name = map.get(a.engineer_id) ?? null;
          }
        }
      }

      // 6. Apply filters
      let filtered = aggregated;
      if (filters.discipline) {
        filtered = filtered.filter((r) => r.discipline === filters.discipline);
      }
      if (filters.engineerId) {
        filtered = filtered.filter((r) => r.engineer_id === filters.engineerId);
      }
      if (filters.hasBlocker) {
        filtered = filtered.filter((r) => r.blocker_raised);
      }
      if (filters.overdue) {
        const today = new Date().toISOString().slice(0, 10);
        filtered = filtered.filter(
          (r) => r.due_date && r.due_date < today && r.status !== 'completed'
        );
      }
      if (view === 'blocker') {
        filtered = filtered.filter((r) => r.blocker_raised);
      }

      // 7. Sort by progress delta desc (the default).
      filtered.sort((a, b) => b.progress_delta - a.progress_delta);
      return filtered;
    },
    staleTime: 1000 * 60,
  });
}
