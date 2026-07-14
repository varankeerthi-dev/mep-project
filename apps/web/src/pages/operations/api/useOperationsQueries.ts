import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import {
  NeedsAttentionItem,
  LiveNowSiteCheckIn,
  LiveNowManufacturingWIP,
  LiveNowDispatch,
  SalesQuote,
  SalesOrder,
  SalesConfirmedAwaitingPO,
  UpcomingEvent,
  ProjectActivity,
  PlanningShutdownEvent,
  BlockingWorkItem,
  ProformaAdvanceItem,
  DueTodayItem,
  PayableReceivableItem
} from './mockData';

export const useNeedsAttention = () => {
  return useQuery({
    queryKey: ['operations', 'needsAttention'],
    queryFn: async (): Promise<NeedsAttentionItem[]> => {
      const items: NeedsAttentionItem[] = [];
      
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
            link: '/approvals'
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
            tagLabel: 'STOPPAGE',
            title: s.project?.project_name || 'Project Stoppage',
            context: s.reason || 'Work stopped',
            amount: null,
            days: Math.floor((Date.now() - new Date(s.start_time).getTime()) / (1000 * 3600 * 24)),
            link: '/projects'
          });
        });
      }
      
      return items.sort((a, b) => b.days - a.days);
    },
    staleTime: 120 * 1000,
    refetchInterval: 120 * 1000,
  });
};

