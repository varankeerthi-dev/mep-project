import { supabase } from '../supabase';
import { calculateTotals, mapSourceToInvoice, roundCurrency } from './logic';
import {
  InvoiceItemSchema,
  InvoiceMaterialSchema,
  InvoiceSchema,
  type Invoice,
  type InvoiceInput,
} from './schemas';
import type {
  ChallanInvoiceSource,
  InvoiceClientSummary,
  InvoiceFilters,
  InvoiceSourceDocument,
  InvoiceSourceMapOptions,
  InvoiceSourceType,
  PurchaseOrderInvoiceSource,
  QuotationInvoiceSource,
} from './types';

export interface InvoiceWithRelations extends Invoice {
  client: InvoiceClientSummary | null;
}

export interface InvoiceTemplateRecord {
  id: string;
  name: string;
  layout_json: Record<string, unknown>;
  created_at?: string;
}

type InvoiceInsertPayload = Omit<
  Invoice,
  'id' | 'created_at' | 'items' | 'materials' | 'company_state' | 'client_state'
>;

const INVOICE_SELECT = `
  id,
  client_id,
  source_type,
  source_id,
  template_id,
  template_type,
  mode,
  subtotal,
  cgst,
  sgst,
  igst,
  total,
  status,
  created_at,
  client:clients(id, name, gst_number, state, default_template_id),
  items:invoice_items(id, invoice_id, description, hsn_code, qty, rate, amount, meta_json),
  materials:invoice_materials(id, invoice_id, product_id, qty_used)
`;

function parseClientSummary(client: any): InvoiceClientSummary | null {
  if (!client) return null;

  return {
    id: String(client.id),
    name: client.name ?? null,
    gst_number: client.gst_number ?? null,
    state: client.state ?? null,
    default_template_id: client.default_template_id ?? null,
  };
}

function buildInvoicePayload(invoice: Invoice): {
  invoiceRow: InvoiceInsertPayload;
  itemRows: Array<{
    description: string;
    hsn_code: string | null;
    qty: number;
    rate: number;
    amount: number;
    meta_json: Record<string, unknown>;
  }>;
  materialRows: Array<{
    product_id: string;
    qty_used: number;
  }>;
} {
  const totals = calculateTotals(invoice, {
    defaultTaxPercent: 18,
  });

  const invoiceRow: InvoiceInsertPayload = {
    client_id: invoice.client_id,
    template_id: invoice.template_id ?? null,
    source_type: invoice.source_type,
    source_id: invoice.source_id,
    template_type: invoice.template_type,
    mode: invoice.mode,
    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    status: invoice.status,
  };

  return {
    invoiceRow,
    itemRows: totals.items.map((item) => ({
      description: item.description,
      hsn_code: item.hsn_code ?? null,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      meta_json: item.meta_json ?? {},
    })),
    materialRows: invoice.materials.map((material) => ({
      product_id: material.product_id,
      qty_used: material.qty_used,
    })),
  };
}

function parseInvoiceRecord(row: any): InvoiceWithRelations {
  const items = Array.isArray(row.items)
    ? row.items.map((item: any) =>
        InvoiceItemSchema.parse({
          id: item.id,
          invoice_id: item.invoice_id,
          description: item.description,
          hsn_code: item.hsn_code ?? null,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          meta_json: item.meta_json ?? {},
        }),
      )
    : [];

  const materials = Array.isArray(row.materials)
    ? row.materials.map((material: any) =>
        InvoiceMaterialSchema.parse({
          id: material.id,
          invoice_id: material.invoice_id,
          product_id: material.product_id,
          qty_used: material.qty_used,
        }),
      )
    : [];

  const client = parseClientSummary(row.client);
  const base = InvoiceSchema.parse({
    id: row.id,
    client_id: row.client_id,
    template_id: row.template_id ?? null,
    source_type: row.source_type,
    source_id: row.source_id,
    template_type: row.template_type,
    mode: row.mode,
    subtotal: row.subtotal,
    cgst: row.cgst,
    sgst: row.sgst,
    igst: row.igst,
    total: row.total,
    status: row.status,
    created_at: row.created_at,
    company_state: null,
    client_state: client?.state ?? null,
    items,
    materials,
  });

  return {
    ...base,
    client,
  };
}

