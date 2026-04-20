import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { withSessionCheck } from '../queryClient';

export function useClients() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: withSessionCheck(async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_id, contact, email, gstin, state, city, category, address1, address2, pincode, shipping_address')
        .eq('organisation_id', organisation.id)
        .order('client_name');
      
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisation?.id,
  });
}
