import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { queryKeys } from '../utils/queryKeys';

export function useWarehouses(options?: {
  enabled?: boolean;
  activeOnly?: boolean;
}) {
  const { organisation } = useAuth();
  const { activeOnly = true, enabled = true } = options ?? {};
  
  return useQuery({
    queryKey: queryKeys.warehouses(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      let query = supabase
        .from('warehouses')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('warehouse_name');
      
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
 * Get a single warehouse by ID
 */
export function useWarehouse(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: async () => {
      if (!warehouseId) return null;
      
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', warehouseId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!warehouseId,
    staleTime: 5 * 60 * 1000,
  });
}
