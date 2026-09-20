import { supabase } from '../../../supabase';

export const subcontractorService = {
  async getSubcontractors(organisationId: string, filter: string) {
    let query = supabase
      .from('subcontractors')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query = query.eq('status', 'Active');
    } else if (filter === 'inactive') {
      query = query.eq('status', 'Inactive');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getSubcontractor(id: string) {
    const { data, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async saveSubcontractor(payload: any, editMode: boolean, id?: string) {
    if (editMode && id) {
      const { data, error } = await supabase.rpc('record_subcontractor', {
        p_subcontractor_id: id,
        p_organisation_id: payload.organisation_id,
        p_company_name: payload.company_name,
        p_contact_person: payload.contact_person,
        p_phone: payload.phone,
        p_email: payload.email,
        p_address: payload.address,
        p_state: payload.state,
        p_gstin: payload.gstin,
        p_pincode: payload.pincode,
        p_pan_card: payload.pan_card,
        p_bank_name: payload.bank_name,
        p_bank_account_number: payload.bank_account_number,
        p_bank_ifsc_code: payload.bank_ifsc_code,
        p_bank_account_type: payload.bank_account_type,
        p_previous_projects: payload.previous_projects,
        p_nature_of_work: payload.nature_of_work,
        p_internal_remarks: payload.internal_remarks,
        p_nda_signed: payload.nda_signed,
        p_contract_signed: payload.contract_signed,
        p_nda_date: payload.nda_date,
        p_contract_date: payload.contract_date,
        p_status: payload.status
      });

      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase.rpc('record_subcontractor', {
        p_subcontractor_id: null,
        p_organisation_id: payload.organisation_id,
        p_company_name: payload.company_name,
        p_contact_person: payload.contact_person,
        p_phone: payload.phone,
        p_email: payload.email,
        p_address: payload.address,
        p_state: payload.state,
        p_gstin: payload.gstin,
        p_pincode: payload.pincode,
        p_pan_card: payload.pan_card,
        p_bank_name: payload.bank_name,
        p_bank_account_number: payload.bank_account_number,
        p_bank_ifsc_code: payload.bank_ifsc_code,
        p_bank_account_type: payload.bank_account_type,
        p_previous_projects: payload.previous_projects,
        p_nature_of_work: payload.nature_of_work,
        p_internal_remarks: payload.internal_remarks,
        p_nda_signed: payload.nda_signed,
        p_contract_signed: payload.contract_signed,
        p_nda_date: payload.nda_date,
        p_contract_date: payload.contract_date,
        p_status: payload.status
      });

      if (error) throw new Error(error.message);
      return data;
    }
  },

  async getWorkOrders(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('subcontractor_work_orders')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAmendments(workOrderIds: string[], organisationId: string) {
    if (!workOrderIds || workOrderIds.length === 0) return [];
    
    const { data, error } = await supabase
      .from('subcontractor_work_order_amendments')
      .select('*')
      .in('work_order_id', workOrderIds)
      .eq('organisation_id', organisationId)
      .eq('status', 'Approved')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getInvoices(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('subcontractor_invoices')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('invoice_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async generateRABill(payload: { organisation_id: string; work_order_id: string; measurement_sheet_id: string; invoice_date?: string; remarks?: string }) {
    const { data, error } = await supabase.rpc('generate_ra_bill', {
      p_organisation_id: payload.organisation_id,
      p_work_order_id: payload.work_order_id,
      p_measurement_sheet_id: payload.measurement_sheet_id,
      p_invoice_date: payload.invoice_date || null,
      p_remarks: payload.remarks || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async updateInvoiceStatus(invoiceId: string, organisationId: string, status: string) {
    const { data, error } = await supabase.rpc('update_invoice_status', {
      p_invoice_id: invoiceId,
      p_organisation_id: organisationId,
      p_status: status
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async finalizeRABill(invoiceId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('finalize_ra_bill', {
      p_invoice_id: invoiceId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getPayments(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('subcontractor_payments')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('payment_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAttendance(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('manpower_attendance')
      .select('*, labour_categories(id, name, code, unit), subcontractors(id, company_name)')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('attendance_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAttendanceByDateRange(organisationId: string, subcontractorId?: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('manpower_attendance')
      .select('*, labour_categories(id, name, code, unit), subcontractors(id, company_name)')
      .eq('organisation_id', organisationId);

    if (subcontractorId) {
      query = query.eq('subcontractor_id', subcontractorId);
    }

    if (startDate) {
      query = query.gte('attendance_date', startDate);
    }

    if (endDate) {
      query = query.lte('attendance_date', endDate);
    }

    const { data, error } = await query.order('attendance_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async saveAttendance(payload: any) {
    const { data, error } = await supabase.rpc('record_attendance', {
      p_organisation_id: payload.organisation_id,
      p_attendance_date: payload.attendance_date,
      p_labour_category_id: payload.labour_category_id,
      p_subcontractor_id: payload.subcontractor_id || null,
      p_client_id: payload.client_id || null,
      p_work_unit_id: payload.work_unit_id || null,
      p_work_unit_type: payload.work_unit_type || 'GENERAL',
      p_workers_count: payload.workers_count || 1,
      p_hours_worked: payload.hours_worked || 8,
      p_supervisor_name: payload.supervisor_name || null,
      p_applied_modifiers: payload.applied_modifiers || [],
      p_base_rate: payload.base_rate || 0,
      p_adjusted_rate: payload.adjusted_rate || 0,
      p_original_amount: payload.original_amount || 0,
      p_adjusted_amount: payload.adjusted_amount || 0,
      p_remarks: payload.remarks || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async updateAttendance(payload: any) {
    const { data, error } = await supabase.rpc('update_attendance', {
      p_attendance_id: payload.id,
      p_organisation_id: payload.organisation_id,
      p_workers_count: payload.workers_count,
      p_hours_worked: payload.hours_worked,
      p_supervisor_name: payload.supervisor_name || null,
      p_remarks: payload.remarks || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteAttendance(attendanceId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('delete_attendance', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async approveAttendance(attendanceId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('approve_attendance', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getDailyLogs(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('subcontractor_daily_logs')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('log_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getManpowerAttendance(subcontractorId: string) {
    const { data, error } = await supabase
      .from('manpower_attendance')
      .select('*, labour_categories(id, name, code, unit)')
      .eq('subcontractor_id', subcontractorId)
      .order('attendance_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getDocuments(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('subcontractor_documents')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async createDocument(payload: any) {
    const { data, error } = await supabase.rpc('create_subcontractor_document', {
      p_organisation_id: payload.organisation_id,
      p_subcontractor_id: payload.subcontractor_id,
      p_document_name: payload.document_name,
      p_document_url: payload.document_url,
      p_document_type: payload.document_type || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteInvoice(invoiceId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('delete_subcontractor_invoice', {
      p_invoice_id: invoiceId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async recordIssueActivityLog(payload: any) {
    const { data, error } = await supabase.rpc('record_issue_activity_log', {
      p_organisation_id: payload.organisation_id,
      p_issue_id: payload.issue_id,
      p_action: payload.action,
      p_old_value: payload.old_value || null,
      p_new_value: payload.new_value || null,
      p_done_by: payload.done_by || null,
      p_done_by_name: payload.done_by_name || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async updateWorkOrderStatus(workOrderId: string, organisationId: string, status: string) {
    const { data, error } = await supabase.rpc('update_subcontractor_work_order_status', {
      p_work_order_id: workOrderId,
      p_organisation_id: organisationId,
      p_status: status
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getLabourCategories(organisationId: string) {
    const { data, error } = await supabase.rpc('get_labour_categories', {
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async createLabourCategory(payload: any) {
    const { data, error } = await supabase.rpc('create_labour_category', {
      p_organisation_id: payload.organisation_id,
      p_name: payload.name,
      p_code: payload.code || null,
      p_description: payload.description || null,
      p_base_rate: payload.base_rate || 0,
      p_unit: payload.unit || 'day',
      p_is_active: payload.is_active ?? true
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteLabourCategory(categoryId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('delete_labour_category', {
      p_category_id: categoryId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getContextModifiers(organisationId: string) {
    const { data, error } = await supabase.rpc('get_context_modifiers', {
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRateCards(organisationId: string, subcontractorId?: string) {
    const { data, error } = await supabase.rpc('get_rate_cards', {
      p_organisation_id: organisationId,
      p_subcontractor_id: subcontractorId || null
    });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getCommunications(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('client_communication')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getNotifications(userId: string, organisationId: string, limit: number = 50) {
    const { data, error } = await supabase.rpc('get_notifications', {
      p_user_id: userId,
      p_organisation_id: organisationId,
      p_limit: limit
    });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async createNotification(payload: { user_id: string; organisation_id: string; type: string; title: string; message: string; reference_id?: string; reference_type?: string }) {
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: payload.user_id,
      p_organisation_id: payload.organisation_id,
      p_type: payload.type,
      p_title: payload.title,
      p_message: payload.message,
      p_reference_id: payload.reference_id || null,
      p_reference_type: payload.reference_type || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async markNotificationRead(notificationId: string, userId?: string) {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
      p_user_id: userId || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async markAllNotificationsRead(userId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getUnreadNotificationCount(userId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
      p_user_id: userId,
      p_organisation_id: organisationId
    });

    if (error) throw new Error(error.message);
    return data || 0;
  },

  async bulkApproveAttendance(attendanceIds: string[], organisationId: string) {
    const results = await Promise.allSettled(
      attendanceIds.map(id => this.approveAttendance(id, organisationId))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return { succeeded, failed, total: attendanceIds.length };
  },

  async bulkUpdateWorkOrderStatus(workOrderIds: string[], organisationId: string, status: string) {
    const results = await Promise.allSettled(
      workOrderIds.map(id => this.updateWorkOrderStatus(id, organisationId, status))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    return { succeeded, failed, total: workOrderIds.length };
  }
};
