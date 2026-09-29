import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as followUpApi from '../follow-up/api';
import type { FollowUpListResult } from '../follow-up/api';
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

// Maps a mutation source domain to its list query-key segment.
const SOURCE_LIST_KEY = {
  quotation: 'quotations',
  podc: 'podc',
  invoice: 'invoices',
  procurement: 'procurement',
} as const;

const EMPTY_LIST_RESULT = { items: [], total: 0 };

export function useFollowupQuotations() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'quotations', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpQuotations(orgId) : EMPTY_LIST_RESULT),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useFollowupPodc() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'podc', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpPodc(orgId) : EMPTY_LIST_RESULT),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useFollowupProcurement() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'procurement', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpProcurement(orgId) : EMPTY_LIST_RESULT),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useFollowupInvoices() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'invoices', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpInvoices(orgId) : EMPTY_LIST_RESULT),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useFollowupActivity() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'activity', orgId],
    queryFn: () => (orgId ? followUpApi.fetchFollowUpActivity(orgId) : EMPTY_LIST_RESULT),
    enabled: !!orgId,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useFollowupLeadsCount() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: [...FOLLOWUP_KEY, 'leads-count', orgId],
    queryFn: () => (orgId ? followUpApi.fetchLeadsCount(orgId) : 0),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
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
      const prev = qc.getQueryData<FollowUpListResult<QuotationFollowUp>>([...FOLLOWUP_KEY, 'quotations', orgId]);
      const newStatus = getTransitionToStatus(response);
      qc.setQueryData<FollowUpListResult<QuotationFollowUp>>([...FOLLOWUP_KEY, 'quotations', orgId], (old) =>
        old
          ? {
              ...old,
              items: old.items.map((q) =>
                q.id === id
                  ? { ...q, status: newStatus, previous_status: q.status, status_changed_at: new Date().toISOString() }
                  : q
              ),
            }
          : old
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
      const prev = qc.getQueryData<FollowUpListResult<PodcBacklogItem>>([...FOLLOWUP_KEY, 'podc', orgId]);
      qc.setQueryData<FollowUpListResult<PodcBacklogItem>>([...FOLLOWUP_KEY, 'podc', orgId], (old) =>
        old
          ? {
              ...old,
              items: old.items.map((p) =>
                p.id === id ? { ...p, issue_flag: issue, dispute_status: 'open' as const } : p
              ),
            }
          : old
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
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: [...FOLLOWUP_KEY, 'activity', orgId] });
      const prev = qc.getQueryData<FollowUpListResult<FollowUpActivityLog>>([...FOLLOWUP_KEY, 'activity', orgId]);
      // Optimistically prepend a reminder-sent activity entry so the user sees
      // immediate feedback in the activity tab before the server round-trip.
      const eventType =
        payload.type === 'quotation'
          ? 'quotation_reminder_sent'
          : payload.type === 'podc'
            ? 'podc_pack_shared'
            : payload.type === 'invoice'
              ? 'invoice_reminder_sent'
              : 'procurement_reminder_sent';
      const newEntry: FollowUpActivityLog = {
        id: `opt-${payload.id}-${Date.now()}`,
        event_type: eventType,
        tab_source: payload.type,
        title: `${payload.type === 'procurement' ? 'Procurement' : payload.type === 'invoice' ? 'Invoice' : payload.type === 'podc' ? 'DC Pack' : 'Quotation'} reminder sent`,
        description: `Reminder sent to ${payload.client}`,
        actor_name: 'You',
        reference_id: payload.id,
        reference_label: payload.label,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<FollowUpListResult<FollowUpActivityLog>>(
        [...FOLLOWUP_KEY, 'activity', orgId],
        (old) => (old ? { ...old, items: [newEntry, ...old.items] } : { items: [newEntry], total: 1 })
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData([...FOLLOWUP_KEY, 'activity', orgId], ctx.prev);
      }
    },
    onSettled: (_d, _e, payload) => {
      // Targeted: the touched source list plus the activity feed (a reminder
      // entry was logged). Queue/counts/metrics derive client-side.
      qc.invalidateQueries({
        queryKey: [...FOLLOWUP_KEY, SOURCE_LIST_KEY[payload.type], orgId],
      });
      qc.invalidateQueries({ queryKey: [...FOLLOWUP_KEY, 'activity', orgId] });
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
      source: 'quotation' | 'podc' | 'invoice' | 'procurement' | 'lead';
      sourceId: string;
      assigneeUserId: string | null;
    }) => {
      if (!orgId) throw new Error('No organisation selected');
      await followUpApi.assignFollowUpOwner(orgId, source, sourceId, assigneeUserId);
    },
    onMutate: async ({ source, sourceId, assigneeUserId }) => {
      await qc.cancelQueries({ queryKey: [...FOLLOWUP_KEY] });
      // Capture prev from the exact sub-key being patched so the error
      // rollback restores the same list that was optimistically modified.
      let prev:
        | FollowUpListResult<QuotationFollowUp>
        | FollowUpListResult<PodcBacklogItem>
        | FollowUpListResult<InvoiceFollowUp>
        | undefined;
      if (source === 'quotation') {
        prev = qc.getQueryData<FollowUpListResult<QuotationFollowUp>>([...FOLLOWUP_KEY, 'quotations', orgId]);
        qc.setQueryData<FollowUpListResult<QuotationFollowUp>>(
          [...FOLLOWUP_KEY, 'quotations', orgId],
          (old) =>
            old
              ? {
                  ...old,
                  items:
                    old.items.map((q) =>
                      q.id === sourceId ? { ...q, assignee_user_id: assigneeUserId ?? null } : q
                    ) ?? [],
                }
              : old
        );
      } else if (source === 'podc') {
        prev = qc.getQueryData<FollowUpListResult<PodcBacklogItem>>([...FOLLOWUP_KEY, 'podc', orgId]);
        qc.setQueryData<FollowUpListResult<PodcBacklogItem>>(
          [...FOLLOWUP_KEY, 'podc', orgId],
          (old) =>
            old
              ? {
                  ...old,
                  items:
                    old.items.map((p) =>
                      p.id === sourceId ? { ...p, assignee_user_id: assigneeUserId ?? null } : p
                    ) ?? [],
                }
              : old
        );
      } else if (source === 'invoice') {
        prev = qc.getQueryData<FollowUpListResult<InvoiceFollowUp>>([...FOLLOWUP_KEY, 'invoices', orgId]);
        qc.setQueryData<FollowUpListResult<InvoiceFollowUp>>(
          [...FOLLOWUP_KEY, 'invoices', orgId],
          (old) =>
            old
              ? {
                  ...old,
                  items:
                    old.items.map((inv) =>
                      inv.id === sourceId
                        ? { ...inv, assignee_user_id: assigneeUserId ?? null }
                        : inv
                    ) ?? [],
                }
              : old
        );
      }
      return { prev, source };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      if (ctx.source === 'quotation' && ctx.prev) {
        qc.setQueryData<FollowUpListResult<QuotationFollowUp>>([...FOLLOWUP_KEY, 'quotations', orgId], ctx.prev as FollowUpListResult<QuotationFollowUp>);
      } else if (ctx.source === 'podc' && ctx.prev) {
        qc.setQueryData<FollowUpListResult<PodcBacklogItem>>([...FOLLOWUP_KEY, 'podc', orgId], ctx.prev as FollowUpListResult<PodcBacklogItem>);
      } else if (ctx.source === 'invoice' && ctx.prev) {
        qc.setQueryData<FollowUpListResult<InvoiceFollowUp>>([...FOLLOWUP_KEY, 'invoices', orgId], ctx.prev as FollowUpListResult<InvoiceFollowUp>);
      }
    },
    onSettled: (_d, _e, variables) => {
      // Targeted: only the touched source list can have changed. The queue,
      // counts and metrics derive from it client-side — no refetch needed.
      const listKey =
        variables.source === 'lead'
          ? (['leads', orgId] as const)
          : ([...FOLLOWUP_KEY, SOURCE_LIST_KEY[variables.source as keyof typeof SOURCE_LIST_KEY], orgId] as const);
      qc.invalidateQueries({ queryKey: listKey });
    },
  });
}

export function useUpdateFollowUpPriority() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      source,
      sourceId,
      priorityBand,
      referenceLabel,
    }: {
      source: 'quotation' | 'podc' | 'invoice' | 'procurement' | 'lead';
      sourceId: string;
      priorityBand: 'critical' | 'high' | 'medium' | 'low';
      referenceLabel?: string;
    }) => {
      if (!orgId) throw new Error('No organisation selected');
      await followUpApi.updateFollowUpPriority(
        orgId,
        source,
        sourceId,
        priorityBand,
        referenceLabel
      );
    },
    onSettled: (_d, _e, variables) => {
      // Targeted: only the touched source list can have changed. The queue
      // derives client-side — no refetch needed. The best-effort escalation
      // log is fire-and-forget (frequently rejected server-side), so the
      // activity feed is intentionally not refetched for it.
      const listKey =
        variables.source === 'lead'
          ? (['leads', orgId] as const)
          : ([...FOLLOWUP_KEY, SOURCE_LIST_KEY[variables.source as keyof typeof SOURCE_LIST_KEY], orgId] as const);
      qc.invalidateQueries({ queryKey: listKey });
    },
  });
}

