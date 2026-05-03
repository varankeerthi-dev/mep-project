import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { ServiceRate, QuotationItemExtended } from '../types/erection';

// Hook to fetch all active service rates
export function useServiceRates() {
  return useQuery({
    queryKey: ['service_rates'],
    queryFn: async (): Promise<ServiceRate[]> => {
      const { data, error } = await supabase
        .from('service_rates')
        .select('*')
        .eq('is_active', true)
        .order('item_name');
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Hook to fetch erection items for a specific quotation
export function useErectionItems(quotationId: string) {
  return useQuery({
    queryKey: ['quotation_items', quotationId, 'erection'],
    queryFn: async (): Promise<QuotationItemExtended[]> => {
      const { data, error } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotationId)
        .eq('section', 'erection')
        .order('created_at');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!quotationId,
  });
}

// Mutation to update erection rate (marks as manually edited)
export function useUpdateErectionRate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, newRate }: { id: string; newRate: number }) => {
      const { data, error } = await supabase
        .from('quotation_items')
        .update({
          rate: newRate,
          rate_manually_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation_items'] });
    },
  });
}

// Mutation to delete erection (marks parent material to prevent re-creation)
export function useDeleteErection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (erectionItem: QuotationItemExtended) => {
      // 1. Delete erection row
      const { error: deleteError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('id', erectionItem.id);
      
      if (deleteError) throw deleteError;
      
      // 2. Mark parent material to prevent re-creation
      if (erectionItem.linked_material_id) {
        const { error: updateError } = await supabase
          .from('quotation_items')
          .update({ erection_manually_removed: true })
          .eq('id', erectionItem.linked_material_id);
        
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation_items'] });
    },
  });
}

// Mutation to toggle erection_manually_removed flag on material
export function useToggleErectionRemoval() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ materialId, removed }: { materialId: string; removed: boolean }) => {
      const { error } = await supabase
        .from('quotation_items')
        .update({ erection_manually_removed: removed })
        .eq('id', materialId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation_items'] });
    },
  });
}

// Helper function to look up service rate by item name
export async function lookupServiceRate(itemName: string): Promise<ServiceRate | null> {
  const { data, error } = await supabase
    .from('service_rates')
    .select('*')
    .eq('item_name', String(itemName))
    .eq('is_active', true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw error;
  }
  
  return data;
}
