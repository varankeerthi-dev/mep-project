import { supabase } from '../supabase';
import {
  ConversionType,
  type ConversionPayload,
  type QuotationSourceData,
  type DCSourceData,
  type ProformaSourceData,
  type InvoiceSourceData,
  type POSourceData,
  type PurchaseOrderSourceData,
  type ConvertedInvoiceData,
  type ConvertedProformaData,
  type ConvertedQuotationData,
  type ConvertedDCData,
  type ConvertedInvoiceItem,
  type ConvertedProformaItem,
  type ConvertedQuotationItem,
  type ConvertedDCItem,
  type ConversionResult,
  type MultiDCQuotationMode,
  type DCAllocation,
} from './types';

// Fetch source document based on conversion type
export async function fetchSourceDocument(
  type: ConversionType,
  sourceId: string,
  organisationId: string
): Promise<QuotationSourceData | DCSourceData | ProformaSourceData | InvoiceSourceData | POSourceData | PurchaseOrderSourceData> {
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

  if (type === 'dc-to-quotation' || type === 'dc-to-proforma' || type === 'dc-to-invoice') {
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

  if (type === 'invoice-to-creditnote' || type === 'invoice-to-challan') {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, client_name, name, state, gstin),
        items:invoice_items(
          id,
          description,
          hsn_code,
          qty,
          rate,
          amount,
          tax_percent,
          discount_percent,
          cgst_percent,
          sgst_percent,
          igst_percent,
          cgst_amount,
          sgst_amount,
          igst_amount,
          meta_json
        )
      `)
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Invoice not found');

    return {
      id: data.id,
      invoice_no: data.invoice_no || data.invoice_number || '',
      client_id: data.client_id,
      client_name: data.client?.client_name || data.client?.name || null,
      client_state: data.client?.state || null,
      company_state: data.company_state || null,
      gstin: data.client?.gstin || null,
      billing_address: data.billing_address || null,
      subtotal: Number(data.subtotal || 0),
      cgst: Number(data.cgst || 0),
      sgst: Number(data.sgst || 0),
      igst: Number(data.igst || 0),
      total: Number(data.total || 0),
      po_number: data.po_number || null,
      po_date: data.po_date || null,
      remarks: data.remarks || null,
      items: (data.items || []).map((item: any) => ({
        id: item.id,
        description: item.description || item.item?.display_name || item.item?.name || '',
        hsn_code: item.hsn_code || item.item?.hsn_code || null,
        qty: Number(item.qty || item.quantity || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || item.line_total || 0),
        tax_percent: Number(item.tax_percent || 0),
        discount_percent: item.discount_percent != null ? Number(item.discount_percent) : null,
        cgst_percent: item.cgst_percent != null ? Number(item.cgst_percent) : null,
        sgst_percent: item.sgst_percent != null ? Number(item.sgst_percent) : null,
        igst_percent: item.igst_percent != null ? Number(item.igst_percent) : null,
        cgst_amount: item.cgst_amount != null ? Number(item.cgst_amount) : null,
        sgst_amount: item.sgst_amount != null ? Number(item.sgst_amount) : null,
        igst_amount: item.igst_amount != null ? Number(item.igst_amount) : null,
        meta_json: item.meta_json || null,
      })),
    };
  }

  if (type === 'client-po-to-invoice') {
    const { data: header, error: headerError } = await supabase
      .from('client_purchase_orders')
      .select(`
        id,
        po_number,
        client_id,
        po_date,
        po_total_value,
        remarks,
        client:clients(state)
      `)
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();

    if (headerError) throw headerError;
    if (!header) throw new Error('Client PO not found');

    const { data: items, error: itemsError } = await supabase
      .from('po_line_items')
      .select(`
        id,
        description,
        hsn_sac_code,
        quantity,
        rate,
        amount,
        gst_percentage,
        unit,
        item_code
      `)
      .eq('po_id', sourceId)
      .order('line_order', { ascending: true });

    if (itemsError) throw itemsError;

    return {
      id: header.id,
      po_number: header.po_number,
      client_id: header.client_id,
      po_date: header.po_date,
      po_total_value: Number(header.po_total_value || 0),
      remarks: header.remarks,
      client_state: header.client?.state || null,
      items: (items || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        hsn_sac_code: item.hsn_sac_code || null,
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        gst_percentage: Number(item.gst_percentage || 18),
        unit: item.unit || null,
        item_code: item.item_code || null,
      })),
    };
  }

  if (type === 'purchase-po-to-bill') {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        vendor_id,
        po_date,
        currency,
        exchange_rate,
        subtotal,
        discount_amount,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        igst_amount,
        total_amount,
        vendor:purchase_vendors(company_name),
        items:purchase_order_items(
          id,
          item_name,
          description,
          hsn_code,
          quantity,
          unit,
          rate,
          discount_percent,
          discount_amount,
          taxable_value,
          cgst_percent,
          cgst_amount,
          sgst_percent,
          sgst_amount,
          igst_percent,
          igst_amount,
          total_amount
        )
      `)
      .eq('id', sourceId)
      .eq('organisation_id', organisationId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Purchase Order not found');

    return {
      id: data.id,
      po_number: data.po_number,
      vendor_id: data.vendor_id,
      po_date: data.po_date,
      currency: data.currency || 'INR',
      exchange_rate: data.exchange_rate || 1,
      subtotal: Number(data.subtotal || 0),
      discount_amount: Number(data.discount_amount || 0),
      taxable_amount: Number(data.taxable_amount || 0),
      cgst_amount: Number(data.cgst_amount || 0),
      sgst_amount: Number(data.sgst_amount || 0),
      igst_amount: Number(data.igst_amount || 0),
      total_amount: Number(data.total_amount || 0),
      vendor: data.vendor,
      items: (data.items || []).map((item: any) => ({
        id: item.id,
        item_name: item.item_name,
        description: item.description || null,
        hsn_code: item.hsn_code || null,
        quantity: Number(item.quantity || 0),
        unit: item.unit || 'Nos',
        rate: Number(item.rate || 0),
        discount_percent: Number(item.discount_percent || 0),
        discount_amount: Number(item.discount_amount || 0),
        taxable_value: Number(item.taxable_value || 0),
        cgst_percent: Number(item.cgst_percent || 0),
        cgst_amount: Number(item.cgst_amount || 0),
        sgst_percent: Number(item.sgst_percent || 0),
        sgst_amount: Number(item.sgst_amount || 0),
        igst_percent: Number(item.igst_percent || 0),
        igst_amount: Number(item.igst_amount || 0),
        total_amount: Number(item.total_amount || 0),
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
  const items: ConvertedInvoiceItem[] = source.items.map((item) => {
    // Use effective rate after discounts
    const effectiveRate = item.final_rate_snapshot || item.rate || 0;
    // Amount should be taxable value (qty × effective rate), NOT line_total (which includes tax)
    const taxableAmount = item.qty * effectiveRate;
    
    return {
      description: item.description,
      hsn_code: item.hsn_code,
      qty: item.qty,
      rate: effectiveRate,
      amount: taxableAmount,
      tax_percent: item.tax_percent,
      meta_json: {
        source_item_id: item.id,
        item_id: item.item_id,
      },
    };
  });

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
  const items: ConvertedDCItem[] = source.items.map((item) => {
    // Use effective rate after discounts, not the original pre-discount rate
    const effectiveRate = item.final_rate_snapshot || item.rate || 0;
    // Use the line_total (which includes discount) or calculate fresh
    const lineTotal = item.line_total || (item.qty * effectiveRate);
    
    return {
      material_id: item.item_id,
      material_name: item.description,
      quantity: item.qty,
      rate: effectiveRate,
      amount: lineTotal,
    };
  });

  const data: ConvertedDCData = {
    client_id: source.client_id,
    client_name: null, // Resolved in CreateDC from clients list
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

// Transform DC to Invoice
export function transformDCToInvoice(source: DCSourceData): ConversionResult {
  const items: ConvertedInvoiceItem[] = source.items.map((item) => ({
    description: item.material_name,
    hsn_code: null,
    qty: item.quantity,
    rate: item.rate,
    amount: item.amount,
    tax_percent: 18,
    meta_json: {
      material_id: item.material_id,
      source_item_id: item.id,
    },
  }));

  const data: ConvertedInvoiceData = {
    client_id: source.client_id || '', // Resolved in hook from client_name
    source_type: 'challan',
    source_id: source.id,
    template_type: 'standard',
    mode: 'itemized',
    invoice_no: null, // Will be auto-generated
    invoice_date: new Date().toISOString().split('T')[0],
    po_number: source.po_no,
    po_date: null,
    company_state: null, // Will be fetched from organisation
    client_state: source.ship_to_state,
    items,
  };

  return {
    data,
    sourceType: 'Delivery Challan',
    sourceNumber: source.dc_number,
    conversionType: 'dc-to-invoice',
    targetDocumentType: 'invoice',
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

// Transform Invoice to Credit Note
export function transformInvoiceToCreditNote(
  source: InvoiceSourceData
): ConversionResult {
  const data = {
    client_id: source.client_id,
    invoice_id: source.id,
    invoice_no: source.invoice_no,
    client_name: source.client_name,
    client_state: source.client_state,
    company_state: source.company_state,
    gstin: source.gstin,
    billing_address: source.billing_address,
    subtotal: source.subtotal,
    cgst: source.cgst,
    sgst: source.sgst,
    igst: source.igst,
    total: source.total,
    po_number: source.po_number,
    po_date: source.po_date,
    remarks: source.remarks,
    items: source.items,
  };

  return {
    data,
    sourceType: 'Invoice',
    sourceNumber: source.invoice_no,
    conversionType: 'invoice-to-creditnote',
    targetDocumentType: 'creditnote',
  };
}

// Transform Invoice to Delivery Challan
export function transformInvoiceToChallan(
  source: InvoiceSourceData
): ConversionResult {
  const items: ConvertedDCItem[] = source.items.map((item) => ({
    material_id: null,
    material_name: item.description,
    quantity: item.qty,
    rate: item.rate,
    amount: item.amount,
  }));

  const data: ConvertedDCData = {
    client_id: source.client_id,
    client_name: source.client_name,
    project_id: null, // Invoices don't carry project_id
    dc_number: null, // Will be auto-generated
    dc_date: new Date().toISOString().split('T')[0],
    ship_to_address: source.billing_address,
    ship_to_state: source.client_state,
    po_number: source.po_number,
    remarks: source.remarks,
    items,
  };

  return {
    data,
    sourceType: 'Invoice',
    sourceNumber: source.invoice_no,
    conversionType: 'invoice-to-challan',
    targetDocumentType: 'dc',
  };
}

// Main transform function that routes to specific transformer
// Transform Client PO to Invoice
export function transformClientPOToInvoice(
  source: POSourceData
): ConversionResult {
  const items: ConvertedInvoiceItem[] = source.items.map((item) => ({
    description: item.description,
    hsn_code: item.hsn_sac_code,
    qty: item.quantity,
    rate: item.rate,
    amount: item.amount,
    tax_percent: item.gst_percentage,
    meta_json: {
      tax_percent: item.gst_percentage,
      uom: item.unit || 'Nos',
      item_code: item.item_code,
      material_id: null,
      base_rate: item.rate,
      po_line_item_id: item.id,
    },
  }));

  const data: ConvertedInvoiceData = {
    client_id: source.client_id,
    source_type: 'po',
    source_id: source.id,
    template_type: 'standard',
    mode: 'itemized',
    invoice_no: null, // Will be auto-generated
    invoice_date: new Date().toISOString().split('T')[0],
    po_number: source.po_number,
    po_date: source.po_date,
    company_state: null, // Will be fetched from organisation
    client_state: source.client_state,
    items,
  };

  return {
    data,
    sourceType: 'Client PO',
    sourceNumber: source.po_number,
    conversionType: 'client-po-to-invoice',
    targetDocumentType: 'invoice',
  };
}

// Transform Purchase Order to Bill
export function transformPurchasePOToBill(
  source: PurchaseOrderSourceData
): ConversionResult {
  const items = source.items.map((item) => ({
    item_name: item.item_name,
    description: item.description,
    hsn_code: item.hsn_code,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    discount_percent: item.discount_percent,
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

  const data = {
    source_type: 'purchase-po-to-bill',
    source_id: source.id,
    vendor_id: source.vendor_id,
    po_id: source.id,
    po_number: source.po_number,
    bill_date: new Date().toISOString().split('T')[0],
    currency: source.currency,
    exchange_rate: source.exchange_rate,
    subtotal: source.subtotal,
    discount_amount: source.discount_amount,
    taxable_amount: source.taxable_amount,
    cgst_amount: source.cgst_amount,
    sgst_amount: source.sgst_amount,
    igst_amount: source.igst_amount,
    total_amount: source.total_amount,
    vendor_name: source.vendor?.company_name || null,
    items,
  };

  return {
    data,
    sourceType: 'Purchase Order',
    sourceNumber: source.po_number,
    conversionType: 'purchase-po-to-bill',
    targetDocumentType: 'bill', // Custom type for purchase bills
  };
}

// Main transform function that routes to specific transformer
export function transformSourceToTarget(
  type: ConversionType,
  sourceData: QuotationSourceData | DCSourceData | ProformaSourceData | InvoiceSourceData | POSourceData | PurchaseOrderSourceData
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
    case 'invoice-to-creditnote':
      return transformInvoiceToCreditNote(sourceData as InvoiceSourceData);
    case 'invoice-to-challan':
      return transformInvoiceToChallan(sourceData as InvoiceSourceData);
    case 'client-po-to-invoice':
      return transformClientPOToInvoice(sourceData as POSourceData);
    case 'dc-to-invoice':
      return transformDCToInvoice(sourceData as DCSourceData);
    case 'purchase-po-to-bill':
      return transformPurchasePOToBill(sourceData as PurchaseOrderSourceData);
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
    'multi-dc-to-quotation': 'Converted to Quotation',
    'invoice-to-creditnote': 'Converted to Credit Note',
    'invoice-to-challan': 'Converted to Delivery',
    'client-po-to-invoice': 'Converted to Invoice',
    'dc-to-invoice': 'Converted to Invoice',
    'purchase-po-to-bill': 'Billed',
  };

  return statusMap[conversionType];
}

// Get source table name for status update
export function getSourceTableName(conversionType: ConversionType): string {
  if (conversionType.startsWith('quotation-')) return 'quotation_header';
  if (conversionType.startsWith('dc-')) return 'delivery_challans';
  if (conversionType === 'proforma-to-invoice') return 'proforma_invoices';
  if (conversionType === 'invoice-to-creditnote') return 'invoices';
  if (conversionType === 'invoice-to-challan') return 'invoices';
  if (conversionType === 'client-po-to-invoice') return 'client_purchase_orders';
  if (conversionType === 'purchase-po-to-bill') return 'purchase_orders';
  throw new Error(`Unknown conversion type: ${conversionType}`);
}

// ═══════════════════════════════════════════════════════════════════════
// Multi-DC → Quotation functions
// ═══════════════════════════════════════════════════════════════════════

// Fetch multiple DCs for conversion
export async function fetchMultipleDCsForConversion(
  dcIds: string[],
  organisationId: string
): Promise<DCSourceData[]> {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select(`
      id,
      dc_number,
      client_name,
      project_id,
      ship_to_state,
      po_no,
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
    .in('id', dcIds)
    .eq('organisation_id', organisationId);

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No Delivery Challans found');

  return data.map((dc: any) => ({
    id: dc.id,
    dc_number: dc.dc_number,
    client_name: dc.client_name,
    client_id: null,
    project_id: dc.project_id,
    ship_to_state: dc.ship_to_state || '',
    po_no: dc.po_no || '',
    remarks: dc.remarks,
    dc_date: dc.dc_date,
    items: (dc.items || []).map((item: any) => ({
      id: item.id,
      material_id: item.material_id,
      material_name: item.material_name,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      amount: Number(item.amount),
    })),
  }));
}

// Validate that all DCs belong to the same client
export async function validateDCsSameClient(
  dcIds: string[],
  organisationId: string
): Promise<{ valid: boolean; clientName?: string; clientId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select('id, client_name')
    .in('id', dcIds)
    .eq('organisation_id', organisationId);

  if (error) throw error;

  const clientNames = [...new Set(data.map((dc: any) => dc.client_name).filter(Boolean))];
  if (clientNames.length === 0) {
    return { valid: false, error: 'No client found on selected DCs' };
  }
  if (clientNames.length > 1) {
    return { valid: false, error: `Multiple clients found: ${clientNames.join(', ')}. All DCs must be from the same client.` };
  }

  // Resolve client_id
  const clientId = await resolveClientIdFromName(clientNames[0], organisationId);

  return { valid: true, clientName: clientNames[0], clientId };
}

// Transform multiple DCs into a single quotation (Single Total mode)
export function transformMultiDC_SingleTotal(
  sources: DCSourceData[],
  clientId: string
): ConversionResult {
  const allItems: ConvertedQuotationItem[] = [];
  sources.forEach(dc => {
    dc.items.forEach(item => {
      allItems.push({
        item_id: item.material_id,
        description: item.material_name,
        qty: item.quantity,
        rate: item.rate,
        tax_percent: 18,
        uom: 'nos',
      });
    });
  });

  const data: ConvertedQuotationData = {
    client_id: clientId,
    project_id: sources[0]?.project_id || null,
    billing_address: null,
    gstin: null,
    state: sources[0]?.ship_to_state || null,
    date: new Date().toISOString().split('T')[0],
    valid_till: null,
    payment_terms: null,
    reference: sources.map(s => s.dc_number).join(', '),
    remarks: sources.map(s => s.remarks).filter(Boolean).join('; ') || null,
    items: allItems,
  };

  return {
    data,
    sourceType: 'Delivery Challan',
    sourceNumber: sources.map(s => s.dc_number).join(', '),
    conversionType: 'multi-dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}

// Transform multiple DCs into a quotation grouped by DC
export function transformMultiDC_GroupedByDC(
  sources: DCSourceData[],
  clientId: string
): ConversionResult {
  const allItems: ConvertedQuotationItem[] = [];
  sources.forEach(dc => {
    // Add a header row for each DC
    allItems.push({
      item_id: null,
      description: `── DC: ${dc.dc_number} (${dc.dc_date}) ──`,
      qty: 0,
      rate: 0,
      tax_percent: 0,
      uom: '',
    });
    // Add items under this DC
    dc.items.forEach(item => {
      allItems.push({
        item_id: item.material_id,
        description: item.material_name,
        qty: item.quantity,
        rate: item.rate,
        tax_percent: 18,
        uom: 'nos',
      });
    });
  });

  const data: ConvertedQuotationData = {
    client_id: clientId,
    project_id: sources[0]?.project_id || null,
    billing_address: null,
    gstin: null,
    state: sources[0]?.ship_to_state || null,
    date: new Date().toISOString().split('T')[0],
    valid_till: null,
    payment_terms: null,
    reference: sources.map(s => s.dc_number).join(', '),
    remarks: sources.map(s => s.remarks).filter(Boolean).join('; ') || null,
    items: allItems,
  };

  return {
    data,
    sourceType: 'Delivery Challan',
    sourceNumber: sources.map(s => s.dc_number).join(', '),
    conversionType: 'multi-dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}

// Transform multiple DCs into a quotation with one row per DC
export function transformMultiDC_OneRowPerDC(
  sources: DCSourceData[],
  clientId: string
): ConversionResult {
  const allItems: ConvertedQuotationItem[] = [];
  sources.forEach(dc => {
    const totalAmount = dc.items.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = dc.items.reduce((sum, item) => sum + item.quantity, 0);
    allItems.push({
      item_id: null,
      description: `Delivery Challan ${dc.dc_number} (${dc.dc_date}) - ${dc.items.length} items`,
      qty: totalQty,
      rate: totalAmount > 0 && totalQty > 0 ? totalAmount / totalQty : 0,
      tax_percent: 18,
      uom: 'nos',
    });
  });

  const data: ConvertedQuotationData = {
    client_id: clientId,
    project_id: sources[0]?.project_id || null,
    billing_address: null,
    gstin: null,
    state: sources[0]?.ship_to_state || null,
    date: new Date().toISOString().split('T')[0],
    valid_till: null,
    payment_terms: null,
    reference: sources.map(s => s.dc_number).join(', '),
    remarks: sources.map(s => s.remarks).filter(Boolean).join('; ') || null,
    items: allItems,
  };

  return {
    data,
    sourceType: 'Delivery Challan',
    sourceNumber: sources.map(s => s.dc_number).join(', '),
    conversionType: 'multi-dc-to-quotation',
    targetDocumentType: 'quotation',
  };
}

// Save DC links for a quotation
export async function saveQuotationDCLinks(
  quotationId: string,
  allocations: DCAllocation[]
): Promise<void> {
  // Delete existing links
  await supabase.from('quotation_dc_links').delete().eq('quotation_id', quotationId);

  if (allocations.length === 0) return;

  const links = allocations.map(a => ({
    quotation_id: quotationId,
    delivery_challan_id: a.dc_id,
    allocated_amount: a.allocated_amount,
  }));

  const { error } = await supabase.from('quotation_dc_links').insert(links);
  if (error) throw error;
}

// Load DC links for a quotation
export async function loadQuotationDCLinks(quotationId: string): Promise<DCAllocation[]> {
  const { data, error } = await supabase
    .from('quotation_dc_links')
    .select('delivery_challan_id, allocated_amount, dc:delivery_challans(id, dc_number, dc_date, client_name)')
    .eq('quotation_id', quotationId);

  if (error) throw error;

  return (data || []).map((link: any) => ({
    dc_id: link.delivery_challan_id,
    dc_number: link.dc?.dc_number || '',
    allocated_amount: Number(link.allocated_amount),
    items: [], // Will be loaded separately if needed
  }));
}
