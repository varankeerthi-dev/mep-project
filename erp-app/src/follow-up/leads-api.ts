import { supabase } from '../supabase';
import type {
  Lead,
  LeadUpdateInput,
  NewLeadInput,
  NextAction,
  WinLossCategory,
  WinLossReason,
  LeadStatus,
  LeadIndustry,
  LeadHistory,
  LeadAssignmentRule,
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
// Lead Statuses
// ---------------------------------------------------------------------------

export async function fetchLeadStatuses(organisationId: string): Promise<LeadStatus[]> {
  const { data, error } = await supabase
    .from('lead_statuses')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as LeadStatus[];
}

export async function createLeadStatus(
  organisationId: string,
  input: { name: string; color: string; sort_order: number; category: 'open' | 'won' | 'lost' | 'junk'; is_default?: boolean }
): Promise<LeadStatus> {
  const { data, error } = await supabase
    .from('lead_statuses')
    .insert({ organisation_id: organisationId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data as LeadStatus;
}

export async function updateLeadStatus(
  id: string,
  input: Partial<{ name: string; color: string; sort_order: number; category: 'open' | 'won' | 'lost' | 'junk'; is_default: boolean }>
): Promise<LeadStatus> {
  const { data, error } = await supabase
    .from('lead_statuses')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as LeadStatus;
}

export async function deleteLeadStatus(id: string): Promise<void> {
  const { error } = await supabase.from('lead_statuses').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Lead Industries
// ---------------------------------------------------------------------------

export async function fetchLeadIndustries(organisationId: string): Promise<LeadIndustry[]> {
  const { data, error } = await supabase
    .from('lead_industries')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as LeadIndustry[];
}

export async function createLeadIndustry(
  organisationId: string,
  input: { name: string; sort_order: number }
): Promise<LeadIndustry> {
  const { data, error } = await supabase
    .from('lead_industries')
    .insert({ organisation_id: organisationId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data as LeadIndustry;
}

export async function updateLeadIndustry(id: string, input: Partial<{ name: string; sort_order: number }>): Promise<LeadIndustry> {
  const { data, error } = await supabase
    .from('lead_industries')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as LeadIndustry;
}

export async function deleteLeadIndustry(id: string): Promise<void> {
  const { error } = await supabase.from('lead_industries').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Lead History
// ---------------------------------------------------------------------------

export async function fetchLeadHistory(leadId: string): Promise<LeadHistory[]> {
  const { data, error } = await supabase
    .from('lead_history')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as LeadHistory[];
}

export async function createLeadHistory(
  input: Omit<LeadHistory, 'id' | 'created_at'>
): Promise<LeadHistory> {
  const { data, error } = await supabase
    .from('lead_history')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as LeadHistory;
}

// ---------------------------------------------------------------------------
// Lead Assignment Rules
// ---------------------------------------------------------------------------

export async function fetchLeadAssignmentRule(organisationId: string): Promise<LeadAssignmentRule | null> {
  const { data, error } = await supabase
    .from('lead_assignment_rules')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle();

  if (error) throw error;
  return data as LeadAssignmentRule | null;
}

export async function upsertLeadAssignmentRule(
  rule: Omit<LeadAssignmentRule, 'id' | 'created_at' | 'updated_at'>
): Promise<LeadAssignmentRule> {
  const { data, error } = await supabase
    .from('lead_assignment_rules')
    .upsert(rule, { onConflict: 'organisation_id' })
    .select()
    .single();

  if (error) throw error;
  return data as LeadAssignmentRule;
}

// ---------------------------------------------------------------------------
// Leads (updated for new fields)
// ---------------------------------------------------------------------------

export async function fetchLeads(organisationId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      *,
      client:clients(id, client_name),
      owner:user_profiles!leads_owner_user_id_fkey(id, full_name),
      lead_status:lead_statuses(id, name, color, sort_order, is_default, category),
      industry:lead_industries(id, name)
    `
    )
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => {
    const client = row.client as Record<string, unknown> | null;
    const owner = row.owner as Record<string, unknown> | null;
    const leadStatus = row.lead_status as Record<string, unknown> | null;
    const industry = row.industry as Record<string, unknown> | null;
    const merged: Lead = {
      ...(row as unknown as Lead),
      client_name: (client?.client_name as string | undefined) ?? null,
      owner_name: (owner?.full_name as string | undefined) ?? null,
      lead_status: leadStatus ? (leadStatus as unknown as unknown as LeadStatus) : null,
      industry: industry ? (industry as unknown as unknown as LeadIndustry) : null,
    };
    return merged;
  });
}

export async function fetchLeadById(leadId: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select(
      `
      *,
      client:clients(id, client_name),
      owner:user_profiles!leads_owner_user_id_fkey(id, full_name),
      lead_status:lead_statuses(id, name, color, sort_order, is_default, category),
      industry:lead_industries(id, name)
    `
    )
    .eq('id', leadId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const client = data.client as Record<string, unknown> | null;
  const owner = data.owner as Record<string, unknown> | null;
  const leadStatus = data.lead_status as Record<string, unknown> | null;
  const industry = data.industry as Record<string, unknown> | null;
  return {
    ...(data as unknown as Lead),
    client_name: (client?.client_name as string | undefined) ?? null,
    owner_name: (owner?.full_name as string | undefined) ?? null,
    lead_status: leadStatus ? (leadStatus as unknown as LeadStatus) : null,
    industry: industry ? (industry as unknown as LeadIndustry) : null,
  };
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
      lead_status_id: input.lead_status_id ?? null,
      industry_id: input.industry_id ?? null,
      referred_by: input.referred_by ?? '',
      remarks: input.remarks ?? '',
      city: input.city ?? '',
      state: input.state ?? '',
      pin: input.pin ?? '',
    })
    .select(
      `
      *,
      lead_status:lead_statuses(id, name, color, sort_order, is_default, category),
      industry:lead_industries(id, name)
    `
    )
    .single();

  if (error) throw error;
  const leadStatus = (data as Record<string, unknown>).lead_status as Record<string, unknown> | null;
  const industry = (data as Record<string, unknown>).industry as Record<string, unknown> | null;
  return {
    ...(data as unknown as Lead),
    lead_status: leadStatus ? (leadStatus as unknown as LeadStatus) : null,
    industry: industry ? (industry as unknown as LeadIndustry) : null,
  };
}

export async function updateLead(
  leadId: string,
  input: LeadUpdateInput
): Promise<Lead> {
  const updateData: Record<string, unknown> = {};
  if (input.contact_name !== undefined) updateData.contact_name = input.contact_name;
  if (input.company_name !== undefined) updateData.company_name = input.company_name;
  if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;
  if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
  if (input.source !== undefined) updateData.source = input.source;
  if (input.client_id !== undefined) updateData.client_id = input.client_id;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.disqualified_reason !== undefined) updateData.disqualified_reason = input.disqualified_reason;
  if (input.project_name !== undefined) updateData.project_name = input.project_name;
  if (input.requirement_summary !== undefined) updateData.requirement_summary = input.requirement_summary;
  if (input.estimated_value !== undefined) updateData.estimated_value = input.estimated_value;
  if (input.expected_close_date !== undefined) updateData.expected_close_date = input.expected_close_date;
  if (input.owner_user_id !== undefined) updateData.owner_user_id = input.owner_user_id;
  if (input.next_action_at !== undefined) updateData.next_action_at = input.next_action_at;
  if (input.next_action_label !== undefined) updateData.next_action_label = input.next_action_label;
  if (input.lead_status_id !== undefined) updateData.lead_status_id = input.lead_status_id;
  if (input.industry_id !== undefined) updateData.industry_id = input.industry_id;
  if (input.referred_by !== undefined) updateData.referred_by = input.referred_by;
  if (input.remarks !== undefined) updateData.remarks = input.remarks;
  if (input.city !== undefined) updateData.city = input.city;
  if (input.state !== undefined) updateData.state = input.state;
  if (input.pin !== undefined) updateData.pin = input.pin;

  const { data, error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId)
    .select(
      `
      *,
      lead_status:lead_statuses(id, name, color, sort_order, is_default, category),
      industry:lead_industries(id, name)
    `
    )
    .single();

  if (error) throw error;
  const leadStatus = (data as Record<string, unknown>).lead_status as Record<string, unknown> | null;
  const industry = (data as Record<string, unknown>).industry as Record<string, unknown> | null;
  return {
    ...(data as unknown as Lead),
    lead_status: leadStatus ? (leadStatus as unknown as LeadStatus) : null,
    industry: industry ? (industry as unknown as LeadIndustry) : null,
  };
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
    .select(
      `
      *,
      lead_status:lead_statuses(id, name, color, sort_order, is_default, category),
      industry:lead_industries(id, name)
    `
    )
    .single();

  if (error) throw error;
  const leadStatus = (data as Record<string, unknown>).lead_status as Record<string, unknown> | null;
  const industry = (data as Record<string, unknown>).industry as Record<string, unknown> | null;
  return {
    ...(data as unknown as Lead),
    lead_status: leadStatus ? (leadStatus as unknown as LeadStatus) : null,
    industry: industry ? (industry as unknown as LeadIndustry) : null,
  };
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
    .select(
      `
      *,
      lead_status:lead_statuses(id, name, color, sort_order, is_default, category),
      industry:lead_industries(id, name)
    `
    )
    .single();

  if (error) throw error;
  const leadStatus = (data as Record<string, unknown>).lead_status as Record<string, unknown> | null;
  const industry = (data as Record<string, unknown>).industry as Record<string, unknown> | null;
  return {
    ...(data as unknown as Lead),
    lead_status: leadStatus ? (leadStatus as unknown as LeadStatus) : null,
    industry: industry ? (industry as unknown as LeadIndustry) : null,
  };
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

export async function fetchCadenceRules(organisationId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('cadence_rules')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('applies_to', { ascending: true });

  if (error) throw error;
  return (data || []) as any[];
}

export async function upsertCadenceRule(rule: Omit<any, 'id' | 'created_at' | 'updated_at'>): Promise<any> {
  const { data, error } = await supabase
    .from('cadence_rules')
    .upsert(rule, { onConflict: 'organisation_id,applies_to,is_active' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Next Action (ambient chip)
// ---------------------------------------------------------------------------

export async function fetchClientNextAction(
  organisationId: string,
  clientId: string
): Promise<NextAction | null> {
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
  const results = await Promise.all(
    clientIds.map((id) => fetchClientNextAction(organisationId, id).catch(() => null))
  );
  const map = new Map<string, NextAction>();
  results.forEach((next, idx) => {
    if (next) map.set(clientIds[idx], next);
  });
  return map;
}

// ---------------------------------------------------------------------------
// Organisation Users — for owner assignment picker
// ---------------------------------------------------------------------------

export async function fetchOrgUsers(organisationId: string): Promise<Array<{ id: string; full_name: string }>> {
  const { data, error } = await supabase
    .rpc('get_org_users', { p_org_id: organisationId });

  if (error) {
    console.warn('get_org_users RPC failed, trying direct query:', error);
    const { data: members, error: mError } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('organisation_id', organisationId)
      .eq('status', 'active');
    if (mError) throw mError;
    const userIds = (members || []).map(r => (r as any).user_id).filter(Boolean) as string[];
    if (userIds.length === 0) return [];

    const { data: profiles, error: pError } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('user_id', userIds);
    if (pError) throw pError;
    return (profiles || []) as Array<{ id: string; full_name: string }>;
  }

  return (data || []) as Array<{ id: string; full_name: string }>;
}
