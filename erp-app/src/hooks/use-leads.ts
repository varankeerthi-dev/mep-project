// =============================================================================
// useLeads / useWinLossReasons / useCadenceRules / useNextAction
// Hooks layer for the ambient follow-up wedge.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as leadsApi from '../follow-up/leads-api';
import {
  MOCK_CADENCE_RULES,
  MOCK_LEADS,
  MOCK_LEAD_INDUSTRIES,
  MOCK_LEAD_STATUSES,
  MOCK_NEXT_ACTIONS,
  MOCK_WIN_LOSS_REASONS,
} from '../mock/leads-data';
import type {
  CadenceRule,
  Lead,
  LeadAssignmentRule,
  LeadHistory,
  LeadIndustry,
  LeadStatus,
  LeadUpdateInput,
  NewLeadInput,
  NextAction,
  WinLossCategory,
  WinLossReason,
} from '../types/leads';

const KEYS = {
  leads: (orgId?: string) => ['leads', orgId] as const,
  wlReasons: (orgId?: string, category?: WinLossCategory) =>
    ['win-loss-reasons', orgId, category ?? 'all'] as const,
  cadence: (orgId?: string) => ['cadence-rules', orgId] as const,
  nextAction: (orgId?: string, clientId?: string) =>
    ['next-action', orgId, clientId] as const,
  nextActionsBulk: (orgId?: string) => ['next-action-bulk', orgId] as const,
  leadStatuses: (orgId?: string) => ['lead-statuses', orgId] as const,
  leadIndustries: (orgId?: string) => ['lead-industries', orgId] as const,
  leadHistory: (leadId?: string) => ['lead-history', leadId] as const,
  leadAssignmentRule: (orgId?: string) => ['lead-assignment-rule', orgId] as const,
};

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
    if (leadsApi.isLeadsSchemaError(e)) {
      console.warn(`[Leads] ${label}: schema not ready, using mock data. Run 076_leads_cadence_winloss.sql in Supabase.`);
      return { data: mock, source: 'mock' };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export function useLeads() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.leads(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => leadsApi.fetchLeads(orgId),
        MOCK_LEADS,
        'leads'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
    placeholderData: MOCK_LEADS,
  });
}

export function useLeadsWithStatus(): { data: Lead[]; isLoading: boolean } {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  const q = useQuery({
    queryKey: KEYS.leads(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => leadsApi.fetchLeads(orgId),
        MOCK_LEADS,
        'leads'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 30_000,
    placeholderData: MOCK_LEADS,
  });

  return { data: q.data ?? [], isLoading: q.isLoading };
}

export function useCreateLead() {
  const { organisation, user } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (input: NewLeadInput) => {
      if (!orgId || !user?.id) throw new Error('No active org / user');
      if (USE_MOCK) {
        return { ...MOCK_LEADS[0], ...input, id: `mock-${Date.now()}` } as Lead;
      }
      return leadsApi.createLead(orgId, input, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', orgId] });
    },
  });
}

export function useUpdateLead() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: LeadUpdateInput }) => {
      if (USE_MOCK) {
        return { id, ...patch } as unknown as Lead;
      }
      return leadsApi.updateLead(id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', orgId] });
    },
  });
}

export function useConvertLead() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async ({
      id,
      clientId,
      quotationId,
    }: {
      id: string;
      clientId?: string;
      quotationId?: string;
    }) => {
      if (USE_MOCK) return { id, status: 'Converted' as const } as unknown as Lead;
      return leadsApi.convertLead(id, { clientId, quotationId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', orgId] });
    },
  });
}

export function useDisqualifyLead() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (USE_MOCK) return { id, status: 'Disqualified' as const, disqualified_reason: reason } as unknown as Lead;
      return leadsApi.disqualifyLead(id, reason);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', orgId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Win / Loss reasons
// ---------------------------------------------------------------------------

export function useWinLossReasons(category?: WinLossCategory) {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.wlReasons(orgId, category),
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => leadsApi.fetchWinLossReasons(orgId, category),
        category
          ? MOCK_WIN_LOSS_REASONS.filter((r) => r.category === category)
          : MOCK_WIN_LOSS_REASONS,
        'win-loss-reasons'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Cadence rules
// ---------------------------------------------------------------------------

export function useCadenceRules() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.cadence(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => leadsApi.fetchCadenceRules(orgId),
        MOCK_CADENCE_RULES,
        'cadence-rules'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
}

export function useUpsertCadenceRule() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (rule: Omit<CadenceRule, 'id' | 'created_at' | 'updated_at'>) => {
      if (USE_MOCK) return rule as CadenceRule;
      return leadsApi.upsertCadenceRule(rule);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.cadence(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Next Action (ambient chip)
// ---------------------------------------------------------------------------

export function useClientNextAction(clientId: string | null | undefined) {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.nextAction(orgId, clientId),
    queryFn: async () => {
      if (!orgId || !clientId) return null;
      const safeOrgId = orgId;
      const safeClientId = clientId;
      const { data } = await withMockFallback<NextAction | null>(
        () => leadsApi.fetchClientNextAction(safeOrgId, safeClientId),
        MOCK_NEXT_ACTIONS[0] ?? null,
        `next-action:${safeClientId}`
      );
      return data;
    },
    enabled: !!orgId && !!clientId,
    staleTime: 30_000,
  });
}

export function useClientNextActionsBulk(clientIds: string[]) {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.nextActionsBulk(orgId),
    queryFn: async () => {
      if (!orgId || clientIds.length === 0) return new Map<string, NextAction>();
      const safeOrgId = orgId;
      const { data } = await withMockFallback(
        () => leadsApi.fetchClientNextActionsBulk(safeOrgId, clientIds),
        new Map<string, NextAction>(MOCK_NEXT_ACTIONS.map((n, i) => [clientIds[i] ?? '', n])),
        'next-action-bulk'
      );
      return data;
    },
    enabled: !!orgId && clientIds.length > 0,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Lead Statuses
// ---------------------------------------------------------------------------

export function useLeadStatuses() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.leadStatuses(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => leadsApi.fetchLeadStatuses(orgId),
        MOCK_LEAD_STATUSES,
        'lead-statuses'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    placeholderData: MOCK_LEAD_STATUSES,
  });
}

