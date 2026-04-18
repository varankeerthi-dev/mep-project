import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { queryKeys } from '../utils/queryKeys';

export function useVariants(options?: {
  enabled?: boolean;
  activeOnly?: boolean;
}) {
  const { organisation } = useAuth();
  const { activeOnly = true, enabled = true } = options ?? {};
  
  return useQuery({
    queryKey: queryKeys.variants(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      let query = supabase
        .from('company_variants')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('variant_name');
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Get a single variant by ID
 */
export function useVariant(variantId: string | undefined) {
  return useQuery({
    queryKey: ['variant', variantId],
    queryFn: async () => {
      if (!variantId) return null;
      
      const { data, error } = await supabase
        .from('company_variants')
        .select('*')
        .eq('id', variantId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!variantId,
    staleTime: 5 * 60 * 1000,
  });
}
