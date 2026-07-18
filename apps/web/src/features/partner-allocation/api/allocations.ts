import { supabase } from '@/supabase';
import type { LeadAllocationInput } from '../model';

const TABLE = 'lead_allocations';

export type AllocationFilterParams = {
  status?: string;
  partner_id?: string;
  lead_id?: string;
  search?: string;
  organisation_id: string;
};

export async function listAllocations(filters: AllocationFilterParams) {
  let query = supabase
    .from(TABLE)
    .select('*, lead:leads(id, contact_name, company_name, city, project_name, requirement_summary), partner:partners(id, business_name, contact_person, phone)')
    .eq('organisation_id', filters.organisation_id)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.partner_id) {
    query = query.eq('partner_id', filters.partner_id);
  }
  if (filters.lead_id) {
    query = query.eq('lead_id', filters.lead_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAllocationById(id: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, lead:leads(*), partner:partners(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createAllocation(input: LeadAllocationInput) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAllocation(id: string, input: Partial<LeadAllocationInput>) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAllocation(id: string) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function getAllocationsByLeadId(leadId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, partner:partners(id, business_name, contact_person, phone, email)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
