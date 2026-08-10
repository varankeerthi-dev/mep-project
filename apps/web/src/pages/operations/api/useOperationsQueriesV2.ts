// src/pages/operations/api/useOperationsQueriesV2.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { formatAppDate } from '@/lib/dateFormat';
import {
  NeedsAttentionItemV2,
  LiveNowSiteCheckInV2,
  LiveNowManufacturingWIPV2,
  LiveNowDispatchV2,
  SalesQuoteV2,
  SalesOrderV2,
  UpcomingVisit,
  ProjectV2,
  ProformaAdvanceV2,
  OverdueReceivableV2
} from './mockDataV2';

export const useNeedsAttentionV2 = () => {
  return useQuery({
    queryKey: ['operationsV2', 'needsAttention'],
    queryFn: async (): Promise<NeedsAttentionItemV2[]> => {
      const items: NeedsAttentionItemV2[] = [];
      
      const { data: approvals, error: err1 } = await supabase
        .from('approvals')
        .select('*')
        .eq('status', 'pending')
        .limit(10);
        
      if (!err1 && approvals) {
        approvals.forEach((a: any) => {
          items.push({
            id: `app-${a.id}`,
            type: 'warn',
            tagLabel: 'APPROVAL',
            title: String(a.reference_type || 'Unknown').toUpperCase(),
            context: a.comments || 'Pending approval',
            amount: null,
            days: Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 3600 * 24)),
            link: '/approvals',
            owner: { name: 'System', initials: 'SY' },
            statusBadge: { text: 'Pending', type: 'days' }
          });
        });
      }
      
      const { data: stoppages, error: err2 } = await supabase
        .from('site_report_work_stoppages')
        .select('*, project:project_id(project_name)')
        .is('end_time', null)
        .limit(10);
        
      if (!err2 && stoppages) {
        stoppages.forEach((s: any) => {
          items.push({
            id: `stop-${s.id}`,
            type: 'alert',
            tagLabel: 'WORK STOPPED',
            title: s.project?.project_name || 'Project Stoppage',
            context: s.reason || 'Work stopped',
            amount: null,
            days: Math.floor((Date.now() - new Date(s.start_time).getTime()) / (1000 * 3600 * 24)),
            link: '/projects',
            owner: { name: 'Manager', initials: 'MG' },
            statusBadge: { text: 'Active', type: 'Today' }
          });
        });
      }
      
      return items.sort((a, b) => b.days - a.days);
    },
    staleTime: 120 * 1000,
    refetchInterval: 120 * 1000,
  });
};

