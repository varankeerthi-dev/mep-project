import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { Project } from '../types';
import { projectKeys } from './useProjectDetails';

// Custom hook to query the project list with server-side pagination, status, and search filters
export function useProjects(options: {
  organisationId: string;
  page: number;
  limit: number;
  search: string;
  status: string;
}) {
  const { organisationId, page, limit, search, status } = options;

  return useQuery({
    queryKey: projectKeys.list({ organisationId, page, limit, search, status }),
    queryFn: async () => {
      if (!organisationId) return { data: [] as Project[], count: 0 };
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      let query = supabase
        .from('projects')
        .select(
          'id, project_name, project_code, project_type, project_estimated_value, po_required, po_status, status, completion_percentage, start_date, expected_end_date, created_at, client:clients(id, client_name), pos:client_purchase_orders!client_purchase_orders_project_id_fkey(po_total_value)',
          { count: 'exact' }
        )
        .eq('organisation_id', organisationId);

      if (status && status !== 'All') {
        query = query.eq('status', status);
      }
      if (search) {
        // Sanitize the value for the PostgREST or() expression: characters such
        // as "," "(" ")" quotes or backslashes would otherwise break or alter
        // the filter. Removed characters are replaced with a space so the rest
        // of the term still matches. ilike wildcard semantics (%, _) unchanged.
        const safe = search.replace(/[,"\\()]/g, ' ').trim();
        if (safe) {
          query = query.or(`project_name.ilike.%${safe}%,project_code.ilike.%${safe}%`);
        }
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error) throw error;
      return {
        data: (data || []) as Project[],
        count: count || 0,
      };
    },
    enabled: !!organisationId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

// Lightweight custom hook to query project status stats for stats badges.
// Uses head-only COUNT queries (no row payload) instead of downloading every
// project row and counting in the browser.
export function useProjectStats(organisationId: string) {
  return useQuery({
    queryKey: projectKeys.list({ organisationId, type: 'stats' }),
    queryFn: async () => {
      if (!organisationId) return {} as Record<string, number>;
      const statuses = ['Active', 'Draft', 'Execution Completed', 'Financially Closed', 'Closed', 'Archived'];

      const countFor = async (status?: string) => {
        let q = supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', organisationId);
        if (status) q = q.eq('status', status);
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      };

      const [all, ...statusCounts] = await Promise.all([
        countFor(),
        ...statuses.map(s => countFor(s)),
      ]);

      const counts: Record<string, number> = { All: all };
      statuses.forEach((s, i) => {
        counts[s] = statusCounts[i];
      });
      return counts;
    },
    enabled: !!organisationId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
