import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export function useWarehouses() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('warehouse_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
}
