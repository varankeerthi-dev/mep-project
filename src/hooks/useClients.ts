import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export const CLIENT_QUERY_KEY = ['clients'] as const;

export function useClients() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: CLIENT_QUERY_KEY,
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_id, contact, email, gstin, state, city, category, address1, address2, pincode, shipping_address')
        .eq('org_id', organisation.id) // Use org_id as found in database
        .order('client_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    // No overrides! Use global defaults from queryClient.ts
    // This means:
    // - staleTime: 5 min (from global)
    // - refetchOnMount: false (from global)
    // - refetchOnWindowFocus: false (from global)
  });
}
