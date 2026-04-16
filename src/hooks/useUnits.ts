import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export function useUnits() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['units', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('item_units')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('unit_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
}
