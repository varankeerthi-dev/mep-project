import { supabase } from '../supabase';
import {
  ConversionType,
  type ConversionPayload,
  type QuotationSourceData,
  type DCSourceData,
  type ProformaSourceData,
  type ConvertedInvoiceData,
  type ConvertedProformaData,
  type ConvertedQuotationData,
  type ConvertedDCData,
  type ConvertedInvoiceItem,
  type ConvertedProformaItem,
  type ConvertedQuotationItem,
  type ConvertedDCItem,
  type ConversionResult,
} from './types';

// Fetch source document based on conversion type
export async function fetchSourceDocument(
  type: ConversionType,
  sourceId: string,
  organisationId: string
): Promise<QuotationSourceData | DCSourceData | ProformaSourceData> {
  if (type === 'quotation-to-proforma' || type === 'quotation-to-invoice' || type === 'quotation-to-dc') {
    const { data, error } = await supabase
      .from('quotation_header')
      .select(`
        id,
        quotation_no,
        client_id,
        state,
        project_id,
        billing_address,
        gstin,
        date,
        valid_till,
        payment_terms,
        reference,
        remarks,
        subtotal,
        grand_total,
        items:quotation_items(
          id,
          item_id,
          variant_id,
          description,
          hsn_code,
          qty,
          uom,
          rate,
          base_rate_snapshot,
          final_rate_snapshot,
          original_discount_percent,
          discount_percent,
          discount_amount,
          tax_percent,
          tax_amount,
          line_total,
          make
        )
      `)
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Quotation not found');

    const mappedItems = (data.items || []).map((item: any) => {
      // Use base_rate_snapshot as original rate if available, otherwise use rate
      const originalRate = Number(item.base_rate_snapshot || item.rate || 0);
      // Use final_rate_snapshot if available, otherwise use rate
      const finalRate = Number(item.final_rate_snapshot || item.rate || 0);
      // Calculate discount percent from the difference
      const discountPercent = originalRate > 0 ? ((originalRate - finalRate) / originalRate) * 100 : 0;

      return {
        id: item.id,
        item_id: item.item_id,
        variant_id: item.variant_id,
        description: item.description,
        hsn_code: item.hsn_code,
        qty: Number(item.qty),
        uom: item.uom,
        rate: originalRate, // Original rate (before discount)
        original_discount_percent: Number(item.original_discount_percent || 0),
        discount_percent: Number(discountPercent),
        discount_amount: Number(item.discount_amount || 0),
        tax_percent: Number(item.tax_percent || 18),
        tax_amount: Number(item.tax_amount || 0),
        line_total: Number(item.line_total),
        make: item.make,
      };
    });

    return {
      id: data.id,
      quotation_no: data.quotation_no,
      client_id: data.client_id,
      client_state: data.state,
      project_id: data.project_id,
      billing_address: data.billing_address,
      gstin: data.gstin,
      state: data.state,
      date: data.date,
      valid_till: data.valid_till,
      payment_terms: data.payment_terms,
      reference: data.reference,
      remarks: data.remarks,
      subtotal: data.subtotal || 0,
      total_tax: 0,
      grand_total: data.grand_total || 0,
      items: mappedItems,
    };
  }

  if (type === 'dc-to-quotation' || type === 'dc-to-proforma') {
    const { data, error } = await supabase
      .from('delivery_challans')
      .select(`
        id,
        dc_number,
        client_name,
        project_id,
        remarks,
        dc_date,
        items:delivery_challan_items(
          id,
          material_id,
          material_name,
          quantity,
          rate,
          amount
        )
      `)
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Delivery Challan not found');

    return {
      id: data.id,
      dc_number: data.dc_number,
      client_name: data.client_name,
      client_id: null,
      project_id: data.project_id,
      ship_to_state: '',
      po_no: '',
      remarks: data.remarks,
      dc_date: data.dc_date,
      items: (data.items || []).map((item: any) => ({
        id: item.id,
        material_id: item.material_id,
        material_name: item.material_name,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        amount: Number(item.amount),
      })),
    };
  }

  if (type === 'proforma-to-invoice') {
    const { data, error } = await supabase
      .from('proforma_invoices')
      .select(`
        id,
        pi_number,
        client_id,
        client_state,
        company_state,
        subtotal,
        cgst,
        sgst,
        igst,
        total,
        po_number,
        po_date,
        valid_until,
        notes,
        terms,
        items:proforma_items(
          id,
          description,
          hsn_code,
          qty,
          rate,
          amount,
          tax_percent,
          discount_percent,
          discount_amount
        )
      `)
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Proforma Invoice not found');

    return {
      id: data.id,
      pi_number: data.pi_number,
      client_id: data.client_id,
      client_state: data.client_state,
      company_state: data.company_state,
      subtotal: data.subtotal || 0,
      cgst: data.cgst || 0,
      sgst: data.sgst || 0,
      igst: data.igst || 0,
      total: data.total || 0,
      po_number: data.po_number,
      po_date: data.po_date,
      valid_until: data.valid_until,
      notes: data.notes,
      terms: data.terms,
      payment_terms: '',
      items: (data.items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        hsn_code: item.hsn_code,
        qty: Number(item.qty),
        rate: Number(item.rate),
        amount: Number(item.amount),
        tax_percent: Number(item.tax_percent),
        discount_percent: Number(item.discount_percent),
        discount_amount: Number(item.discount_amount),
      })),
    };
  }

  throw new Error(`Unsupported conversion type: ${type}`);
}

