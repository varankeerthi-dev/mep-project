import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { queryKeys } from '../utils/queryKeys';

export function useProjects(options?: {
  select?: string;
  status?: string;
  enabled?: boolean;
}) {
  const { organisation } = useAuth();
  const { select = 'id, project_name, name, project_code, client_id, client_name, status', status, enabled = true } = options ?? {};
  
  return useQuery({
    queryKey: status ? ['projects', organisation?.id, status] : queryKeys.projects(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      let query = supabase
        .from('projects')
        .select(select)
        .eq('organisation_id', organisation.id)
        .order('project_name');
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Get a single project by ID
 */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get active projects only
 */
export function useActiveProjects() {
  return useProjects({ status: 'Active' });
}
