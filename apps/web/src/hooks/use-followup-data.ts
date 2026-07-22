import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as followUpApi from '../follow-up/api';
import type {
  InvoiceFollowUp,
  PodcBacklogItem,
  PodcIssueFlag,
  QuotationFollowUp,
  QuotationFollowUpStatus,
  QuotationResponseOption,
} from '../types/followup';
import { getTransitionToStatus } from '../lib/followup/quotation-workflow';

const FOLLOWUP_KEY = ['follow-up'] as const;

export function useFollowupQuotations() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'quotations', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpQuotations(orgId) : []),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useFollowupPodc() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'podc', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpPodc(orgId) : []),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useFollowupProcurement() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'procurement', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpProcurement(orgId) : []),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useFollowupInvoices() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'invoices', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpInvoices(orgId) : []),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useFollowupActivity() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'activity', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpActivity(orgId) : []),
    enabled: !!orgId,
    staleTime: 15_000,
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
      type: 'quotation' | 'podc' | 'invoice' | 'procurement';
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
      } else if (payload.type === 'procurement') {
        await followUpApi.recordProcurementReminder(orgId, payload.id, {
          po_no: payload.label,
          vendor_name: payload.client,
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
