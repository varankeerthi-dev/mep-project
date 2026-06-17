// =============================================================================
// Leads / Cadence / Win-Loss / Next-Action API layer.
// Mirrors the pattern in api.ts: thin Supabase wrappers, typed, with mock fallback.
// =============================================================================

import { supabase } from '../supabase';
import type {
  CadenceRule,
  Lead,
  LeadUpdateInput,
  NewLeadInput,
  NextAction,
  WinLossCategory,
  WinLossReason,
} from '../types/leads';

export function isLeadsSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('leads') ||
    msg.includes('cadence_rules') ||
    msg.includes('win_loss_reasons') ||
    msg.includes('schema cache')
  );
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function fetchLeads(organisationId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      *,
      client:clients(id, client_name),
      owner:user_profiles!leads_owner_user_id_fkey(id, full_name)
    `
    )
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => {
    const client = row.client as Record<string, unknown> | null;
    const owner = row.owner as Record<string, unknown> | null;
    const merged: Lead = {
      ...(row as unknown as Lead),
      client_name: (client?.client_name as string | undefined) ?? null,
      owner_name: (owner?.full_name as string | undefined) ?? null,
    };
    return merged;
  });
}

export async function createLead(
  organisationId: string,
  input: NewLeadInput,
  createdBy: string
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      organisation_id: organisationId,
      contact_name: input.contact_name,
      company_name: input.company_name ?? '',
      contact_phone: input.contact_phone ?? '',
      contact_email: input.contact_email ?? '',
      source: input.source ?? 'Other',
      client_id: input.client_id ?? null,
      project_name: input.project_name ?? '',
      requirement_summary: input.requirement_summary ?? '',
      estimated_value: input.estimated_value ?? 0,
      expected_close_date: input.expected_close_date ?? null,
      owner_user_id: input.owner_user_id ?? null,
      next_action_at: input.next_action_at ?? null,
      next_action_label: input.next_action_label ?? '',
      created_by: createdBy,
      status: 'New',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Lead;
}

export async function updateLead(
  leadId: string,
  input: LeadUpdateInput
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update(input)
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data as Lead;
}

export async function convertLead(
  leadId: string,
  options: { clientId?: string; quotationId?: string }
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({
      status: 'Converted',
      converted_at: new Date().toISOString(),
      converted_to_client_id: options.clientId ?? null,
      converted_to_quotation_id: options.quotationId ?? null,
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data as Lead;
}

export async function disqualifyLead(
  leadId: string,
  reason: string
): Promise<Lead> {
  const { data, error } = await supabase
    .from('leads')
    .update({
      status: 'Disqualified',
      disqualified_reason: reason,
    })
    .eq('id', leadId)
    .select()
    .single();

  if (error) throw error;
  return data as Lead;
}

// ---------------------------------------------------------------------------
// Win / Loss reasons
// ---------------------------------------------------------------------------

export async function fetchWinLossReasons(
  organisationId: string,
  category?: WinLossCategory
): Promise<WinLossReason[]> {
  let q = supabase
    .from('win_loss_reasons')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (category) q = q.eq('category', category);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as WinLossReason[];
}

// ---------------------------------------------------------------------------
// Cadence rules
// ---------------------------------------------------------------------------

export async function fetchCadenceRules(organisationId: string): Promise<CadenceRule[]> {
  const { data, error } = await supabase
    .from('cadence_rules')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('applies_to', { ascending: true });

  if (error) throw error;
  return (data || []) as CadenceRule[];
}

export async function upsertCadenceRule(rule: Omit<CadenceRule, 'id' | 'created_at' | 'updated_at'>): Promise<CadenceRule> {
  const { data, error } = await supabase
    .from('cadence_rules')
    .upsert(rule, { onConflict: 'organisation_id,applies_to,is_active' })
    .select()
    .single();

  if (error) throw error;
  return data as CadenceRule;
}

// ---------------------------------------------------------------------------
// Next Action (ambient chip)
// ---------------------------------------------------------------------------

export async function fetchClientNextAction(
  organisationId: string,
  clientId: string
): Promise<NextAction | null> {
  // signature stable; callers guarantee non-empty before invocation
  const { data, error } = await supabase.rpc('get_closest_next_action', {
    p_organisation_id: organisationId,
    p_client_id: clientId,
  });

  if (error) throw error;
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as NextAction;
}

export async function fetchClientNextActionsBulk(
  organisationId: string,
  clientIds: string[]
): Promise<Map<string, NextAction>> {
  if (clientIds.length === 0) return new Map();

  // Run a single SQL query via an alternative: select from next_action_index directly.
  // PostgREST may not expose the view, so we use the RPC per id but batch via Promise.all.
  // For ≤200 clients this is fine; for larger pages we paginate client-side.
  const results = await Promise.all(
    clientIds.map((id) => fetchClientNextAction(organisationId, id).catch(() => null))
  );

  const map = new Map<string, NextAction>();
  results.forEach((next, idx) => {
    if (next) map.set(clientIds[idx], next);
  });
  return map;
}
