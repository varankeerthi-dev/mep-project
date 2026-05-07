import { supabase } from '../lib/supabase';
import { 
  Approval, 
  ApprovalAction, 
  ApprovalWorkflow, 
  ApprovalActionRequest 
} from '../types/approvals';

export class ApprovalWorkflowEngine {
  /**
   * Process an approval action through the workflow
   */
  static async processApprovalAction(
    approvalId: string, 
    action: ApprovalActionRequest,
    approverId: string
  ): Promise<{ success: boolean; message: string; nextLevel?: number }> {
    try {
      // Get approval details
      const { data: approval, error: approvalError } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (approvalError || !approval) {
        return { success: false, message: 'Approval not found' };
      }

      // Check if approval is still pending
      if (approval.status !== 'PENDING') {
        return { success: false, message: 'Approval is not in pending state' };
      }

      // Get workflow configuration
      const workflow = await this.getWorkflowForApproval(approval);
      if (!workflow) {
        return { success: false, message: 'No workflow configured for this approval type' };
      }

      // Log the action
      await this.logApprovalAction(approvalId, action, approverId, approval.organisation_id);

      // Process the action
      let newStatus = approval.status;
      let newLevel = approval.current_level;

      switch (action.action) {
        case 'APPROVED':
          if (approval.current_level >= approval.max_levels) {
            // Final approval
            newStatus = 'APPROVED';
            await this.finalizeApproval(approval);
          } else {
            // Move to next level
            newLevel = approval.current_level + 1;
            await this.moveToNextLevel(approvalId, newLevel);
          }
          break;

        case 'REJECTED':
          newStatus = 'REJECTED';
          await this.rejectApproval(approval);
          break;

        case 'HOLD':
          newStatus = 'HOLD';
          await this.holdApproval(approval);
          break;

        case 'FORWARDED':
          newStatus = 'FORWARDED';
          if (action.forward_to) {
            await this.forwardApproval(approvalId, action.forward_to);
          }
          break;

        default:
          return { success: false, message: 'Invalid action' };
      }

      // Update approval status
      const { error: updateError } = await supabase
        .from('approvals')
        .update({
          status: newStatus,
          current_level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', approvalId);

      if (updateError) {
        return { success: false, message: 'Failed to update approval status' };
      }

      // Send notifications
      await this.sendWorkflowNotifications(approval, action, newLevel);

      return { 
        success: true, 
        message: `Approval ${action.action.toLowerCase()} successfully`,
        nextLevel: newLevel
      };

    } catch (error) {
      console.error('Error processing approval action:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get workflow configuration for an approval
   */
  private static async getWorkflowForApproval(approval: Approval): Promise<ApprovalWorkflow | null> {
    try {
      const { data: workflow } = await supabase
        .from('approval_workflows')
        .select(`
          *,
          approver:approval_approvers!inner(
            user_id,
            designation,
            department,
            email_address,
            phone_number,
            is_active,
            approval_types,
            max_approval_amount,
            user:users(name, email, avatar_url)
          )
        `)
        .eq('approval_type', approval.approval_type)
        .eq('level', approval.current_level)
        .lte('min_amount', approval.amount || 0)
        .or(`max_amount.is.null,max_amount.gte.${approval.amount || 0}`)
        .eq('is_active', true)
        .eq('organisation_id', approval.organisation_id)
        .single();

      return workflow;
    } catch (error) {
      console.error('Error getting workflow:', error);
      return null;
    }
  }

  /**
   * Log approval action
   */
  private static async logApprovalAction(
    approvalId: string, 
    action: ApprovalActionRequest, 
    approverId: string,
    organisationId: string
  ): Promise<void> {
    try {
      await supabase
        .from('approval_actions')
        .insert({
          approval_id: approvalId,
          action: action.action,
          approver_id: approverId,
          comments: action.comments,
          ip_address: '127.0.0.1', // TODO: Get actual IP
          user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
          organisation_id: organisationId
        });
    } catch (error) {
      console.error('Error logging approval action:', error);
    }
  }

  /**
   * Move approval to next level
   */
  private static async moveToNextLevel(approvalId: string, nextLevel: number): Promise<void> {
    try {
      // Get next level approvers
      const { data: nextWorkflows } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('level', nextLevel)
        .eq('is_active', true);

      if (nextWorkflows && nextWorkflows.length > 0) {
        // Send notifications to next level approvers
        for (const workflow of nextWorkflows) {
          if (workflow.approver_id) {
            await supabase
              .from('approval_notifications')
              .insert({
                approval_id: approvalId,
                user_id: workflow.approver_id,
                notification_type: 'IN_APP',
                organisation_id: workflow.organisation_id
              });
          }
        }
      }
    } catch (error) {
      console.error('Error moving to next level:', error);
    }
  }

  /**
   * Finalize approval (last level approved)
   */
  private static async finalizeApproval(approval: Approval): Promise<void> {
    try {
      // Update the reference document status
      await this.updateReferenceDocument(approval, 'APPROVED');

      // Send final approval notifications
      await this.sendFinalApprovalNotifications(approval);

      // Trigger any post-approval workflows
      await this.triggerPostApprovalWorkflows(approval);
    } catch (error) {
      console.error('Error finalizing approval:', error);
    }
  }

  /**
   * Reject approval
   */
  private static async rejectApproval(approval: Approval): Promise<void> {
    try {
      // Update the reference document status
      await this.updateReferenceDocument(approval, 'REJECTED');

      // Send rejection notifications
      await this.sendRejectionNotifications(approval);
    } catch (error) {
      console.error('Error rejecting approval:', error);
    }
  }

  /**
   * Hold approval
   */
  private static async holdApproval(approval: Approval): Promise<void> {
    try {
      // Send hold notifications
      await this.sendHoldNotifications(approval);
    } catch (error) {
      console.error('Error holding approval:', error);
    }
  }

  /**
   * Forward approval
   */
  private static async forwardApproval(approvalId: string, forwardTo: string): Promise<void> {
    try {
      // Add notification for forwarded user
      const { data: approval } = await supabase
        .from('approvals')
        .select('organisation_id')
        .eq('id', approvalId)
        .single();

      if (approval) {
        await supabase
          .from('approval_notifications')
          .insert({
            approval_id: approvalId,
            user_id: forwardTo,
            notification_type: 'IN_APP',
            organisation_id: approval.organisation_id
          });
      }
    } catch (error) {
      console.error('Error forwarding approval:', error);
    }
  }

  /**
   * Update reference document status
   */
  private static async updateReferenceDocument(
    approval: Approval, 
    status: string
  ): Promise<void> {
    try {
      let tableName = '';
      
      switch (approval.reference_type) {
        case 'purchase_orders':
          tableName = 'purchase_orders';
          break;
        case 'work_orders':
          tableName = 'work_orders';
          break;
        case 'invoices':
          tableName = 'invoices';
          break;
        case 'quotations':
          tableName = 'quotations';
          break;
        case 'proforma_invoices':
          tableName = 'proforma_invoices';
          break;
        default:
          console.log('Unknown reference type:', approval.reference_type);
          return;
      }

      if (tableName) {
        await supabase
          .from(tableName)
          .update({ 
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', approval.reference_id);
      }
    } catch (error) {
      console.error('Error updating reference document:', error);
    }
  }

  /**
   * Send workflow notifications
   */
  private static async sendWorkflowNotifications(
    approval: Approval, 
    action: ApprovalActionRequest, 
    nextLevel?: number
  ): Promise<void> {
    try {
      // Send notification to requester
      await supabase
        .from('approval_notifications')
        .insert({
          approval_id: approval.id,
          user_id: approval.requested_by,
          notification_type: 'IN_APP',
          organisation_id: approval.organisation_id
        });

      // If moved to next level, notify next approvers
      if (action.action === 'APPROVED' && nextLevel) {
        await this.moveToNextLevel(approval.id, nextLevel);
      }
    } catch (error) {
      console.error('Error sending workflow notifications:', error);
    }
  }

  /**
   * Send final approval notifications
   */
  private static async sendFinalApprovalNotifications(approval: Approval): Promise<void> {
    try {
      // Notify requester
      await supabase
        .from('approval_notifications')
        .insert({
          approval_id: approval.id,
          user_id: approval.requested_by,
          notification_type: 'IN_APP',
          organisation_id: approval.organisation_id
        });
    } catch (error) {
      console.error('Error sending final approval notifications:', error);
    }
  }

  /**
   * Send rejection notifications
   */
  private static async sendRejectionNotifications(approval: Approval): Promise<void> {
    try {
      // Notify requester
      await supabase
        .from('approval_notifications')
        .insert({
          approval_id: approval.id,
          user_id: approval.requested_by,
          notification_type: 'IN_APP',
          organisation_id: approval.organisation_id
        });
    } catch (error) {
      console.error('Error sending rejection notifications:', error);
    }
  }

  /**
   * Send hold notifications
   */
  private static async sendHoldNotifications(approval: Approval): Promise<void> {
    try {
      // Notify requester
      await supabase
        .from('approval_notifications')
        .insert({
          approval_id: approval.id,
          user_id: approval.requested_by,
          notification_type: 'IN_APP',
          organisation_id: approval.organisation_id
        });
    } catch (error) {
      console.error('Error sending hold notifications:', error);
    }
  }

  /**
   * Trigger post-approval workflows
   */
  private static async triggerPostApprovalWorkflows(approval: Approval): Promise<void> {
    try {
      // Trigger any custom workflows based on approval type
      switch (approval.approval_type) {
        case 'PURCHASE_ORDER':
          await this.triggerPurchaseOrderWorkflows(approval);
          break;
        case 'WORK_ORDER':
          await this.triggerWorkOrderWorkflows(approval);
          break;
        case 'INVOICE':
          await this.triggerInvoiceWorkflows(approval);
          break;
        // Add more cases as needed
      }
    } catch (error) {
      console.error('Error triggering post-approval workflows:', error);
    }
  }

  /**
   * Trigger purchase order specific workflows
   */
  private static async triggerPurchaseOrderWorkflows(approval: Approval): Promise<void> {
    try {
      // Example: Create payment request for approved PO
      if (approval.amount && approval.amount > 0) {
        // This would integrate with payment request system
        console.log('Creating payment request for approved PO:', approval.id);
      }
    } catch (error) {
      console.error('Error triggering PO workflows:', error);
    }
  }

  /**
   * Trigger work order specific workflows
   */
  private static async triggerWorkOrderWorkflows(approval: Approval): Promise<void> {
    try {
      // Example: Notify subcontractor of approved work order
      console.log('Notifying subcontractor for approved WO:', approval.id);
    } catch (error) {
      console.error('Error triggering WO workflows:', error);
    }
  }

  /**
   * Trigger invoice specific workflows
   */
  private static async triggerInvoiceWorkflows(approval: Approval): Promise<void> {
    try {
      // Example: Send invoice to client
      console.log('Sending approved invoice to client:', approval.id);
    } catch (error) {
      console.error('Error triggering invoice workflows:', error);
    }
  }

  /**
   * Get approval history
   */
  static async getApprovalHistory(approvalId: string): Promise<any[]> {
    try {
      const { data: actions } = await supabase
        .from('approval_actions')
        .select(`
          *,
          approver:users(name, email)
        `)
        .eq('approval_id', approvalId)
        .order('action_at', { ascending: true });

      return actions || [];
    } catch (error) {
      console.error('Error getting approval history:', error);
      return [];
    }
  }

  /**
   * Get pending approvals for a user
   */
  static async getPendingApprovalsForUser(userId: string): Promise<Approval[]> {
    try {
      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', userId)
        .single();

      if (!userOrg) return [];

      // Get user's roles and workflows
      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('approver_id', userId)
        .eq('is_active', true)
        .eq('organisation_id', userOrg.organisation_id);

      if (!workflows || workflows.length === 0) return [];

      // Get approvals that match user's workflow levels
      const approvalTypes = [...new Set(workflows.map(w => w.approval_type))];
      const levels = [...new Set(workflows.map(w => w.level))];

      const { data: approvals } = await supabase
        .from('approvals')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id)
        .eq('status', 'PENDING')
        .in('approval_type', approvalTypes)
        .in('current_level', levels)
        .order('created_at', { ascending: false });

      return approvals || [];
    } catch (error) {
      console.error('Error getting pending approvals for user:', error);
      return [];
    }
  }
}
