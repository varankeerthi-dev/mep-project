import { supabase } from '../supabase';
import { ApprovalAPI } from '../approvals/api';

interface ReassignParams {
  revisionId: string;
  organisationId: string;
  performedBy: string;
  newAssigneeId: string;
  currentAssigneeId: string;
  reason: string;
  isMdVoluntary?: boolean;
}

async function resolveQuotationClient(quotationId: string): Promise<{ client_id: string; quotation_no: string }> {
  const { data } = await supabase
    .from('quotation_header')
    .select('client_id, quotation_no')
    .eq('id', quotationId)
    .single();

  if (!data) throw new Error('Quotation not found');
  return { client_id: data.client_id, quotation_no: data.quotation_no };
}

export async function initiateQuotationRevision(
  organisationId: string,
  quotationId: string,
  clientId?: string,
  salespersonId?: string,
  commLogId?: string
) {
  let resolvedClientId = clientId;
  let quotationNo = '';

  if (!resolvedClientId || !commLogId) {
    const resolved = await resolveQuotationClient(quotationId);
    resolvedClientId = resolvedClientId || resolved.client_id;
    quotationNo = resolved.quotation_no;
  }

  if (!salespersonId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    salespersonId = user.id;
  }

  if (!commLogId) {
    const { data: newComm, error: commError } = await supabase
      .from('client_communication')
      .insert([{
        organisation_id: organisationId,
        party_type: 'client',
        client_id: resolvedClientId,
        subject: `Quotation revision requested - ${quotationNo}`,
        call_brief: `Auto-generated: Revision workflow started for quotation ${quotationNo}`,
        call_category: 'general',
        call_regarding: 'quotation',
        status: 'open',
        priority: 'medium',
        linked_type: 'quotation',
        linked_id: quotationId,
        call_entered_by: salespersonId,
        call_received_by: salespersonId
      }])
      .select()
      .single();

    if (commError) throw commError;
    commLogId = newComm.id;
  }

  const { data: revision, error } = await supabase
    .from('quotation_revisions')
    .insert([{
      organisation_id: organisationId,
      communication_id: commLogId,
      client_id: resolvedClientId,
      original_owner_id: salespersonId,
      current_owner_id: salespersonId,
      status: 'pending_approval'
    }])
    .select()
    .single();

  if (error) throw error;

  const approvalResult = await ApprovalAPI.createApprovalRequest({
    approval_type: 'QUOTATION',
    reference_id: revision.id,
    reference_type: 'quotation_revisions',
    title: 'Quotation Revision Request',
    description: `Quotation revision workflow initiated`
  });

  if (approvalResult.success && approvalResult.data?.id) {
    await supabase
      .from('quotation_revisions')
      .update({ approval_request_id: approvalResult.data.id })
      .eq('id', revision.id);
  }

  await supabase
    .from('quotation_revision_audit_logs')
    .insert([{
      organisation_id: organisationId,
      revision_id: revision.id,
      action_taken: 'REQUESTED',
      performed_by: salespersonId,
      remarks: 'Quotation revision workflow initiated'
    }]);

  return revision;
}

export async function reassignRevisionTask({
  revisionId, organisationId, performedBy,
  newAssigneeId, currentAssigneeId, reason, isMdVoluntary = false
}: ReassignParams) {
  const { error: updateError } = await supabase
    .from('quotation_revisions')
    .update({ current_owner_id: newAssigneeId })
    .eq('id', revisionId);

  if (updateError) throw updateError;

  const actionText = isMdVoluntary ? 'DELEGATED_BY_MANAGEMENT' : 'VOLUNTARY_DELEGATION';

  const { error: auditError } = await supabase
    .from('quotation_revision_audit_logs')
    .insert([{
      organisation_id: organisationId,
      revision_id: revisionId,
      action_taken: actionText,
      performed_by: performedBy,
      previous_assignee_id: currentAssigneeId,
      new_assignee_id: newAssigneeId,
      remarks: reason
    }]);

  if (auditError) throw auditError;
}
