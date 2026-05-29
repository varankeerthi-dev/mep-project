import { supabase } from '../supabase';

export async function listProcureRequisitionLines(organisationId: string) {
  const { data, error } = await supabase
    .from('purchase_requisition_lines')
    .select('id, requisition_id, item_id, item_name, requested_qty, procure_required_qty, source_type, requisition:purchase_requisitions!inner(requisition_number, status)')
    .eq('organisation_id', organisationId)
    .eq('source_type', 'PROCURE')
    .gt('procure_required_qty', 0)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export interface AvailabilityInquiryLineInput {
  requisition_line_id: string;
  item_id?: string | null;
  item_name: string;
  required_qty: number;
}

export async function createAvailabilityInquiry(input: {
  organisation_id: string;
  requisition_id: string;
  lines: AvailabilityInquiryLineInput[];
  notes?: string;
  created_by?: string | null;
}) {
  const inquiryNumber = await generateInquiryNumber(input.organisation_id);
  const { data: inquiry, error: headerError } = await supabase
    .from('availability_inquiries')
    .insert({
      organisation_id: input.organisation_id,
      requisition_id: input.requisition_id,
      inquiry_number: inquiryNumber,
      notes: input.notes || null,
      created_by: input.created_by || null,
    })
    .select()
    .single();
  if (headerError) throw headerError;

  const lineInserts = input.lines.map(l => ({
    organisation_id: input.organisation_id,
    inquiry_id: inquiry.id,
    requisition_line_id: l.requisition_line_id,
    item_id: l.item_id || null,
    item_name: l.item_name,
    required_qty: l.required_qty,
  }));

  const { data: lines, error: lineError } = await supabase
    .from('availability_inquiry_lines')
    .insert(lineInserts)
    .select();
  if (lineError) throw lineError;
  return { inquiry, lines };
}

export async function listAvailabilityInquiries(organisationId: string) {
  const { data, error } = await supabase
    .from('availability_inquiries')
    .select('*, lines:availability_inquiry_lines(*, responses:availability_responses(*, vendor:purchase_vendors(company_name)))')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function upsertAvailabilityResponse(input: {
  organisation_id: string;
  inquiry_line_id: string;
  vendor_id: string;
  available_qty: number;
  promise_date?: string | null;
  valid_till?: string | null;
  remarks?: string | null;
  po_ready_qty?: number;
}) {
  const { data: existing } = await supabase
    .from('availability_responses')
    .select('id')
    .eq('organisation_id', input.organisation_id)
    .eq('inquiry_line_id', input.inquiry_line_id)
    .eq('vendor_id', input.vendor_id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('availability_responses')
      .update({
        available_qty: input.available_qty,
        promise_date: input.promise_date || null,
        valid_till: input.valid_till || null,
        remarks: input.remarks || null,
        po_ready_qty: input.po_ready_qty ?? input.available_qty,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from('availability_responses')
    .insert({
      organisation_id: input.organisation_id,
      inquiry_line_id: input.inquiry_line_id,
      vendor_id: input.vendor_id,
      available_qty: input.available_qty,
      promise_date: input.promise_date || null,
      valid_till: input.valid_till || null,
      remarks: input.remarks || null,
      po_ready_qty: input.po_ready_qty ?? input.available_qty,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function convertAvailabilityResponseToPO(input: {
  organisation_id: string;
  response_id: string;
  vendor_id: string;
  created_by?: string | null;
}) {
  const { data: response, error: responseError } = await supabase
    .from('availability_responses')
    .select('*, inquiry_line:availability_inquiry_lines(*, inquiry:availability_inquiries(*))')
    .eq('id', input.response_id)
    .single();
  if (responseError) throw responseError;

  const line = response.inquiry_line;
  const inquiry = line?.inquiry;
  if (!line || !inquiry) throw new Error('Invalid inquiry response relation');

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      organisation_id: input.organisation_id,
      vendor_id: input.vendor_id,
      po_number: `PO-AI-${new Date().getTime()}`,
      po_date: new Date().toISOString().slice(0, 10),
      delivery_date: null,
      currency: 'INR',
      exchange_rate: 1,
      status: 'Draft',
      internal_notes: `From availability inquiry ${inquiry.inquiry_number}`,
      subtotal: 0,
      discount_amount: 0,
      taxable_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
      total_amount_inr: 0,
      created_by: input.created_by || null,
    })
    .select()
    .single();
  if (poError) throw poError;

  const qty = Number(response.po_ready_qty || response.available_qty || 0);
  const { data: poItem, error: itemError } = await supabase
    .from('purchase_order_items')
    .insert({
      organisation_id: input.organisation_id,
      po_id: po.id,
      sr: 1,
      item_name: line.item_name,
      description: line.item_name,
      quantity: qty,
      unit: 'Nos',
      rate: 0,
      discount_percent: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_percent: 0,
      cgst_amount: 0,
      sgst_percent: 0,
      sgst_amount: 0,
      igst_percent: 0,
      igst_amount: 0,
      total_amount: 0,
      total_amount_inr: 0,
      requisition_line_id: line.requisition_line_id || null,
      inquiry_line_id: line.id,
    })
    .select()
    .single();
  if (itemError) throw itemError;

  if (line.requisition_line_id) {
    const { data: reqLine } = await supabase
      .from('purchase_requisition_lines')
      .select('po_qty, requisition_id')
      .eq('id', line.requisition_line_id)
      .maybeSingle();

    await supabase
      .from('purchase_requisition_lines')
      .update({
        po_qty: Number(reqLine?.po_qty || 0) + qty,
      })
      .eq('id', line.requisition_line_id);

    if (reqLine?.requisition_id) {
      await updateRequisitionHeaderStatus(reqLine.requisition_id);
    }
  }

  return { po, poItem };
}

export async function postGoodsReceipt(input: {
  organisation_id: string;
  po_id: string;
  po_item_id: string;
  received_qty: number;
  created_by?: string | null;
}) {
  const { data, error } = await supabase.rpc('post_goods_receipt', {
    p_organisation_id: input.organisation_id,
    p_po_id: input.po_id,
    p_po_item_id: input.po_item_id,
    p_received_qty: input.received_qty,
    p_created_by: input.created_by || null,
  });
  if (error) throw error;
  return data;
}

async function generateInquiryNumber(organisationId: string) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const { data, error } = await supabase
    .from('availability_inquiries')
    .select('id')
    .eq('organisation_id', organisationId)
    .ilike('inquiry_number', `AI-${yy}-%`);
  if (error) throw error;
  return `AI-${yy}-${String((data?.length || 0) + 1).padStart(4, '0')}`;
}

export async function updateRequisitionHeaderStatus(requisitionId: string) {
  const { error } = await supabase.rpc('update_purchase_requisition_header_status', {
    p_requisition_id: requisitionId,
  });
  if (error) throw error;
}

export interface SourcingLine {
  id: string;
  requisition_id: string;
  line_no: number;
  item_id: string | null;
  item_name: string;
  variant_name: string | null;
  uom: string | null;
  requested_qty: number;
  store_allocated_qty: number;
  procure_required_qty: number;
  available_stock_qty: number;
  po_qty: number;
  received_qty: number;
  open_qty: number;
  status: string;
  required_date: string | null;
  requisition: {
    requisition_number: string;
    status: string;
    purpose_type: string;
    priority: string;
    required_date: string | null;
  };
}

export async function listRequisitionLinesForSourcing(organisationId: string) {
  const { data, error } = await supabase
    .from('purchase_requisition_lines')
    .select(`
      id, requisition_id, line_no, item_id, item_name, variant_name,
      uom, requested_qty, store_allocated_qty, procure_required_qty,
      available_stock_qty, po_qty, received_qty, open_qty, status, required_date,
      requisition:purchase_requisitions!inner(requisition_number, status, purpose_type, priority, required_date)
    `)
    .eq('organisation_id', organisationId)
    .in('requisition.status', ['Approved', 'Partially Fulfilled'])
    .gt('open_qty', 0)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as SourcingLine[];
}

export async function fulfillFromStoreLine(
  lineId: string,
  itemId: string | null,
  qty: number,
  organisationId: string
) {
  if (!itemId) throw new Error('Item has no inventory tracking');

  const { data: stockRows, error: stockError } = await supabase
    .from('item_stock')
    .select('id, warehouse_id, current_stock')
    .eq('item_id', itemId)
    .eq('organisation_id', organisationId)
    .gt('current_stock', 0)
    .order('current_stock', { ascending: false });
  if (stockError) throw stockError;

  let remaining = qty;
  for (const row of (stockRows || [])) {
    if (remaining <= 0) break;
    const deduct = Math.min(remaining, Number(row.current_stock));
    const { error } = await supabase
      .from('item_stock')
      .update({ current_stock: Number(row.current_stock) - deduct, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) throw error;
    remaining -= deduct;
  }

  const { data: line, error: lineError } = await supabase
    .from('purchase_requisition_lines')
    .select('store_allocated_qty, open_qty, requisition_id')
    .eq('id', lineId)
    .single();
  if (lineError) throw lineError;

  const newStoreAllocated = Number(line.store_allocated_qty || 0) + qty;
  const newOpenQty = Math.max(0, Number(line.open_qty || 0) - qty);

  await supabase
    .from('purchase_requisition_lines')
    .update({
      store_allocated_qty: newStoreAllocated,
      open_qty: newOpenQty,
      status: newOpenQty <= 0 ? 'Fulfilled' : 'Partially Fulfilled',
    })
    .eq('id', lineId);

  if (line?.requisition_id) {
    await updateRequisitionHeaderStatus(line.requisition_id);
  }
}

export async function sendToPurchaseLine(
  lineId: string,
  qty: number,
  organisationId: string,
  requisitionId: string
) {
  const { data: line, error: lineError } = await supabase
    .from('purchase_requisition_lines')
    .select('procure_required_qty, open_qty, item_id, item_name, requested_qty')
    .eq('id', lineId)
    .single();
  if (lineError) throw lineError;

  const newOpenQty = Math.max(0, Number(line.open_qty || 0) - qty);

  await supabase
    .from('purchase_requisition_lines')
    .update({
      open_qty: newOpenQty,
      status: newOpenQty <= 0 ? 'Fulfilled' : 'Partially Fulfilled',
    })
    .eq('id', lineId);

  await updateRequisitionHeaderStatus(requisitionId);

  const inquiryNumber = `AI-${String(new Date().getTime()).slice(-8)}`;
  const { data: inquiry, error: inqError } = await supabase
    .from('availability_inquiries')
    .insert({
      organisation_id: organisationId,
      requisition_id: requisitionId,
      inquiry_number: inquiryNumber,
      notes: `Sourced from line ${lineId}`,
    })
    .select()
    .single();
  if (inqError) throw inqError;

  const { error: liError } = await supabase
    .from('availability_inquiry_lines')
    .insert({
      organisation_id: organisationId,
      inquiry_id: inquiry.id,
      requisition_line_id: lineId,
      item_id: line?.item_id || null,
      item_name: line?.item_name || '',
      required_qty: qty,
    });
  if (liError) throw liError;

  return inquiry;
}

export interface VendorResponseInfo {
  requisition_line_id: string;
  inquiry_line_id: string;
  inquiry_created_at: string;
  vendor_name: string;
  available_qty: number;
  po_ready_qty: number;
  promise_date: string | null;
  remarks: string | null;
  vendor_id: string;
  po_number: string | null;
  po_status: string | null;
  po_id: string | null;
}

export async function listVendorResponsesForLines(lineIds: string[], organisationId: string): Promise<Record<string, VendorResponseInfo[]>> {
  if (lineIds.length === 0) return {};

  const { data, error } = await supabase
    .from('availability_inquiry_lines')
    .select(`
      requisition_line_id,
      id,
      required_qty,
      created_at,
      inquiry:availability_inquiries!inner(created_at, inquiry_number, status),
      responses:availability_responses(
        id,
        available_qty,
        po_ready_qty,
        promise_date,
        remarks,
        vendor_id,
        vendor:purchase_vendors(company_name)
      )
    `)
    .in('requisition_line_id', lineIds);
  if (error) throw error;

  const inquiryLineIds: string[] = [];
  const inquiryLineCreatedAt: Record<string, string> = {};

  for (const row of (data || []) as any[]) {
    if (row.id) {
      inquiryLineIds.push(row.id);
      inquiryLineCreatedAt[row.id] = row.created_at || row.inquiry?.created_at || '';
    }
  }

  let poByLineId: Record<string, { po_number: string; po_status: string; po_id: string }> = {};
  if (inquiryLineIds.length > 0) {
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select('inquiry_line_id, po_id, po:purchase_orders!inner(po_number, status)')
      .in('inquiry_line_id', inquiryLineIds)
      .not('inquiry_line_id', 'is', null);
    if (poItems) {
      for (const pi of (poItems as any[])) {
        const inqLineId = (pi as any).inquiry_line_id;
        const pp = pi.po as any;
        if (inqLineId && pp) {
          poByLineId[inqLineId] = { po_number: pp.po_number, po_status: pp.status, po_id: pi.po_id };
        }
      }
    }
  }

  const result: Record<string, VendorResponseInfo[]> = {};
  for (const row of (data || []) as any[]) {
    const lineId = row.requisition_line_id;
    if (!result[lineId]) result[lineId] = [];
    const inquiryLineId = row.id;
    const poInfo = poByLineId[inquiryLineId] || null;
    for (const r of (row.responses || [])) {
      result[lineId].push({
        requisition_line_id: lineId,
        inquiry_line_id: inquiryLineId,
        inquiry_created_at: inquiryLineCreatedAt[inquiryLineId] || '',
        vendor_name: r.vendor?.company_name || 'Unknown',
        available_qty: Number(r.available_qty || 0),
        po_ready_qty: Number(r.po_ready_qty || 0),
        promise_date: r.promise_date || null,
        remarks: r.remarks || null,
        vendor_id: r.vendor_id,
        po_number: poInfo?.po_number || null,
        po_status: poInfo?.po_status || null,
        po_id: poInfo?.po_id || null,
      });
    }
  }
  return result;
}
