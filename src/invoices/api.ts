import { supabase } from '../supabase';
import { calculateTotals, mapSourceToInvoice, roundCurrency } from './logic';
import {
  InvoiceItemSchema,
  InvoiceMaterialSchema,
  InvoiceSchema,
  type Invoice,
  type InvoiceInput,
} from './schemas';
import { deductInvoiceStock, reverseInvoiceStockDeductions } from './stock-deduction/api';
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

const INVOICE_FIELDS = [
  'invoice_no',
  'invoice_date',
  'po_number',
  'po_date',
  'source_type',
  'source_id',
];

const INVOICE_SELECT = `
  id,
  client_id,
  invoice_no,
  invoice_date,
  po_number,
  po_date,
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
  paid_amount,
  status,
  created_at,
  client:clients(id, client_name, gstin, state, default_template_id, email),
  items:invoice_items(id, invoice_id, description, hsn_code, qty, rate, amount, meta_json),
  materials:invoice_materials(id, invoice_id, product_id, qty_used)
`;

function parseClientSummary(client: any): InvoiceClientSummary | null {
  if (!client) return null;

  return {
    id: String(client.id),
    name: client.client_name ?? null,
    gst_number: client.gstin ?? null,
    state: client.state ?? null,
    default_template_id: client.default_template_id ?? null,
    email: client.email ?? null,
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
    invoice_no: invoice.invoice_no ?? null,
    invoice_date: invoice.invoice_date ?? null,
    po_number: invoice.po_number ?? null,
    po_date: invoice.po_date ?? null,
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
    invoice_no: row.invoice_no ?? null,
    invoice_date: row.invoice_date ?? null,
    po_number: row.po_number ?? null,
    po_date: row.po_date ?? null,
    template_id: row.template_id ?? null,
    source_type: row.source_type,
    source_id: row.source_id ?? null,
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

export async function createInvoice(input: InvoiceInput & { organisation_id: string }): Promise<InvoiceWithRelations> {
  const parsed = InvoiceSchema.parse(input);
  const organisationId = input.organisation_id;
  const clientState = await ensureClientState(parsed.client_id, parsed.client_state);
  const validated = InvoiceSchema.parse({
    ...parsed,
    client_state: clientState,
  });
  const { invoiceRow, itemRows, materialRows } = buildInvoicePayload(validated);

  let invoiceId: string | null = null;

  try {
    const { data: inserted, error } = await supabase.from('invoices').insert({ ...invoiceRow, organisation_id: organisationId }).select('id').single();
    if (error) throw error;
    invoiceId = inserted.id;
    const insertedInvoiceId = inserted.id as string;

    if (itemRows.length > 0) {
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert(itemRows.map((item) => ({ ...item, invoice_id: insertedInvoiceId, organisation_id: organisationId })));
      if (itemError) throw itemError;
    }

    if (materialRows.length > 0) {
      const { error: materialError } = await supabase
        .from('invoice_materials')
        .insert(materialRows.map((material) => ({ ...material, invoice_id: insertedInvoiceId, organisation_id: organisationId })));
      if (materialError) throw materialError;
    }

    // Update PO utilized value if invoice is created from PO
    if (validated.source_type === 'po' && validated.source_id) {
      const invoiceTotal = validated.total || 0;
      try {
        const { error: poError } = await supabase.rpc('update_po_utilized_value', {
          p_po_id: validated.source_id,
          p_invoice_amount: invoiceTotal
        });
        if (poError) {
          console.warn('Failed to update PO utilized value:', poError);
        }
      } catch (err) {
        console.warn('PO update RPC call failed:', err);
      }
    }

    // Handle stock deduction if enabled.
    // IMPORTANT: Delivery Challan already deducts stock at dispatch time,
    // so invoices created from challans must never deduct again.
    if (validated.source_type !== 'challan' && validated.deduct_stock_on_finalize && validated.mode) {
      try {
        const deductionResults = await deductInvoiceStock(
          insertedInvoiceId,
          organisationId,
          validated.mode,
          validated.allow_insufficient_stock || false
        );
        
        // Check for insufficient stock errors
        const insufficientItems = deductionResults.filter(r => r.status === 'INSUFFICIENT');
        if (insufficientItems.length > 0) {
          console.warn('Insufficient stock for items:', insufficientItems);
          // Note: We don't fail the invoice creation, just log the warning
        }
      } catch (err) {
        console.error('Stock deduction failed:', err);
        // Note: We don't fail the invoice creation, just log the error
      }
    }

    return getInvoiceById(insertedInvoiceId, organisationId);
  } catch (error) {
    if (invoiceId) {
      await supabase.from('invoices').delete().eq('id', invoiceId);
    }
    throw error;
  }
}

export async function updateInvoice(id: string, input: InvoiceInput & { organisation_id: string }): Promise<InvoiceWithRelations> {
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
      .insert(itemRows.map((item) => ({ ...item, invoice_id: id, organisation_id: input.organisation_id })));
    if (itemError) throw itemError;
  }

  if (materialRows.length > 0) {
    const { error: materialError } = await supabase
      .from('invoice_materials')
      .insert(materialRows.map((material) => ({ ...material, invoice_id: id, organisation_id: input.organisation_id })));
    if (materialError) throw materialError;
  }

  // Handle stock deduction if enabled.
  // IMPORTANT: Delivery Challan already deducts stock at dispatch time,
  // so invoices created from challans must never deduct again.
  if (validated.source_type !== 'challan' && validated.deduct_stock_on_finalize && validated.mode) {
    try {
      const deductionResults = await deductInvoiceStock(
        id,
        input.organisation_id,
        validated.mode,
        validated.allow_insufficient_stock || false
      );
      
      // Check for insufficient stock errors
      const insufficientItems = deductionResults.filter(r => r.status === 'INSUFFICIENT');
      if (insufficientItems.length > 0) {
        console.warn('Insufficient stock for items:', insufficientItems);
        // Note: We don't fail the update, just log the warning
      }
    } catch (err) {
      console.error('Stock deduction failed:', err);
      // Note: We don't fail the update, just log the error
    }
  }

  return getInvoiceById(id, input.organisation_id);
}

export async function deleteInvoice(id: string, organisationId: string): Promise<void> {
  // Reverse stock deductions before deleting invoice
  try {
    await reverseInvoiceStockDeductions(id);
  } catch (err) {
    console.error('Failed to reverse stock deductions:', err);
    // Continue with deletion even if reversal fails
  }

  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('organisation_id', organisationId);
  if (error) throw error;
}

export async function getInvoiceById(id: string, organisationId?: string): Promise<InvoiceWithRelations> {
  let query = supabase.from('invoices').select(INVOICE_SELECT).eq('id', id);
  if (organisationId) {
    query = query.eq('organisation_id', organisationId);
  }
  const { data, error } = await query.single();

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

export async function getInvoiceTemplates(organisationId?: string): Promise<InvoiceTemplateRecord[]> {
  let query = supabase
    .from('invoice_templates')
    .select('id, name, layout_json, created_at');
    
  if (organisationId) {
    query = query.eq('organisation_id', organisationId);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

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

async function resolveClientFromChallan(clientName: string, organisationId: string, fallbackState?: string | null): Promise<{
  clientId: string;
  clientState: string | null;
}> {
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, state')
    .eq('name', clientName)
    .eq('organisation_id', organisationId)
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
  organisationId: string,
): Promise<Map<string, string | null>> {
  const ids = Array.from(
    new Set(
      lines
        .map((line) => line.product_id ?? line.item_id ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('materials')
    .select('id, hsn_code')
    .eq('organisation_id', organisationId)
    .in('id', ids);
  if (error) throw error;

  return new Map((data ?? []).map((item) => [item.id, item.hsn_code ?? null]));
}

interface MaterialMatch {
  id: string;
  hsn_code: string | null;
  name: string;
  display_name: string;
  sale_price: number | null;
  unit: string | null;
}

async function matchMaterialByDescriptionOrHsn(
  description: string,
  hsnCode: string | null,
  organisationId: string,
): Promise<MaterialMatch | null> {
  if (!description && !hsnCode) return null;

  // Try exact match by HSN first
  if (hsnCode) {
    const { data, error } = await supabase
      .from('materials')
      .select('id, hsn_code, name, display_name, sale_price, unit')
      .eq('organisation_id', organisationId)
      .eq('hsn_code', hsnCode)
      .limit(1)
      .maybeSingle();
    
    if (!error && data) {
      return data as MaterialMatch;
    }
  }

  // Try fuzzy match by description/name
  if (description) {
    const searchTerm = description.toLowerCase().trim();
    const { data, error } = await supabase
      .from('materials')
      .select('id, hsn_code, name, display_name, sale_price, unit')
      .eq('organisation_id', organisationId)
      .or(`name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
      .limit(5)
      .maybeSingle();
    
    if (!error && data) {
      return data as MaterialMatch;
    }
  }

  return null;
}

export async function loadInvoiceSource(sourceType: InvoiceSourceType, sourceId: string, organisationId: string): Promise<InvoiceSourceDocument> {
  if (sourceType === 'quotation') {
    const { data: header, error: headerError } = await supabase
      .from('quotation_header')
      .select('id, client_id, state, reference')
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();
    if (headerError) throw headerError;

    const { data: items, error: itemError } = await supabase
      .from('quotation_items')
      .select('id, item_id, description, qty, rate, line_total, tax_percent')
      .eq('quotation_id', sourceId);
    if (itemError) throw itemError;

    const hsnById = await enrichHsnCodes(items ?? [], organisationId);

    // Match each quotation item to inventory materials
    const matchedItems = await Promise.all(
      (items ?? []).map(async (item) => {
        const matchedMaterial = await matchMaterialByDescriptionOrHsn(
          item.description ?? '',
          hsnById.get(item.item_id) ?? null,
          organisationId
        );

        return {
          id: item.id,
          item_id: matchedMaterial?.id ?? item.item_id ?? null,
          product_id: matchedMaterial?.id ?? null,
          description: item.description ?? 'Quotation item',
          hsn_code: matchedMaterial?.hsn_code ?? hsnById.get(item.item_id) ?? null,
          qty: Number(item.qty ?? 0),
          rate: matchedMaterial?.sale_price ?? Number(item.rate ?? 0),
          amount: Number(item.line_total ?? roundCurrency(Number(item.qty ?? 0) * Number(item.rate ?? 0))),
          tax_percent: Number(item.tax_percent ?? 18),
          meta_json: matchedMaterial ? {
            material_id: matchedMaterial.id,
            base_rate: matchedMaterial.sale_price,
            unit: matchedMaterial.unit,
            matched_from_quotation: true,
          } : undefined,
        };
      })
    );

    const source: QuotationInvoiceSource = {
      type: 'quotation',
      header: {
        id: header.id,
        client_id: header.client_id,
        client_state: header.state ?? null,
        reference: header.reference ?? null,
      },
      items: matchedItems,
    };

    return source;
  }

  if (sourceType === 'challan') {
    const { data: header, error: headerError } = await supabase
      .from('delivery_challans')
      .select('id, client_name, dc_number, ship_to_state, po_no, remarks')
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();
    if (headerError) throw headerError;
    if (!header.client_name) {
      throw new Error('Delivery challan is missing client_name and cannot be invoiced.');
    }

    const resolvedClient = await resolveClientFromChallan(header.client_name, organisationId, header.ship_to_state ?? null);

    const { data: items, error: itemError } = await supabase
      .from('delivery_challan_items')
      .select('id, material_id, material_name, quantity, rate, amount')
      .eq('delivery_challan_id', sourceId);
    if (itemError) throw itemError;

    const hsnById = await enrichHsnCodes((items ?? []).map((item) => ({ product_id: item.material_id ?? null })), organisationId);

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
    .eq('organisation_id', organisationId)
    .single();
  if (headerError) throw headerError;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('state')
    .eq('id', header.client_id)
    .maybeSingle();
  if (clientError) throw clientError;

  // Load PO line items
  const { data: lineItems, error: lineItemsError } = await supabase
    .from('po_line_items')
    .select('*')
    .eq('po_id', sourceId)
    .order('line_order', { ascending: true });

  if (lineItemsError) throw lineItemsError;

  // Match each PO line item to inventory materials
  const matchedLineItems = await Promise.all(
    (lineItems ?? []).map(async (item) => {
      const matchedMaterial = await matchMaterialByDescriptionOrHsn(
        item.description ?? '',
        item.hsn_sac_code ?? null,
        organisationId
      );

      return {
        id: item.id,
        item_id: matchedMaterial?.id ?? null,
        product_id: matchedMaterial?.id ?? null,
        description: item.description ?? 'PO item',
        hsn_code: matchedMaterial?.hsn_code ?? item.hsn_sac_code ?? null,
        qty: Number(item.quantity ?? 0),
        rate: matchedMaterial?.sale_price ?? Number(item.rate ?? 0),
        amount: Number(item.amount ?? roundCurrency(Number(item.quantity ?? 0) * Number(item.rate ?? 0))),
        tax_percent: Number(item.gst_percentage ?? 18),
        meta_json: {
          tax_percent: Number(item.gst_percentage ?? 18),
          uom: matchedMaterial?.unit ?? (item.unit || 'Nos'),
          item_code: item.item_code || null,
          ...(matchedMaterial ? {
            material_id: matchedMaterial.id,
            base_rate: matchedMaterial.sale_price,
            matched_from_po: true,
          } : {}),
        },
      };
    })
  );

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
    items: matchedLineItems,
    materials: [], // PO items are treated as line items, not materials
  };

  return source;
}

export async function mapInvoiceSourceToDraft(
  sourceType: InvoiceSourceType,
  sourceId: string,
  organisationId: string,
  options: InvoiceSourceMapOptions = {},
): Promise<Invoice> {
  const source = await loadInvoiceSource(sourceType, sourceId, organisationId);
  return mapSourceToInvoice(source, options);
}

export interface InvoiceSeriesConfig {
  prefix: string;
  suffix: string;
  startNumber: number;
  padding: number;
}

function getFyPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month < 3) return `${year - 1}-${String(year).slice(-2)}`;
  return `${year}-${String(year + 1).slice(-2)}`;
}

export async function getInvoiceNumberPreview(organisationId: string): Promise<string> {
  const fallbackNo = `INV-${Date.now().toString().slice(-6)}`;
  
  if (!organisationId) return fallbackNo;
  
  try {
    let defaultSeries = null;
    
    const { data: byOrgDefault } = await supabase
      .from('document_series')
      .select('id, configs, current_number, created_at')
      .eq('is_default', true)
      .eq('organisation_id', organisationId)
      .limit(1)
      .maybeSingle();
    
    if (byOrgDefault) {
      defaultSeries = byOrgDefault;
    } else {
      const { data: byOrgLatest } = await supabase
        .from('document_series')
        .select('id, configs, current_number, created_at')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (byOrgLatest) defaultSeries = byOrgLatest;
    }

    if (!defaultSeries) return fallbackNo;

    const cfg = defaultSeries?.configs?.invoice;
    if (!cfg || !cfg.enabled) return fallbackNo;

    const rawPrefix = cfg.prefix || 'INV-';
    const suffix = cfg.suffix || '';
    const number = parseInt(cfg.start_number || defaultSeries.current_number || 1, 10);
    const padded = String(number).padStart(parseInt(cfg.padding || 4, 10), '0');
    const fy = getFyPrefix();
    const prefix = String(rawPrefix).replace('{FY}', fy);
    
    return `${prefix}${padded}${suffix}`;
  } catch (err) {
    console.warn('Unable to load invoice series:', err);
    return fallbackNo;
  }
}

export async function incrementInvoiceNumber(seriesId: string, organisationId: string): Promise<void> {
  try {
    const { data: series } = await supabase
      .from('document_series')
      .select('configs, current_number')
      .eq('id', seriesId)
      .single();
    
    if (!series) return;
    
    const cfg = series.configs?.invoice || {};
    const nextNumber = parseInt(cfg.start_number || series.current_number || 1, 10) + 1;
    const updatedCfg = { ...series.configs, invoice: { ...cfg, start_number: nextNumber } };
    
    await supabase
      .from('document_series')
      .update({ current_number: nextNumber, configs: updatedCfg })
      .eq('id', seriesId);
  } catch (err) {
    console.warn('Failed to increment invoice number:', err);
  }
}

export async function findInvoiceSeries(organisationId: string): Promise<{ id: string; config: InvoiceSeriesConfig } | null> {
  if (!organisationId) return null;
  
  try {
    let defaultSeries = null;
    
    const { data: byOrgDefault } = await supabase
      .from('document_series')
      .select('id, configs, current_number')
      .eq('is_default', true)
      .eq('organisation_id', organisationId)
      .limit(1)
      .maybeSingle();
    
    if (byOrgDefault) {
      defaultSeries = byOrgDefault;
    } else {
      const { data: byOrgLatest } = await supabase
        .from('document_series')
        .select('id, configs, current_number')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (byOrgLatest) defaultSeries = byOrgLatest;
    }

    if (!defaultSeries) return null;

    const cfg = defaultSeries.configs?.invoice;
    if (!cfg || !cfg.enabled) return null;

    return {
      id: defaultSeries.id,
      config: {
        prefix: cfg.prefix || 'INV-',
        suffix: cfg.suffix || '',
        startNumber: parseInt(cfg.start_number || defaultSeries.current_number || 1, 10),
        padding: parseInt(cfg.padding || 4, 10),
      },
    };
  } catch (err) {
    console.warn('Unable to find invoice series:', err);
    return null;
  }
}

export async function generateInvoiceNumber(organisationId: string): Promise<{ invoiceNo: string; seriesId: string | null }> {
  const series = await findInvoiceSeries(organisationId);
  
  if (!series) {
    return {
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      seriesId: null,
    };
  }

  const { prefix, suffix, startNumber, padding } = series.config;
  const fy = getFyPrefix();
  const paddedNumber = String(startNumber).padStart(padding, '0');
  const invoiceNo = `${prefix.replace('{FY}', fy)}${paddedNumber}${suffix}`;

  return {
    invoiceNo,
    seriesId: series.id,
  };
}

export async function loadClientPOs(clientId: string, organisationId: string): Promise<Array<{ id: string; po_number: string; po_date: string | null }>> {
  if (!clientId) return [];
  
  const { data, error } = await supabase
    .from('client_purchase_orders')
    .select('id, po_number, po_date')
    .eq('client_id', clientId)
    .eq('organisation_id', organisationId)
    .order('po_date', { ascending: false })
    .limit(50);
  
  if (error) {
    console.warn('Failed to load client POs:', error);
    return [];
  }
  
  return (data || []).map(row => ({
    id: row.id,
    po_number: row.po_number,
    po_date: row.po_date,
  }));
}
