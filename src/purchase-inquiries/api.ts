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
      .select('po_qty')
      .eq('id', line.requisition_line_id)
      .maybeSingle();

    await supabase
      .from('purchase_requisition_lines')
      .update({
        po_qty: Number(reqLine?.po_qty || 0) + qty,
      })
      .eq('id', line.requisition_line_id);
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
