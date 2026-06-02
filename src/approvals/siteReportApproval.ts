import { supabase } from '@/lib/supabase';

export type SiteReportApprovalAction = 'APPROVED' | 'REJECTED' | 'HOLD' | 'FORWARDED';

export type SiteReportApprovalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ApprovableMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export interface CreateSiteReportApprovalInput {
  reportId: string;
  approverId: string;
  organisationId: string;
  engineerId: string;
  engineerName: string;
  reportDate: string;
  projectName?: string | null;
  clientName?: string | null;
  priority?: SiteReportApprovalPriority;
  comments?: string;
}

export interface SiteReportApprovalRow {
  id: string;
  approval_type: 'SITE_REPORT_REQUEST';
  reference_id: string;
  reference_type: 'site_reports';
  title: string;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD' | 'FORWARDED';
  priority: SiteReportApprovalPriority;
  requested_by: string;
  requested_at: string;
  current_level: number;
  max_levels: number;
  assigned_approver_id: string | null;
  organisation_id: string;
  created_at: string;
  updated_at: string;
  site_report?: {
    id: string;
    report_date: string;
    engineer_name: string | null;
    pm_status: string | null;
    projects?: { project_name: string } | { project_name: string }[] | null;
    clients?: { client_name: string } | { client_name: string }[] | null;
  } | null;
}

export class SiteReportApprovalApi {
  static async listApprovableMembers(organisationId: string): Promise<ApprovableMember[]> {
    const { data, error } = await supabase.rpc('get_approvable_members_for_org', {
      p_organisation_id: organisationId,
    });
    if (error) {
      console.error('listApprovableMembers error:', error);
      return [];
    }
    return (data || []) as ApprovableMember[];
  }

  static async createApprovalRequest(
    input: CreateSiteReportApprovalInput
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const title = `Site Report — ${input.engineerName} — ${input.reportDate}`;
      const descriptionParts: string[] = [];
      if (input.clientName) descriptionParts.push(`Client: ${input.clientName}`);
      if (input.projectName) descriptionParts.push(`Project: ${input.projectName}`);
      if (input.engineerName) descriptionParts.push(`Engineer: ${input.engineerName}`);
      if (input.comments) descriptionParts.push(`Note: ${input.comments}`);

      const { data, error } = await supabase
        .from('approvals')
        .insert({
          approval_type: 'SITE_REPORT_REQUEST',
          reference_id: input.reportId,
          reference_type: 'site_reports',
          title,
          description: descriptionParts.join(' · ') || null,
          currency: 'INR',
          priority: input.priority || 'NORMAL',
          requested_by: input.engineerId,
          max_levels: 1,
          current_level: 1,
          status: 'PENDING',
          assigned_approver_id: input.approverId,
          organisation_id: input.organisationId,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase
        .from('approval_notifications')
        .insert({
          approval_id: data.id,
          user_id: input.approverId,
          notification_type: 'IN_APP',
          organisation_id: input.organisationId,
        })
        .then(
          () => undefined,
          () => undefined
        );

      return { success: true, approvalId: data.id };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Unknown error' };
    }
  }

  static async listPendingApprovalsForApprover(
    approverUserId: string,
    organisationId: string
  ): Promise<SiteReportApprovalRow[]> {
    const { data, error } = await supabase
      .from('approvals')
      .select(
        `
        *,
        site_report:site_reports!approvals_reference_id_fkey(
          id, report_date, engineer_name, pm_status,
          projects:project_id ( project_name ),
          clients:client_id ( client_name )
        )
        `
      )
      .eq('approval_type', 'SITE_REPORT_REQUEST')
      .eq('status', 'PENDING')
      .eq('assigned_approver_id', approverUserId)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('listPendingApprovalsForApprover error:', error);
      return [];
    }
    return (data || []) as SiteReportApprovalRow[];
  }

  static async listAllPendingForOrg(organisationId: string): Promise<SiteReportApprovalRow[]> {
    const { data, error } = await supabase
      .from('approvals')
      .select(
        `
        *,
        site_report:site_reports!approvals_reference_id_fkey(
          id, report_date, engineer_name, pm_status,
          projects:project_id ( project_name ),
          clients:client_id ( client_name )
        )
        `
      )
      .eq('approval_type', 'SITE_REPORT_REQUEST')
      .eq('status', 'PENDING')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('listAllPendingForOrg error:', error);
      return [];
    }
    return (data || []) as SiteReportApprovalRow[];
  }

  static async processAction(
    approvalId: string,
    action: SiteReportApprovalAction,
    approverUserId: string,
    comments?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: approval, error: approvalErr } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (approvalErr || !approval) {
        return { success: false, error: approvalErr?.message || 'Approval not found' };
      }

      if (approval.status !== 'PENDING') {
        return { success: false, error: 'Approval is not in pending state' };
      }

      if (approval.assigned_approver_id && approval.assigned_approver_id !== approverUserId) {
        return { success: false, error: 'You are not the assigned approver for this request' };
      }

      const { error: actionErr } = await supabase
        .from('approval_actions')
        .insert({
          approval_id: approvalId,
          action,
          approver_id: approverUserId,
          comments: comments || null,
          organisation_id: approval.organisation_id,
        });

      if (actionErr) {
        return { success: false, error: actionErr.message };
      }

      let newApprovalStatus: 'APPROVED' | 'REJECTED' | 'HOLD' | 'FORWARDED';
      if (action === 'APPROVED') newApprovalStatus = 'APPROVED';
      else if (action === 'REJECTED') newApprovalStatus = 'REJECTED';
      else if (action === 'HOLD') newApprovalStatus = 'HOLD';
      else newApprovalStatus = 'FORWARDED';

      const { error: updateErr } = await supabase
        .from('approvals')
        .update({
          status: newApprovalStatus,
          current_level: action === 'APPROVED' ? approval.max_levels : approval.current_level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      if (approval.reference_type === 'site_reports' && approval.reference_id) {
        let newPmStatus: string | null = null;
        if (action === 'APPROVED') newPmStatus = 'Approved';
        else if (action === 'REJECTED') newPmStatus = 'Rejected';
        else if (action === 'HOLD') newPmStatus = 'On Hold';

        if (newPmStatus) {
          await supabase
            .from('site_reports')
            .update({ pm_status: newPmStatus })
            .eq('id', approval.reference_id)
            .then(
              () => undefined,
              (e: any) => console.error('Failed to update site_reports.pm_status:', e)
            );
        }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Unknown error' };
    }
  }

  static async getApprovalForReport(
    reportId: string
  ): Promise<SiteReportApprovalRow | null> {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('approval_type', 'SITE_REPORT_REQUEST')
      .eq('reference_id', reportId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('getApprovalForReport error:', error);
      return null;
    }
    return (data || null) as SiteReportApprovalRow | null;
  }
}
