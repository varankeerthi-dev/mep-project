import { supabase } from '../../../supabase';
import type { SitePlan, SitePlanAllocation, SitePlanScheduleHistory, TomorrowsManpowerSummaryData } from '../types';

export const sitePlanApi = {
  async getSitePlans(organisationId: string, options?: { startDate?: string; endDate?: string }): Promise<SitePlan[]> {
    // 1. First query unified manpower_attendance with entry_kind = 'PLANNED'
    let query = supabase
      .from('manpower_attendance')
      .select(`
        id,
        organisation_id,
        attendance_date,
        workers_count,
        remarks,
        status,
        client_confirmation,
        project_id,
        client_id,
        subcontractor_id,
        project:projects(id, title, name, project_name, project_code),
        client:clients(id, company_name, client_name, name),
        category:labour_categories(id, name, code),
        subcontractor:subcontractors(id, vendor_name, company_name),
        worker:labour_workers(id, name)
      `)
      .eq('organisation_id', organisationId)
      .eq('entry_kind', 'PLANNED')
      .order('attendance_date', { ascending: true });

    if (options?.startDate) {
      query = query.gte('attendance_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('attendance_date', options.endDate);
    }

    const { data: attData, error: attError } = await query;

    if (!attError && attData && attData.length > 0) {
      return attData.map((p: any) => ({
        id: p.id,
        organisation_id: p.organisation_id,
        project_id: p.project_id,
        client_id: p.client_id,
        plan_name: p.remarks || `${p.category?.name || 'Labour'} on ${p.project?.project_name || p.project?.name || p.project?.title || 'Site'}`,
        plan_date: p.attendance_date,
        start_time: '08:00:00',
        end_time: '17:00:00',
        trade: p.category?.name || 'General',
        headcount_required: p.workers_count || 1,
        allocated_headcount: p.workers_count || 1,
        notes: p.remarks,
        plan_status: p.status === 'CONVERTED' ? 'approved' : (p.status === 'APPROVED' ? 'approved' : 'draft'),
        client_confirmation_status: p.client_confirmation === 'confirmed' ? 'confirmed' : 'not_confirmed',
        execution_status: p.status === 'CONVERTED' ? 'completed' : 'scheduled',
        site_visit_id: null,
        created_by: null,
        approved_by: null,
        approved_at: null,
        approval_notes: null,
        created_at: p.attendance_date,
        updated_at: p.attendance_date,
        project: p.project ? {
          id: p.project.id,
          title: p.project.project_name || p.project.name || p.project.title,
          name: p.project.name || p.project.project_name,
          project_code: p.project.project_code,
        } : null,
        client: p.client ? {
          id: p.client.id,
          company_name: p.client.client_name || p.client.name || p.client.company_name,
          name: p.client.name || p.client.client_name,
        } : null,
        allocations: [
          {
            id: p.id + '-alloc',
            site_plan_id: p.id,
            organisation_id: p.organisation_id,
            employee_id: null,
            subcontractor_id: p.subcontractor_id,
            allocation_type: p.subcontractor_id ? 'subcontractor' : 'headcount_placeholder',
            allocated_trade: p.category?.name || 'General',
            headcount: p.workers_count || 1,
            status: p.client_confirmation === 'confirmed' ? 'confirmed' : 'assigned',
            notes: p.remarks,
            allocated_by: null,
            allocated_at: p.attendance_date,
            subcontractor: p.subcontractor ? {
              id: p.subcontractor.id,
              vendor_name: p.subcontractor.company_name,
              company_name: p.subcontractor.company_name,
            } : null,
          }
        ],
      }));
    }

    // 2. Fallback to site_plans table
    let legacyQuery = supabase
      .from('site_plans')
      .select(`
        *,
        project:projects(id, title, project_code),
        client:clients(id, company_name),
        allocations:site_plan_allocations(
          *,
          employee:employees(id, name, employee_code, designation),
          subcontractor:subcontractors(id, vendor_name, company_name)
        )
      `)
      .eq('organisation_id', organisationId)
      .order('plan_date', { ascending: true });

    if (options?.startDate) {
      legacyQuery = legacyQuery.gte('plan_date', options.startDate);
    }
    if (options?.endDate) {
      legacyQuery = legacyQuery.lte('plan_date', options.endDate);
    }

    const { data, error } = await legacyQuery;
    if (error) return [];

    return (data || []).map((plan: any) => {
      const allocatedHeadcount = (plan.allocations || []).reduce(
        (sum: number, a: SitePlanAllocation) => sum + (Number(a.headcount) || 1),
        0
      );
      return {
        ...plan,
        allocated_headcount: allocatedHeadcount,
      };
    });
  },

  async getSitePlanById(id: string): Promise<SitePlan | null> {
    // 1. Try manpower_attendance
    const { data: attData } = await supabase
      .from('manpower_attendance')
      .select(`
        id,
        organisation_id,
        attendance_date,
        workers_count,
        remarks,
        status,
        client_confirmation,
        project_id,
        client_id,
        subcontractor_id,
        project:projects(id, title, name, project_name, project_code),
        client:clients(id, company_name, client_name, name),
        category:labour_categories(id, name, code),
        subcontractor:subcontractors(id, vendor_name, company_name),
        worker:labour_workers(id, name)
      `)
      .eq('id', id)
      .maybeSingle();

    if (attData) {
      const p = attData as any;
      const proj = Array.isArray(p.project) ? p.project[0] : p.project;
      const cl = Array.isArray(p.client) ? p.client[0] : p.client;
      const cat = Array.isArray(p.category) ? p.category[0] : p.category;

      return {
        id: p.id,
        organisation_id: p.organisation_id,
        project_id: p.project_id,
        client_id: p.client_id,
        plan_name: p.remarks || `${cat?.name || 'Labour'} on ${proj?.project_name || proj?.name || proj?.title || 'Site'}`,
        plan_date: p.attendance_date,
        start_time: '08:00:00',
        end_time: '17:00:00',
        trade: cat?.name || 'General',
        headcount_required: p.workers_count || 1,
        allocated_headcount: p.workers_count || 1,
        notes: p.remarks,
        plan_status: p.status === 'CONVERTED' ? 'approved' : (p.status === 'APPROVED' ? 'approved' : 'draft'),
        client_confirmation_status: p.client_confirmation === 'confirmed' ? 'confirmed' : 'not_confirmed',
        execution_status: p.status === 'CONVERTED' ? 'completed' : 'scheduled',
        site_visit_id: null,
        created_by: null,
        approved_by: null,
        approved_at: null,
        approval_notes: null,
        created_at: p.attendance_date,
        updated_at: p.attendance_date,
        project: proj ? {
          id: proj.id,
          title: proj.project_name || proj.name || proj.title,
          name: proj.name || proj.project_name,
          project_code: proj.project_code,
        } : null,
        client: cl ? {
          id: cl.id,
          company_name: cl.client_name || cl.name || cl.company_name,
          name: cl.name || cl.client_name,
        } : null,
        allocations: [],
      };
    }

    // 2. Fallback to site_plans
    const { data, error } = await supabase
      .from('site_plans')
      .select(`
        *,
        project:projects(id, title, project_code),
        client:clients(id, company_name),
        allocations:site_plan_allocations(
          *,
          employee:employees(id, name, employee_code, designation),
          subcontractor:subcontractors(id, vendor_name, company_name)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    const allocatedHeadcount = (data.allocations || []).reduce(
      (sum: number, a: SitePlanAllocation) => sum + (Number(a.headcount) || 1),
      0
    );

    return {
      ...data,
      allocated_headcount: allocatedHeadcount,
    };
  },

  async createSitePlan(plan: Partial<SitePlan>): Promise<SitePlan> {
    // If trade category id is provided, call plan_labour RPC
    const categoryId = (plan as any).labour_category_id || (plan as any).trade_id;
    if (plan.organisation_id && plan.plan_date && categoryId) {
      const { data, error } = await supabase.rpc('plan_labour', {
        p_organisation_id: plan.organisation_id,
        p_attendance_date: plan.plan_date,
        p_labour_category_id: categoryId,
        p_workers_count: plan.headcount_required || 1,
        p_client_id: plan.client_id || null,
        p_project_id: plan.project_id || null,
        p_confirmation: plan.client_confirmation_status === 'confirmed' ? 'confirmed' : 'planned_unconfirmed',
        p_remarks: plan.notes || plan.plan_name || null,
      });

      if (error) throw error;
      return data as any;
    }

    // Fallback to site_plans table
    const { data, error } = await supabase
      .from('site_plans')
      .insert([plan])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSitePlan(id: string, updates: Partial<SitePlan>): Promise<SitePlan> {
    // Update on manpower_attendance if it's an attendance row
    const { data: attData } = await supabase
      .from('manpower_attendance')
      .update({
        attendance_date: updates.plan_date,
        workers_count: updates.headcount_required,
        remarks: updates.notes || updates.plan_name,
        client_confirmation: updates.client_confirmation_status === 'confirmed' ? 'confirmed' : 'planned_unconfirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (attData) return attData as any;

    // Fallback to site_plans
    const { data, error } = await supabase
      .from('site_plans')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async confirmPlanWithClient(attendanceId: string, organisationId: string, confirmation: string): Promise<any> {
    const { data, error } = await supabase.rpc('confirm_plan_with_client', {
      p_attendance_id: attendanceId,
      p_organisation_id: organisationId,
      p_confirmation: confirmation,
    });

    if (error) throw error;
    return data;
  },

  async convertPlanToActual(params: {
    planId: string;
    organisationId: string;
    actualHeadcount: number;
    actualHours?: number;
    supervisorName?: string;
    remarks?: string;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('convert_plan_to_actual', {
      p_plan_id: params.planId,
      p_organisation_id: params.organisationId,
      p_actual_headcount: params.actualHeadcount,
      p_actual_hours: params.actualHours || 8,
      p_supervisor_name: params.supervisorName || null,
      p_applied_modifiers: [],
      p_remarks: params.remarks || null,
    });

    if (error) throw error;
    return data;
  },

  async rescheduleSitePlan(params: {
    planId: string;
    organisationId: string;
    previousDate: string;
    newDate: string;
    reason: string;
    clientAgreed: boolean;
    userId?: string;
  }): Promise<void> {
    // Try updating manpower_attendance
    const { error: attError } = await supabase
      .from('manpower_attendance')
      .update({
        attendance_date: params.newDate,
        client_confirmation: params.clientAgreed ? 'confirmed' : 'planned_unconfirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.planId);

    if (attError) {
      await supabase
        .from('site_plans')
        .update({
          plan_date: params.newDate,
          client_confirmation_status: params.clientAgreed ? 'confirmed' : 'postponement_requested',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.planId);
    }

    await supabase
      .from('site_plan_schedule_history')
      .insert([{
        site_plan_id: params.planId,
        organisation_id: params.organisationId,
        previous_date: params.previousDate,
        new_date: params.newDate,
        previous_status: 'scheduled',
        new_status: params.clientAgreed ? 'confirmed' : 'postponement_requested',
        reason: params.reason,
        client_agreed: params.clientAgreed,
        rescheduled_by: params.userId || null,
      }])
      .select()
      .maybeSingle();
  },

  async addAllocation(allocation: Partial<SitePlanAllocation>): Promise<SitePlanAllocation> {
    const { data, error } = await supabase
      .from('site_plan_allocations')
      .insert([allocation])
      .select(`
        *,
        employee:employees(id, name, employee_code, designation),
        subcontractor:subcontractors(id, vendor_name, company_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async removeAllocation(allocationId: string): Promise<void> {
    const { error } = await supabase
      .from('site_plan_allocations')
      .delete()
      .eq('id', allocationId);

    if (error) throw error;
  },

  async dispatchExecutionVisit(planId: string): Promise<string> {
    const { data, error } = await supabase.rpc('link_or_create_execution_visit', {
      p_site_plan_id: planId,
    });

    if (error) throw error;
    return data as string;
  },

  async getScheduleHistory(planId: string): Promise<SitePlanScheduleHistory[]> {
    const { data, error } = await supabase
      .from('site_plan_schedule_history')
      .select('*')
      .eq('site_plan_id', planId)
      .order('rescheduled_at', { ascending: false });

    if (error) return [];
    return data || [];
  },

  async getTomorrowsSummary(organisationId: string, dateStr: string): Promise<TomorrowsManpowerSummaryData> {
    const plans = await this.getSitePlans(organisationId, {
      startDate: dateStr,
      endDate: dateStr,
    });

    let totalRequired = 0;
    let totalAllocated = 0;
    const tradeMap = new Map<string, { required: number; allocated: number }>();
    const confirmationCounts = { confirmed: 0, notConfirmed: 0, postponementRequested: 0 };
    const executionCounts = { scheduled: 0, dispatched: 0 };

    for (const p of plans) {
      const req = Number(p.headcount_required) || 1;
      const alloc = Number(p.allocated_headcount) || 0;
      totalRequired += req;
      totalAllocated += alloc;

      const trade = p.trade || 'General';
      const existing = tradeMap.get(trade) || { required: 0, allocated: 0 };
      existing.required += req;
      existing.allocated += alloc;
      tradeMap.set(trade, existing);

      if (p.client_confirmation_status === 'confirmed') confirmationCounts.confirmed++;
      else if (p.client_confirmation_status === 'postponement_requested') confirmationCounts.postponementRequested++;
      else confirmationCounts.notConfirmed++;

      if (p.execution_status === 'dispatched' || p.execution_status === 'in_progress' || p.execution_status === 'completed') {
        executionCounts.dispatched++;
      } else {
        executionCounts.scheduled++;
      }
    }

    const trades = Array.from(tradeMap.entries()).map(([trade, counts]) => ({
      trade,
      required: counts.required,
      allocated: counts.allocated,
    }));

    return {
      targetDate: dateStr,
      totalRequired,
      totalAllocated,
      trades,
      confirmationCounts,
      executionCounts,
      plans,
    };
  },
};
