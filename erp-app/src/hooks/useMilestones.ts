import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ProjectMilestone {
  id: string;
  organisation_id: string;
  project_id: string;
  name: string;
  milestone_date: string;
  type: 'equipment_testing' | 'inspection' | 'handover' | 'other';
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  created_by: string;
}

export function useProjectMilestones(projectId: string | null, organisationId?: string | null) {
  const { organisation } = useAuth();
  const orgId = organisationId || organisation?.id;

  return useQuery<ProjectMilestone[]>({
    queryKey: ['milestones', projectId, orgId],
    queryFn: async () => {
      if (!projectId || !orgId) return [];
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .eq('organisation_id', orgId)
        .order('milestone_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId && !!orgId,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: async (milestone: Omit<ProjectMilestone, 'id' | 'organisation_id' | 'created_at' | 'created_by'>) => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('project_milestones')
        .insert([{
          ...milestone,
          organisation_id: organisation.id,
          created_by: user.id
        }])
        .select();
      
      if (error) throw error;
      return data[0] as ProjectMilestone;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-milestones-count'] });
    }
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestone: Partial<ProjectMilestone> & { id: string; project_id: string }) => {
      const { id, project_id, ...updateData } = milestone;
      const { data, error } = await supabase
        .from('project_milestones')
        .update(updateData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0] as ProjectMilestone;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-milestones-count'] });
    }
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, project_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-milestones-count'] });
    }
  });
}
