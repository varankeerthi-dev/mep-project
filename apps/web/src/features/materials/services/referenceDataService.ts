// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';

export function useCategories(orgId: string | null) {
  return useQuery({
    queryKey: ['materials-page-data', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.from('item_categories').select('*').order('category_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}

export function useVendors(orgId: string | null) {
  return useQuery({
    queryKey: ['purchase-vendors', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name')
        .eq('organisation_id', orgId)
        .eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}

export function useDiscountCategories(orgId: string | null) {
  return useQuery({
    queryKey: ['discountCategories', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('discount_categories')
        .select('*')
        .or(`organisation_id.eq.${orgId},organisation_id.is.null`)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}