export function useCreateLeadStatus() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (input: { name: string; color: string; sort_order: number; category: 'open' | 'won' | 'lost' | 'junk'; is_default?: boolean }) => {
      if (!orgId) throw new Error('No active org');
      return leadsApi.createLeadStatus(orgId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leadStatuses(orgId) });
    },
  });
}

export function useUpdateLeadStatus() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<{ name: string; color: string; sort_order: number; category: 'open' | 'won' | 'lost' | 'junk'; is_default: boolean }> }) => {
      return leadsApi.updateLeadStatus(id, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leadStatuses(orgId) });
    },
  });
}

export function useDeleteLeadStatus() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return leadsApi.deleteLeadStatus(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leadStatuses(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Lead Industries
// ---------------------------------------------------------------------------

export function useLeadIndustries() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.leadIndustries(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await withMockFallback(
        () => leadsApi.fetchLeadIndustries(orgId),
        MOCK_LEAD_INDUSTRIES,
        'lead-industries'
      );
      return data;
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    placeholderData: MOCK_LEAD_INDUSTRIES,
  });
}

export function useCreateLeadIndustry() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (input: { name: string; sort_order: number }) => {
      if (!orgId) throw new Error('No active org');
      return leadsApi.createLeadIndustry(orgId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leadIndustries(orgId) });
    },
  });
}

export function useDeleteLeadIndustry() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return leadsApi.deleteLeadIndustry(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leadIndustries(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Lead History
// ---------------------------------------------------------------------------

export function useLeadHistory(leadId: string | null) {
  return useQuery({
    queryKey: KEYS.leadHistory(leadId ?? undefined),
    queryFn: async () => {
      if (!leadId) return [];
      return leadsApi.fetchLeadHistory(leadId);
    },
    enabled: !!leadId,
    staleTime: 10_000,
  });
}

export function useCreateLeadHistory() {
  return useMutation({
    mutationFn: async (input: Omit<LeadHistory, 'id' | 'created_at'>) => {
      return leadsApi.createLeadHistory(input);
    },
  });
}

// ---------------------------------------------------------------------------
// Lead Assignment Rules
// ---------------------------------------------------------------------------

export function useLeadAssignmentRule() {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;

  return useQuery({
    queryKey: KEYS.leadAssignmentRule(orgId),
    queryFn: async () => {
      if (!orgId) return null;
      return leadsApi.fetchLeadAssignmentRule(orgId);
    },
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
}

export function useUpsertLeadAssignmentRule() {
  const { organisation } = useAuth();
  const qc = useQueryClient();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async (rule: Omit<LeadAssignmentRule, 'id' | 'created_at' | 'updated_at'>) => {
      return leadsApi.upsertLeadAssignmentRule(rule);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leadAssignmentRule(orgId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Pure helper: compute escalation stage from rule + next_action_at
// Use when you can't (or don't want to) round-trip to RPC.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Org users — for owner assignment picker
// ---------------------------------------------------------------------------

export function useOrgUsers(): { data: Array<{ id: string; full_name: string }> | undefined; isLoading: boolean } {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const result = useQuery({
    queryKey: ['org-users', orgId],
    queryFn: () => orgId ? leadsApi.fetchOrgUsers(orgId) : Promise.resolve([]),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  return { data: result.data, isLoading: result.isLoading };
}

export function computeStageClient(
  rule: Pick<CadenceRule, 'stage_1_days' | 'stage_2_days' | 'stage_3_days' | 'stage_4_days'> | null,
  nextActionAt: string | null,
  now: Date = new Date()
): 0 | 1 | 2 | 3 | 4 {
  if (!nextActionAt) return 0;
  const ageMs = now.getTime() - new Date(nextActionAt).getTime();
  if (ageMs <= 0) return 0;

  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const s1 = rule?.stage_1_days ?? 1;
  const s2 = rule?.stage_2_days ?? 3;
  const s3 = rule?.stage_3_days ?? 7;
  const s4 = rule?.stage_4_days ?? 15;

  if (ageDays >= s4) return 4;
  if (ageDays >= s3) return 3;
  if (ageDays >= s2) return 2;
  if (ageDays >= s1) return 1;
  return 0;
}
