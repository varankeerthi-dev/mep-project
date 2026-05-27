import { supabase } from '../supabase';

export type PurposeType = 'PROJECT' | 'SITE_WORK' | 'COMPANY_EXPENSE' | 'MAINTENANCE' | 'CAPEX' | 'OTHER';
export type RequisitionPriority = 'Low' | 'Normal' | 'High' | 'Emergency';

export interface RequisitionLineInput {
  item_id?: string | null;
  variant_id?: string | null;
  item_name: string;
  variant_name?: string | null;
  uom?: string | null;
  requested_qty: number;
  estimated_rate?: number | null;
  required_date?: string | null;
  notes?: string | null;
}

export interface CreateRequisitionInput {
  organisation_id: string;
  purpose_type: PurposeType;
  project_id?: string | null;
  site_id?: string | null;
  cost_center_id?: string | null;
  work_order_id?: string | null;
  required_date?: string | null;
  priority?: RequisitionPriority;
  notes?: string | null;
  requested_by?: string | null;
  requested_by_name?: string | null;
  source_context?: 'PROJECT' | 'CENTRAL' | 'SITE_WORK' | 'MAINTENANCE' | 'OTHER';
  requisition_number?: string;
  lines: RequisitionLineInput[];
}

export async function createPurchaseRequisition(input: CreateRequisitionInput) {
  const requisitionNumber = input.requisition_number || await generateRequisitionNumber(input.organisation_id);

  const { data: header, error: headerError } = await supabase
    .from('purchase_requisitions')
    .insert({
      organisation_id: input.organisation_id,
      requisition_number: requisitionNumber,
      purpose_type: input.purpose_type,
      project_id: input.project_id || null,
      site_id: input.site_id || null,
      cost_center_id: input.cost_center_id || null,
      work_order_id: input.work_order_id || null,
      required_date: input.required_date || null,
      priority: input.priority || 'Normal',
      notes: input.notes || null,
      requested_by: input.requested_by || null,
      requested_by_name: input.requested_by_name || null,
      source_context: input.source_context || 'CENTRAL',
      status: 'Pending',
    })
    .select()
    .single();

  if (headerError) throw headerError;

  const rows = input.lines.map((line, idx) => {
    const requested = Number(line.requested_qty || 0);
    return {
      organisation_id: input.organisation_id,
      requisition_id: header.id,
      line_no: idx + 1,
      item_id: line.item_id || null,
      variant_id: line.variant_id || null,
      item_name: line.item_name,
      variant_name: line.variant_name || null,
      uom: line.uom || null,
      requested_qty: requested,
      estimated_rate: line.estimated_rate ?? null,
      estimated_amount: line.estimated_rate != null ? Number(line.estimated_rate) * requested : null,
      open_qty: requested,
      required_date: line.required_date || input.required_date || null,
      notes: line.notes || null,
    };
  });

  const { error: linesError } = await supabase.from('purchase_requisition_lines').insert(rows);
  if (linesError) throw linesError;

  return header;
}

export async function approvePurchaseRequisition(requisitionId: string) {
  const { error } = await supabase.rpc('approve_purchase_requisition', { p_requisition_id: requisitionId });
  if (error) throw error;
}

export async function submitPurchaseRequisitionForApproval(requisitionId: string, actorId?: string | null) {
  const { data, error } = await supabase.rpc('submit_purchase_requisition_for_approval', {
    p_requisition_id: requisitionId,
    p_actor_id: actorId || null,
  });
  if (error) throw error;
  return data;
}

export async function processPurchaseRequisitionApproval(
  requisitionId: string,
  action: 'APPROVE' | 'REJECT',
  actorId?: string | null,
  comment?: string | null
) {
  const { data, error } = await supabase.rpc('process_purchase_requisition_approval', {
    p_requisition_id: requisitionId,
    p_action: action,
    p_actor_id: actorId || null,
    p_comment: comment || null,
  });
  if (error) throw error;
  return data;
}

export async function listPurchaseAuditLogs(organisationId: string, entityId: string) {
  const { data, error } = await supabase
    .from('purchase_audit_log')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('entity_type', 'REQUISITION')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listPurchaseRequisitions(organisationId: string, projectId?: string | null) {
  let query = supabase
    .from('purchase_requisitions')
    .select('*, lines:purchase_requisition_lines(*)')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listPurchaseIVSettings(organisationId: string) {
  const { data, error } = await supabase
    .from('purchase_iv_settings')
    .select('*')
    .eq('organisation_id', organisationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPurchaseInvoiceVerifications(organisationId: string) {
  const { data, error } = await supabase
    .from('purchase_invoice_verifications')
    .select('*, bill:purchase_bills(id, bill_number, bill_date, total_amount, po_id), po:purchase_orders(id, po_number, po_date)')
    .eq('organisation_id', organisationId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function verifyPurchaseBill3Way(organisationId: string, billId: string) {
  const { data, error } = await supabase.rpc('verify_purchase_bill_3way', {
    p_organisation_id: organisationId,
    p_bill_id: billId,
  });
  if (error) throw error;
  return data as string;
}

async function generateRequisitionNumber(organisationId: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const { data, error } = await supabase
    .from('purchase_requisitions')
    .select('requisition_number')
    .eq('organisation_id', organisationId)
    .ilike('requisition_number', `PR-${yy}${mm}-%`);

  if (error) throw error;
  const next = (data?.length || 0) + 1;
  return `PR-${yy}${mm}-${String(next).padStart(4, '0')}`;
}
