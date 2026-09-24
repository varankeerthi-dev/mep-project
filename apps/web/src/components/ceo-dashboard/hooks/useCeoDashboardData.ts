import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/logger';
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts';
import { useOpenStoppagesByOrg, useResolveStoppage } from '@/hooks/useStoppages';
import type { WorkStoppageWithReport } from '@/types/siteReportStoppage';
import { ApprovalAPI } from '@/approvals/api';

export type CeoMode = 'projects' | 'manufacturing' | 'combined';

export type DateHorizon = 'this_month' | 'this_quarter' | 'fy_current' | 'all' | 'custom';

export interface DateRangeState {
  horizon: DateHorizon;
  startDate: string | null; // 'YYYY-MM-DD'
  endDate: string | null;   // 'YYYY-MM-DD'
}

export interface QuoteItem {
  id: string;
  quotation_no: string;
  client_name: string;
  project_name: string;
  grand_total: number;
  status: string;
  approval_status: string | null;
  date: string;
  valid_till: string | null;
  created_at: string;
}

export interface SalesOrderItem {
  id: string;
  po_number: string;
  client_name: string;
  project_name: string;
  po_date: string;
  po_expiry_date: string | null;
  po_total_value: number;
  po_utilized_value: number;
  po_available_value: number;
  status: string;
}

export interface ProjectPortfolioItem {
  id: string;
  name: string;
  project_name: string;
  client_name: string;
  status: string;
  completion_percentage: number;
  start_date: string | null;
  expected_end_date: string | null;
  project_estimated_value: number;
  budget: number;
  target_margin_percent: number | null;
  health: 'On Track' | 'At Risk' | 'Critical Delayed' | 'Completed';
  daysVariance: number;
}

export interface JobCardWipItem {
  id: string;
  job_card_no: string;
  product_name: string;
  planned_qty: number;
  actual_qty: number;
  output_unit: string;
  status: string;
  priority: string;
  yield_pct: number | null;
  created_at: string;
}

export interface InvoiceBillingItem {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  outstanding: number;
  status: string;
  client_name: string;
  daysOverdue: number;
}

export interface CeoApprovalItem {
  id: string;
  approval_type: string;
  title: string;
  status: string;
  priority: string;
  requested_at: string;
  amount: number | null;
  reference_id: string | null;
  reference_type: string | null;
  requester_name: string | null;
}

export interface CeoPipelineMetrics {
  quotes: {
    totalValue: number;
    count: number;
    avgValue: number;
    approvedValue: number;
  };
  orders: {
    totalBookedValue: number;
    utilizedValue: number;
    availableBacklog: number;
    count: number;
  };
  execution: {
    activeProjectsCount: number;
    onTrackCount: number;
    atRiskCount: number;
    delayedCount: number;
    avgCompletion: number;
    activeJobCardsCount: number;
    totalJobUnitsPlanned: number;
    totalJobUnitsDone: number;
  };
  billing: {
    totalBilled: number;
    totalCollected: number;
    totalOverdueAR: number;
    invoicesCount: number;
    collectionRate: number; // percentage
  };
  escalations: {
    criticalStoppagesCount: number;
    highPriorityApprovalsCount: number;
    budgetOverrunsCount: number;
    totalEscalations: number;
  };
}

export function computeDateBoundaries(horizon: DateHorizon, customStart?: string | null, customEnd?: string | null, orgFy = 'FY24-25') {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  if (horizon === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  if (horizon === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { startDate: firstDay, endDate: lastDay };
  }

  if (horizon === 'this_quarter') {
    const quarterIndex = Math.floor(now.getMonth() / 3);
    const firstDay = new Date(now.getFullYear(), quarterIndex * 3, 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), (quarterIndex + 1) * 3, 0).toISOString().slice(0, 10);
    return { startDate: firstDay, endDate: lastDay };
  }

  if (horizon === 'fy_current') {
    // Standard Indian Financial Year: April 1 to March 31
    const currentYear = now.getFullYear();
    const isPostApril = now.getMonth() >= 3; // April is index 3
    const startYear = isPostApril ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  }

  // 'all'
  return { startDate: '2020-01-01', endDate: '2099-12-31' };
}

