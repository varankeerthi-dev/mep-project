import { supabase } from '@/supabase';
import type { TenderInput, TenderDocumentInput } from '../model';

const TENDERS_TABLE = 'est_tenders';
const DOCUMENTS_TABLE = 'est_tender_documents';

export type TenderFilterParams = {
  status?: string;
  search?: string;
  organisation_id: string;
};

export async function listTenders(filters: TenderFilterParams) {
  let query = supabase
    .from(TENDERS_TABLE)
    .select('*, client:clients(id, client_name), boq:est_boq_headers(id, boq_no)')
    .eq('organisation_id', filters.organisation_id)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(`tender_no.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getTenderById(id: string) {
  const { data, error } = await supabase
    .from(TENDERS_TABLE)
    .select('*, client:clients(id, client_name), boq:est_boq_headers(id, boq_no, title), documents:est_tender_documents(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createTender(input: TenderInput) {
  const { data, error } = await supabase
    .from(TENDERS_TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTender(id: string, input: Partial<TenderInput>) {
  const { data, error } = await supabase
    .from(TENDERS_TABLE)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTender(id: string) {
  const { error } = await supabase.from(TENDERS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function listTenderHistory(organisationId: string) {
  const { data, error } = await supabase
    .from(TENDERS_TABLE)
    .select('*')
    .eq('organisation_id', organisationId)
    .in('status', ['Won', 'Lost'])
    .order('decision_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTenderDocument(input: TenderDocumentInput) {
  const { data, error } = await supabase
    .from(DOCUMENTS_TABLE)
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTenderDocument(id: string) {
  const { error } = await supabase.from(DOCUMENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}
