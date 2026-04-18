import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { queryKeys } from '../utils/queryKeys';

export function useUnits(options?: {
  enabled?: boolean;
  activeOnly?: boolean;
}) {
  const { organisation } = useAuth();
  const { activeOnly = true, enabled = true } = options ?? {};
  
  return useQuery({
    queryKey: queryKeys.units(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      let query = supabase
        .from('item_units')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('unit_name');
      
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
 * Get a single unit by ID
 */
export function useUnit(unitId: string | undefined) {
  return useQuery({
    queryKey: ['unit', unitId],
    queryFn: async () => {
      if (!unitId) return null;
      
      const { data, error } = await supabase
        .from('item_units')
        .select('*')
        .eq('id', unitId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!unitId,
    staleTime: 5 * 60 * 1000,
  });
}
