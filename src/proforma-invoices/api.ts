import { supabase } from '../supabase';
import { calculateTotals, roundCurrency, isInterstate } from './logic';
import { ProformaItemSchema, ProformaSchema, type Proforma, type ProformaInput } from './schemas';
import type { ProformaFilters, ProformaClientSummary } from './types';
import { createInvoice } from '../invoices/api';
import type { InvoiceWithRelations } from '../invoices/api';

export interface ProformaWithRelations extends Proforma {
  client: ProformaClientSummary | null;
}

const PROFORMA_SELECT = `
  id,
  pi_number,
  client_id,
  status,
  subtotal,
  cgst,
  sgst,
  igst,
  total,
  company_state,
  client_state,
  valid_until,
  accepted_at,
  source_type,
  source_id,
  converted_invoice_id,
  notes,
  created_at,
  updated_at,
  client:clients(id, name, gst_number, state, default_template_id),
  items:proforma_items(id, proforma_id, description, hsn_code, qty, rate, amount, meta_json, sort_order)
`;

function parseClientSummary(client: any): ProformaClientSummary | null {
  if (!client) return null;
  return {
    id: String(client.id),
    name: client.name ?? null,
    gst_number: client.gst_number ?? null,
    state: client.state ?? null,
    default_template_id: client.default_template_id ?? null,
  };
}

function parseProformaRecord(row: any): ProformaWithRelations {
  const items = Array.isArray(row.items)
    ? row.items.map((item: any) =>
        ProformaItemSchema.parse({
          id: item.id,
          proforma_id: item.proforma_id,
          description: item.description,
          hsn_code: item.hsn_code ?? null,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          meta_json: item.meta_json ?? {},
          sort_order: item.sort_order ?? 0,
        }),
      )
    : [];

  const client = parseClientSummary(row.client);
  const base = ProformaSchema.parse({
    id: row.id,
    pi_number: row.pi_number ?? null,
    client_id: row.client_id,
    status: row.status,
    subtotal: row.subtotal,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    total: row.total,
    company_state: row.company_state ?? null,
    client_state: row.client_state ?? null,
    valid_until: row.valid_until ?? null,
    accepted_at: row.accepted_at ?? null,
    source_type: row.source_type,
    source_id: row.source_id ?? null,
    converted_invoice_id: row.converted_invoice_id ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items,
  });

  return {
    ...base,
    client,
  };
}

function buildProformaPayload(proforma: Proforma): {
  proformaRow: Record<string, unknown>;
  itemRows: Array<{
    description: string;
    hsn_code: string | null;
    qty: number;
    rate: number;
    amount: number;
    meta_json: Record<string, unknown>;
    sort_order: number;
  }>;
} {
  const DEFAULT_TAX = 18;
  const items = proforma.items.map((item, idx) => {
    const amt = roundCurrency(item.qty * item.rate);
    return {
      ...item,
      id: item.id ?? undefined,
      proforma_id: item.proforma_id ?? undefined,
      amount: amt,
      meta_json: { tax_percent: item.meta_json?.tax_percent ?? DEFAULT_TAX, ...item.meta_json },
      sort_order: idx,
    };
  });

  const subtotal = roundCurrency(items.reduce((sum, i) => sum + i.amount, 0));
  const taxTotal = roundCurrency(
    items.reduce((sum, i) => sum + i.amount * ((i.meta_json?.tax_percent ?? DEFAULT_TAX) / 100), 0)
  );

  let cgst = 0, sgst = 0, igst = 0;
  if (isInterstate(proforma.company_state, proforma.client_state)) {
    igst = taxTotal;
  } else {
    cgst = roundCurrency(taxTotal / 2);
    sgst = roundCurrency(taxTotal - cgst);
  }

  const proformaRow: Record<string, unknown> = {
    client_id: proforma.client_id,
    status: proforma.status,
    subtotal,
    cgst,
    sgst,
    igst,
    total: roundCurrency(subtotal + taxTotal),
    company_state: proforma.company_state,
    client_state: proforma.client_state,
    valid_until: proforma.valid_until,
    accepted_at: proforma.accepted_at,
    source_type: proforma.source_type,
    source_id: proforma.source_id,
    converted_invoice_id: proforma.converted_invoice_id,
    notes: proforma.notes,
  };

  return {
    proformaRow,
    itemRows: items.map((item, index) => ({
      description: item.description,
      hsn_code: item.hsn_code ?? null,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      meta_json: item.meta_json ?? {},
      sort_order: index,
    })),
  };
}

async function ensureClientState(clientId: string, organisationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('state')
    .eq('id', clientId)
    .eq('organisation_id', organisationId)
    .maybeSingle();

  if (error) throw error;
  return data?.state ?? null;
}

