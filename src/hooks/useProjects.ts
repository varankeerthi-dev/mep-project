import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export const PROJECTS_QUERY_KEY = ['projects'] as const;

export function useProjects() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, name, project_code, client_id, client_name, site_address')
        .eq('organisation_id', organisation.id)
        .order('project_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
}
