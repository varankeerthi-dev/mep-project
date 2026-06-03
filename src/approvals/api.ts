import { supabase, currentOrgId } from '../lib/supabase';
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

      return {
        success: true,
        data: approvals || [],
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

  static async processApproval(approvalId: string, action: ApprovalActionRequest): Promise<ApiResponse<void>> {
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

      const { error: actionError } = await supabase
        .from('approval_actions')
        .insert({
          approval_id: approvalId,
          action: action.action,
          approver_id: user.id,
          comments: action.comments,
          ip_address: '127.0.0.1',
          user_agent: navigator.userAgent,
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
      } else if (action.action === 'FORWARDED') {
        newStatus = 'FORWARDED';
      }

      const { error: updateError } = await supabase
        .from('approvals')
        .update({
          status: newStatus,
          current_level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', approvalId);

      if (updateError) {
        return { success: false, error: { code: 'DB_ERROR', message: updateError.message } };
      }

      if (newStatus === 'APPROVED') {
        await this.triggerPostApprovalActions(approval);
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
        .select(`
          *,
          approver:users(name, email)
        `)
        .eq('approval_id', approvalId)
        .order('action_at', { ascending: true });

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      return {
        success: true,
        data: actions || [],
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

  private static async triggerPostApprovalActions(approval: Approval) {
    try {
      switch (approval.reference_type) {
        case 'purchase_orders':
          await supabase
            .from('purchase_orders')
            .update({ status: 'APPROVED' })
            .eq('id', approval.reference_id);
          break;
        case 'work_orders':
          await supabase
            .from('work_orders')
            .update({ status: 'APPROVED' })
            .eq('id', approval.reference_id);
          break;
        case 'invoices':
          await supabase
            .from('invoices')
            .update({ status: 'APPROVED' })
            .eq('id', approval.reference_id);
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
    reference_number?: string | null;
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
      let referenceNumber: string | null = null;

      if (refSpec && referenceId) {
        const { data: refRow } = await supabase
          .from(refSpec.table)
          .select(refSpec.select)
          .eq('id', referenceId)
          .maybeSingle();

        if (refRow) {
          projectId = (refRow as any).project_id ?? null;
          projectName = (refRow as any).project?.name ?? null;
          referenceNumber = refSpec.numberField
            ? (refRow as any)[refSpec.numberField] ?? null
            : null;
        }
      }

      return {
        requester_name: requesterName,
        requester_role: requesterRole,
        project_id: projectId,
        project_name: projectName,
        reference_number: referenceNumber,
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
  payment_requests:       { table: 'payment_requests',       select: 'project_id, project:projects(name), request_no', numberField: 'request_no' },
  purchase_payments:      { table: 'purchase_payments',      select: 'project_id, project:projects(name), voucher_no',  numberField: 'voucher_no'  },
  subcontractor_payments: { table: 'subcontractor_payments', select: 'project_id, project:projects(name), voucher_no',  numberField: 'voucher_no'  },
  purchase_orders:        { table: 'purchase_orders',        select: 'project_id, project:projects(name), po_number',   numberField: 'po_number'   },
  work_orders:            { table: 'work_orders',            select: 'project_id, project:projects(name), wo_number',   numberField: 'wo_number'   },
  invoices:               { table: 'invoices',               select: 'project_id, project:projects(name), invoice_number', numberField: 'invoice_number' },
  quotations:             { table: 'quotations',             select: 'project_id, project:projects(name), quotation_number', numberField: 'quotation_number' },
  material_dispatches:    { table: 'material_dispatches',    select: 'project_id, project:projects(name), dispatch_number', numberField: 'dispatch_number' },
};
