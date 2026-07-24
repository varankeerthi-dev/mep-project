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
      const { data, error } = await supabase
        .from('subcontractors')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase
        .from('subcontractors')
        .insert([payload])
        .select()
        .single();

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
      .from('subcontractor_attendance')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('attendance_date', { ascending: false });

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

  async getLabourCategories(organisationId: string) {
    const { data, error } = await supabase
      .from('labour_categories')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('is_active', true);

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

  async getCommunications(subcontractorId: string, organisationId: string) {
    const { data, error } = await supabase
      .from('client_communication')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }
};
