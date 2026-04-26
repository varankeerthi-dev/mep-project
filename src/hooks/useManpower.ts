// ============================================
// MANPOWER-BASED SUBCONTRACTOR SYSTEM API HOOKS
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import {
  LabourCategory,
  CreateLabourCategoryInput,
  UpdateLabourCategoryInput,
  RateCard,
  CreateRateCardInput,
  UpdateRateCardInput,
  ContextModifier,
  CreateContextModifierInput,
  UpdateContextModifierInput,
  ManpowerAttendance,
  CreateManpowerAttendanceInput,
  UpdateManpowerAttendanceInput,
  ManpowerBilling,
  CreateManpowerBillingInput,
  UpdateManpowerBillingInput,
} from '../types/manpower';

// ============================================
// LABOUR CATEGORIES
// ============================================

export function useLabourCategories(organisationId: string | undefined) {
  return useQuery({
    queryKey: ['labour-categories', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('labour_categories')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('name');
      if (error) throw error;
      return data as LabourCategory[];
    },
    enabled: !!organisationId,
  });
}

export function useCreateLabourCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLabourCategoryInput) => {
      const { data, error } = await supabase
        .from('labour_categories')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as LabourCategory;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['labour-categories', variables.organisation_id] });
    },
  });
}

export function useUpdateLabourCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateLabourCategoryInput) => {
      const { data, error } = await supabase
        .from('labour_categories')
        .update(input)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as LabourCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labour-categories'] });
    },
  });
}

export function useDeleteLabourCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('labour_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labour-categories'] });
    },
  });
}

// ============================================
// RATE CARDS
// ============================================

export function useRateCards(organisationId: string | undefined, subcontractorId?: string) {
  return useQuery({
    queryKey: ['rate-cards', organisationId, subcontractorId],
    queryFn: async () => {
      if (!organisationId) return [];
      let query = supabase
        .from('rate_cards')
        .select(`
          *,
          labour_categories(id, name, code, unit),
          subcontractors(id, company_name)
        `)
        .eq('organisation_id', organisationId)
        .eq('is_active', true);
      
      if (subcontractorId) {
        query = query.eq('subcontractor_id', subcontractorId);
      }
      
      const { data, error } = await query.order('effective_from', { ascending: false });
      if (error) throw error;
      return data as RateCard[];
    },
    enabled: !!organisationId,
  });
}

export function useCreateRateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRateCardInput) => {
      const { data, error } = await supabase
        .from('rate_cards')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as RateCard;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards', variables.organisation_id] });
    },
  });
}

export function useUpdateRateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRateCardInput) => {
      const { data, error } = await supabase
        .from('rate_cards')
        .update(input)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as RateCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
  });
}

export function useDeleteRateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rate_cards')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-cards'] });
    },
  });
}

// ============================================
// CONTEXT MODIFIERS
// ============================================

export function useContextModifiers(organisationId: string | undefined) {
  return useQuery({
    queryKey: ['context-modifiers', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('context_modifiers')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('is_active', true)
        .order('modifier_type');
      if (error) throw error;
      return data as ContextModifier[];
    },
    enabled: !!organisationId,
  });
}

export function useCreateContextModifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContextModifierInput) => {
      const { data, error } = await supabase
        .from('context_modifiers')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ContextModifier;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['context-modifiers', variables.organisation_id] });
    },
  });
}

export function useUpdateContextModifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateContextModifierInput) => {
      const { data, error } = await supabase
        .from('context_modifiers')
        .update(input)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as ContextModifier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-modifiers'] });
    },
  });
}

export function useDeleteContextModifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('context_modifiers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['context-modifiers'] });
    },
  });
}

// ============================================
// MANPOWER ATTENDANCE
// ============================================

export function useManpowerAttendance(
  organisationId: string | undefined,
  subcontractorId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['manpower-attendance', organisationId, subcontractorId, startDate, endDate],
    queryFn: async () => {
      if (!organisationId) return [];
      let query = supabase
        .from('manpower_attendance')
        .select(`
          *,
          labour_categories(id, name, code, unit),
          subcontractors(id, company_name)
        `)
        .eq('organisation_id', organisationId);
      
      if (subcontractorId) {
        query = query.eq('subcontractor_id', subcontractorId);
      }
      
      if (startDate) {
        query = query.gte('attendance_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('attendance_date', endDate);
      }
      
      const { data, error } = await query.order('attendance_date', { ascending: false });
      if (error) throw error;
      return data as ManpowerAttendance[];
    },
    enabled: !!organisationId,
  });
}

export function useCreateManpowerAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManpowerAttendanceInput) => {
      const { data, error } = await supabase
        .from('manpower_attendance')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ManpowerAttendance;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manpower-attendance', variables.organisation_id] });
    },
  });
}

export function useUpdateManpowerAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateManpowerAttendanceInput) => {
      const { data, error } = await supabase
        .from('manpower_attendance')
        .update(input)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as ManpowerAttendance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manpower-attendance'] });
    },
  });
}

export function useDeleteManpowerAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manpower_attendance')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manpower-attendance'] });
    },
  });
}

export function useApproveManpowerAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('manpower_attendance')
        .update({ 
          status: 'APPROVED',
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ManpowerAttendance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manpower-attendance'] });
    },
  });
}

// ============================================
// MANPOWER BILLING
// ============================================

export function useManpowerBilling(
  organisationId: string | undefined,
  subcontractorId?: string,
  status?: string
) {
  return useQuery({
    queryKey: ['manpower-billing', organisationId, subcontractorId, status],
    queryFn: async () => {
      if (!organisationId) return [];
      let query = supabase
        .from('manpower_billing')
        .select(`
          *,
          subcontractors(id, company_name)
        `)
        .eq('organisation_id', organisationId);
      
      if (subcontractorId) {
        query = query.eq('subcontractor_id', subcontractorId);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query.order('billing_period_start', { ascending: false });
      if (error) throw error;
      return data as ManpowerBilling[];
    },
    enabled: !!organisationId,
  });
}

export function useCreateManpowerBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManpowerBillingInput) => {
      const { data, error } = await supabase
        .from('manpower_billing')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ManpowerBilling;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manpower-billing', variables.organisation_id] });
    },
  });
}

export function useUpdateManpowerBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateManpowerBillingInput) => {
      const { data, error } = await supabase
        .from('manpower_billing')
        .update(input)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as ManpowerBilling;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manpower-billing'] });
    },
  });
}

export function useDeleteManpowerBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('manpower_billing')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manpower-billing'] });
    },
  });
}

export function useApproveManpowerBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('manpower_billing')
        .update({ 
          status: 'APPROVED',
          approved_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ManpowerBilling;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manpower-billing'] });
    },
  });
}

// Export as namespace for easier imports
export const useManpower = {
  useLabourCategories,
  useCreateLabourCategory,
  useUpdateLabourCategory,
  useDeleteLabourCategory,
  useRateCards,
  useCreateRateCard,
  useUpdateRateCard,
  useDeleteRateCard,
  useContextModifiers,
  useCreateContextModifier,
  useUpdateContextModifier,
  useDeleteContextModifier,
  useManpowerAttendance,
  useCreateManpowerAttendance,
  useUpdateManpowerAttendance,
  useDeleteManpowerAttendance,
  useApproveManpowerAttendance,
  useManpowerBilling,
  useCreateManpowerBilling,
  useUpdateManpowerBilling,
  useDeleteManpowerBilling,
  useApproveManpowerBilling,
};