export function useCeoDashboardData(orgId: string | undefined, dateRange: DateRangeState, currentFy = 'FY24-25') {
  const queryClient = useQueryClient();

  const { startDate, endDate } = useMemo(
    () => computeDateBoundaries(dateRange.horizon, dateRange.startDate, dateRange.endDate, currentFy),
    [dateRange.horizon, dateRange.startDate, dateRange.endDate, currentFy]
  );

  // 1. Detect Enabled Modules
  const modulesQuery = useQuery({
    queryKey: ['ceo-dashboard', 'org-modules', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_modules')
        .select('module_id, enabled')
        .eq('organisation_id', orgId as string);
      if (error) {
        console.warn('Could not query org_modules, defaulting:', error);
        return { hasProjects: true, hasManufacturing: true };
      }
      const set = new Set((data || []).filter((m) => m.enabled).map((m) => m.module_id));
      return {
        hasProjects: set.size === 0 || set.has('projects'),
        hasManufacturing: set.has('manufacturing'),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const hasProjects = modulesQuery.data?.hasProjects ?? true;
  const hasManufacturing = modulesQuery.data?.hasManufacturing ?? false;

  // 2. Quotes & Pipeline Query
  const quotesQuery = useQuery({
    queryKey: ['ceo-dashboard', 'quotes', orgId, startDate, endDate],
    enabled: !!orgId,
    queryFn: async (): Promise<QuoteItem[]> => {
      const { data, error } = await supabase
        .from('quotation_header')
        .select(`
          id, quotation_no, client_id, project_id, grand_total, status, approval_status,
          date, valid_till, created_at,
          client:client_id(client_name),
          project:project_id(project_name)
        `)
        .eq('organisation_id', orgId as string)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []).map((q: any) => ({
        id: q.id,
        quotation_no: q.quotation_no || 'Quote',
        client_name: q.client?.client_name || 'Client',
        project_name: q.project?.project_name || 'General',
        grand_total: Number(q.grand_total) || 0,
        status: q.status || 'Draft',
        approval_status: q.approval_status || null,
        date: q.date || q.created_at?.slice(0, 10),
        valid_till: q.valid_till || null,
        created_at: q.created_at,
      }));
    },
    staleTime: 60 * 1000,
  });

  // 3. Sales Orders / Client POs Query
  const ordersQuery = useQuery({
    queryKey: ['ceo-dashboard', 'orders', orgId, startDate, endDate],
    enabled: !!orgId,
    queryFn: async (): Promise<SalesOrderItem[]> => {
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select(`
          id, po_number, po_date, po_expiry_date, po_total_value, po_utilized_value,
          po_available_value, status, client_id, project_id,
          client:client_id(client_name),
          project:project_id(project_name)
        `)
        .eq('organisation_id', orgId as string)
        .order('po_date', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []).map((po: any) => {
        const total = Number(po.po_total_value) || 0;
        const utilized = Number(po.po_utilized_value) || 0;
        const available = po.po_available_value !== null ? Number(po.po_available_value) : Math.max(0, total - utilized);
        return {
          id: po.id,
          po_number: po.po_number || 'PO',
          client_name: po.client?.client_name || 'Client',
          project_name: po.project?.project_name || 'General',
          po_date: po.po_date || '—',
          po_expiry_date: po.po_expiry_date || null,
          po_total_value: total,
          po_utilized_value: utilized,
          po_available_value: available,
          status: po.status || 'Active',
        };
      });
    },
    staleTime: 60 * 1000,
  });

  // 4. Projects Portfolio Query
  const projectsQuery = useQuery({
    queryKey: ['ceo-dashboard', 'projects', orgId],
    enabled: !!orgId && hasProjects,
    queryFn: async (): Promise<ProjectPortfolioItem[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, name, project_name, client_name, status, completion_percentage,
          expected_end_date, start_date, project_estimated_value, budget, target_margin_percent
        `)
        .eq('organisation_id', orgId as string)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);

      return (data || []).map((p: any) => {
        const completion = Number(p.completion_percentage) || 0;
        const expectedEnd = p.expected_end_date;
        let daysVariance = 0;
        let health: ProjectPortfolioItem['health'] = 'On Track';

        if (p.status === 'Completed' || completion >= 100) {
          health = 'Completed';
        } else if (expectedEnd) {
          const diffMs = new Date(expectedEnd).getTime() - new Date(today).getTime();
          daysVariance = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (daysVariance < -7) {
            health = 'Critical Delayed';
          } else if (daysVariance < 0 || (completion < 50 && daysVariance < 14)) {
            health = 'At Risk';
          } else {
            health = 'On Track';
          }
        }

        return {
          id: p.id,
          name: p.name || p.project_name || 'Project',
          project_name: p.project_name || p.name || 'Project',
          client_name: p.client_name || 'Client',
          status: p.status || 'Active',
          completion_percentage: completion,
          start_date: p.start_date || null,
          expected_end_date: expectedEnd || null,
          project_estimated_value: Number(p.project_estimated_value) || 0,
          budget: Number(p.budget) || 0,
          target_margin_percent: p.target_margin_percent !== null ? Number(p.target_margin_percent) : null,
          health,
          daysVariance,
        };
      });
    },
    staleTime: 60 * 1000,
  });

  // 5. Job Cards WIP Query (Manufacturing Mode)
  const jobCardsQuery = useQuery({
    queryKey: ['ceo-dashboard', 'job-cards', orgId],
    enabled: !!orgId && hasManufacturing,
    queryFn: async (): Promise<JobCardWipItem[]> => {
      const { data, error } = await supabase
        .from('job_cards')
        .select(`
          id, job_card_no, product_name, planned_qty, actual_qty,
          output_unit, status, priority, yield_pct, created_at
        `)
        .eq('organisation_id', orgId as string)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Job cards query error, returning empty:', error);
        return [];
      }
      return (data || []).map((j: any) => ({
        id: j.id,
        job_card_no: j.job_card_no || 'JC',
        product_name: j.product_name || 'Item',
        planned_qty: Number(j.planned_qty) || 0,
        actual_qty: Number(j.actual_qty) || 0,
        output_unit: j.output_unit || 'Nos',
        status: j.status || 'In Progress',
        priority: j.priority || 'Normal',
        yield_pct: j.yield_pct !== null ? Number(j.yield_pct) : null,
        created_at: j.created_at,
      }));
    },
    staleTime: 60 * 1000,
  });

  // 6. Billing & Invoices Query
  const invoicesQuery = useQuery({
    queryKey: ['ceo-dashboard', 'invoices', orgId, startDate, endDate],
    enabled: !!orgId,
    queryFn: async (): Promise<InvoiceBillingItem[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id, invoice_no, invoice_date, due_date, total, paid_amount, status, client_id,
          client:client_id(client_name)
        `)
        .eq('organisation_id', orgId as string)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false })
        .limit(200);

      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);

      return (data || []).map((inv: any) => {
        const total = Number(inv.total) || 0;
        const paid = Number(inv.paid_amount) || 0;
        const outstanding = Math.max(0, total - paid);
        let daysOverdue = 0;
        if (outstanding > 0 && inv.due_date && inv.due_date < today) {
          const diffMs = new Date(today).getTime() - new Date(inv.due_date).getTime();
          daysOverdue = Math.round(diffMs / (1000 * 60 * 60 * 24));
        }

        return {
          id: inv.id,
          invoice_no: inv.invoice_no || 'INV',
          invoice_date: inv.invoice_date || '—',
          due_date: inv.due_date || null,
          total,
          paid_amount: paid,
          outstanding,
          status: inv.status || 'Issued',
          client_name: inv.client?.client_name || 'Client',
          daysOverdue,
        };
      });
    },
    staleTime: 60 * 1000,
  });

  // 7. Approvals Query (Executive pending approvals)
  const approvalsQuery = useQuery({
    queryKey: ['ceo-dashboard', 'approvals', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<CeoApprovalItem[]> => {
      const { data, error } = await supabase
        .from('approvals')
        .select(`
          id, approval_type, title, status, priority, requested_at,
          amount, reference_id, reference_type, requester_name
        `)
        .eq('organisation_id', orgId as string)
        .eq('status', 'PENDING')
        .order('requested_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        approval_type: a.approval_type || 'APPROVAL',
        title: a.title || 'Pending Request',
        status: a.status,
        priority: a.priority || 'NORMAL',
        requested_at: a.requested_at,
        amount: a.amount !== null ? Number(a.amount) : null,
        reference_id: a.reference_id,
        reference_type: a.reference_type,
        requester_name: a.requester_name || null,
      }));
    },
    staleTime: 30 * 1000,
  });

  // 8. Open Stoppages & Budget Alerts
  const openStoppagesQuery = useOpenStoppagesByOrg(orgId);
  const budgetAlertsQuery = useBudgetAlerts(orgId || null);
  const resolveStoppageMutation = useResolveStoppage(orgId);

  // 9. Process Direct Approval Mutation
  const processApprovalMutation = useMutation({
    mutationFn: async ({ approvalId, action, comments }: { approvalId: string; action: 'APPROVED' | 'REJECTED'; comments?: string }) => {
      const res = await ApprovalAPI.processApproval(approvalId, {
        action,
        comments: comments || (action === 'APPROVED' ? 'Approved by CEO' : 'Rejected by CEO'),
      });
      if (!res.success) {
        throw new Error(res.error?.message || `Failed to ${action.toLowerCase()} approval`);
      }
      return res;
    },
    onSuccess: (_, variables) => {
      toast.success(`Approval marked as ${variables.action.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['ceo-dashboard', 'approvals', orgId] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Approval action failed');
    },
  });

  // Calculate High-Level Pipeline Metrics
  const metrics = useMemo<CeoPipelineMetrics>(() => {
    const quotes = quotesQuery.data ?? [];
    const orders = ordersQuery.data ?? [];
    const projects = projectsQuery.data ?? [];
    const jobCards = jobCardsQuery.data ?? [];
    const invoices = invoicesQuery.data ?? [];
    const approvals = approvalsQuery.data ?? [];
    const stoppages = openStoppagesQuery.data ?? [];
    const budgetAlerts = budgetAlertsQuery.data ?? [];

    // Quotes calculations
    const quotesTotal = quotes.reduce((acc, q) => acc + q.grand_total, 0);
    const approvedQuotesValue = quotes
      .filter((q) => q.status === 'Approved' || q.approval_status === 'Approved')
      .reduce((acc, q) => acc + q.grand_total, 0);
    const avgQuote = quotes.length > 0 ? quotesTotal / quotes.length : 0;

    // Orders calculations
    const totalBookedValue = orders.reduce((acc, o) => acc + o.po_total_value, 0);
    const utilizedValue = orders.reduce((acc, o) => acc + o.po_utilized_value, 0);
    const availableBacklog = orders.reduce((acc, o) => acc + o.po_available_value, 0);

    // Projects calculations
    const activeProjects = projects.filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled');
    const onTrack = activeProjects.filter((p) => p.health === 'On Track').length;
    const atRisk = activeProjects.filter((p) => p.health === 'At Risk').length;
    const delayed = activeProjects.filter((p) => p.health === 'Critical Delayed').length;
    const avgComp = activeProjects.length > 0
      ? Math.round(activeProjects.reduce((acc, p) => acc + p.completion_percentage, 0) / activeProjects.length)
      : 0;

    // Job Cards calculations
    const activeJobCards = jobCards.filter((j) => j.status !== 'Completed' && j.status !== 'Cancelled');
    const totalPlanned = activeJobCards.reduce((acc, j) => acc + j.planned_qty, 0);
    const totalDone = activeJobCards.reduce((acc, j) => acc + j.actual_qty, 0);

    // Billing & AR calculations
    const totalBilled = invoices.reduce((acc, inv) => acc + inv.total, 0);
    const totalCollected = invoices.reduce((acc, inv) => acc + inv.paid_amount, 0);
    const totalOverdueAR = invoices
      .filter((inv) => inv.daysOverdue > 0)
      .reduce((acc, inv) => acc + inv.outstanding, 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

    // Critical Escalations
    const criticalStoppages = stoppages.length;
    const highPriorityApprovals = approvals.filter((a) => a.priority === 'HIGH' || a.priority === 'URGENT' || (a.amount && a.amount >= 50000)).length;
    const criticalBudgetAlerts = budgetAlerts.filter((b) => b.isOverBudget).length;

    return {
      quotes: {
        totalValue: quotesTotal,
        count: quotes.length,
        avgValue: avgQuote,
        approvedValue: approvedQuotesValue,
      },
      orders: {
        totalBookedValue,
        utilizedValue,
        availableBacklog,
        count: orders.length,
      },
      execution: {
        activeProjectsCount: activeProjects.length,
        onTrackCount: onTrack,
        atRiskCount: atRisk,
        delayedCount: delayed,
        avgCompletion: avgComp,
        activeJobCardsCount: activeJobCards.length,
        totalJobUnitsPlanned: totalPlanned,
        totalJobUnitsDone: totalDone,
      },
      billing: {
        totalBilled,
        totalCollected,
        totalOverdueAR,
        invoicesCount: invoices.length,
        collectionRate,
      },
      escalations: {
        criticalStoppagesCount: criticalStoppages,
        highPriorityApprovalsCount: highPriorityApprovals,
        budgetOverrunsCount: criticalBudgetAlerts,
        totalEscalations: criticalStoppages + highPriorityApprovals + criticalBudgetAlerts,
      },
    };
  }, [
    quotesQuery.data,
    ordersQuery.data,
    projectsQuery.data,
    jobCardsQuery.data,
    invoicesQuery.data,
    approvalsQuery.data,
    openStoppagesQuery.data,
    budgetAlertsQuery.data,
  ]);

  const isLoading =
    modulesQuery.isLoading ||
    quotesQuery.isLoading ||
    ordersQuery.isLoading ||
    projectsQuery.isLoading ||
    invoicesQuery.isLoading ||
    approvalsQuery.isLoading ||
    openStoppagesQuery.isLoading;

  return {
    modules: {
      hasProjects,
      hasManufacturing,
      isLoading: modulesQuery.isLoading,
    },
    metrics,
    data: {
      quotes: quotesQuery.data ?? [],
      orders: ordersQuery.data ?? [],
      projects: projectsQuery.data ?? [],
      jobCards: jobCardsQuery.data ?? [],
      invoices: invoicesQuery.data ?? [],
      approvals: approvalsQuery.data ?? [],
      stoppages: openStoppagesQuery.data ?? [],
      budgetAlerts: budgetAlertsQuery.data ?? [],
    },
    isLoading,
    dateRange,
    mutations: {
      processApproval: processApprovalMutation,
      resolveStoppage: resolveStoppageMutation,
    },
  };
}
