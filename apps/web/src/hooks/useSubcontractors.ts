import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Subcontractor {
  id: string;
  organisation_id: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  nature_of_work?: string;
  status?: string;
}

export function useSubcontractors() {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery<Subcontractor[]>({
    queryKey: ['subcontractors', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, organisation_id, company_name, contact_person, phone, email, nature_of_work, status')
        .eq('organisation_id', orgId)
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Error fetching subcontractors:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!orgId,
  });
}
