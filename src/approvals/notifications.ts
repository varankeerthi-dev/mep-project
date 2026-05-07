import { supabase } from '../lib/supabase';
import { Approval, ApprovalNotification } from '../types/approvals';

export class ApprovalNotificationService {
  /**
   * Send approval notifications to relevant users
   */
  static async sendApprovalNotifications(approvalId: string, level?: number): Promise<void> {
    try {
      // Get approval details
      const { data: approval } = await supabase
        .from('approvals')
        .select(`
          *,
          requester:users(name, email)
        `)
        .eq('id', approvalId)
        .single();

      if (!approval) return;

      // Get approvers for current/next level
      const targetLevel = level || approval.current_level;
      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select(`
          *,
          approver:users(name, email, phone)
        `)
        .eq('approval_type', approval.approval_type)
        .eq('level', targetLevel)
        .eq('is_active', true)
        .eq('organisation_id', approval.organisation_id);

      if (!workflows || workflows.length === 0) return;

      // Send notifications to each approver
      for (const workflow of workflows) {
        if (workflow.approver_id && workflow.approver) {
          await this.createNotification(approvalId, workflow.approver_id, 'IN_APP');
          
          // Send email notification
          await this.sendEmailNotification(approval, workflow.approver);
          
          // Send SMS for urgent approvals
          if (approval.priority === 'URGENT' && workflow.approver.phone) {
            await this.sendSMSNotification(approval, workflow.approver);
          }
        }
      }
    } catch (error) {
      console.error('Error sending approval notifications:', error);
    }
  }

