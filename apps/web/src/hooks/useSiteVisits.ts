import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
export { useClients } from './useClients';

export interface UseSiteVisitsOptions {
  refetchInterval?: number | false;
}

export function useSiteVisits(options?: UseSiteVisitsOptions) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['site-visits', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];

      const { data, error } = await supabase
        .from('site_visits')
        .select('*, clients(id, client_name), lead:leads!lead_id(id, contact_name, company_name)')
        .eq('organisation_id', organisation.id)
        .order('visit_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 60 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });
}

export function useVisitPurposes() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['visit-purposes', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];

      const { data, error } = await supabase
        .from('visit_purposes')
        .select('id, name, organisation_id')
        .or(`organisation_id.eq.${organisation.id},organisation_id.is.null`)
        .order('name');
      
      if (error) {
        return [
          { id: '1', name: 'Measurement' },
          { id: '2', name: 'Complaint' },
          { id: '3', name: 'Friendly Call' },
          { id: '4', name: 'Bill Submission' },
          { id: '5', name: 'Meeting' }
        ];
      }
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProjectManagers() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['project-managers', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];

      // 1. Fetch active member user IDs in this organisation
      const { data: members, error: membersError } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('organisation_id', organisation.id)
        .eq('status', 'active');
      
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const userIds = members.map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length === 0) return [];

      // 2. Fetch profiles strictly for those users belonging to this organisation
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, user_id, full_name, email')
        .in('user_id', userIds)
        .order('full_name');
      
      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddSiteVisit() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async (newVisit: any) => {
      if (!organisation?.id) throw new Error('Organisation context required');
      const payload = {
        ...newVisit,
        organisation_id: newVisit.organisation_id || organisation.id,
      };
      delete (payload as any).clients;
      delete (payload as any).lead;

      const { data, error } = await supabase
        .from('site_visits')
        .insert([payload])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits', organisation?.id] });
    },
  });
}

export function useUpdateSiteVisit() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async (updatedVisit: any) => {
      const { id, ...updateData } = updatedVisit;
      delete (updateData as any).clients;
      delete (updateData as any).lead;
      
      let query = supabase
        .from('site_visits')
        .update(updateData)
        .eq('id', id);

      if (organisation?.id) {
        query = query.eq('organisation_id', organisation.id);
      }
      
      const { data, error } = await query.select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits', organisation?.id] });
    },
  });
}

export function useAddPurpose() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!organisation?.id) throw new Error('Organisation context required');
      const { data, error } = await supabase
        .from('visit_purposes')
        .insert([{ name, organisation_id: organisation.id }])
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes', organisation?.id] });
    },
  });
}
