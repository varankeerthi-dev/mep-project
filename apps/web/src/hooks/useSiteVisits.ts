import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '@/lib/logger';

export function useSiteVisits() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['site-visits', organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('site_visits')
        .select('*, clients (*), lead:leads!lead_id(id, contact_name, company_name)');
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
      }

      const { data, error } = await query.order('visit_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    refetchInterval: 30000
  });
}

export function useClients() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      let query = supabase.from('clients').select('id, client_name');
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    refetchInterval: 30000
  });
}

export function useVisitPurposes() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['visit-purposes', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_purposes')
        .select('id, name')
        .eq('organisation_id', organisation?.id)
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
      return data;
    },
    enabled: !!organisation?.id
  });
}

export function useProjectManagers() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['project-managers', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .order('full_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });
}

export function useAddSiteVisit() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async (newVisit: any) => {
      const { data, error } = await supabase
        .from('site_visits')
        .insert([newVisit])
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
      
      const { data, error } = await supabase
        .from('site_visits')
        .update(updateData)
        .eq('id', id)
        .select();
      
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
      const { data, error } = await supabase
        .from('visit_purposes')
        .insert([{ name, organisation_id: organisation?.id }])
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes'] });
    },
  });
}