export async function createProforma(input: ProformaInput & { organisation_id: string }): Promise<ProformaWithRelations> {
  const parsed = ProformaSchema.parse(input);
  const organisationId = input.organisation_id;
  const clientState = await ensureClientState(parsed.client_id, organisationId);
  
  const validated = ProformaSchema.parse({
    ...parsed,
    client_state: clientState,
    company_state: parsed.company_state ?? null,
  });

  const { proformaRow, itemRows } = buildProformaPayload(validated);

  let proformaId: string | null = null;

  try {
    const { data: inserted, error } = await supabase
      .from('proforma_invoices')
      .insert({ ...proformaRow, organisation_id: organisationId })
      .select('id')
      .single();
    if (error) throw error;
    proformaId = inserted.id;

    if (itemRows.length > 0) {
      const { error: itemError } = await supabase
        .from('proforma_items')
        .insert(itemRows.map((item) => ({ ...item, proforma_id: proformaId, organisation_id: organisationId })));
      if (itemError) throw itemError;
    }

    return getProformaById(proformaId, organisationId);
  } catch (error) {
    if (proformaId) {
      await supabase.from('proforma_invoices').delete().eq('id', proformaId);
    }
    throw error;
  }
}

export async function updateProforma(
  id: string,
  input: ProformaInput & { organisation_id: string },
): Promise<ProformaWithRelations> {
  const parsed = ProformaSchema.parse({ ...input, id });
  const clientState = await ensureClientState(parsed.client_id, input.organisation_id);
  
  const validated = ProformaSchema.parse({
    ...parsed,
    client_state: clientState,
  });

  const { proformaRow, itemRows } = buildProformaPayload(validated);

  const { error: proformaError } = await supabase
    .from('proforma_invoices')
    .update({ ...proformaRow, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (proformaError) throw proformaError;

  const { error: deleteItemsError } = await supabase
    .from('proforma_items')
    .delete()
    .eq('proforma_id', id);
  if (deleteItemsError) throw deleteItemsError;

  if (itemRows.length > 0) {
    const { error: itemError } = await supabase
      .from('proforma_items')
      .insert(itemRows.map((item) => ({ ...item, proforma_id: id, organisation_id: input.organisation_id })));
    if (itemError) throw itemError;
  }

  return getProformaById(id, input.organisation_id);
}

export async function getProformaById(id: string, organisationId?: string): Promise<ProformaWithRelations> {
  let query = supabase.from('proforma_invoices').select(PROFORMA_SELECT).eq('id', id);
  if (organisationId) {
    query = query.eq('organisation_id', organisationId);
  }
  const { data, error } = await query.single();
  if (error) throw error;
  return parseProformaRecord(data);
}

export async function getProformaInvoices(filters: ProformaFilters = {}): Promise<ProformaWithRelations[]> {
  let query = supabase
    .from('proforma_invoices')
    .select(PROFORMA_SELECT)
    .eq('organisation_id', filters.organisationId)
    .order('created_at', { ascending: false });

  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.sourceType) query = query.eq('source_type', filters.sourceType);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(parseProformaRecord);
}

export async function sendProforma(id: string, organisationId: string, validDays = 30): Promise<ProformaWithRelations> {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validDays);

  const { error } = await supabase
    .from('proforma_invoices')
    .update({
      status: 'sent',
      valid_until: validUntil.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return getProformaById(id, organisationId);
}

export async function markAccepted(id: string, organisationId: string): Promise<ProformaWithRelations> {
  const { error } = await supabase
    .from('proforma_invoices')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return getProformaById(id, organisationId);
}

export async function markRejected(id: string, organisationId: string): Promise<ProformaWithRelations> {
  const { error } = await supabase
    .from('proforma_invoices')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return getProformaById(id, organisationId);
}

export async function convertToInvoice(
  proformaId: string,
  organisationId: string,
): Promise<InvoiceWithRelations> {
  const proforma = await getProformaById(proformaId, organisationId);

  const itemInputs = proforma.items.map((item) => ({
    description: item.description,
    hsn_code: item.hsn_code,
    qty: item.qty,
    rate: item.rate,
    amount: item.amount,
    meta_json: item.meta_json,
  }));

  const sourceType = proforma.source_type === 'manual' ? 'quotation' : proforma.source_type;

  const invoiceInput = {
    client_id: proforma.client_id,
    source_type: sourceType as 'quotation' | 'challan' | 'po',
    source_id: proforma.source_id,
    template_type: 'standard' as const,
    mode: 'itemized' as const,
    subtotal: proforma.subtotal,
    cgst: proforma.cgst,
    sgst: proforma.sgst,
    igst: proforma.igst,
    total: proforma.total,
    status: 'draft' as const,
    company_state: proforma.company_state,
    client_state: proforma.client_state,
    items: itemInputs,
  };

  const invoice = await createInvoice({ ...invoiceInput, organisation_id: organisationId });

  await supabase
    .from('proforma_invoices')
    .update({
      converted_invoice_id: invoice.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proformaId);

  return invoice;
}

export async function deleteProforma(id: string, organisationId: string): Promise<void> {
  const { error } = await supabase
    .from('proforma_invoices')
    .delete()
    .eq('id', id)
    .eq('organisation_id', organisationId);

  if (error) throw error;
}