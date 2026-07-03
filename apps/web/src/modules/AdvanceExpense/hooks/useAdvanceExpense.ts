import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ApprovalIntegration } from '@/approvals/integration';
import { generateTransactionNo } from '../utils/transactionNo';
import type { AdvanceExpense, PettyCashFloat, AeFilters, AeFormData, AeKpiData } from '../types';

function useOrgId() {
  const ctx = useAuth();
  return ctx.organisation?.id;
}

function useUserId() {
  const ctx = useAuth();
  return ctx.user?.id;
}

function useUserName() {
  const ctx = useAuth();
  return ctx.user?.user_metadata?.full_name || ctx.user?.email || '';
}

export function useExpenseCategories(orgId?: string) {
  return useQuery({
    queryKey: ['expense-categories', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_code, name')
        .eq('root_type', 'Expense')
        .eq('is_group', false)
        .eq('organisation_id', orgId!)
        .order('name');
      return data || [];
    },
    enabled: !!orgId,
  });
}

export function useOrgEmployees(orgId?: string) {
  return useQuery({
    queryKey: ['org-employees', orgId],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('organisation_id', orgId!);
      if (!members?.length) return [];
      const ids = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      return profiles || [];
    },
    enabled: !!orgId,
  });
}

export function useProjects(orgId?: string) {
  return useQuery({
    queryKey: ['projects-list', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organisation_id', orgId!)
        .order('name');
      return data || [];
    },
    enabled: !!orgId,
  });
}

export function useAdvanceExpenses(orgId?: string, filters?: AeFilters) {
  return useQuery({
    queryKey: ['advances-expenses', orgId, filters],
    queryFn: async () => {
      let query = supabase
        .from('advances_expenses')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (filters?.type && filters.type !== 'ALL') query = query.eq('type', filters.type);
      if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
      if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
      if (filters?.project_id) query = query.eq('project_id', filters.project_id);
      if (filters?.category_id) query = query.eq('category_id', filters.category_id);
      if (filters?.date_from) query = query.gte('created_at', filters.date_from);
      if (filters?.date_to) query = query.lte('created_at', filters.date_to);

      const { data } = await query;
      return (data || []) as AdvanceExpense[];
    },
    enabled: !!orgId,
  });
}

export function usePettyCashFloats(orgId?: string) {
  return useQuery({
    queryKey: ['petty-cash-floats', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('petty_cash_floats')
        .select('*')
        .eq('organisation_id', orgId!)
        .order('created_at', { ascending: false });
      return (data || []) as PettyCashFloat[];
    },
    enabled: !!orgId,
  });
}

export function useAeKpis(orgId?: string) {
  return useQuery({
    queryKey: ['ae-kpis', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('advances_expenses')
        .select('type, amount, status')
        .eq('organisation_id', orgId!)
        .eq('is_deleted', false);

      const rows = (data || []) as Pick<AdvanceExpense, 'type' | 'amount' | 'status'>[];
      const kpis: AeKpiData = {
        advances_total: 0,
        expenses_total: 0,
        awaiting_payment: 0,
        paid_out: 0,
        accrued: 0,
        float_balances: 0,
      };

      for (const r of rows) {
        if (r.type === 'ADVANCE') kpis.advances_total += Number(r.amount);
        if (r.type === 'EXPENSE' || r.type === 'REIMBURSEMENT') kpis.expenses_total += Number(r.amount);
        if (r.status === 'PENDING') kpis.awaiting_payment += Number(r.amount);
        if (r.status === 'PAID') kpis.paid_out += Number(r.amount);
        if (r.status === 'APPROVED') kpis.accrued += Number(r.amount);
      }

      const { data: floats } = await supabase
        .from('petty_cash_floats')
        .select('current_balance')
        .eq('organisation_id', orgId!)
        .eq('status', 'ACTIVE');

      kpis.float_balances = (floats || []).reduce((sum: number, f: any) => sum + Number(f.current_balance), 0);

      return kpis;
    },
    enabled: !!orgId,
  });
}