// Transform Quotation to Proforma Invoice
export function transformQuotationToProforma(
  source: QuotationSourceData
): ConversionResult {
  const items: ConvertedProformaItem[] = source.items.map((item) => {
    // Use the original rate from quotation
    const originalRate = item.rate;
    const discountPercent = item.discount_percent || 0;
    // Calculate rate after discount
    const rateAfterDiscount = originalRate - (originalRate * discountPercent / 100);
    // Amount should be qty × rate after discount
    const amount = item.qty * rateAfterDiscount;

    return {
      description: item.description,
      hsn_code: item.hsn_code,
      qty: item.qty,
      rate: originalRate, // Original rate (before discount)
      amount: amount,
      tax_percent: item.tax_percent,
      discount_percent: discountPercent,
      discount_amount: 0,
      item_id: item.item_id,
      variant_id: item.variant_id,
      make: item.make,
      variant: null, // quotation_items doesn't have variant column
      unit: item.uom, // quotation_items uses uom
      meta_json: {
        tax_percent: item.tax_percent,
        uom: item.uom,
        base_rate: originalRate,
        rate_after_discount: rateAfterDiscount,
        source_item_id: item.id,
      },
    };
  });

  const data: ConvertedProformaData = {
    client_id: source.client_id,
    source_type: 'quotation',
    source_id: source.id,
    pi_number: null, // Will be auto-generated
    company_state: null, // Will be fetched from organisation
    client_state: source.client_state,
    valid_until: source.valid_till,
    po_number: null,
    po_date: null,
    notes: source.remarks,
    terms: null,
    payment_terms: source.payment_terms,
    items,
  };

  return {
    data,
    sourceType: 'Quotation',
    sourceNumber: source.quotation_no,
    conversionType: 'quotation-to-proforma',
    targetDocumentType: 'proforma',
  };
}

// Transform Quotation to Invoice
export function transformQuotationToInvoice(
  source: QuotationSourceData
): ConversionResult {
  const items: ConvertedInvoiceItem[] = source.items.map((item) => ({
    description: item.description,
    hsn_code: item.hsn_code,
    qty: item.qty,
    rate: item.rate,
    amount: item.line_total,
    tax_percent: item.tax_percent,
    meta_json: {
      source_item_id: item.id,
      item_id: item.item_id,
    },
  }));

  const data: ConvertedInvoiceData = {
    client_id: source.client_id,
    source_type: 'quotation',
    source_id: source.id,
    template_type: 'standard',
    mode: 'itemized',
    invoice_no: null, // Will be auto-generated
    invoice_date: new Date().toISOString().split('T')[0],
    po_number: source.reference,
    po_date: null,
    company_state: null, // Will be fetched from organisation
    client_state: source.client_state,
    items,
  };

  return {
    data,
    sourceType: 'Quotation',
    sourceNumber: source.quotation_no,
    conversionType: 'quotation-to-invoice',
    targetDocumentType: 'invoice',
  };
}

// Transform Quotation to Delivery Challan
export function transformQuotationToDC(
  source: QuotationSourceData
): ConversionResult {
  const items: ConvertedDCItem[] = source.items.map((item) => ({
    material_id: item.item_id,
    material_name: item.description,
    quantity: item.qty,
    rate: item.rate,
    amount: item.line_total,
  }));

  const data: ConvertedDCData = {
    client_id: source.client_id,
    project_id: source.project_id,
    dc_number: null, // Will be auto-generated
    dc_date: new Date().toISOString().split('T')[0],
    ship_to_address: source.billing_address,
    ship_to_state: source.state,
    po_number: source.reference,
    remarks: source.remarks,
    items,
  };

  return {
    data,
    sourceType: 'Quotation',
    sourceNumber: source.quotation_no,
    conversionType: 'quotation-to-dc',
    targetDocumentType: 'dc',
  };
}

