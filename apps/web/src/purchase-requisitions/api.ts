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
  status?: 'Draft' | 'Pending';
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
      status: input.status || 'Pending',
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

  if (input.status === 'Pending' || !input.status) {
    const totalAmount = rows.reduce((s, r) => s + (Number(r.estimated_amount) || 0), 0);
    try {
      const { ApprovalIntegration } = await import('../approvals/integration');
      await ApprovalIntegration.createPurchaseRequisitionApproval(
        header.id,
        requisitionNumber,
        totalAmount,
        (input.priority?.toUpperCase() as any) || 'NORMAL'
      );
    } catch (err) {
      console.warn('Failed to trigger ApprovalIntegration for purchase requisition:', err);
    }
  }

  return header;
}

export async function approvePurchaseRequisition(requisitionId: string) {
  const { error } = await supabase.rpc('approve_purchase_requisition', { p_requisition_id: requisitionId });
  if (!error) return;
  if (!shouldFallbackFromRpcError(error)) throw error;
  await approvePurchaseRequisitionFallback(requisitionId);
}

export async function submitPurchaseRequisitionForApproval(requisitionId: string, actorId?: string | null) {
  const { data, error } = await supabase.rpc('submit_purchase_requisition_for_approval', {
    p_requisition_id: requisitionId,
    p_actor_id: actorId || null,
  });
  if (!error) return data;

  if (!shouldFallbackFromRpcError(error)) throw error;
  return submitPurchaseRequisitionFallback(requisitionId, actorId || null);
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
  if (!error) return data;

  if (!shouldFallbackFromRpcError(error)) throw error;
  return processPurchaseRequisitionApprovalFallback(requisitionId, action, actorId || null, comment || null);
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

function shouldFallbackFromRpcError(error: any) {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === '42883' || msg.includes('not found') || msg.includes('could not find');
}

async function submitPurchaseRequisitionFallback(requisitionId: string, actorId: string | null) {
  const { data: req, error: reqErr } = await supabase
    .from('purchase_requisitions')
    .select('id, organisation_id, purpose_type')
    .eq('id', requisitionId)
    .single();
  if (reqErr) throw reqErr;

  let requiredLevel = 1;
  const { data: totalRows } = await supabase
    .from('purchase_requisition_lines')
    .select('estimated_amount')
    .eq('requisition_id', requisitionId);
  const estimatedTotal = (totalRows || []).reduce((s: number, r: any) => s + Number(r.estimated_amount || 0), 0);

  const { data: rules, error: rulesErr } = await supabase
    .from('purchase_release_rules')
    .select('required_level, purpose_type, min_amount, max_amount, is_active')
    .eq('organisation_id', req.organisation_id)
    .eq('is_active', true);
  if (!rulesErr && rules?.length) {
    const applicable = rules.filter((r: any) =>
      (!r.purpose_type || r.purpose_type === req.purpose_type) &&
      estimatedTotal >= Number(r.min_amount || 0) &&
      (r.max_amount == null || estimatedTotal <= Number(r.max_amount))
    );
    requiredLevel = applicable.reduce((m: number, r: any) => Math.max(m, Number(r.required_level || 1)), 1);
  }

  const nextStatus = requiredLevel > 1 ? 'Pending Approval' : 'Approved';
  const { error: updErr } = await supabase
    .from('purchase_requisitions')
    .update({
      approval_status: nextStatus,
      required_approval_level: requiredLevel,
      current_approval_level: requiredLevel > 1 ? 1 : requiredLevel,
      approved_by: requiredLevel > 1 ? null : actorId,
      approved_at: requiredLevel > 1 ? null : new Date().toISOString(),
      status: requiredLevel > 1 ? 'Pending' : 'Approved',
    })
    .eq('id', requisitionId);
  if (updErr) throw updErr;

  if (requiredLevel === 1) {
    try {
      await approvePurchaseRequisition(requisitionId);
    } catch {
      // keep header approval successful even if source-determination RPC is unavailable
    }
  }
  return requiredLevel > 1 ? 'PENDING_APPROVAL' : 'APPROVED';
}

async function processPurchaseRequisitionApprovalFallback(
  requisitionId: string,
  action: 'APPROVE' | 'REJECT',
  actorId: string | null,
  _comment: string | null
) {
  const { data: req, error: reqErr } = await supabase
    .from('purchase_requisitions')
    .select('id, current_approval_level, required_approval_level')
    .eq('id', requisitionId)
    .single();
  if (reqErr) throw reqErr;

  if (action === 'REJECT') {
    const { error } = await supabase
      .from('purchase_requisitions')
      .update({ approval_status: 'Rejected', status: 'Rejected' })
      .eq('id', requisitionId);
    if (error) throw error;
    return 'REJECTED';
  }

  const current = Number(req.current_approval_level || 0);
  const required = Number(req.required_approval_level || 1);
  if (current + 1 >= required) {
    const { error } = await supabase
      .from('purchase_requisitions')
      .update({
        approval_status: 'Approved',
        status: 'Approved',
        current_approval_level: required,
        approved_by: actorId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requisitionId);
    if (error) throw error;
    try {
      await approvePurchaseRequisition(requisitionId);
    } catch {
      // allow approval completion without downstream RPC hard-fail
    }
    return 'APPROVED';
  }

  const { error } = await supabase
    .from('purchase_requisitions')
    .update({ current_approval_level: current + 1 })
    .eq('id', requisitionId);
  if (error) throw error;
  return 'PENDING_APPROVAL';
}

async function approvePurchaseRequisitionFallback(requisitionId: string) {
  const { data: req, error: reqErr } = await supabase
    .from('purchase_requisitions')
    .select('id, organisation_id')
    .eq('id', requisitionId)
    .single();
  if (reqErr) throw reqErr;

  const { data: lines, error: linesErr } = await supabase
    .from('purchase_requisition_lines')
    .select('id, requested_qty')
    .eq('requisition_id', requisitionId);
  if (linesErr) throw linesErr;

  for (const line of lines || []) {
    const requested = Number(line.requested_qty || 0);
    const { error: updErr } = await supabase
      .from('purchase_requisition_lines')
      .update({
        available_stock_qty: 0,
        store_allocated_qty: 0,
        procure_required_qty: requested,
        source_type: 'PROCURE',
        open_qty: requested,
        status: 'Open',
      })
      .eq('id', line.id);
    if (updErr) throw updErr;
  }

  const { error: reqUpdErr } = await supabase
    .from('purchase_requisitions')
    .update({ status: 'Approved' })
    .eq('id', req.id);
  if (reqUpdErr) throw reqUpdErr;
}

export async function deletePurchaseRequisition(requisitionId: string) {
  const { error } = await supabase
    .from('purchase_requisitions')
    .delete()
    .eq('id', requisitionId);
  if (error) throw error;
}

export async function updatePurchaseRequisition(requisitionId: string, input: CreateRequisitionInput) {
  const { error: headerError } = await supabase
    .from('purchase_requisitions')
    .update({
      purpose_type: input.purpose_type,
      project_id: input.project_id || null,
      site_id: input.site_id || null,
      cost_center_id: input.cost_center_id || null,
      work_order_id: input.work_order_id || null,
      required_date: input.required_date || null,
      priority: input.priority || 'Normal',
      notes: input.notes || null,
      status: input.status || 'Pending',
    })
    .eq('id', requisitionId);

  if (headerError) throw headerError;

  // Re-sync lines: Delete and re-insert
  const { error: deleteError } = await supabase
    .from('purchase_requisition_lines')
    .delete()
    .eq('requisition_id', requisitionId);
  
  if (deleteError) throw deleteError;

  const rows = input.lines.map((line, idx) => {
    const requested = Number(line.requested_qty || 0);
    return {
      organisation_id: input.organisation_id,
      requisition_id: requisitionId,
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

  if (input.status === 'Pending' || !input.status) {
    const totalAmount = rows.reduce((s, r) => s + (Number(r.estimated_amount) || 0), 0);
    try {
      const { data: header } = await supabase
        .from('purchase_requisitions')
        .select('requisition_number')
        .eq('id', requisitionId)
        .single();

      const { ApprovalIntegration } = await import('../approvals/integration');
      await ApprovalIntegration.createPurchaseRequisitionApproval(
        requisitionId,
        header?.requisition_number || 'PR',
        totalAmount,
        (input.priority?.toUpperCase() as any) || 'NORMAL'
      );
    } catch (err) {
      console.warn('Failed to trigger ApprovalIntegration for purchase requisition update:', err);
    }
  }

  return { id: requisitionId };
}