export const useLiveNow = () => {
  const siteCheckIns = useQuery({
    queryKey: ['operations', 'liveNow', 'siteCheckIns'],
    queryFn: async (): Promise<LiveNowSiteCheckIn[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, user:user_id(full_name), client:client_id(client_name)')
        .gte('visit_date', today)
        .limit(10);
        
      if (error) return [];
      return (data || []).map((v: any) => ({
        id: v.id,
        name: v.user?.full_name || 'Unknown User',
        location: v.client?.client_name || 'Site',
        time: new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        initials: (v.user?.full_name || 'U').substring(0, 2).toUpperCase()
      }));
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const manufacturingWIP = useQuery({
    queryKey: ['operations', 'liveNow', 'manufacturingWIP'],
    queryFn: async (): Promise<LiveNowManufacturingWIP[]> => {
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .in('status', ['in_progress', 'started'])
        .limit(5);
        
      if (error) return [];
      return (data || []).map((j: any) => ({
        id: j.id,
        name: j.card_number || 'Job Card',
        progress: j.completion_percentage || 0,
        meta: j.item_name || 'Production',
        status: (j.completion_percentage > 50) ? 'on-track' : 'behind'
      }));
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const dispatch = useQuery({
    queryKey: ['operations', 'liveNow', 'dispatch'],
    queryFn: async (): Promise<LiveNowDispatch[]> => {
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
          dispatchId: d.challan_number || 'Unknown',
          destination: d.client?.client_name || 'Unknown Destination',
          timeBadge: hours > 24 ? `${Math.floor(hours/24)}d ago` : `${hours}h ago`,
          badgeType: hours > 48 ? 'warn' : 'info'
        };
      });
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return { siteCheckIns, manufacturingWIP, dispatch };
};

export const useSalesQuotes = () => {
  return useQuery({
    queryKey: ['operations', 'sales', 'quotes'],
    queryFn: async (): Promise<SalesQuote[]> => {
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
          client: q.client?.client_name || 'Unknown Client',
          context: `Quote ${q.quotation_number}`,
          badgeType: days > 7 ? 'warn' : 'info',
          badgeLabel: q.status.toUpperCase(),
          daysSince: `${days} days`
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useOpenSalesOrders = () => {
  return useQuery({
    queryKey: ['operations', 'sales', 'openOrders'],
    queryFn: async (): Promise<SalesOrder[]> => {
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
        value: po.total_amount || 0
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useConfirmedAwaitingPO = () => {
  return useQuery({
    queryKey: ['operations', 'sales', 'awaitingPO'],
    queryFn: async (): Promise<SalesConfirmedAwaitingPO[]> => {
      const { data, error } = await supabase
        .from('quotation_headers')
        .select('*, client:client_id(client_name)')
        .eq('status', 'approved')
        .limit(10);
        
      if (error) return [];
      return (data || []).map((q: any) => ({
        id: q.id,
        client: q.client?.client_name || 'Unknown Client',
        daysWaiting: Math.floor((Date.now() - new Date(q.updated_at).getTime()) / (1000 * 3600 * 24)),
        value: q.total_amount || 0
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useUpcomingEvents = () => {
  return useQuery({
    queryKey: ['operations', 'sales', 'upcomingEvents'],
    queryFn: async (): Promise<UpcomingEvent[]> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, client:client_id(client_name)')
        .gt('visit_date', today)
        .limit(5);
        
      if (error) return [];
      return (data || []).map((v: any) => ({
        id: v.id,
        type: 'visit',
        title: v.client?.client_name || 'Site Visit',
        meta: v.purpose || 'Follow-up',
        tag: new Date(v.visit_date).toLocaleDateString()
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useProjectActivity = () => {
  return useQuery({
    queryKey: ['operations', 'projects', 'activity'],
    queryFn: async (): Promise<ProjectActivity[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, manager:manager_id(full_name)')
        .in('status', ['active', 'ongoing', 'in_progress'])
        .limit(10);
        
      if (error) return [];
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.project_name,
        progress: p.progress_percentage || 0,
        manager: p.manager?.full_name || null,
        nextMilestone: p.current_phase || 'Execution',
        date: new Date(p.created_at).toLocaleDateString()
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useUpcomingPlanningShutdown = () => {
  return useQuery({
    queryKey: ['operations', 'projects', 'planningShutdown'],
    queryFn: async (): Promise<PlanningShutdownEvent[]> => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .select('*, project:project_id(project_name)')
        .is('end_time', null)
        .limit(5);
        
      if (error) return [];
      return (data || []).map((s: any) => ({
        id: s.id,
        type: 'shutdown',
        title: s.project?.project_name || 'Project Issue',
        context: s.reason || 'Work halted'
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useBlockingWork = () => {
  return useQuery({
    queryKey: ['operations', 'financial', 'blockingWork'],
    queryFn: async (): Promise<BlockingWorkItem[]> => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .select('*, project:project_id(project_name)')
        .is('end_time', null)
        .limit(5);
        
      if (error) return [];
      return (data || []).map((s: any) => {
        const daysStopped = Math.floor((Date.now() - new Date(s.start_time).getTime()) / (1000 * 3600 * 24));
        return {
          id: s.id,
          project: s.project?.project_name || 'Unknown Project',
          context: s.reason || 'Stoppage',
          workStarted: new Date(s.created_at).toLocaleDateString(),
          stoppedSince: new Date(s.start_time).toLocaleDateString(),
          daysStopped,
          pendingAmount: 0
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useProformaAdvancePending = () => {
  return useQuery({
    queryKey: ['operations', 'financial', 'proformaAdvance'],
    queryFn: async (): Promise<ProformaAdvanceItem[]> => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('*, client:client_id(client_name)')
        .not('status', 'eq', 'paid')
        .limit(5);
        
      if (error) return [];
      return (data || []).map((pi: any) => ({
        id: pi.id,
        client: pi.client?.client_name || 'Unknown Client',
        context: pi.invoice_number || 'Proforma',
        poDate: new Date(pi.created_at).toLocaleDateString(),
        terms: 'Advance',
        receivedPct: 0,
        status: 'Grace period',
        daysSincePO: Math.floor((Date.now() - new Date(pi.created_at).getTime()) / (1000 * 3600 * 24)),
        pendingAmount: pi.total_amount || 0
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useDueToday = () => {
  return useQuery({
    queryKey: ['operations', 'financial', 'dueToday'],
    queryFn: async (): Promise<DueTodayItem[]> => {
      return [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
};

export const usePayablesList = () => {
  return useQuery({
    queryKey: ['operations', 'financial', 'payables'],
    queryFn: async (): Promise<PayableReceivableItem[]> => {
      const { data, error } = await supabase
        .from('purchase_bills')
        .select('*, vendor:vendor_id(name)')
        .not('status', 'eq', 'paid')
        .limit(5);
        
      if (error) return [];
      return (data || []).map((pb: any) => {
        const daysOverdue = Math.floor((Date.now() - new Date(pb.due_date).getTime()) / (1000 * 3600 * 24));
        return {
          id: pb.id,
          name: pb.vendor?.name || 'Unknown Vendor',
          invoiceRef: pb.bill_number || 'Bill',
          aging: daysOverdue > 14 ? 'alert' : (daysOverdue > 0 ? 'warn' : 'ok'),
          agingText: daysOverdue > 0 ? `${daysOverdue}d overdue` : `Due in ${Math.abs(daysOverdue)}d`,
          amount: pb.total_amount || 0,
          dueDate: new Date(pb.due_date || pb.created_at).toLocaleDateString(),
          paymentMode: 'Bank Transfer',
          bank: 'HDFC',
          contact: 'Vendor Contact',
          link: '/purchase'
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useReceivablesList = () => {
  return useQuery({
    queryKey: ['operations', 'financial', 'receivables'],
    queryFn: async (): Promise<PayableReceivableItem[]> => {
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
          name: inv.client?.client_name || 'Unknown Client',
          invoiceRef: inv.invoice_number || 'Invoice',
          aging: daysOverdue > 30 ? 'alert' : (daysOverdue > 0 ? 'warn' : 'ok'),
          agingText: daysOverdue > 0 ? `${daysOverdue}d overdue` : `Due in ${Math.abs(daysOverdue)}d`,
          amount: inv.total_amount || 0,
          dueDate: new Date(inv.due_date || inv.created_at).toLocaleDateString(),
          paymentMode: 'Bank Transfer',
          bank: 'SBI',
          contact: 'Client Contact',
          link: '/invoices'
        };
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};
