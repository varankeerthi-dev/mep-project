import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export function useVariants() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['variants', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('company_variants')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('variant_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
}
