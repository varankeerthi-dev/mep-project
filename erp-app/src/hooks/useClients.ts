import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { withSessionCheck } from '../queryClient';

export function useClients() {
  const { organisation } = useAuth();
  
  return useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: withSessionCheck(async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_id, contact, email, gstin, state, city, category, address1, address2, pincode, shipping_address, discount_type, discount_profile_id, standard_pricelist_id, custom_discounts')
        .eq('organisation_id', organisation.id)
        .order('client_name');
      
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisation?.id,
  });
}
