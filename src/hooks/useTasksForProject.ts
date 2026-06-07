// ============================================
// useTasksForProject — Phase 1a hook
// ============================================
// Scoped task list for the daily-report work-item typeahead.
// Filters to a single project, recency-ranks open tasks on top,
// applies the engineer's discipline as a soft default filter.
//
// Pattern mirrors src/components/tasks/hooks.ts::useTasks
// but trimmed to the typeahead's needs:
//   - only the columns the typeahead renders
//   - no full task hydration (useTask(id) is for detail views)
//   - 30s staleTime, single round trip
// ============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ProjectTaskSlim {
  id: string;
  task_no: number | null;
  title: string;
  status: string;
  priority: string;
  discipline: string | null;
  completion_percentage: number;
  due_date: string | null;
  task_type: string;
  updated_at: string;
}

export type ProjectTaskSort = 'open_first' | 'recent' | 'due_soon' | 'alpha';

interface UseTasksForProjectArgs {
  organisationId: string | null | undefined;
  projectId: string | null | undefined;
  /** Soft filter: when set, the typeahead surfaces this discipline on top.
   *  The user can still pick any task. Pass null/undefined to disable. */
  preferredDiscipline?: string | null;
  /** Cap on returned rows. Typeahead only needs ~50. */
  limit?: number;
  /** 'open_first' (default for daily reports) or other modes. */
  sort?: ProjectTaskSort;
  /** Free-text search from the typeahead input. */
  search?: string;
  /** When false, the query doesn't fire (e.g. project not yet chosen). */
  enabled?: boolean;
}

const DEFAULT_LIMIT = 50;
const DEFAULT_SORT: ProjectTaskSort = 'open_first';

export const projectTaskKeys = {
  all: ['project-tasks-slim'] as const,
  byProject: (
    orgId: string | null | undefined,
    projectId: string | null | undefined,
    sort: ProjectTaskSort,
    search: string
  ) =>
    [
      ...projectTaskKeys.all,
      { orgId, projectId, sort, search: search.trim().toLowerCase() },
    ] as const,
};

export function useTasksForProject({
  organisationId,
  projectId,
  preferredDiscipline,
  limit = DEFAULT_LIMIT,
  sort = DEFAULT_SORT,
  search = '',
  enabled = true,
}: UseTasksForProjectArgs) {
  return useQuery({
    queryKey: projectTaskKeys.byProject(organisationId, projectId, sort, search),
    enabled: !!organisationId && !!projectId && enabled,
    queryFn: async () => {
      // Build the base query — only the columns the typeahead renders
      let query = supabase
        .from('tasks')
        .select(
          'id, task_no, title, status, priority, discipline, completion_percentage, due_date, task_type, updated_at'
        )
        .eq('organisation_id', organisationId as string)
        .eq('project_id', projectId as string)
        .is('deleted_at', null);

      const trimmed = search.trim();
      if (trimmed) {
        // ilike on title and task_no (cast to text)
        const numeric = Number(trimmed);
        if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
          query = query.or(`title.ilike.%${trimmed}%,task_no.eq.${numeric}`);
        } else {
          query = query.ilike('title', `%${trimmed}%`);
        }
      }

      // Sort: open tasks first means "not in completed/cancelled" first.
      // Supabase can't ORDER BY a computed predicate, so we approximate:
      // completed/cancelled last, everything else by the secondary key.
      if (sort === 'open_first') {
        // Put completed + cancelled at the bottom; among the rest, recent first.
        query = query
          .order('status', { ascending: true, nullsFirst: false })
          .order('updated_at', { ascending: false });
      } else if (sort === 'recent') {
        query = query.order('updated_at', { ascending: false });
      } else if (sort === 'due_soon') {
        query = query
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('updated_at', { ascending: false });
      } else {
        query = query.order('title', { ascending: true });
      }

      query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as ProjectTaskSlim[];

      // Post-sort: re-rank by preferredDiscipline (soft, not a hard filter)
      if (preferredDiscipline) {
        const norm = preferredDiscipline.toLowerCase();
        rows.sort((a, b) => {
          const aMatch = a.discipline?.toLowerCase() === norm ? 0 : 1;
          const bMatch = b.discipline?.toLowerCase() === norm ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          // tiebreak: keep relative order from the query
          return 0;
        });
      }

      return rows;
    },
    staleTime: 1000 * 30,
  });
}
