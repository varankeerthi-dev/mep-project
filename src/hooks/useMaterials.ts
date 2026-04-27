import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { withSessionCheck } from '../queryClient';

export function useMaterials() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['materials', organisation?.id],
    queryFn: withSessionCheck(async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, display_name, name, unit, uses_variant, sale_price, item_type, item_code, mappings:material_client_mappings(id, client_id, client_part_no, client_description)')
        .eq('organisation_id', organisation.id)
        .order('name');
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisation?.id,
  });
}
