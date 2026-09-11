import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { ConsumableCatalogItem } from '@/types/expense';

export function useConsumableCatalog() {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery({
    queryKey: ['consumable-catalog', orgId],
    queryFn: async (): Promise<ConsumableCatalogItem[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('consumable_catalog')
        .select('*')
        .eq('organisation_id', orgId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateConsumable() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      category: string;
      preferred_brand?: string;
      typical_unit?: string;
    }) => {
      if (!organisation?.id) throw new Error('No organisation selected');
      const { data, error } = await supabase
        .from('consumable_catalog')
        .insert({
          organisation_id: organisation.id,
          name: input.name,
          category: input.category,
          preferred_brand: input.preferred_brand ?? null,
          typical_unit: input.typical_unit ?? 'piece',
        })
        .select()
        .single();
      if (error) throw error;
      return data as ConsumableCatalogItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumable-catalog'] });
    },
  });
}
