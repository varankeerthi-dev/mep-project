import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { queryKeys } from '../utils/queryKeys';
import { timedSupabaseQuery } from '../utils/queryTimeout';

export function useClients(options?: {
  select?: string;
  enabled?: boolean;
}) {
  const { organisation } = useAuth();
  const { select = 'id, client_name, client_id, contact, email, gstin, state, city, category, address1, address2, pincode, shipping_address', enabled = true } = options ?? {};
  
  return useQuery({
    queryKey: queryKeys.clients(organisation?.id),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select(select)
        .eq('organisation_id', organisation.id)
        .order('client_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Get a single client by ID
 */
export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.client.detail(clientId ?? ''),
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}
