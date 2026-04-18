import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { queryKeys } from '../utils/queryKeys';

export function useMaterials(options?: {
  select?: string;
  enabled?: boolean;
}) {
  const { organisation } = useAuth();
  const { select = 'id, display_name, name, unit, uses_variant, sale_price, purchase_price, item_type, item_code, category, is_active', enabled = true } = options ?? {};
  
  return useQuery({
    queryKey: queryKeys.materials(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('materials')
        .select(select)
        .eq('organisation_id', organisation.id)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Get a single material by ID with full details
 */
export function useMaterial(materialId: string | undefined) {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['material', materialId],
    queryFn: async () => {
      if (!materialId) return null;
      
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', materialId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!materialId,
    staleTime: 5 * 60 * 1000,
  });
}
