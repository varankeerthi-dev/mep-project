import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

export function useChartOfAccounts() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['accounts', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('account_code');
      
      if (error) throw error;

      // Transform flat list to tree
      const accountMap = new Map();
      const roots: any[] = [];

      data.forEach((acc: any) => {
        accountMap.set(acc.id, {
          id: acc.id,
          code: acc.account_code,
          name: acc.name,
          type: acc.is_group ? 'Group' : 'Ledger',
          rootType: acc.root_type,
          balance: 0, // Calculate balances in a real system by joining journal_entry_lines
          children: []
        });
      });

      data.forEach((acc: any) => {
        const node = accountMap.get(acc.id);
        if (acc.parent_id && accountMap.has(acc.parent_id)) {
          accountMap.get(acc.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      return roots;
    },
    enabled: !!organisation?.id,
  });
}

export function useDayBook() {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['journal_entries', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          id,
          voucher_no,
          voucher_date,
          voucher_type,
          narration,
          status,
          created_at,
          journal_entry_lines (
            id, debit, credit, narration, party_type, party_id, accounts(name)
          )
        `)
        // .eq('company_id', organisation.id) - Use company_id or branch_id if multitenant
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((entry: any) => {
        // Flatten the double-entry lines for display (simplified for DayBook view)
        // Find the main line (e.g. the first line with a debit)
        const mainLine = entry.journal_entry_lines?.[0];
        
        return {
          id: entry.id,
          time: new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          voucherNo: entry.voucher_no,
          type: entry.voucher_type,
          partyName: mainLine?.accounts?.name || 'Multiple Accounts',
          narration: entry.narration || mainLine?.narration || '',
          debit: entry.journal_entry_lines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || null,
          credit: entry.journal_entry_lines?.reduce((sum: number, line: any) => sum + (line.credit || 0), 0) || null,
          status: entry.status,
        };
      });
    },
    enabled: !!organisation?.id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('accounts')
        .insert({
          ...data,
          organisation_id: organisation?.id,
          company_id: organisation?.id // Ensure company_id is provided
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  return useMutation({
    mutationFn: async (data: any) => {
      // Use the rpc function for safe double entry
      const { error } = await supabase.rpc('post_journal_entry', {
        p_organisation_id: organisation?.id,
        p_voucher_date: data.voucher_date,
        p_voucher_type: data.voucher_type,
        p_narration: data.narration,
        p_lines: data.lines
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
    }
  });
}
