import { supabase, currentOrgId } from '../lib/supabase';
import { ApprovalNotificationService } from './notifications';
import {
  Approval,
  ApprovalRequest,
  ApprovalActionRequest,
  ApprovalFilters,
  ApprovalStats,
  ApiResponse,
  ApprovalActionLog,
  ApprovalWorkflow
} from '../types/approvals';

export class ApprovalAPI {
  static async createApprovalRequest(data: ApprovalRequest): Promise<ApiResponse<Approval>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      const { data: workflow } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('approval_type', data.approval_type)
        .lte('min_amount', data.amount || 0)
        .or(`max_amount.is.null,max_amount.gte.${data.amount || 0}`)
        .eq('is_active', true)
        .eq('organisation_id', organisationId)
        .order('level', { ascending: false })
        .limit(1)
        .single();

      const maxLevels = workflow ? workflow.level : 1;

      const denorm = await this.enrichApprovalMetadata(user.id, organisationId, data.reference_type, data.reference_id);

      const { data: approval, error } = await supabase
        .from('approvals')
        .insert({
          approval_type: data.approval_type,
          reference_id: data.reference_id,
          reference_type: data.reference_type,
          title: data.title,
          description: data.description,
          amount: data.amount,
          priority: data.priority || 'NORMAL',
          requested_by: user.id,
          max_levels: maxLevels,
          organisation_id: organisationId,
          requester_name: data.requester_name ?? denorm.requester_name ?? null,
          requester_role: data.requester_role ?? denorm.requester_role ?? null,
          project_id: data.project_id ?? denorm.project_id ?? null,
          project_name: data.project_name ?? denorm.project_name ?? null,
          reference_number: data.reference_number ?? denorm.reference_number ?? null,
          reviewer_id: data.reviewer_id ?? null,
          review_status: data.review_status ?? 'NOT_REQUIRED',
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      await this.sendApprovalNotifications(approval.id);

      return {
        success: true,
        data: approval,
        meta: { timestamp: new Date().toISOString() }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  static async getApprovalsForUser(filters?: ApprovalFilters): Promise<ApiResponse<Approval[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      let query = supabase
        .from('approvals')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.status && filters.status.length > 0) {
          query = query.in('status', filters.status);
        }
        if (filters.type && filters.type.length > 0) {
          query = query.in('approval_type', filters.type);
        }
        if (filters.priority && filters.priority.length > 0) {
          query = query.in('priority', filters.priority);
        }
        if (filters.date_from) {
          query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
          query = query.lte('created_at', filters.date_to);
        }
        if (filters.requested_by) {
          query = query.eq('requested_by', filters.requested_by);
        }
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }
      }

      const { data: approvals, error } = await query;

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      const userIds = [...new Set((approvals || []).map((a: any) => a.requested_by).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('user_profiles').select('user_id, full_name').in('user_id', userIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      const enriched = (approvals || []).map((a: any) => ({
        ...a,
        requester_name: profileMap[a.requested_by] || a.requester_name || null,
      }));

      return {
        success: true,
        data: enriched,
        meta: { timestamp: new Date().toISOString() }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  static async submitReviewAction(approvalId: string, action: 'REVIEWED' | 'REJECTED', comments?: string): Promise<ApiResponse<void>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };

      const { data: approval, error: approvalError } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (approvalError || !approval) return { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } };
      
      if (approval.review_status !== 'PENDING') {
        return { success: false, error: { code: 'INVALID_STATE', message: 'Approval is not pending review' } };
      }

      if (approval.reviewer_id && approval.reviewer_id !== user.id) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'You are not the designated reviewer' } };
      }

      const { error: actionError } = await supabase
        .from('approval_actions')
        .insert({
          approval_id: approvalId,
          action: action === 'REVIEWED' ? 'FORWARDED' : 'REJECTED', // Log review as a forwarded/rejected action
          approver_id: user.id,
          comments: comments || `Marked as ${action}`,
          organisation_id: approval.organisation_id
        });