// Transform DC to Quotation
export function transformDCToQuotation(source: DCSourceData): ConversionResult {
  const items: ConvertedQuotationItem[] = source.items.map((item) => ({
    item_id: item.material_id,
    description: item.material_name,
    qty: item.quantity,
    rate: item.rate,
    tax_percent: 18, // Default tax
    uom: 'nos',
  }));

  const data: ConvertedQuotationData = {
    client_id: source.client_id || '', // Will need to resolve client_id from client_name
    project_id: source.project_id,
    billing_address: null,
    gstin: null,
    state: source.ship_to_state,
    date: source.dc_date,
    valid_till: null,
    payment_terms: null,
    reference: source.dc_number,
    remarks: source.remarks,
    items,
  };

  return {
    data,
    sourceType: 'Delivery Challan',
    sourceNumber: source.dc_number,
    conversionType: 'dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}

// Transform DC to Proforma Invoice
export function transformDCToProforma(source: DCSourceData): ConversionResult {
  const items: ConvertedProformaItem[] = source.items.map((item) => ({
    description: item.material_name,
    hsn_code: null,
    qty: item.quantity,
    rate: item.rate,
    amount: item.amount,
    tax_percent: 18,
    discount_percent: 0,
    discount_amount: 0,
  }));

  const data: ConvertedProformaData = {
    client_id: source.client_id || '', // Will need to resolve client_id from client_name
    source_type: 'challan',
    source_id: source.id,
    pi_number: null,
    company_state: null,
    client_state: source.ship_to_state,
    valid_until: null,
    po_number: source.po_no,
    po_date: null,
    notes: source.remarks,
    terms: null,
    payment_terms: null,
    items,
  };

  return {
    data,
    sourceType: 'Delivery Challan',
    sourceNumber: source.dc_number,
    conversionType: 'dc-to-proforma',
    targetDocumentType: 'proforma',
  };
}

// Transform Proforma to Invoice
export function transformProformaToInvoice(
  source: ProformaSourceData
): ConversionResult {
  const items: ConvertedInvoiceItem[] = source.items.map((item) => ({
    description: item.description,
    hsn_code: item.hsn_code,
    qty: item.qty,
    rate: item.rate,
    amount: item.amount,
    tax_percent: item.tax_percent,
    meta_json: {
      source_item_id: item.id,
    },
  }));

  const data: ConvertedInvoiceData = {
    client_id: source.client_id,
    source_type: 'quotation', // Proforma uses quotation source type in invoice
    source_id: source.id,
    template_type: 'standard',
    mode: 'itemized',
    invoice_no: null, // Will be auto-generated
    invoice_date: new Date().toISOString().split('T')[0],
    po_number: source.po_number,
    po_date: source.po_date,
    company_state: source.company_state,
    client_state: source.client_state,
    items,
  };

  return {
    data,
    sourceType: 'Proforma Invoice',
    sourceNumber: source.pi_number || 'PI',
    conversionType: 'proforma-to-invoice',
    targetDocumentType: 'invoice',
  };
}

// Main transform function that routes to specific transformer
export function transformSourceToTarget(
  type: ConversionType,
  sourceData: QuotationSourceData | DCSourceData | ProformaSourceData
): ConversionResult {
  switch (type) {
    case 'quotation-to-proforma':
      return transformQuotationToProforma(sourceData as QuotationSourceData);
    case 'quotation-to-invoice':
      return transformQuotationToInvoice(sourceData as QuotationSourceData);
    case 'quotation-to-dc':
      return transformQuotationToDC(sourceData as QuotationSourceData);
    case 'dc-to-quotation':
      return transformDCToQuotation(sourceData as DCSourceData);
    case 'dc-to-proforma':
      return transformDCToProforma(sourceData as DCSourceData);
    case 'proforma-to-invoice':
      return transformProformaToInvoice(sourceData as ProformaSourceData);
    default:
      throw new Error(`Unknown conversion type: ${type}`);
  }
}

// Helper to resolve client_id from client_name (for DC conversions)
export async function resolveClientIdFromName(
  clientName: string,
  organisationId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('name', clientName)
    .eq('organisation_id', organisationId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Client "${clientName}" not found`);
  }

  return data.id;
}

// Get status to set on source document after conversion
export function getSourceStatusAfterConversion(conversionType: ConversionType): string {
  const statusMap: Record<ConversionType, string> = {
    'quotation-to-proforma': 'Converted to Proforma',
    'quotation-to-invoice': 'Converted to Sales',
    'quotation-to-dc': 'Converted to Delivery',
    'dc-to-quotation': 'Converted to Quotation',
    'dc-to-proforma': 'Converted to Proforma',
    'proforma-to-invoice': 'Converted to Invoice',
  };

  return statusMap[conversionType];
}

// Get source table name for status update
export function getSourceTableName(conversionType: ConversionType): string {
  if (conversionType.startsWith('quotation-')) return 'quotation_header';
  if (conversionType.startsWith('dc-')) return 'delivery_challans';
  if (conversionType === 'proforma-to-invoice') return 'proforma_invoices';
  throw new Error(`Unknown conversion type: ${conversionType}`);
}
