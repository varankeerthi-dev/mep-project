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

export async function createAvailabilityInquiry(input: {
  organisation_id: string;
  requisition_id: string;
  requisition_line_id: string;
  item_id?: string | null;
  item_name: string;
  required_qty: number;
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

  const { data: line, error: lineError } = await supabase
    .from('availability_inquiry_lines')
    .insert({
      organisation_id: input.organisation_id,
      inquiry_id: inquiry.id,
      requisition_line_id: input.requisition_line_id,
      item_id: input.item_id || null,
      item_name: input.item_name,
      required_qty: input.required_qty,
    })
    .select()
    .single();
  if (lineError) throw lineError;
  return { inquiry, line };
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

