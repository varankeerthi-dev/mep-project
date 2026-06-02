import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/logger';
import type {
  ProjectHandover,
  ProjectHandoverWithProject,
  ProjectHandoverInsert,
  ProjectHandoverUpdate,
} from '@/types/handover';

export const HANDOVERS_KEY = (orgId: string | undefined) => ['project-handovers', orgId];

export function useHandovers(organisationId: string | undefined) {
  return useQuery({
    queryKey: HANDOVERS_KEY(organisationId),
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_handovers')
        .select(`
          *,
          project:projects (
            id,
            name,
            project_name,
            client_name
          )
        `)
        .eq('organisation_id', organisationId as string)
        .order('planned_date', { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectHandoverWithProject[];
    },
    staleTime: 1000 * 60,
  });
}

export function useHandover(handoverId: string | undefined) {
  return useQuery({
    queryKey: ['project-handover', handoverId],
    enabled: !!handoverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_handovers')
        .select(`
          *,
          project:projects (
            id,
            name,
            project_name,
            client_name
          )
        `)
        .eq('id', handoverId as string)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as ProjectHandoverWithProject | null;
    },
  });
}

export function useCreateHandover(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectHandoverInsert) => {
      const { data, error } = await supabase
        .from('project_handovers')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectHandover;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HANDOVERS_KEY(organisationId) });
      toast.success('Handover milestone created');
    },
    onError: (err: Error) => {
      toast.error(`Failed to create handover: ${err.message}`);
    },
  });
}

export function useUpdateHandover(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ProjectHandoverUpdate }) => {
      const { data, error } = await supabase
        .from('project_handovers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectHandover;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HANDOVERS_KEY(organisationId) });
      toast.success('Handover updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update handover: ${err.message}`);
    },
  });
}

export function useDeleteHandover(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_handovers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HANDOVERS_KEY(organisationId) });
      toast.success('Handover deleted');
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete handover: ${err.message}`);
    },
  });
}

export function useProjectOptions(organisationId: string | undefined) {
  return useQuery({
    queryKey: ['projects-for-handover', organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_name, client_name')
        .eq('organisation_id', organisationId as string)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        name: string;
        project_name: string | null;
        client_name: string | null;
      }>;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useEngineerOptions(organisationId: string | undefined) {
  return useQuery({
    queryKey: ['engineers-for-handover', organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_members')
        .select('user_id, full_name, email, role')
        .eq('organisation_id', organisationId as string)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        user_id: string;
        full_name: string | null;
        email: string | null;
        role: string;
      }>;
    },
    staleTime: 1000 * 60 * 5,
  });
}
