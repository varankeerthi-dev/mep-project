import { supabase } from '../lib/supabase';
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
  // Create a new approval request
  static async createApprovalRequest(data: ApprovalRequest): Promise<ApiResponse<Approval>> {
    try {
      // Get current user and organisation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      // Get workflow configuration for this approval type and amount
      const { data: workflow } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('approval_type', data.approval_type)
        .lte('min_amount', data.amount || 0)
        .or(`max_amount.is.null,max_amount.gte.${data.amount || 0}`)
        .eq('is_active', true)
        .eq('organisation_id', userOrg.organisation_id)
        .order('level', { ascending: false })
        .limit(1)
        .single();

      const maxLevels = workflow ? workflow.level : 1;

      // Create the approval
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
          organisation_id: userOrg.organisation_id
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      // Send notifications to approvers
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

  // Get approvals for current user
  static async getApprovalsForUser(filters?: ApprovalFilters): Promise<ApiResponse<Approval[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      let query = supabase
        .from('approvals')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id)
        .order('created_at', { ascending: false });

      // Apply filters
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

  // Process approval action (approve/reject/hold/forward)
  static async processApproval(approvalId: string, action: ApprovalActionRequest): Promise<ApiResponse<void>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      // Get approval details
      const { data: approval, error: approvalError } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (approvalError || !approval) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } };
      }

      // Check if approval is still pending
      if (approval.status !== 'PENDING') {
        return { success: false, error: { code: 'INVALID_STATE', message: 'Approval is not in pending state' } };
      }

      // Log the action
      const { error: actionError } = await supabase
        .from('approval_actions')
        .insert({
          approval_id: approvalId,
          action: action.action,
          approver_id: user.id,
          comments: action.comments,
          ip_address: '127.0.0.1', // TODO: Get actual IP
          user_agent: navigator.userAgent,
          organisation_id: approval.organisation_id
        });

      if (actionError) {
        return { success: false, error: { code: 'DB_ERROR', message: actionError.message } };
      }

      // Update approval status
      let newStatus = approval.status;
      let newLevel = approval.current_level;

      if (action.action === 'APPROVED') {
        if (approval.current_level >= approval.max_levels) {
          newStatus = 'APPROVED';
        } else {
          newLevel = approval.current_level + 1;
          // Send notification to next level approver
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

      // If approved, trigger post-approval actions
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

  // Get approval history
  static async getApprovalHistory(approvalId: string): Promise<ApiResponse<ApprovalActionLog[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

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

  // Get approval statistics
  static async getApprovalStats(): Promise<ApiResponse<ApprovalStats>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      const { data: stats, error } = await supabase
        .from('approval_stats')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id)
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

  // Send approval notifications
  private static async sendApprovalNotifications(approvalId: string, level?: number) {
    try {
      // Get approval details
      const { data: approval } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (!approval) return;

      // Get approvers for this level
      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('approval_type', approval.approval_type)
        .eq('level', level || approval.current_level)
        .eq('is_active', true)
        .eq('organisation_id', approval.organisation_id);

      if (!workflows || workflows.length === 0) return;

      // Create notifications for each approver
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

  // Trigger post-approval actions
  private static async triggerPostApprovalActions(approval: Approval) {
    try {
      // Update the reference document status
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
        // Add more cases as needed
      }

    } catch (error) {
      console.error('Error triggering post-approval actions:', error);
    }
  }

  // Get approval workflows for configuration
  static async getApprovalWorkflows(): Promise<ApiResponse<ApprovalWorkflow[]>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: { code: 'NO_ORG', message: 'User not associated with any organisation' } };
      }

      const { data: workflows, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id)
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
}