export const useLiveNowV2 = () => {
  const siteCheckIns = useQuery({
    queryKey: ['operationsV2', 'liveNow', 'siteCheckIns'],
    queryFn: async (): Promise<LiveNowSiteCheckInV2[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, user:user_id(full_name), client:client_id(client_name)')
        .gte('visit_date', today)
        .limit(10);
        
      if (error) return [];
      return (data || []).map((v: any) => ({
        id: v.id,
        time: new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        engineer: v.user?.full_name || 'Unknown User',
        siteActivity: `${v.client?.client_name || 'Site'}\n${v.purpose || 'Visit'}`,
        status: v.status || 'On Site',
        statusType: 'onsite'
      }));
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const manufacturingWIP = useQuery({
    queryKey: ['operationsV2', 'liveNow', 'manufacturingWIP'],
    queryFn: async (): Promise<LiveNowManufacturingWIPV2[]> => {
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .in('status', ['in_progress', 'started'])
        .limit(5);
        
      if (error) return [];
      return (data || []).map((j: any) => ({
        id: j.id,
        lotProduct: `${j.card_number || 'Job Card'}\n${j.item_name || 'Production'}`,
        progress: j.completion_percentage || 0,
        totalPieces: j.quantity || 100,
        completedPieces: Math.round((j.quantity || 100) * (j.completion_percentage || 0) / 100),
        shift: 'Shift A',
        startTime: '08:00 AM',
        eta: '04:00 PM'
      }));
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const dispatch = useQuery({
    queryKey: ['operationsV2', 'liveNow', 'dispatch'],
    queryFn: async (): Promise<LiveNowDispatchV2[]> => {
      const { data, error } = await supabase
        .from('delivery_challans')
        .select('*, client:client_id(client_name)')
        .not('status', 'in', '("delivered","cancelled")')
        .limit(5);
        
      if (error) return [];
      return (data || []).map((d: any) => {
        const hours = Math.floor((Date.now() - new Date(d.created_at).getTime()) / (1000 * 3600));
        return {
          id: d.id,
          dcClient: `${d.challan_number || 'Unknown'}\n${d.client?.client_name || 'Client'}`,
          vehicleDriver: `${d.vehicle_number || 'Vehicle'}\n${d.driver_name || 'Driver'}`,
          departed: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          eta: new Date(Date.now() + 4 * 3600 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: hours > 24 ? 'Reached' : 'En Route'
        };
      });
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return { siteCheckIns, manufacturingWIP, dispatch };
};

export const useSalesQuotesV2 = () => {
  return useQuery({
    queryKey: ['operationsV2', 'sales', 'quotes'],
    queryFn: async (): Promise<SalesQuoteV2[]> => {
      const { data, error } = await supabase
        .from('quotation_headers')
        .select('*, client:client_id(client_name)')
        .in('status', ['draft', 'pending'])
        .limit(10);
        
      if (error) return [];
      return (data || []).map((q: any) => {
        const days = Math.floor((Date.now() - new Date(q.created_at).getTime()) / (1000 * 3600 * 24));
        return {
          id: q.id,
          clientProject: q.client?.client_name || 'Unknown Client',
          value: q.total_amount || 0,
          status: q.status.toUpperCase(),
          statusType: 'Tech Approval',
          pendingSince: `${days} days`
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useOpenSalesOrdersV2 = () => {
  return useQuery({
    queryKey: ['operationsV2', 'sales', 'openOrders'],
    queryFn: async (): Promise<SalesOrderV2[]> => {
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select('*, client:client_id(client_name)')
        .in('status', ['approved', 'processing'])
        .limit(10);
        
      if (error) return [];
      return (data || []).map((po: any) => ({
        id: po.id,
        client: po.client?.client_name || 'Unknown Client',
        orderNo: po.po_number,
        orderDate: formatAppDate(po.created_at),
        value: po.total_amount || 0
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useUpcomingVisits = () => {
  return useQuery({
    queryKey: ['operationsV2', 'sales', 'upcomingVisits'],
    queryFn: async (): Promise<UpcomingVisit[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, client:client_id(client_name), user:user_id(full_name)')
        .gt('visit_date', today)
        .limit(5);
        
      if (error) return [];
      return (data || []).map((v: any) => {
        const visitDate = new Date(v.visit_date);
        const todayDate = new Date();
        const diffDays = Math.floor((visitDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));
        
        return {
          id: v.id,
          date: visitDate.getDate().toString(),
          dayOfWeek: visitDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
          company: v.client?.client_name || 'Site Visit',
          visitType: v.purpose || 'Follow-up',
          assignedTo: {
            name: v.user?.full_name || 'Unassigned',
            initials: (v.user?.full_name || 'U').substring(0, 2).toUpperCase()
          },
          time: new Date(v.visit_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `${diffDays} days`
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useProjectActivityV2 = () => {
  return useQuery({
    queryKey: ['operationsV2', 'projects', 'activity'],
    queryFn: async (): Promise<ProjectV2[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, manager:manager_id(full_name)')
        .in('status', ['active', 'ongoing', 'in_progress'])
        .limit(10);
        
      if (error) return [];
      return (data || []).map((p: any) => ({
        id: p.id,
        projectManager: `${p.project_name}\n${p.manager?.full_name || 'Unassigned'}`,
        managerInitials: (p.manager?.full_name || 'U').substring(0, 2).toUpperCase(),
        progress: p.progress_percentage || 0,
        nextMilestone: p.current_phase || 'Execution',
        milestoneDate: formatAppDate(p.created_at),
        status: p.progress_percentage > 60 ? 'On Track' : p.progress_percentage > 30 ? 'At Risk' : 'Delayed'
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useProformaAdvanceV2 = () => {
  return useQuery({
    queryKey: ['operationsV2', 'financial', 'proformaAdvance'],
    queryFn: async (): Promise<ProformaAdvanceV2[]> => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('*, client:client_id(client_name)')
        .not('status', 'eq', 'paid')
        .limit(5);
        
      if (error) return [];
      return (data || []).map((pi: any) => ({
        id: pi.id,
        company: pi.client?.client_name || 'Unknown Client',
        poValue: pi.total_amount || 0,
        advanceReceived: (pi.total_amount || 0) * 0.2,
        advancePercentage: 20,
        pendingAmount: (pi.total_amount || 0) * 0.8
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useOverdueReceivables = () => {
  return useQuery({
    queryKey: ['operationsV2', 'financial', 'overdueReceivables'],
    queryFn: async (): Promise<OverdueReceivableV2[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:client_id(client_name)')
        .not('status', 'eq', 'paid')
        .limit(5);
        
      if (error) return [];
      return (data || []).map((inv: any) => {
        const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 3600 * 24));
        return {
          id: inv.id,
          company: inv.client?.client_name || 'Unknown Client',
          invoice: inv.invoice_number || 'Invoice',
          dueDate: formatAppDate(inv.due_date || inv.created_at),
          amount: inv.total_amount || 0,
          daysOverdue: Math.max(0, daysOverdue)
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};