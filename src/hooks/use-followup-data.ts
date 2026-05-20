import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as followUpApi from '../follow-up/api';
import {
  MOCK_ACTIVITY_LOGS,
  MOCK_INVOICES,
  MOCK_PODC_BACKLOG,
  MOCK_QUOTATIONS,
} from '../mock/followup-data';
import type {
  FollowUpActivityLog,
  InvoiceFollowUp,
  PodcBacklogItem,
  PodcIssueFlag,
  QuotationFollowUp,
  QuotationFollowUpStatus,
  QuotationResponseOption,
} from '../types/followup';
import { getTransitionToStatus } from '../lib/followup/quotation-workflow';

const FOLLOWUP_KEY = ['follow-up'] as const;

const USE_MOCK = import.meta.env.VITE_FOLLOWUP_USE_MOCK === 'true';

async function withMockFallback<T>(
  fetcher: () => Promise<T>,
  mock: T,
  label: string
): Promise<{ data: T; source: 'supabase' | 'mock' }> {
  if (USE_MOCK) return { data: mock, source: 'mock' };
  try {
    const data = await fetcher();
    return { data, source: 'supabase' };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (followUpApi.isFollowUpSchemaError(e)) {
      console.warn(`[Follow-Up] ${label}: schema not ready, using mock data. Run 051_follow_up_centre.sql in Supabase.`);
      return { data: mock, source: 'mock' };
    }
    throw err;
  }
}

export function useFollowUpDataSource() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  const q = useQuery({
    queryKey: [...FOLLOWUP_KEY, 'source-probe', orgId],
    queryFn: async () => {
      if (!orgId || USE_MOCK) return 'mock' as const;
      try {
        await followUpApi.fetchFollowUpActivity(orgId, 1);
        return 'supabase' as const;
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (followUpApi.isFollowUpSchemaError(e)) return 'mock' as const;
        return 'supabase' as const;
      }
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return q.data ?? (USE_MOCK ? 'mock' : 'supabase');
}

export function useFollowupQuotations() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'quotations', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => followUpApi.fetchFollowUpQuotations(orgId),
        MOCK_QUOTATIONS,
        'quotations'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
    placeholderData: MOCK_QUOTATIONS,
  });
}

export function useFollowupPodc() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'podc', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => followUpApi.fetchFollowUpPodc(orgId),
        MOCK_PODC_BACKLOG,
        'podc'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
    placeholderData: MOCK_PODC_BACKLOG,
  });
}

export function useFollowupInvoices() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'invoices', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => followUpApi.fetchFollowUpInvoices(orgId),
        MOCK_INVOICES,
        'invoices'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
    placeholderData: MOCK_INVOICES,
  });
}

export function useFollowupActivity() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'activity', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => followUpApi.fetchFollowUpActivity(orgId),
        MOCK_ACTIVITY_LOGS,
        'activity'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 15_000,
    placeholderData: MOCK_ACTIVITY_LOGS,
  });
}

export function useLogQuotationResponse() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      response,
      quotation_no,
      client_name,
      previousStatus,
    }: {
      id: string;
      response: QuotationResponseOption;
      quotation_no?: string;
      client_name?: string;
      previousStatus?: QuotationFollowUpStatus | null;
    }) => {
      if (!orgId) throw new Error('No organisation selected');
      await followUpApi.upsertQuotationResponse(orgId, id, response, {
        quotation_no: quotation_no || id,
        client_name: client_name || 'Client',
      }, previousStatus);
    },
    onMutate: async ({ id, response }) => {
      await qc.cancelQueries({ queryKey: [...FOLLOWUP_KEY, 'quotations', orgId] });
      const prev = qc.getQueryData<QuotationFollowUp[]>([...FOLLOWUP_KEY, 'quotations', orgId]);
      const newStatus = getTransitionToStatus(response);
      qc.setQueryData<QuotationFollowUp[]>([...FOLLOWUP_KEY, 'quotations', orgId], (old) =>
        (old ?? []).map((q) =>
          q.id === id
            ? { ...q, status: newStatus, previous_status: q.status, status_changed_at: new Date().toISOString() }
            : q
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([...FOLLOWUP_KEY, 'quotations', orgId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY, 'quotations', orgId] });
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY, 'activity', orgId] });
    },
  });
}

export function useFlagPodcIssue() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      issue,
      dc_wo_number,
    }: {
      id: string;
      issue: PodcIssueFlag;
      dc_wo_number?: string;
    }) => {
      if (!orgId) throw new Error('No organisation selected');
      await followUpApi.flagPodcIssue(orgId, id, issue, {
        dc_wo_number: dc_wo_number || id,
      });
    },
    onMutate: async ({ id, issue }) => {
      await qc.cancelQueries({ queryKey: [...FOLLOWUP_KEY, 'podc', orgId] });
      const prev = qc.getQueryData<PodcBacklogItem[]>([...FOLLOWUP_KEY, 'podc', orgId]);
      qc.setQueryData<PodcBacklogItem[]>([...FOLLOWUP_KEY, 'podc', orgId], (old) =>
        (old ?? []).map((p) =>
          p.id === id ? { ...p, issue_flag: issue, dispute_status: 'open' as const } : p
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([...FOLLOWUP_KEY, 'podc', orgId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY, 'podc', orgId] });
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY, 'activity', orgId] });
    },
  });
}

export function useRecordReminder() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      type: 'quotation' | 'podc' | 'invoice';
      id: string;
      label: string;
      client: string;
    }) => {
      if (!orgId) throw new Error('No organisation selected');
      if (payload.type === 'quotation') {
        await followUpApi.recordQuotationReminder(orgId, payload.id, {
          quotation_no: payload.label,
          client_name: payload.client,
        });
      } else if (payload.type === 'podc') {
        await followUpApi.recordPodcPackShared(orgId, payload.id, {
          dc_wo_number: payload.label,
          client_name: payload.client,
        });
      } else {
        await followUpApi.recordInvoiceReminder(orgId, payload.id, {
          invoice_no: payload.label,
          client_name: payload.client,
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY] });
    },
  });
}

export function useAssignFollowUp() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      source,
      sourceId,
      assigneeUserId,
    }: {
      source: 'quotation' | 'podc' | 'invoice';
      sourceId: string;
      assigneeUserId: string | null;
    }) => {
      if (!orgId) throw new Error('No organisation selected');
      await followUpApi.assignFollowUpOwner(orgId, source, sourceId, assigneeUserId);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY] });
    },
  });
}
