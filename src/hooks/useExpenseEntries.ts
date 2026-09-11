import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { ExpenseEntry, ExpenseEntryInsert } from '@/types/expense';

export function useExpenseEntries(opts?: { projectId?: string }) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery({
    queryKey: ['expense-entries', orgId, opts?.projectId],
    queryFn: async (): Promise<ExpenseEntry[]> => {
      if (!orgId) return [];
      let query = supabase
        .from('expense_entries')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });
      if (opts?.projectId) {
        query = query.eq('project_id', opts.projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

export function useExpenseEntry(id: string | undefined) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['expense-entry', id],
    queryFn: async (): Promise<ExpenseEntry | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('expense_entries')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateExpenseEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ExpenseEntryInsert) => {
      const { data, error } = await supabase
        .from('expense_entries')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ExpenseEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-entries'] });
    },
  });
}

export function useUpdateExpenseEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<ExpenseEntry> & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['expense-entries'] });
    },
  });
}
