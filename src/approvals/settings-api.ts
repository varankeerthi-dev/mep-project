import { supabase } from '../lib/supabase';

export interface ApprovalApprover {
  id: string;
  user_id: string;
  designation: string;
  department?: string;
  email_address?: string;
  phone_number?: string;
  is_active: boolean;
  approval_types: string[];
  max_approval_amount?: number;
  organisation_id: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export interface ApprovalSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description?: string;
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export class ApprovalSettingsAPI {
  // Get all approvers for organisation
  static async getApprovers(): Promise<{ success: boolean; data?: ApprovalApprover[]; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      const { data: approvers, error } = await supabase
        .from('approvers_details')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: approvers || [] };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Add new approver
  static async addApprover(approverData: Omit<ApprovalApprover, 'id' | 'created_at' | 'updated_at' | 'user_name' | 'user_email' | 'user_avatar'>): Promise<{ success: boolean; data?: ApprovalApprover; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      const { data: approver, error } = await supabase
        .from('approval_approvers')
        .insert({
          ...approverData,
          organisation_id: userOrg.organisation_id
        })
        .select(`
          *,
          user:users(name, email, avatar_url)
        `)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Update workflow to use this approver
      if (approver && approverData.approval_types.length > 0) {
        await this.updateWorkflowsForApprover(approver.id, approverData);
      }

      return { success: true, data: approver };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Update existing approver
  static async updateApprover(approverId: string, updates: Partial<ApprovalApprover>): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('approval_approvers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', approverId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Update workflows if approval types changed
      if (updates.approval_types) {
        await this.updateWorkflowsForApprover(approverId, updates as ApprovalApprover);
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Delete approver
  static async deleteApprover(approverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // First update workflows to remove this approver
      await supabase
        .from('approval_workflows')
        .update({ approver_id: null })
        .eq('approver_id', approverId);

      // Then delete the approver
      const { error } = await supabase
        .from('approval_approvers')
        .delete()
        .eq('id', approverId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Toggle approver active status
  static async toggleApproverStatus(approverId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('approval_approvers')
        .update({ 
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', approverId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get approval settings
  static async getApprovalSettings(): Promise<{ success: boolean; data?: ApprovalSetting[]; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      const { data: settings, error } = await supabase
        .from('approval_settings')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: settings || [] };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Update approval setting
  static async updateApprovalSetting(settingKey: string, settingValue: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      const { error } = await supabase
        .from('approval_settings')
        .upsert({
          setting_key: settingKey,
          setting_value: settingValue,
          organisation_id: userOrg.organisation_id,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)
        .eq('organisation_id', userOrg.organisation_id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get employees for approver selection
  static async getEmployees(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      // Get all users in the organisation
      const { data: employees, error } = await supabase
        .from('user_organisations')
        .select(`
          user:users(id, name, email, avatar_url)
        `)
        .eq('organisation_id', userOrg.organisation_id);

      if (error) {
        return { success: false, error: error.message };
      }

      const employeeList = employees?.map(uo => uo.user) || [];
      return { success: true, data: employeeList };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get available designations
  static async getDesignations(): Promise<{ success: boolean; data?: string[]; error?: string }> {
    try {
      const designations = [
        'Project Manager',
        'General Manager',
        'Director',
        'Accounts Manager',
        'Purchase Manager',
        'Operations Manager',
        'Site Manager',
        'Finance Manager',
        'Admin',
        'CEO'
      ];

      return { success: true, data: designations };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Update workflows for approver
  private static async updateWorkflowsForApprover(approverId: string, approverData: ApprovalApprover): Promise<void> {
    try {
      // Delete existing workflows for this approver
      await supabase
        .from('approval_workflows')
        .delete()
        .eq('approver_id', approverId);

      // Create new workflows based on approval types
      for (const approvalType of approverData.approval_types) {
        await supabase
          .from('approval_workflows')
          .insert({
            approval_type: approvalType,
            level: 1, // This should be configurable
            min_amount: 0,
            max_amount: approverData.max_approval_amount,
            approver_designation: approverData.designation,
            approver_id: approverId,
            is_active: approverData.is_active,
            organisation_id: approverData.organisation_id
          });
      }
    } catch (error) {
      console.error('Error updating workflows for approver:', error);
    }
  }

  // Get approver by user ID
  static async getApproverByUserId(userId: string): Promise<{ success: boolean; data?: ApprovalApprover; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      const { data: approver, error } = await supabase
        .from('approvers_details')
        .select('*')
        .eq('user_id', userId)
        .eq('organisation_id', userOrg.organisation_id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: approver };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get approval statistics for approver
  static async getApproverStats(approverId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get user's organisation
      const { data: userOrg } = await supabase
        .from('user_organisations')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrg) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      // Get approvals where this user is the approver
      const { data: approvals, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('organisation_id', userOrg.organisation_id)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      // Calculate stats
      const stats = {
        total_approvals: approvals?.length || 0,
        pending_approvals: approvals?.filter(a => a.status === 'PENDING').length || 0,
        approved_approvals: approvals?.filter(a => a.status === 'APPROVED').length || 0,
        rejected_approvals: approvals?.filter(a => a.status === 'REJECTED').length || 0,
        hold_approvals: approvals?.filter(a => a.status === 'HOLD').length || 0
      };

      return { success: true, data: stats };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