      if (actionError) return { success: false, error: { code: 'DB_ERROR', message: actionError.message } };

      const updates: any = {
        review_status: action,
        reviewed_at: new Date().toISOString()
      };

      if (action === 'REJECTED') {
        updates.status = 'REJECTED'; // Rejecting review rejects the whole document
      }

      const { error: updateError } = await supabase
        .from('approvals')
        .update(updates)
        .eq('id', approvalId);

      if (updateError) return { success: false, error: { code: 'DB_ERROR', message: updateError.message } };

      return { success: true, meta: { timestamp: new Date().toISOString() } };
    } catch (error) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  static async processApproval(approvalId: string, action: ApprovalActionPayload): Promise<ApiResponse<void>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      const { data: approval, error: approvalError } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (approvalError || !approval) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } };
      }

      if (approval.status !== 'PENDING') {
        return { success: false, error: { code: 'INVALID_STATE', message: 'Approval is not in pending state' } };
      }

      if (approval.review_status === 'PENDING' && action.action !== 'RETURNED' && action.action !== 'REJECTED') {
        return { success: false, error: { code: 'REVIEW_PENDING', message: 'This document is pending review and cannot be approved yet.' } };
      }

      const { error: actionError } = await supabase
        .from('approval_actions')
        .insert({
          approval_id: approvalId,
          action: action.action,
          approver_id: user.id,
          comments: action.comments,
          organisation_id: approval.organisation_id
        });

      if (actionError) {
        return { success: false, error: { code: 'DB_ERROR', message: actionError.message } };
      }

      let newStatus = approval.status;
      let newLevel = approval.current_level;

      if (action.action === 'APPROVED') {
        if (approval.current_level >= approval.max_levels) {
          newStatus = 'APPROVED';
        } else {
          newLevel = approval.current_level + 1;
          await this.sendApprovalNotifications(approvalId, newLevel);
        }
      } else if (action.action === 'REJECTED') {
        newStatus = 'REJECTED';
      } else if (action.action === 'HOLD') {
        newStatus = 'HOLD';
      } else if (action.action === 'RETURNED') {
        newStatus = 'RETURNED';
      } else if (action.action === 'FORWARDED') {
        newStatus = 'FORWARDED';
      }

      const updateData: any = {
        status: newStatus,
        current_level: newLevel,
        updated_at: new Date().toISOString()
      };
      
      if (action.action === 'HOLD' && action.comments) {
        updateData.hold_reason = action.comments;
      } else if (action.action !== 'HOLD') {
        updateData.hold_reason = null; // Clear hold reason if moved out of hold
      }

      const { data: updated, error: updateError } = await supabase
        .from('approvals')
        .update(updateData)
        .eq('id', approvalId)
        .select()
        .maybeSingle();

      if (updateError || !updated) {
        return { success: false, error: { code: 'DB_ERROR', message: updateError?.message || 'Approval update failed' } };
      }

      if (newStatus === 'APPROVED') {
        await this.triggerPostApprovalActions(approval, action.amount_approved);
      }

      if (action.action === 'RETURNED') {
        await ApprovalNotificationService.sendReturnNotification(approvalId, action.comments);
        await this.markSourceDocumentAsReturned(approval, action.comments);
      }

      // Log to follow_up_activity_log
      try {
        const { data: userProfile } = await supabase
          .from('users')
          .select('emp_name')
          .eq('id', user.id)
          .maybeSingle();

        const actorName = userProfile?.emp_name || 'System';

        await supabase.from('follow_up_activity_log').insert({
          organisation_id: approval.organisation_id,
          reference_id: approval.reference_id,
          reference_label: approval.reference_type,
          event_type: 'approval_status_changed',
          title: `Approval ${action.action}`,
          description: action.comments || `Document was marked as ${action.action}`,
          actor_name: actorName,
          metadata: {
            approval_id: approval.id,
            action: action.action,
            amount_approved: action.amount_approved
          }
        });
      } catch (logError) {
        console.error('Failed to log approval activity', logError);
      }

      return {
        success: true,
        meta: { timestamp: new Date().toISOString() }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  static async getApprovalHistory(approvalId: string): Promise<ApiResponse<ApprovalActionLog[]>> {
    try {
      const { data: actions, error } = await supabase
        .from('approval_actions')
        .select(`*`)
        .eq('approval_id', approvalId)
        .order('action_at', { ascending: true });

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      // Fetch approver names from user_profiles
      const approverIds = [...new Set((actions || []).map(a => a.approver_id).filter(Boolean))];
      const { data: profiles } = approverIds.length > 0
        ? await supabase.from('user_profiles').select('user_id, full_name').in('user_id', approverIds)
        : { data: [] };

      const actionsWithApprovers = (actions || []).map(action => {
        const profile = profiles?.find(p => p.user_id === action.approver_id);
        return {
          ...action,
          approver: profile ? { name: profile.full_name } : undefined
        };
      });

      return {
        success: true,
        data: actionsWithApprovers,
        meta: { timestamp: new Date().toISOString() }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  static async getApprovalStats(): Promise<ApiResponse<ApprovalStats>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      const { data: stats, error } = await supabase
        .from('approval_stats')
        .select('*')
        .eq('organisation_id', organisationId)
        .single();

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      return {
        success: true,
        data: stats as ApprovalStats,
        meta: { timestamp: new Date().toISOString() }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private static async sendApprovalNotifications(approvalId: string, level?: number) {
    try {
      const { data: approval } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (!approval) return;

      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('approval_type', approval.approval_type)
        .eq('level', level || approval.current_level)
        .eq('is_active', true)
        .eq('organisation_id', approval.organisation_id);

      if (!workflows || workflows.length === 0) return;

      for (const workflow of workflows) {
        if (workflow.approver_id) {
          await supabase
            .from('approval_notifications')
            .insert({
              approval_id: approvalId,
              user_id: workflow.approver_id,
              notification_type: 'IN_APP',
              organisation_id: approval.organisation_id
            });
        }
      }

    } catch (error) {
      console.error('Error sending approval notifications:', error);
    }
  }

  private static async triggerPostApprovalActions(approval: Approval, amountApproved?: number) {
    try {
      switch (approval.reference_type) {
        case 'purchase_orders':
          await supabase.from('purchase_orders').update({ status: 'APPROVED' }).eq('id', approval.reference_id);
          break;
        case 'work_orders':
          await supabase.from('subcontractor_work_orders').update({ status: 'APPROVED' }).eq('id', approval.reference_id);
          break;
        case 'invoices':
          await supabase.from('invoices').update({ status: 'APPROVED' }).eq('id', approval.reference_id);
          break;
        case 'quotations':
          await supabase.from('quotation_header').update({ status: 'Approved' }).eq('id', approval.reference_id);
          break;
        case 'payment_requests':
          await supabase.from('payment_requests').update({
            status: 'Approved',
            approved_at: new Date().toISOString(),
            ...(amountApproved !== undefined ? { amount_approved: amountApproved } : {})
          }).eq('id', approval.reference_id);
          break;
        case 'purchase_payments':
          await supabase.from('purchase_payments').update({
            workflow_step: 'approved',
            approval_status: 'Approved',
            approved_at: new Date().toISOString(),
            ...(amountApproved !== undefined ? { amount_approved: amountApproved } : {})
          }).eq('id', approval.reference_id);
          break;
        case 'subcontractor_payments':
          await supabase.from('subcontractor_payments').update({
            workflow_step: 'approved',
            approval_status: 'Approved',
            approved_at: new Date().toISOString(),
            ...(amountApproved !== undefined ? { amount_approved: amountApproved } : {})
          }).eq('id', approval.reference_id);
          break;
      }
    } catch (error) {
      console.error('Error triggering post-approval actions:', error);
    }
  }

  static async getApprovalWorkflows(): Promise<ApiResponse<ApprovalWorkflow[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      const { data: workflows, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('approval_type', { ascending: true })
        .order('level', { ascending: true });

      if (workflows) {
        const userIds = workflows.map((w: any) => w.approver_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: userRows } = await supabase
            .from('users')
            .select('id, emp_name')
            .in('id', userIds);
          const nameMap = Object.fromEntries((userRows ?? []).map((u: any) => [u.id, u.emp_name]));
          for (const w of workflows) {
            (w as any).approver_name = nameMap[w.approver_id] ?? null;
          }
        }
      }

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      return {
        success: true,
        data: workflows || [],
        meta: { timestamp: new Date().toISOString() }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private static async enrichApprovalMetadata(
    userId: string,
    organisationId: string,
    referenceType: string,
    referenceId: string
  ): Promise<{
    requester_name?: string | null;
    requester_role?: string | null;
    project_id?: string | null;
    project_name?: string | null;
    client_name?: string | null;
    reference_number?: string | null;
    required_date?: string | null;
  }> {
    try {
      const [profileRes, memberRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('full_name, role')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('org_members')
          .select('role')
          .eq('user_id', userId)
          .eq('organisation_id', organisationId)
          .maybeSingle(),
      ]);

      const requesterName = profileRes.data?.full_name ?? null;
      const requesterRole = memberRes.data?.role ?? profileRes.data?.role ?? null;

      const refSpec = REFERENCE_DENORM_MAP[referenceType];
      let projectId: string | null = null;
      let projectName: string | null = null;
      let clientName: string | null = null;
      let referenceNumber: string | null = null;
      let requiredDate: string | null = null;

      if (refSpec && referenceId) {
        const { data: refRow } = await supabase
          .from(refSpec.table)
          .select(refSpec.select)
          .eq('id', referenceId)
          .maybeSingle();

        if (refRow) {
          projectId = (refRow as any).project_id ?? null;
          projectName = (refRow as any).project?.name ?? (refRow as any).project?.project_name ?? null;
          clientName = (refRow as any).client?.name ?? (refRow as any).client?.client_name ?? null;
          
          if (!projectName) {
              projectName = clientName;
          }
          
          referenceNumber = refSpec.numberField
            ? (refRow as any)[refSpec.numberField] ?? null
            : null;
            
          requiredDate = (refRow as any).due_date ?? (refRow as any).request_date ?? null;
        }
      }

      return {
        requester_name: requesterName,
        requester_role: requesterRole,
        project_id: projectId,
        project_name: projectName,
        client_name: clientName,
        reference_number: referenceNumber,
        required_date: requiredDate,
      };
    } catch (e) {
      console.error('enrichApprovalMetadata failed', e);
      return {};
    }
  }
}

const REFERENCE_DENORM_MAP: Record<
  string,
  { table: string; select: string; numberField: string | null }
> = {
  payment_requests:       { table: 'payment_requests',       select: 'client_id, client:clients(name), project_id, project:projects(name), request_no, request_date, due_date', numberField: 'request_no' },
  purchase_payments:      { table: 'purchase_payments',      select: 'client_id, client:clients(name), project_id, project:projects(name), voucher_no',  numberField: 'voucher_no'  },
  subcontractor_payments: { table: 'subcontractor_payments', select: 'client_id, client:clients(name), project_id, project:projects(name), voucher_no',  numberField: 'voucher_no'  },
  purchase_orders:        { table: 'purchase_orders',        select: 'project_id, project:projects(name), po_number',   numberField: 'po_number'   },
  work_orders:            { table: 'subcontractor_work_orders',            select: 'project_id, project:projects(name), work_order_no',   numberField: 'work_order_no'   },
  invoices:               { table: 'invoices',               select: 'project_id, project:projects(name), invoice_number', numberField: 'invoice_number' },
  quotations:             { table: 'quotation_header',       select: 'client_id, client:clients(client_name), project_id, project:projects(name), quotation_no', numberField: 'quotation_no' },
  material_dispatches:    { table: 'material_dispatches',    select: 'project_id, project:projects(name), dispatch_number', numberField: 'dispatch_number' },
};

export class ApprovalExtensions {
  static async resubmitApproval(approvalId: string, notes?: string): Promise<ApiResponse<void>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      
      const { data: approval } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();
        
      if (!approval) return { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } };

      const { error: updateError } = await supabase
        .from('approvals')
        .update({
          status: 'PENDING',
          is_resubmitted: true,
          resubmission_notes: notes,
          current_level: 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', approvalId);

      if (updateError) throw updateError;

      await supabase.from('approval_actions').insert({
        approval_id: approvalId,
        action: 'RESUBMITTED',
        approver_id: user.id,
        comments: notes,
        organisation_id: approval.organisation_id
      });

      await this.markSourceDocumentAsPending(approval);

      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  private static async markSourceDocumentAsReturned(approval: any, reason?: string): Promise<void> {
    try {
      const updateData: Record<string, any> = { approval_status: 'Revision Requested' };

      switch (approval.reference_type) {
        case 'quotations':
          await supabase.from('quotation_header').update(updateData).eq('id', approval.reference_id);
          break;
        case 'purchase_orders':
          await supabase.from('purchase_orders').update(updateData).eq('id', approval.reference_id);
          break;
        case 'work_orders':
          await supabase.from('subcontractor_work_orders').update(updateData).eq('id', approval.reference_id);
          break;
        case 'invoices':
          await supabase.from('invoices').update(updateData).eq('id', approval.reference_id);
          break;
        case 'payment_requests':
          await supabase.from('payment_requests').update(updateData).eq('id', approval.reference_id);
          break;
        case 'purchase_payments':
          await supabase.from('purchase_payments').update(updateData).eq('id', approval.reference_id);
          break;
        case 'subcontractor_payments':
          await supabase.from('subcontractor_payments').update(updateData).eq('id', approval.reference_id);
          break;
      }
    } catch (error) {
      console.error('Error marking source document as returned:', error);
    }
  }

  private static async markSourceDocumentAsPending(approval: any): Promise<void> {
    try {
      const updateData: Record<string, any> = { approval_status: 'Pending' };

      switch (approval.reference_type) {
        case 'quotations':
          await supabase.from('quotation_header').update(updateData).eq('id', approval.reference_id);
          break;
        case 'purchase_orders':
          await supabase.from('purchase_orders').update(updateData).eq('id', approval.reference_id);
          break;
        case 'work_orders':
          await supabase.from('subcontractor_work_orders').update(updateData).eq('id', approval.reference_id);
          break;
        case 'invoices':
          await supabase.from('invoices').update(updateData).eq('id', approval.reference_id);
          break;
        case 'payment_requests':
          await supabase.from('payment_requests').update(updateData).eq('id', approval.reference_id);
          break;
        case 'purchase_payments':
          await supabase.from('purchase_payments').update(updateData).eq('id', approval.reference_id);
          break;
        case 'subcontractor_payments':
          await supabase.from('subcontractor_payments').update(updateData).eq('id', approval.reference_id);
          break;
      }
    } catch (error) {
      console.error('Error marking source document as pending:', error);
    }
  }

  static async getVendorHolds(vendorId: string): Promise<ApiResponse<any[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      
      const { data: holds, error } = await supabase
        .from('payment_requests')
        .select('id, request_no, approvals!inner(id, status, hold_reason)')
        .eq('vendor_id', vendorId)
        .eq('approvals.status', 'HOLD');

      if (error) throw error;

      return { success: true, data: holds || [] };
    } catch (error) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }
}
