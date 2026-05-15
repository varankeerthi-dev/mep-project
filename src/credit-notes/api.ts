import { supabase } from '../supabase';
import type { CreditNote, CreditNoteItem, CreditNoteFilters } from './types';

const CN_SELECT = `
  id,
  organisation_id,
  client_id,
  invoice_id,
  cn_number,
  cn_date,
  cn_type,
  reason,
  taxable_amount,
  cgst_amount,
  sgst_amount,
  igst_amount,
  total_amount,
  approval_status,
  authorized_signatory_id,
  created_at,
  updated_at,
  client:clients(id, client_name, name, gstin, state, email),
  items:credit_note_items(id, cn_id, organisation_id, description, hsn_code, quantity, rate, discount_amount, taxable_value, cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount, total_amount, created_at)
`;

function parseClient(client: any): CreditNote['client'] {
  if (!client) return null;
  return {
    id: String(client.id),
    name: client.client_name ?? client.name ?? null,
    gstin: client.gstin ?? null,
    state: client.state ?? null,
    email: client.email ?? null,
  };
}

function parseCreditNote(row: any): CreditNote {
  return {
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    client_id: String(row.client_id),
    invoice_id: row.invoice_id ?? null,
    cn_number: String(row.cn_number ?? ''),
    cn_date: String(row.cn_date ?? ''),
    cn_type: String(row.cn_type ?? ''),
    reason: row.reason ?? null,
    taxable_amount: Number(row.taxable_amount ?? 0),
    cgst_amount: Number(row.cgst_amount ?? 0),
    sgst_amount: Number(row.sgst_amount ?? 0),
    igst_amount: Number(row.igst_amount ?? 0),
    total_amount: Number(row.total_amount ?? 0),
    approval_status: String(row.approval_status ?? 'Pending'),
    authorized_signatory_id: row.authorized_signatory_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    client: parseClient(row.client),
    items: (row.items ?? []).map((item: any) => ({
      id: String(item.id),
      cn_id: String(item.cn_id),
      organisation_id: String(item.organisation_id),
      description: String(item.description ?? ''),
      hsn_code: item.hsn_code ?? null,
      quantity: Number(item.quantity ?? 0),
      rate: Number(item.rate ?? 0),
      discount_amount: Number(item.discount_amount ?? 0),
      taxable_value: Number(item.taxable_value ?? 0),
      cgst_percent: Number(item.cgst_percent ?? 0),
      cgst_amount: Number(item.cgst_amount ?? 0),
      sgst_percent: Number(item.sgst_percent ?? 0),
      sgst_amount: Number(item.sgst_amount ?? 0),
      igst_percent: Number(item.igst_percent ?? 0),
      igst_amount: Number(item.igst_amount ?? 0),
      total_amount: Number(item.total_amount ?? 0),
      created_at: item.created_at ?? null,
    })),
  };
}

