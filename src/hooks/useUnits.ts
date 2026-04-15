import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_units')
        .select('*')
        .order('unit_name');
      if (error) throw error;
      return data || [];
    },
  });
}
