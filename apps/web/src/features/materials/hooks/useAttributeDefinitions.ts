import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import type { AttributeDefinition } from '../model/entities/Material';

export function useAttributeDefinitions(organisationId: string | null | undefined) {
  return useQuery<AttributeDefinition[]>({
    queryKey: ['attribute-definitions', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('attribute_definitions')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('name');
      if (error) throw error;
      return (data || []) as AttributeDefinition[];
    },
    enabled: !!organisationId,
  });
}
