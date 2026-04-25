import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { withSessionCheck } from '../queryClient';

export function useProjects() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['projects', organisation?.id],
    queryFn: withSessionCheck(async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, name, project_code, client_id, client_name')
        .eq('organisation_id', organisation.id)
        .order('project_name');
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisation?.id,
  });
}
