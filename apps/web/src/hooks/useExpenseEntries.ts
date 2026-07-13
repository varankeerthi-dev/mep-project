import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ExpenseEntry, ExpenseEntryInsert, ExpenseEntryUpdate } from '@/types/expense';

export const EXPENSE_ENTRIES_KEY = 'expense-entries';

type ExpenseEntryFilter = {
  organisationId?: string;
  projectId?: string;
  status?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
};

function buildQuery(filters: ExpenseEntryFilter) {
  let query = supabase
    .from('expense_entries')
    .select(`
      *,
      project:projects(id, project_name),
      client:clients(id, client_name),
      consumable_item:consumable_catalog(id, name, category, unit),
      material:materials(id, name, unit)
    `)
    .order('created_at', { ascending: false });

  if (filters.organisationId) {
    query = query.eq('organisation_id', filters.organisationId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.category) {
    query = query.eq('expense_category', filters.category);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  return query;
}

export function useExpenseEntries(filters: ExpenseEntryFilter) {
  return useQuery({
    queryKey: [EXPENSE_ENTRIES_KEY, filters],
    enabled: !!filters.organisationId,
    queryFn: async () => {
      const { data, error } = await buildQuery(filters);
      if (error) throw error;
      return (data || []) as ExpenseEntry[];
    },
  });
}

export function useExpenseEntry(id: string | undefined) {
  return useQuery({
    queryKey: [EXPENSE_ENTRIES_KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_entries')
        .select(`
          *,
          project:projects(id, project_name),
          client:clients(id, client_name),
          consumable_item:consumable_catalog(id, name, category, unit),
          material:materials(id, name, unit)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as ExpenseEntry;
    },
  });
}

export function useCreateExpenseEntry(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseEntryInsert) => {
      const { data, error } = await supabase
        .from('expense_entries')
        .insert({ ...input, organisation_id: organisationId })
        .select()
        .single();
      if (error) throw error;
      return data as ExpenseEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSE_ENTRIES_KEY] });
    },
  });
}

export function useUpdateExpenseEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ExpenseEntryUpdate }) => {
      const { data, error } = await supabase
        .from('expense_entries')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ExpenseEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EXPENSE_ENTRIES_KEY] });
    },
  });
}