export async function getCreditNotes(filters: CreditNoteFilters = {}): Promise<CreditNote[]> {
  let query = supabase
    .from('credit_notes')
    .select(CN_SELECT)
    .eq('organisation_id', filters.organisationId)
    .order('cn_date', { ascending: false });

  if (filters.status && filters.status !== 'All') {
    query = query.eq('approval_status', filters.status);
  }
  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }
  if (filters.dateFrom) {
    query = query.gte('cn_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('cn_date', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(parseCreditNote);
}

export async function getCreditNoteById(id: string, organisationId: string): Promise<CreditNote | null> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select(CN_SELECT)
    .eq('id', id)
    .eq('organisation_id', organisationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseCreditNote(data);
}

export async function createCreditNote(input: {
  organisation_id: string;
  client_id: string;
  invoice_id?: string | null;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason?: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  authorized_signatory_id?: string | null;
  items: Omit<CreditNoteItem, 'id' | 'cn_id' | 'organisation_id' | 'created_at'>[];
}): Promise<CreditNote> {
  const { data: cn, error: cnError } = await supabase
    .from('credit_notes')
    .insert({
      organisation_id: input.organisation_id,
      client_id: input.client_id,
      invoice_id: input.invoice_id || null,
      cn_number: input.cn_number,
      cn_date: input.cn_date,
      cn_type: input.cn_type,
      reason: input.reason || null,
      taxable_amount: input.taxable_amount,
      cgst_amount: input.cgst_amount,
      sgst_amount: input.sgst_amount,
      igst_amount: input.igst_amount,
      total_amount: input.total_amount,
      approval_status: input.approval_status,
      authorized_signatory_id: (input.authorized_signatory_id && input.authorized_signatory_id !== '') ? input.authorized_signatory_id : null,
    })
    .select()
    .single();

  if (cnError) throw cnError;
  if (!cn) throw new Error('Failed to create credit note');

  if (input.items.length > 0) {
    const itemInserts = input.items.map((item) => ({
      cn_id: cn.id,
      organisation_id: input.organisation_id,
      description: item.description,
      hsn_code: item.hsn_code || null,
      quantity: item.quantity,
      rate: item.rate,
      discount_amount: item.discount_amount,
      taxable_value: item.taxable_value,
      cgst_percent: item.cgst_percent,
      cgst_amount: item.cgst_amount,
      sgst_percent: item.sgst_percent,
      sgst_amount: item.sgst_amount,
      igst_percent: item.igst_percent,
      igst_amount: item.igst_amount,
      total_amount: item.total_amount,
    }));

    const { error: itemError } = await supabase
      .from('credit_note_items')
      .insert(itemInserts);

    if (itemError) throw itemError;
  }

  return getCreditNoteById(cn.id, input.organisation_id) as Promise<CreditNote>;
}

export async function updateCreditNote(input: {
  id: string;
  organisation_id: string;
  client_id: string;
  invoice_id?: string | null;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason?: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  authorized_signatory_id?: string | null;
  items: (Omit<CreditNoteItem, 'id' | 'cn_id' | 'organisation_id' | 'created_at'> & { id?: string })[];
}): Promise<CreditNote> {
  const { error: cnError } = await supabase
    .from('credit_notes')
    .update({
      client_id: input.client_id,
      invoice_id: input.invoice_id || null,
      cn_number: input.cn_number,
      cn_date: input.cn_date,
      cn_type: input.cn_type,
      reason: input.reason || null,
      taxable_amount: input.taxable_amount,
      cgst_amount: input.cgst_amount,
      sgst_amount: input.sgst_amount,
      igst_amount: input.igst_amount,
      total_amount: input.total_amount,
      approval_status: input.approval_status,
      authorized_signatory_id: (input.authorized_signatory_id && input.authorized_signatory_id !== '') ? input.authorized_signatory_id : null,
    })
    .eq('id', input.id)
    .eq('organisation_id', input.organisation_id);

  if (cnError) throw cnError;

  // Delete existing items and re-insert
  const { error: deleteError } = await supabase
    .from('credit_note_items')
    .delete()
    .eq('cn_id', input.id);

  if (deleteError) throw deleteError;

  if (input.items.length > 0) {
    const itemInserts = input.items.map((item) => ({
      cn_id: input.id,
      organisation_id: input.organisation_id,
      description: item.description,
      hsn_code: item.hsn_code || null,
      quantity: item.quantity,
      rate: item.rate,
      discount_amount: item.discount_amount,
      taxable_value: item.taxable_value,
      cgst_percent: item.cgst_percent,
      cgst_amount: item.cgst_amount,
      sgst_percent: item.sgst_percent,
      sgst_amount: item.sgst_amount,
      igst_percent: item.igst_percent,
      igst_amount: item.igst_amount,
      total_amount: item.total_amount,
    }));

    const { error: itemError } = await supabase
      .from('credit_note_items')
      .insert(itemInserts);

    if (itemError) throw itemError;
  }

  return getCreditNoteById(input.id, input.organisation_id) as Promise<CreditNote>;
}

export async function deleteCreditNote(id: string, organisationId: string): Promise<void> {
  const { error } = await supabase
    .from('credit_notes')
    .delete()
    .eq('id', id)
    .eq('organisation_id', organisationId);

  if (error) throw error;
}

export async function generateNextCNNumber(organisationId: string): Promise<string> {
  const { data, error } = await supabase
    .from('credit_notes')
    .select('cn_number')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return 'CN-0001';

  const lastNo = data[0].cn_number;
  if (!lastNo) return 'CN-0001';

  const match = lastNo.match(/(\d+)$/);
  if (!match) return 'CN-0001';

  const nextNum = parseInt(match[1]) + 1;
  return `CN-${String(nextNum).padStart(4, '0')}`;
}
