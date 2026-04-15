import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export const VARIANTS_QUERY_KEY = ['variants'] as const;

export function useVariants() {
  return useQuery({
    queryKey: VARIANTS_QUERY_KEY,
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
