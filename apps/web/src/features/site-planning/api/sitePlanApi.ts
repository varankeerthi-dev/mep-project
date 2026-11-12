import { supabase } from '../../../supabase';
import type { SitePlan, SitePlanAllocation, SitePlanScheduleHistory, TomorrowsManpowerSummaryData } from '../types';

function formatSitePlanRelations(data: any): SitePlan {
  const proj = data.project ? {
    id: data.project.id,
    title: data.project.project_name || data.project.name || data.project.title || 'Site',
    name: data.project.name || data.project.project_name || data.project.title,
    project_code: data.project.project_code,
  } : null;

  const cl = data.client ? {
    id: data.client.id,
    company_name: data.client.client_name || data.client.name || data.client.company_name || 'Client',
    client_name: data.client.client_name || data.client.name,
    name: data.client.name || data.client.client_name,
  } : null;

  const allocs = (data.allocations || []).map((a: any) => ({
    ...a,
    subcontractor: a.subcontractor ? {
      id: a.subcontractor.id,
      vendor_name: a.subcontractor.company_name || a.subcontractor.vendor_name,
      company_name: a.subcontractor.company_name || a.subcontractor.vendor_name,
    } : null,
  }));

  const allocatedHeadcount = allocs.reduce(
    (sum: number, a: SitePlanAllocation) => sum + (Number(a.headcount) || 1),
    0
  );

  const readinessScore = [
    Boolean(data.site_access_cleared),
    Boolean(data.permits_approved),
    Boolean(data.materials_staged),
    Boolean(data.tools_dispatched),
  ].filter(Boolean).length;

  return {
    ...data,
    project: proj,
    client: cl,
    allocations: allocs,
    allocated_headcount: allocatedHeadcount,
    readiness_score: readinessScore,
  };
}

export const sitePlanApi = {
  async getSitePlans(organisationId: string, options?: { startDate?: string; endDate?: string }): Promise<SitePlan[]> {
    // 1. Primary authoritative query on public.site_plans
    let query = supabase
      .from('site_plans')
      .select(`
        *,
        project:projects(id, name, project_name, project_code),
        client:clients(id, name, client_name),
        allocations:site_plan_allocations(
          *,
          employee:employees(id, name, employee_code, designation),
          subcontractor:subcontractors(id, company_name)
        )
      `)
      .eq('organisation_id', organisationId)
      .order('plan_date', { ascending: true });

    if (options?.startDate) {
      query = query.gte('plan_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('plan_date', options.endDate);
    }

    const { data: plansData, error: plansError } = await query;
    if (plansError) {
      console.error('Error fetching site plans:', plansError);
      return [];
    }

    const plans: SitePlan[] = (plansData || []).map(formatSitePlanRelations);

    // 2. Secondary check for standalone planned attendance records without duplicate IDs
    const existingIds = new Set(plans.map((p) => p.id));
    let attQuery = supabase
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
        project:projects(id, name, project_name, project_code),
        client:clients(id, name, client_name),
        category:labour_categories(id, name, code),
        subcontractor:subcontractors(id, company_name),
        worker:labour_workers(id, name)
      `)
      .eq('organisation_id', organisationId)
      .eq('entry_kind', 'PLANNED')
      .order('attendance_date', { ascending: true });

    if (options?.startDate) {
      attQuery = attQuery.gte('attendance_date', options.startDate);
    }
    if (options?.endDate) {
      attQuery = attQuery.lte('attendance_date', options.endDate);
    }

    const { data: attData } = await attQuery;

    if (attData && attData.length > 0) {
      for (const p of attData) {
        if (!existingIds.has(p.id)) {
          plans.push({
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
            work_type: 'erection_project',
            site_access_cleared: true,
            permits_approved: true,
            materials_staged: true,
            tools_dispatched: true,
            readiness_score: 4,
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
          });
        }
      }
    }

    return plans;
  },

  async getSitePlanById(id: string): Promise<SitePlan | null> {
    // 1. Primary check in site_plans
    const { data, error } = await supabase
      .from('site_plans')
      .select(`
        *,
        project:projects(id, name, project_name, project_code),
        client:clients(id, name, client_name),
        allocations:site_plan_allocations(
          *,
          employee:employees(id, name, employee_code, designation),
          subcontractor:subcontractors(id, company_name)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return formatSitePlanRelations(data);
    }

    // 2. Fallback to manpower_attendance
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
        project:projects(id, name, project_name, project_code),
        client:clients(id, name, client_name),
        category:labour_categories(id, name, code),
        subcontractor:subcontractors(id, company_name),
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
        plan_name: p.remarks || `${cat?.name || 'Labour'} on ${proj?.project_name || proj?.name || 'Site'}`,
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
        work_type: 'erection_project',
        site_access_cleared: true,
        permits_approved: true,
        materials_staged: true,
        tools_dispatched: true,
        readiness_score: 4,
        site_visit_id: null,
        created_by: null,
        approved_by: null,
        approved_at: null,
        approval_notes: null,
        created_at: p.attendance_date,
        updated_at: p.attendance_date,
        project: proj ? {
          id: proj.id,
          title: proj.project_name || proj.name || 'Site',
          name: proj.name || proj.project_name,
          project_code: proj.project_code,
        } : null,
        client: cl ? {
          id: cl.id,
          company_name: cl.client_name || cl.name || 'Client',
          name: cl.name || cl.client_name,
        } : null,
        allocations: [],
      };
    }

    return null;
  },

  async createSitePlan(plan: Partial<SitePlan>): Promise<SitePlan> {
    const { data, error } = await supabase
      .from('site_plans')
      .insert([plan])
      .select(`
        *,
        project:projects(id, name, project_name, project_code),
        client:clients(id, name, client_name),
        allocations:site_plan_allocations(
          *,
          employee:employees(id, name, employee_code, designation),
          subcontractor:subcontractors(id, company_name)
        )
      `)
      .single();

    if (error) throw error;
    return formatSitePlanRelations(data);
  },

  async updateSitePlan(id: string, updates: Partial<SitePlan>): Promise<SitePlan> {
    const { data, error } = await supabase
      .from('site_plans')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        project:projects(id, name, project_name, project_code),
        client:clients(id, name, client_name),
        allocations:site_plan_allocations(
          *,
          employee:employees(id, name, employee_code, designation),
          subcontractor:subcontractors(id, company_name)
        )
      `)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return formatSitePlanRelations(data);
    }

    // Fallback for attendance updates
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

    return attData as any;
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
    // 1. Update authoritative site_plans table
    await supabase
      .from('site_plans')
      .update({
        plan_date: params.newDate,
        client_confirmation_status: params.clientAgreed ? 'confirmed' : 'postponement_requested',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.planId);

    // 2. Also synchronize manpower_attendance if present
    await supabase
      .from('manpower_attendance')
      .update({
        attendance_date: params.newDate,
        client_confirmation: params.clientAgreed ? 'confirmed' : 'planned_unconfirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.planId);

    // 3. Record schedule history audit trail
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
        subcontractor:subcontractors(id, company_name)
      `)
      .single();

    if (error) throw error;
    return {
      ...data,
      subcontractor: data.subcontractor ? {
        ...data.subcontractor,
        vendor_name: data.subcontractor.company_name,
      } : null,
    };
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