async function ensureClientState(clientId: string, fallbackState?: string | null): Promise<string | null> {
  if (fallbackState) return fallbackState;

  const { data, error } = await supabase.from('clients').select('state').eq('id', clientId).maybeSingle();

  if (error) throw error;
  return data?.state ?? null;
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceWithRelations> {
  const parsed = InvoiceSchema.parse(input);
  const clientState = await ensureClientState(parsed.client_id, parsed.client_state);
  const validated = InvoiceSchema.parse({
    ...parsed,
    client_state: clientState,
  });
  const { invoiceRow, itemRows, materialRows } = buildInvoicePayload(validated);

  let invoiceId: string | null = null;

  try {
    const { data: inserted, error } = await supabase.from('invoices').insert(invoiceRow).select('id').single();
    if (error) throw error;
    invoiceId = inserted.id;
    const insertedInvoiceId = inserted.id as string;

    if (itemRows.length > 0) {
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert(itemRows.map((item) => ({ ...item, invoice_id: insertedInvoiceId })));
      if (itemError) throw itemError;
    }

    if (materialRows.length > 0) {
      const { error: materialError } = await supabase
        .from('invoice_materials')
        .insert(materialRows.map((material) => ({ ...material, invoice_id: insertedInvoiceId })));
      if (materialError) throw materialError;
    }

    return getInvoiceById(insertedInvoiceId);
  } catch (error) {
    if (invoiceId) {
      await supabase.from('invoices').delete().eq('id', invoiceId);
    }
    throw error;
  }
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceWithRelations> {
  const parsed = InvoiceSchema.parse({
    ...input,
    id,
  });
  const clientState = await ensureClientState(parsed.client_id, parsed.client_state);
  const validated = InvoiceSchema.parse({
    ...parsed,
    client_state: clientState,
  });
  const { invoiceRow, itemRows, materialRows } = buildInvoicePayload(validated);

  const { error: invoiceError } = await supabase.from('invoices').update(invoiceRow).eq('id', id);
  if (invoiceError) throw invoiceError;

  const [deleteItems, deleteMaterials] = await Promise.all([
    supabase.from('invoice_items').delete().eq('invoice_id', id),
    supabase.from('invoice_materials').delete().eq('invoice_id', id),
  ]);

  if (deleteItems.error) throw deleteItems.error;
  if (deleteMaterials.error) throw deleteMaterials.error;

  if (itemRows.length > 0) {
    const { error: itemError } = await supabase
      .from('invoice_items')
      .insert(itemRows.map((item) => ({ ...item, invoice_id: id })));
    if (itemError) throw itemError;
  }

  if (materialRows.length > 0) {
    const { error: materialError } = await supabase
      .from('invoice_materials')
      .insert(materialRows.map((material) => ({ ...material, invoice_id: id })));
    if (materialError) throw materialError;
  }

  return getInvoiceById(id);
}

export async function getInvoiceById(id: string): Promise<InvoiceWithRelations> {
  const { data, error } = await supabase.from('invoices').select(INVOICE_SELECT).eq('id', id).single();

  if (error) throw error;
  return parseInvoiceRecord(data);
}

export async function getInvoices(filters: InvoiceFilters = {}): Promise<InvoiceWithRelations[]> {
  let query = supabase.from('invoices').select(INVOICE_SELECT).eq('organisation_id', filters.organisationId).order('created_at', { ascending: false });

  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.sourceType) query = query.eq('source_type', filters.sourceType);
  if (filters.templateType) query = query.eq('template_type', filters.templateType);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(parseInvoiceRecord);
}

export async function getInvoiceTemplates(): Promise<InvoiceTemplateRecord[]> {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('id, name, layout_json, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((template) => ({
    id: String(template.id),
    name: String(template.name),
    layout_json:
      template.layout_json && typeof template.layout_json === 'object'
        ? (template.layout_json as Record<string, unknown>)
        : {},
    created_at: template.created_at ?? undefined,
  }));
}

async function resolveClientFromChallan(clientName: string, fallbackState?: string | null): Promise<{
  clientId: string;
  clientState: string | null;
}> {
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, state')
    .eq('name', clientName)
    .maybeSingle();

  if (error) throw error;
  if (!client?.id) {
    throw new Error(`Unable to resolve client "${clientName}" for delivery challan.`);
  }

  return {
    clientId: client.id,
    clientState: fallbackState ?? client.state ?? null,
  };
}

