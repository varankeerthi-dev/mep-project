import { useQuery } from '@tanstack/react-query';
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
          '*, client:clients(id, client_name), pos:client_purchase_orders!client_purchase_orders_project_id_fkey(po_total_value), created_by_user:user_profiles!created_by(full_name), updated_by_user:user_profiles!updated_by(full_name)',
          { count: 'exact' }
        )
        .eq('organisation_id', organisationId);

      if (status && status !== 'All') {
        query = query.eq('status', status);
      }
      if (search) {
        query = query.or(`project_name.ilike.%${search}%,project_code.ilike.%${search}%`);
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
    staleTime: 30 * 1000,
  });
}

// Lightweight custom hook to query project status stats for stats badges
export function useProjectStats(organisationId: string) {
  return useQuery({
    queryKey: projectKeys.list({ organisationId, type: 'stats' }),
    queryFn: async () => {
      if (!organisationId) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('projects')
        .select('status')
        .eq('organisation_id', organisationId);

      if (error) throw error;

      const counts: Record<string, number> = { All: data.length };
      data.forEach(p => {
        if (p.status) {
          counts[p.status] = (counts[p.status] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!organisationId,
    staleTime: 30 * 1000,
  });
}