  /**
   * Create in-app notification
   */
  static async createNotification(
    approvalId: string, 
    userId: string, 
    type: 'EMAIL' | 'SMS' | 'IN_APP' = 'IN_APP'
  ): Promise<void> {
    try {
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
            user_id: userId,
            notification_type: type,
            organisation_id: approval.organisation_id
          });
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  /**
   * Send email notification
   */
  static async sendEmailNotification(approval: any, approver: any): Promise<void> {
    try {
      // This would integrate with your email service
      const emailData = {
        to: approver.email,
        subject: `Approval Required: ${approval.title}`,
        template: 'approval-request',
        data: {
          approverName: approver.name,
          approvalTitle: approval.title,
          approvalType: approval.approval_type,
          amount: approval.amount,
          priority: approval.priority,
          requestedBy: approval.requester?.name,
          requestedAt: new Date(approval.requested_at).toLocaleDateString(),
          approvalUrl: `${window.location.origin}/approvals?id=${approval.id}`
        }
      };

      // Example: await emailService.send(emailData);
      console.log('Email notification sent:', emailData);
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  /**
   * Send SMS notification
   */
  static async sendSMSNotification(approval: any, approver: any): Promise<void> {
    try {
      // This would integrate with your SMS service
      const smsData = {
        to: approver.phone,
        message: `URGENT: Approval required for ${approval.title} (${approval.approval_type}). Amount: ₹${approval.amount?.toLocaleString() || '0'}. Please check your email for details.`
      };

      // Example: await smsService.send(smsData);
      console.log('SMS notification sent:', smsData);
    } catch (error) {
      console.error('Error sending SMS notification:', error);
    }
  }

  /**
   * Send approval status change notifications
   */
  static async sendStatusChangeNotification(
    approvalId: string, 
    oldStatus: string, 
    newStatus: string,
    actionBy: string
  ): Promise<void> {
    try {
      // Get approval details
      const { data: approval } = await supabase
        .from('approvals')
        .select(`
          *,
          requester:users(name, email)
        `)
        .eq('id', approvalId)
        .single();

      if (!approval) return;

      // Notify requester about status change
      if (approval.requester) {
        await this.createNotification(approvalId, approval.requested_by, 'IN_APP');
        
        // Send email notification to requester
        await this.sendStatusChangeEmail(approval, oldStatus, newStatus, approval.requester);
      }

      // If rejected, notify all previous approvers
      if (newStatus === 'REJECTED') {
        await this.notifyPreviousApprovers(approvalId, newStatus);
      }
    } catch (error) {
      console.error('Error sending status change notification:', error);
    }
  }

  /**
   * Send status change email
   */
  static async sendStatusChangeEmail(
    approval: any, 
    oldStatus: string, 
    newStatus: string,
    requester: any
  ): Promise<void> {
    try {
      const emailData = {
        to: requester.email,
        subject: `Approval ${newStatus.toLowerCase()}: ${approval.title}`,
        template: 'approval-status-change',
        data: {
          requesterName: requester.name,
          approvalTitle: approval.title,
          approvalType: approval.approval_type,
          oldStatus: oldStatus,
          newStatus: newStatus,
          amount: approval.amount,
          approvalUrl: `${window.location.origin}/approvals?id=${approval.id}`
        }
      };

      // Example: await emailService.send(emailData);
      console.log('Status change email sent:', emailData);
    } catch (error) {
      console.error('Error sending status change email:', error);
    }
  }

  /**
   * Notify previous approvers about rejection
   */
  static async notifyPreviousApprovers(approvalId: string, status: string): Promise<void> {
    try {
      // Get all previous approvers
      const { data: actions } = await supabase
        .from('approval_actions')
        .select(`
          approver_id,
          approver:users(name, email)
        `)
        .eq('approval_id', approvalId)
        .eq('action', 'APPROVED')
        .neq('approver_id', null);

      if (!actions || actions.length === 0) return;

      // Notify each previous approver
      for (const action of actions) {
        if (action.approver_id && action.approver) {
          await this.createNotification(approvalId, action.approver_id, 'IN_APP');
          
          // Send email notification
          await this.sendRejectionEmailToApprovers(approvalId, action.approver);
        }
      }
    } catch (error) {
      console.error('Error notifying previous approvers:', error);
    }
  }

  /**
   * Send rejection email to approvers
   */
  static async sendRejectionEmailToApprovers(approvalId: string, approver: any): Promise<void> {
    try {
      const { data: approval } = await supabase
        .from('approvals')
        .select('title, approval_type, amount')
        .eq('id', approvalId)
        .single();

      if (!approval) return;

      const emailData = {
        to: approver.email,
        subject: `Approval Rejected: ${approval.title}`,
        template: 'approval-rejected',
        data: {
          approverName: approver.name,
          approvalTitle: approval.title,
          approvalType: approval.approval_type,
          amount: approval.amount,
          approvalUrl: `${window.location.origin}/approvals?id=${approvalId}`
        }
      };

      // Example: await emailService.send(emailData);
      console.log('Rejection email sent to approver:', emailData);
    } catch (error) {
      console.error('Error sending rejection email to approvers:', error);
    }
  }

  /**
   * Get unread notifications for user
   */
  static async getUnreadNotifications(userId: string): Promise<ApprovalNotification[]> {
    try {
      const { data: notifications } = await supabase
        .from('approval_notifications')
        .select(`
          *,
          approval:approvals(id, title, approval_type, status, amount, priority)
        `)
        .eq('user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false });

      return notifications || [];
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await supabase
        .from('approval_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read for user
   */
  static async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await supabase
        .from('approval_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  /**
   * Get notification count for user
   */
  static async getNotificationCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('approval_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      return count || 0;
    } catch (error) {
      console.error('Error getting notification count:', error);
      return 0;
    }
  }

  /**
   * Send daily approval summary
   */
  static async sendDailyApprovalSummary(userId: string): Promise<void> {
    try {
      // Get user's pending approvals
      const { data: pendingApprovals } = await supabase
        .from('approvals')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (!pendingApprovals || pendingApprovals.length === 0) return;

      // Get user details
      const { data: user } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', userId)
        .single();

      if (!user) return;

      const emailData = {
        to: user.email,
        subject: 'Daily Approval Summary',
        template: 'daily-approval-summary',
        data: {
          userName: user.name,
          pendingCount: pendingApprovals.length,
          approvals: pendingApprovals.slice(0, 10), // Limit to 10 most recent
          approvalUrl: `${window.location.origin}/approvals`
        }
      };

      // Example: await emailService.send(emailData);
      console.log('Daily approval summary sent:', emailData);
    } catch (error) {
      console.error('Error sending daily approval summary:', error);
    }
  }

  /**
   * Send overdue approval reminders
   */
  static async sendOverdueReminders(): Promise<void> {
    try {
      // Get approvals older than 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: overdueApprovals } = await supabase
        .from('approvals')
        .select('*')
        .eq('status', 'PENDING')
        .lt('created_at', yesterday.toISOString());

      if (!overdueApprovals || overdueApprovals.length === 0) return;

      // Group by current approvers
      for (const approval of overdueApprovals) {
        await this.sendApprovalNotifications(approval.id, approval.current_level);
      }
    } catch (error) {
      console.error('Error sending overdue reminders:', error);
    }
  }

  /**
   * Send escalation notifications for urgent approvals
   */
  static async sendEscalationNotifications(approvalId: string): Promise<void> {
    try {
      // Get approval details
      const { data: approval } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (!approval || approval.priority !== 'URGENT') return;

      // Get next level approvers for escalation
      const nextLevel = approval.current_level + 1;
      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select(`
          *,
          approver:users(name, email)
        `)
        .eq('approval_type', approval.approval_type)
        .eq('level', nextLevel)
        .eq('is_active', true)
        .eq('organisation_id', approval.organisation_id);

      if (!workflows || workflows.length === 0) return;

      // Send escalation notifications
      for (const workflow of workflows) {
        if (workflow.approver_id && workflow.approver) {
          await this.createNotification(approvalId, workflow.approver_id, 'IN_APP');
          
          const emailData = {
            to: workflow.approver.email,
            subject: `ESCALATION: Urgent Approval Pending - ${approval.title}`,
            template: 'approval-escalation',
            data: {
              approverName: workflow.approver.name,
              approvalTitle: approval.title,
              approvalType: approval.approval_type,
              amount: approval.amount,
              currentLevel: approval.current_level,
              maxLevel: approval.max_levels,
              pendingSince: new Date(approval.created_at).toLocaleDateString(),
              approvalUrl: `${window.location.origin}/approvals?id=${approval.id}`
            }
          };

          // Example: await emailService.send(emailData);
          console.log('Escalation notification sent:', emailData);
        }
      }
    } catch (error) {
      console.error('Error sending escalation notifications:', error);
    }
  }
}
