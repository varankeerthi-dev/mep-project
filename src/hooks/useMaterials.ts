import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { withSessionCheck } from '../queryClient';

export function useMaterials() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['materials', organisation?.id],
    queryFn: withSessionCheck(async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, display_name, name, unit, uses_variant, sale_price, item_type, item_code')
        .eq('organisation_id', organisation.id)
        .order('name');
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisation?.id,
  });
}
