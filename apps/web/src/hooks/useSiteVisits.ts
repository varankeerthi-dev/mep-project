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

export function useVisitTypes() {
  const { organisation, user } = useAuth();

  return useQuery({
    queryKey: ['visit-types', organisation?.id],
    queryFn: async () => {
      const defaultTypes = [
        'Survey',
        'Installation',
        'Maintenance',
        'Inspection',
        'Repair',
        'Handover',
        'Consultation',
        'Other',
      ];

      let orgId = organisation?.id;
      if (!orgId && user?.id) {
        const { data: member } = await supabase
          .from('org_members')
          .select('organisation_id')
          .eq('user_id', user.id)
          .maybeSingle();
        orgId = member?.organisation_id || null;
      }

      let query = supabase.from('visit_types').select('id, name, organisation_id');
      if (orgId) {
        query = query.or(`organisation_id.eq.${orgId},organisation_id.is.null`);
      }

      const { data, error } = await query.order('name');

      if (error || !data || data.length === 0) {
        return defaultTypes.map((name) => ({ id: name, name }));
      }

      const names = new Set(data.map((d: any) => d.name));
      const merged = [...data];
      for (const dt of defaultTypes) {
        if (!names.has(dt)) {
          merged.push({ id: dt, name: dt, organisation_id: null });
        }
      }
      return merged.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 60 * 1000,
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

export function useAddVisitType() {
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Category name cannot be empty');

      let orgId = organisation?.id;
      if (!orgId && user?.id) {
        const { data: member } = await supabase
          .from('org_members')
          .select('organisation_id')
          .eq('user_id', user.id)
          .maybeSingle();
        orgId = member?.organisation_id || null;
      }

      const { data, error } = await supabase
        .from('visit_types')
        .insert([{ name: trimmed, organisation_id: orgId }])
        .select();

      if (error) throw error;
      return data?.[0] || { id: trimmed, name: trimmed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-types'] });
    },
  });
}
