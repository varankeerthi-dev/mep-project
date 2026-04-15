import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useVariants() {
  return useQuery({
    queryKey: ['variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_variants')
        .select('*')
        .eq('is_active', true)
        .order('variant_name');
      if (error) throw error;
      return data || [];
    },
  });
}
