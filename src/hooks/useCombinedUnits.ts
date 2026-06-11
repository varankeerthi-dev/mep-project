import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

export type CombinedUnit = {
  value: string;
  label: string;
};

export function useCombinedUnits() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['combined-units', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];

      const { data: itemUnits, error: err1 } = await supabase
        .from('item_units')
        .select('unit_code, unit_name')
        .eq('is_active', true)
        .order('unit_name');
      if (err1) throw err1;

      const { data: customUnits, error: err2 } = await supabase
        .from('custom_units')
        .select('unit_symbol, unit_name')
        .or(`organisation_id.is.null,organisation_id.eq.${organisation.id}`)
        .order('unit_name');
      if (err2) throw err2;

      const map = new Map<string, string>();
      (itemUnits || []).forEach(u => { if (!map.has(u.unit_code)) map.set(u.unit_code, u.unit_name); });
      (customUnits || []).forEach(u => { map.set(u.unit_symbol, u.unit_name); });

      return Array.from(map.entries())
        .map(([value, label]) => ({ value, label: label.charAt(0).toUpperCase() + label.slice(1) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
  });
}
