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
      .select('*, labour_categories(id, name, code, unit), subcontractors(id, company_name), clients(id, client_name), projects(id, name, project_name)')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('attendance_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getAttendanceByDateRange(organisationId: string, subcontractorId?: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('manpower_attendance')
      .select('*, labour_categories(id, name, code, unit), subcontractors(id, company_name), clients(id, client_name), projects(id, name, project_name)')
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
      p_remarks: payload.remarks || null,
      p_project_id: payload.project_id || (payload.work_unit_type === 'PROJECT' ? payload.work_unit_id : null) || null
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
      p_remarks: payload.remarks || null,
      p_applied_modifiers: payload.applied_modifiers || null,
      p_project_id: payload.project_id || null
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

  async rejectAttendance(attendanceId: string, organisationId: string, reason?: string) {
    const { data, error } = await supabase.rpc('reject_attendance', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId,
      p_rejection_reason: reason || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async reopenAttendance(attendanceId: string, organisationId: string, reason?: string) {
    const { data, error } = await supabase.rpc('reopen_attendance', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId,
      p_reason: reason || null
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async quickAddWorker(payload: {
    organisationId: string;
    name: string;
    tradeId: string;
    defaultRate: number;
    phone?: string;
    workerType?: string;
    payBasis?: string;
    payoutRef?: string;
    vendorPartyId?: string;
  }) {
    const { data, error } = await supabase.rpc('quick_add_worker', {
      p_organisation_id: payload.organisationId,
      p_name: payload.name,
      p_trade_id: payload.tradeId,
      p_default_rate: payload.defaultRate,
      p_phone: payload.phone || null,
      p_worker_type: payload.workerType || 'casual',
      p_pay_basis: payload.payBasis || 'daily',
      p_payout_ref: payload.payoutRef || null,
      p_vendor_party_id: payload.vendorPartyId || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getWorkers(organisationId: string) {
    const { data, error } = await supabase
      .from('labour_workers')
      .select('*, trade:labour_categories(id, name, code, unit)')
      .eq('organisation_id', organisationId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(error.message);
    return data || [];
  },

  async planLabour(payload: {
    organisationId: string;
    attendanceDate: string;
    labourCategoryId: string;
    workersCount: number;
    subcontractorId?: string;
    clientId?: string;
    projectId?: string;
    confirmation?: string;
    remarks?: string;
    workerId?: string;
    employeeId?: string;
  }) {
    const { data, error } = await supabase.rpc('plan_labour', {
      p_organisation_id: payload.organisationId,
      p_attendance_date: payload.attendanceDate,
      p_labour_category_id: payload.labourCategoryId,
      p_workers_count: payload.workersCount,
      p_subcontractor_id: payload.subcontractorId || null,
      p_client_id: payload.clientId || null,
      p_project_id: payload.projectId || null,
      p_confirmation: payload.confirmation || 'planned_unconfirmed',
      p_remarks: payload.remarks || null,
      p_worker_id: payload.workerId || null,
      p_employee_id: payload.employeeId || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async confirmPlanWithClient(attendanceId: string, organisationId: string, confirmation: string) {
    const { data, error } = await supabase.rpc('confirm_plan_with_client', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId,
      p_confirmation: confirmation,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async convertPlanToActual(payload: {
    planId: string;
    organisationId: string;
    actualHeadcount: number;
    actualHours?: number;
    supervisorName?: string;
    appliedModifiers?: string[];
    remarks?: string;
  }) {
    const { data, error } = await supabase.rpc('convert_plan_to_actual', {
      p_plan_id: payload.planId,
      p_organisation_id: payload.organisationId,
      p_actual_headcount: payload.actualHeadcount,
      p_actual_hours: payload.actualHours || 8,
      p_supervisor_name: payload.supervisorName || null,
      p_applied_modifiers: payload.appliedModifiers || [],
      p_remarks: payload.remarks || null,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  async getPlannedVsActual(organisationId: string, date?: string) {
    let query = supabase
      .from('v_planned_vs_actual')
      .select('*')
      .eq('organisation_id', organisationId);

    if (date) {
      query = query.eq('attendance_date', date);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async markAttendanceBillable(attendanceId: string, organisationId: string, isBillable: boolean, clientId?: string) {
    const { data, error } = await supabase.rpc('mark_attendance_billable', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId,
      p_is_billable: isBillable,
      p_client_id: clientId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async generateManpowerBill(payload: {
    organisationId: string;
    subcontractorId: string;
    periodFrom: string;
    periodTo: string;
    idempotencyKey?: string;
    clientId?: string;
    projectId?: string;
    workOrderId?: string;
    remarks?: string;
  }) {
    const { data, error } = await supabase.rpc('generate_manpower_bill', {
      p_organisation_id: payload.organisationId,
      p_subcontractor_id: payload.subcontractorId,
      p_period_from: payload.periodFrom,
      p_period_to: payload.periodTo,
      p_idempotency_key: payload.idempotencyKey || null,
      p_client_id: payload.clientId || null,
      p_project_id: payload.projectId || null,
      p_work_order_id: payload.workOrderId || null,
      p_remarks: payload.remarks || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async pullBillableLabour(organisationId: string, clientId: string, projectId?: string, periodFrom?: string, periodTo?: string) {
    const { data, error } = await supabase.rpc('pull_billable_labour', {
      p_organisation_id: organisationId,
      p_client_id: clientId,
      p_project_id: projectId || null,
      p_period_from: periodFrom || null,
      p_period_to: periodTo || null,
    });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async attachLabourToInvoice(payload: {
    invoiceId: string;
    organisationId: string;
    clientId: string;
    projectId?: string;
    periodFrom?: string;
    periodTo?: string;
    idempotencyKey?: string;
  }) {
    const { data, error } = await supabase.rpc('attach_labour_to_invoice', {
      p_invoice_id: payload.invoiceId,
      p_organisation_id: payload.organisationId,
      p_client_id: payload.clientId,
      p_project_id: payload.projectId || null,
      p_period_from: payload.periodFrom || null,
      p_period_to: payload.periodTo || null,
      p_idempotency_key: payload.idempotencyKey || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getLabourMargin(organisationId: string, clientId?: string, projectId?: string) {
    let query = supabase
      .from('v_labour_margin')
      .select('*')
      .eq('organisation_id', organisationId);

    if (clientId) query = query.eq('client_id', clientId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getBillableUninvoiced(organisationId: string, clientId?: string, projectId?: string) {
    let query = supabase
      .from('v_labour_billable_uninvoiced')
      .select('*')
      .eq('organisation_id', organisationId);

    if (clientId) query = query.eq('client_id', clientId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async giveLabourAdvance(payload: {
    organisationId: string;
    workerId?: string;
    employeeId?: string;
    amount: number;
    date?: string;
    notes?: string;
  }) {
    const { data, error } = await supabase.rpc('give_labour_advance', {
      p_organisation_id: payload.organisationId,
      p_worker_id: payload.workerId || null,
      p_employee_id: payload.employeeId || null,
      p_amount: payload.amount,
      p_date: payload.date || new Date().toISOString().split('T')[0],
      p_notes: payload.notes || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getLabourAdvances(organisationId: string, workerId?: string, employeeId?: string) {
    let query = supabase
      .from('labour_advances')
      .select('*, labour_workers(id, name, phone), employees(id, name, email)')
      .eq('organisation_id', organisationId)
      .order('advance_date', { ascending: false });

    if (workerId) query = query.eq('worker_id', workerId);
    if (employeeId) query = query.eq('employee_id', employeeId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async generateWageRun(payload: {
    organisationId: string;
    periodFrom: string;
    periodTo: string;
    kind?: 'weekly' | 'monthly' | 'on_demand';
    maxAdvanceRecoveryCap?: number;
    idempotencyKey?: string;
  }) {
    const { data, error } = await supabase.rpc('generate_wage_run', {
      p_organisation_id: payload.organisationId,
      p_period_from: payload.periodFrom,
      p_period_to: payload.periodTo,
      p_kind: payload.kind || 'weekly',
      p_max_advance_recovery_cap: payload.maxAdvanceRecoveryCap || 1000.00,
      p_idempotency_key: payload.idempotencyKey || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async approveWageRun(runId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('approve_wage_run', {
      p_run_id: runId,
      p_organisation_id: organisationId,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async payWageRun(runId: string, organisationId: string, paymentAccountId?: string, idempotencyKey?: string) {
    const { data, error } = await supabase.rpc('pay_wage_run', {
      p_run_id: runId,
      p_organisation_id: organisationId,
      p_payment_account_id: paymentAccountId || null,
      p_idempotency_key: idempotencyKey || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getWageRuns(organisationId: string) {
    const { data, error } = await supabase
      .from('labour_wage_runs')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('period_from', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getWorkerWageStatements(organisationId: string, runId?: string, workerId?: string) {
    let query = supabase
      .from('v_worker_wage_statement')
      .select('*')
      .eq('organisation_id', organisationId);

    if (runId) query = query.eq('run_id', runId);
    if (workerId) query = query.eq('worker_id', workerId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async recordMeasurement(payload: {
    organisationId: string;
    subcontractorId?: string;
    workerId?: string;
    clientId?: string;
    projectId?: string;
    workOrderId?: string;
    task: string;
    unit?: string;
    qty: number;
    measurementDate?: string;
    evidenceNotes?: string;
  }) {
    const { data, error } = await supabase.rpc('record_measurement', {
      p_organisation_id: payload.organisationId,
      p_subcontractor_id: payload.subcontractorId || null,
      p_worker_id: payload.workerId || null,
      p_client_id: payload.clientId || null,
      p_project_id: payload.projectId || null,
      p_work_order_id: payload.workOrderId || null,
      p_task: payload.task,
      p_unit: payload.unit || 'm',
      p_qty: payload.qty,
      p_measurement_date: payload.measurementDate || new Date().toISOString().split('T')[0],
      p_evidence_notes: payload.evidenceNotes || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async approveMeasurement(measurementId: string, organisationId: string) {
    const { data, error } = await supabase.rpc('approve_measurement', {
      p_measurement_id: measurementId,
      p_organisation_id: organisationId,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getMeasurements(organisationId: string, projectId?: string, subcontractorId?: string) {
    let query = supabase
      .from('labour_measurements')
      .select('*, subcontractors(id, company_name), labour_workers(id, name), clients(id, client_name, name), projects(id, name, project_name)')
      .eq('organisation_id', organisationId)
      .order('measurement_date', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (subcontractorId) query = query.eq('subcontractor_id', subcontractorId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getLabourProductivity(organisationId: string, projectId?: string) {
    let query = supabase
      .from('v_labour_productivity')
      .select('*')
      .eq('organisation_id', organisationId);

    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getLabourBillRates(organisationId: string, clientId?: string, projectId?: string) {
    let query = supabase
      .from('labour_bill_rates')
      .select('*, labour_categories(id, name, code, unit)')
      .eq('organisation_id', organisationId)
      .eq('is_active', true);

    if (clientId) query = query.eq('client_id', clientId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
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
  },

  async requestTenantLink(initiatorOrgId: string, receiverOrgId: string, initiatorPartyId?: string) {
    const { data, error } = await supabase.rpc('request_tenant_link', {
      p_initiator_org_id: initiatorOrgId,
      p_receiver_org_id: receiverOrgId,
      p_initiator_party_id: initiatorPartyId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async acceptTenantLink(linkId: string, receiverOrgId: string, receiverPartyId?: string) {
    const { data, error } = await supabase.rpc('accept_tenant_link', {
      p_link_id: linkId,
      p_receiver_org_id: receiverOrgId,
      p_receiver_party_id: receiverPartyId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async revokeTenantLink(linkId: string, orgId: string, reason?: string) {
    const { data, error } = await supabase.rpc('revoke_tenant_link', {
      p_link_id: linkId,
      p_org_id: orgId,
      p_reason: reason || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getTenantLinks(orgId: string) {
    const { data, error } = await supabase
      .from('labour_tenant_links')
      .select('*, initiator_org:initiator_org_id(id, name), receiver_org:receiver_org_id(id, name)')
      .or(`initiator_org_id.eq.${orgId},receiver_org_id.eq.${orgId}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async submitSharedAttendance(payload: {
    linkId: string;
    senderOrgId: string;
    attendanceIds: string[];
    notes?: string;
  }) {
    const { data, error } = await supabase.rpc('submit_shared_attendance', {
      p_link_id: payload.linkId,
      p_sender_org_id: payload.senderOrgId,
      p_attendance_ids: payload.attendanceIds,
      p_notes: payload.notes || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getSharedInbox(receiverOrgId: string) {
    const { data, error } = await supabase
      .from('v_labour_share_inbox')
      .select('*')
      .eq('receiver_org_id', receiverOrgId)
      .order('attendance_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async reviewSharedAttendance(payload: {
    itemId: string;
    receiverOrgId: string;
    decision: 'approved' | 'rejected' | 'disputed';
    reason?: string;
    projectId?: string;
    workOrderId?: string;
  }) {
    const { data, error } = await supabase.rpc('review_shared_attendance', {
      p_item_id: payload.itemId,
      p_receiver_org_id: payload.receiverOrgId,
      p_decision: payload.decision,
      p_reason: payload.reason || null,
      p_project_id: payload.projectId || null,
      p_work_order_id: payload.workOrderId || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }
};