export function useCreateAdvanceExpense() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const userId = useUserId();
  const userName = useUserName();

  return useMutation({
    mutationFn: async (data: AeFormData) => {
      if (!orgId || !userId) throw new Error('Not authenticated');

      const transactionNo = generateTransactionNo();
      const payload = {
        organisation_id: orgId,
        type: data.type,
        request_type: data.request_type,
        transaction_no: transactionNo,
        employee_id: data.employee_id,
        project_id: data.project_id || null,
        category_id: data.category_id || null,
        amount: data.amount,
        payout_method: data.payout_method,
        narration: data.narration || null,
        remarks: data.remarks || null,
        advance_id: data.advance_id || null,
        float_id: data.float_id || null,
        status: 'DRAFT' as const,
        created_by: userId,
        created_by_name: userName,
      };

      const { data: inserted, error } = await supabase
        .from('advances_expenses')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return inserted as AdvanceExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances-expenses', orgId] });
      queryClient.invalidateQueries({ queryKey: ['ae-kpis', orgId] });
    },
  });
}

export function useSubmitForApproval() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!orgId || !userId) throw new Error('Not authenticated');

      const { data: record } = await supabase
        .from('advances_expenses')
        .select('*, user_profiles!employee_id(full_name)')
        .eq('id', id)
        .single();

      if (!record) throw new Error('Record not found');

      const employeeName = record.employee_name || record.user_profiles?.full_name || 'Employee';
      const categoryName = record.category_name || 'Expense';

      await supabase
        .from('advances_expenses')
        .update({
          status: 'PENDING',
          transaction_no: record.transaction_no || generateTransactionNo(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      const result = await ApprovalIntegration.createAdvanceExpenseApproval(
        id,
        employeeName,
        categoryName,
        Number(record.amount),
      );

      if (!result.success && result.error && result.error !== 'No approval required for this amount') {
        await supabase
          .from('advances_expenses')
          .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
          .eq('id', id);
        throw new Error(result.error);
      }

      if (result.error === 'No approval required for this amount') {
        await supabase
          .from('advances_expenses')
          .update({ status: 'APPROVED', approval_status: 'Not Required', updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      return { ...record, status: 'PENDING' as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances-expenses', orgId] });
      queryClient.invalidateQueries({ queryKey: ['ae-kpis', orgId] });
    },
  });
}

export function useUpdateAdvanceExpense() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AeFormData> }) => {
      const { error } = await supabase
        .from('advances_expenses')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances-expenses', orgId] });
    },
  });
}

export function useDeleteAdvanceExpense() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('advances_expenses')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances-expenses', orgId] });
      queryClient.invalidateQueries({ queryKey: ['ae-kpis', orgId] });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error: aeErr } = await supabase
        .from('advances_expenses')
        .update({ status: 'PAID', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (aeErr) throw aeErr;

      const { data: record } = await supabase
        .from('advances_expenses')
        .select('float_id, amount')
        .eq('id', id)
        .single();

      if (record?.float_id) {
        await supabase.rpc('decrement_float_balance', {
          float_id: record.float_id,
          dec_amount: record.amount,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances-expenses', orgId] });
      queryClient.invalidateQueries({ queryKey: ['ae-kpis', orgId] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-floats', orgId] });
    },
  });
}

export function useCreatePettyCashFloat() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (data: { holder_id: string; project_id: string; float_amount: number; holder_name?: string }) => {
      if (!orgId || !userId) throw new Error('Not authenticated');

      const { data: member } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', data.holder_id)
        .single();

      const { error } = await supabase.from('petty_cash_floats').insert({
        organisation_id: orgId,
        holder_id: data.holder_id,
        holder_name: data.holder_name || member?.full_name || 'Unknown',
        project_id: data.project_id || null,
        float_amount: data.float_amount,
        current_balance: data.float_amount,
        status: 'ACTIVE',
        created_by: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-floats', orgId] });
    },
  });
}

export function useTopUpFloat() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();

  return useMutation({
    mutationFn: async ({ float_id, amount }: { float_id: string; amount: number }) => {
      const { data: float } = await supabase
        .from('petty_cash_floats')
        .select('current_balance')
        .eq('id', float_id)
        .single();

      if (!float) throw new Error('Float not found');

      const newBalance = Number(float.current_balance) + amount;
      const { error } = await supabase
        .from('petty_cash_floats')
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', float_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-floats', orgId] });
    },
  });
}
