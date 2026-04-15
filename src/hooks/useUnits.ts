import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export const UNITS_QUERY_KEY = ['units'] as const;

export function useUnits() {
  return useQuery({
    queryKey: UNITS_QUERY_KEY,
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
