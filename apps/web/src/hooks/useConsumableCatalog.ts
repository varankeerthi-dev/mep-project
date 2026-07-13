import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ConsumableCatalogItem, ConsumableCatalogInsert } from '@/types/expense';

export const CONSUMABLE_CATALOG_KEY = 'consumable-catalog';

export function useConsumableCatalog(organisationId: string | undefined) {
  return useQuery({
    queryKey: [CONSUMABLE_CATALOG_KEY, organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consumable_catalog')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (error) throw error;
      return (data || []) as ConsumableCatalogItem[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateConsumableItem(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConsumableCatalogInsert) => {
      const { data, error } = await supabase
        .from('consumable_catalog')
        .insert({ ...input, organisation_id: organisationId })
        .select()
        .single();
      if (error) throw error;
      return data as ConsumableCatalogItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONSUMABLE_CATALOG_KEY, organisationId] });
    },
  });
}
