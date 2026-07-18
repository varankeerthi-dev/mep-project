import { supabase } from '@/supabase';
import type { PartnerInput } from '../model';

const TABLE = 'partners';

export type PartnerFilterParams = {
  search?: string;
  partner_type?: string;
  is_active?: boolean;
  organisation_id: string;
};

export async function listPartners(filters: PartnerFilterParams) {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('organisation_id', filters.organisation_id)
    .order('business_name', { ascending: true });

  if (filters.partner_type) {
    query = query.eq('partner_type', filters.partner_type);
  }
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  if (filters.search) {
    query = query.or(`business_name.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getPartnerById(id: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createPartner(input: PartnerInput) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePartner(id: string, input: Partial<PartnerInput>) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePartner(id: string) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