async function enrichHsnCodes<T extends { product_id?: string | null; item_id?: string | null }>(
  lines: T[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(
    new Set(
      lines
        .map((line) => line.product_id ?? line.item_id ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (ids.length === 0) return new Map();

  const { data, error } = await supabase.from('materials').select('id, hsn_code').in('id', ids);
  if (error) throw error;

  return new Map((data ?? []).map((item) => [item.id, item.hsn_code ?? null]));
}

export async function loadInvoiceSource(sourceType: InvoiceSourceType, sourceId: string): Promise<InvoiceSourceDocument> {
  if (sourceType === 'quotation') {
    const { data: header, error: headerError } = await supabase
      .from('quotation_header')
      .select('id, client_id, state, reference')
      .eq('id', sourceId)
      .single();
    if (headerError) throw headerError;

    const { data: items, error: itemError } = await supabase
      .from('quotation_items')
      .select('id, item_id, description, qty, rate, line_total, tax_percent')
      .eq('quotation_id', sourceId);
    if (itemError) throw itemError;

    const hsnById = await enrichHsnCodes(items ?? []);

    const source: QuotationInvoiceSource = {
      type: 'quotation',
      header: {
        id: header.id,
        client_id: header.client_id,
        client_state: header.state ?? null,
        reference: header.reference ?? null,
      },
      items: (items ?? []).map((item) => ({
        id: item.id,
        item_id: item.item_id ?? null,
        description: item.description ?? 'Quotation item',
        hsn_code: hsnById.get(item.item_id) ?? null,
        qty: Number(item.qty ?? 0),
        rate: Number(item.rate ?? 0),
        amount: Number(item.line_total ?? roundCurrency(Number(item.qty ?? 0) * Number(item.rate ?? 0))),
        tax_percent: Number(item.tax_percent ?? 18),
      })),
    };

    return source;
  }

  if (sourceType === 'challan') {
    const { data: header, error: headerError } = await supabase
      .from('delivery_challans')
      .select('id, client_name, dc_number, ship_to_state, po_no, remarks')
      .eq('id', sourceId)
      .single();
    if (headerError) throw headerError;
    if (!header.client_name) {
      throw new Error('Delivery challan is missing client_name and cannot be invoiced.');
    }

    const resolvedClient = await resolveClientFromChallan(header.client_name, header.ship_to_state ?? null);

    const { data: items, error: itemError } = await supabase
      .from('delivery_challan_items')
      .select('id, material_id, material_name, quantity, rate, amount')
      .eq('delivery_challan_id', sourceId);
    if (itemError) throw itemError;

    const hsnById = await enrichHsnCodes((items ?? []).map((item) => ({ product_id: item.material_id ?? null })));

    const source: ChallanInvoiceSource = {
      type: 'challan',
      header: {
        id: header.id,
        client_id: resolvedClient.clientId,
        client_state: resolvedClient.clientState,
        challan_number: header.dc_number ?? null,
        po_no: header.po_no ?? null,
        remarks: header.remarks ?? null,
      },
      items: (items ?? []).map((item) => ({
        id: item.id,
        product_id: item.material_id ?? null,
        description: item.material_name ?? 'Delivery challan item',
        hsn_code: hsnById.get(item.material_id) ?? null,
        qty: Number(item.quantity ?? 0),
        rate: Number(item.rate ?? 0),
        amount: Number(item.amount ?? roundCurrency(Number(item.quantity ?? 0) * Number(item.rate ?? 0))),
        tax_percent: 18,
      })),
    };

    return source;
  }

  const { data: header, error: headerError } = await supabase
    .from('client_purchase_orders')
    .select('id, client_id, po_number, po_total_value, remarks')
    .eq('id', sourceId)
    .single();
  if (headerError) throw headerError;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('state')
    .eq('id', header.client_id)
    .maybeSingle();
  if (clientError) throw clientError;

  const source: PurchaseOrderInvoiceSource = {
    type: 'po',
    header: {
      id: header.id,
      client_id: header.client_id,
      client_state: client?.state ?? null,
      po_number: header.po_number,
      po_total_value: Number(header.po_total_value ?? 0),
      remarks: header.remarks ?? null,
    },
    materials: [],
  };

  return source;
}

export async function mapInvoiceSourceToDraft(
  sourceType: InvoiceSourceType,
  sourceId: string,
  options: InvoiceSourceMapOptions = {},
): Promise<Invoice> {
  const source = await loadInvoiceSource(sourceType, sourceId);
  return mapSourceToInvoice(source, options);
}
