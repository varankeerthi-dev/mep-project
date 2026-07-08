import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '@/lib/logger';

export interface NextActionItem {
  id: string;
  source: 'communication' | 'visit' | 'report' | 'issue' | 'follow_up_quote' | 'follow_up_podc' | 'follow_up_invoice' | 'lead';
  title: string;
  contextInfo: string;
  authorName: string;
  date: string;
  isOverdue: boolean;
  rawItem: any;
}

export function useNextActions() {
  const { user, organisation, organisations } = useAuth();
  const queryClient = useQueryClient();

  const currentOrgMember = organisations.find(o => o.organisation_id === organisation?.id);
  const role = currentOrgMember?.role?.toLowerCase() || '';
  const isPowerUser = ['administrator', 'admin', 'project_manager', 'general_manager', 'manager'].includes(role);

  const fetchNextActions = async (): Promise<NextActionItem[]> => {
    if (!user || !organisation?.id) return [];

    const userEmail = user.email || '';
    const userId = user.id;
    const orgId = organisation.id;

    const items: NextActionItem[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // 1. Fetch Client Communications next actions
      // Use explicit FK hint to avoid PostgREST ambiguity (table has 8+ FKs)
      let commQuery = supabase
        .from('client_communication')
        .select('id, next_action, subject, call_brief, follow_up_date, created_at, status, party_type, call_category, call_regarding, client_id, call_entered_by, call_received_by, assigned_to, next_action_acknowledged_by, is_resolved, client:clients!client_communication_client_id_fkey(client_name), replies:client_communication!parent_communication_id(id, call_brief, created_at, call_entered_by)')
        .eq('organisation_id', orgId)
        .eq('is_resolved', false)
        .in('status', ['Open', 'In Progress', 'open', 'in_progress']);

      if (!isPowerUser) {
        commQuery = commQuery.or(`assigned_to.eq.${userId},call_entered_by.eq.${userId}`);
      }

      const { data: comms, error: commErr } = await commQuery;
      if (commErr) console.error('Comm query error:', commErr);
      if (comms) {
        comms.forEach(c => {
          // Skip if user already acknowledged
          const ackList: string[] = c.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          // Use next_action, then subject, then call_brief as fallback for title
          const actionTitle = c.next_action || c.subject || c.call_brief || '';
          if (!actionTitle) return;

          const dateVal = c.follow_up_date || '';
          const isOverdue = dateVal ? dateVal < todayStr : false;
          items.push({
            id: `comm-${c.id}`,
            source: 'communication',
            title: actionTitle,
            contextInfo: `Client: ${(c.client as any)?.client_name || 'N/A'}${c.call_brief && c.call_brief !== actionTitle ? ' | ' + c.call_brief.substring(0, 60) : ''}`,
            authorName: c.party_type || 'Communication',
            date: dateVal,
            isOverdue,
            rawItem: c
          });
        });
      }
    } catch (e) {
      console.error('Error fetching communications next actions:', e);
    }

    try {
      // 2. Fetch Active Site Visits next steps
      let visitsQuery = supabase
        .from('site_visits')
        .select('*, clients(client_name), projects(project_name)')
        .eq('organisation_id', orgId)
        .not('status', 'in', '("completed","cancelled")');

      const { data: visits } = await visitsQuery;
      if (visits) {
        visits.forEach(v => {
          const ackList: string[] = v.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          const isOwner = isPowerUser || 
            v.project_manager_id === userId || 
            (v.engineer && v.engineer.toLowerCase().includes(userEmail.split('@')[0])) ||
            v.created_by === userEmail;

          if (isOwner && (v.next_step || v.purpose)) {
            const dateVal = v.visit_date || '';
            const isOverdue = dateVal ? dateVal < todayStr : false;
            items.push({
              id: `visit-${v.id}`,
              source: 'visit',
              title: v.next_step || v.purpose,
              contextInfo: `Client: ${v.clients?.client_name || 'N/A'} | Project: ${v.projects?.project_name || 'N/A'}`,
              authorName: v.visited_by || v.engineer || 'Unknown',
              date: dateVal,
              isOverdue,
              rawItem: v
            });
          }
        });
      }
    } catch (e) {
      console.error('Error fetching site visits next actions:', e);
    }

    try {
      // 3. Fetch Submitted Site Reports tomorrow's plans
      let reportsQuery = supabase
        .from('site_reports')
        .select('*, projects(project_name)')
        .eq('organisation_id', orgId)
        .eq('status', 'submitted');

      if (!isPowerUser) {
        reportsQuery = reportsQuery.eq('created_by', userEmail);
      }

      const { data: reports } = await reportsQuery;
      if (reports) {
        reports.forEach(r => {
          const ackList: string[] = r.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          if (r.next_plan) {
            const dateVal = r.report_date || '';
            const isOverdue = dateVal ? dateVal < todayStr : false;
            items.push({
              id: `report-${r.id}`,
              source: 'report',
              title: r.next_plan,
              contextInfo: `Project: ${r.projects?.project_name || 'N/A'}`,
              authorName: r.created_by || 'Unknown',
              date: dateVal,
              isOverdue,
              rawItem: r
            });
          }
        });
      }
    } catch (e) {
      console.error('Error fetching site reports tomorrow plans:', e);
    }

    try {
      // 4. Fetch Active Issues
      let issuesQuery = supabase
        .from('issues')
        .select('*, clients(client_name), projects(project_name)')
        .eq('organisation_id', orgId)
        .not('status', 'in', '("closed","resolved")');

      if (!isPowerUser) {
        issuesQuery = issuesQuery.eq('assigned_to', userId);
      }

      const { data: activeIssues } = await issuesQuery;
      if (activeIssues) {
        activeIssues.forEach(i => {
          const ackList: string[] = i.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          const dateVal = i.due_date || '';
          const isOverdue = dateVal ? dateVal < todayStr : false;
          items.push({
            id: `issue-${i.id}`,
            source: 'issue',
            title: i.title,
            contextInfo: `Client: ${i.clients?.client_name || 'N/A'} | Project: ${i.projects?.project_name || 'N/A'}`,
            authorName: i.reported_by_name || 'System',
            date: dateVal,
            isOverdue,
            rawItem: i
          });
        });
      }
    } catch (e) {
      console.error('Error fetching issues next actions:', e);
    }

    try {
      // 5. Fetch Quotation Follow-ups
      let qFollowUpQuery = supabase
        .from('follow_up_quotation_tracking')
        .select('*, quotation_header(quotation_no, clients(client_name))')
        .eq('organisation_id', orgId)
        .not('follow_up_status', 'in', '("lost_to_competitor")');

      const { data: qFollowups } = await qFollowUpQuery;
      if (qFollowups) {
        qFollowups.forEach(q => {
          const ackList: string[] = q.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          const dateVal = q.created_at ? q.created_at.split('T')[0] : '';
          items.push({
            id: `fuq-${q.id}`,
            source: 'follow_up_quote',
            title: `Quotation Follow-Up: ${q.notes || 'Review quotation'}`,
            contextInfo: `Quote: ${q.quotation_header?.quotation_no || 'N/A'} | Client: ${q.quotation_header?.clients?.client_name || 'N/A'}`,
            authorName: 'Sales System',
            date: dateVal,
            isOverdue: false,
            rawItem: q
          });
        });
      }
    } catch (e) {
      console.error('Error fetching quotation follow-ups:', e);
    }

    try {
      // 6. Fetch PO/DC Backlog Follow-ups
      let podcQuery = supabase
        .from('follow_up_podc_backlog')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('is_active', true);

      const { data: podcs } = await podcQuery;
      if (podcs) {
        podcs.forEach(p => {
          const ackList: string[] = p.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          const dateVal = p.created_at ? p.created_at.split('T')[0] : '';
          items.push({
            id: `fupodc-${p.id}`,
            source: 'follow_up_podc',
            title: `PO/DC Backlog: PO pending for ${p.dc_wo_number}`,
            contextInfo: `Client: ${p.client_name} | Project: ${p.project_name}`,
            authorName: p.site_engineer || 'System',
            date: dateVal,
            isOverdue: p.days_pending_po > 7,
            rawItem: p
          });
        });
      }
    } catch (e) {
      console.error('Error fetching PO/DC backlogs:', e);
    }

    try {
      // 7. Fetch Invoice Follow-ups
      let invQuery = supabase
        .from('follow_up_invoice_tracking')
        .select('*, invoices(invoice_no, clients(client_name))')
        .eq('organisation_id', orgId);

      const { data: invoices } = await invQuery;
      if (invoices) {
        invoices.forEach(inv => {
          const ackList: string[] = inv.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          const dateVal = inv.created_at ? inv.created_at.split('T')[0] : '';
          items.push({
            id: `fuinv-${inv.id}`,
            source: 'follow_up_invoice',
            title: `Invoice Collection: Follow up payment (${inv.collection_risk || 'normal'} risk)`,
            contextInfo: `Invoice: ${inv.invoices?.invoice_no || 'N/A'} | Client: ${inv.invoices?.clients?.client_name || 'N/A'}`,
            authorName: 'Finance Team',
            date: dateVal,
            isOverdue: inv.collection_risk === 'high' || inv.collection_risk === 'critical',
            rawItem: inv
          });
        });
      }
    } catch (e) {
      console.error('Error fetching invoice follow-ups:', e);
    }

    try {
      // 8. Fetch Active Leads next actions
      let leadsQuery = supabase
        .from('leads')
        .select('*')
        .eq('organisation_id', orgId)
        .not('status', 'in', '("converted","lost")');

      if (!isPowerUser) {
        leadsQuery = leadsQuery.eq('owner_user_id', userId);
      }

      const { data: activeLeads } = await leadsQuery;
      if (activeLeads) {
        activeLeads.forEach(l => {
          const ackList: string[] = l.next_action_acknowledged_by || [];
          if (ackList.includes(userEmail)) return;

          if (l.next_action_label || l.requirement_summary) {
            const dateVal = l.next_action_at ? l.next_action_at.split('T')[0] : '';
            const isOverdue = dateVal ? dateVal < todayStr : false;
            items.push({
              id: `lead-${l.id}`,
              source: 'lead',
              title: l.next_action_label || `Lead follow up: ${l.requirement_summary}`,
              contextInfo: `Lead: ${l.contact_name} | Company: ${l.company_name || 'N/A'}`,
              authorName: l.owner_name || 'System',
              date: dateVal,
              isOverdue,
              rawItem: l
            });
          }
        });
      }
    } catch (e) {
      console.error('Error fetching leads next actions:', e);
    }

    // Sort items chronologically (overdue/earliest first)
    return items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.date.localeCompare(b.date);
    });
  };

  const fetchNextActionsHistory = async (): Promise<NextActionItem[]> => {
    if (!user || !organisation?.id) return [];

    const userEmail = user.email || '';
    const userId = user.id;
    const orgId = organisation.id;
    const items: NextActionItem[] = [];

    try {
      // Fetch recently resolved or noted communications
      let commQuery = supabase
        .from('client_communication')
        .select('id, next_action, subject, call_brief, follow_up_date, created_at, status, party_type, call_category, call_regarding, client_id, call_entered_by, call_received_by, assigned_to, next_action_acknowledged_by, is_resolved, client:clients!client_communication_client_id_fkey(client_name), replies:client_communication!parent_communication_id(id, call_brief, created_at, call_entered_by)')
        .eq('organisation_id', orgId)
        .or(`is_resolved.eq.true,next_action_acknowledged_by.cs.{"${userEmail}"}`)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: comms } = await commQuery;
      if (comms) {
        comms.forEach(c => {
          const actionTitle = c.next_action || c.subject || c.call_brief || '';
          if (!actionTitle) return;

          items.push({
            id: `comm-${c.id}`,
            source: 'communication',
            title: actionTitle,
            contextInfo: `Client: ${(c.client as any)?.client_name || 'N/A'}${c.call_brief && c.call_brief !== actionTitle ? ' | ' + c.call_brief.substring(0, 60) : ''}`,
            authorName: c.party_type || 'Communication',
            date: c.follow_up_date || '',
            isOverdue: false,
            rawItem: c
          });
        });
      }
    } catch (e) {
      console.error('Error fetching history comms:', e);
    }

    try {
      // Fetch recently noted site visits
      let visitsQuery = supabase
        .from('site_visits')
        .select('*, clients(client_name), projects(project_name)')
        .eq('organisation_id', orgId)
        .or(`status.eq.completed,status.eq.cancelled,next_action_acknowledged_by.cs.{"${userEmail}"}`)
        .order('visit_date', { ascending: false })
        .limit(10);

      const { data: visits } = await visitsQuery;
      if (visits) {
        visits.forEach(v => {
          items.push({
            id: `visit-${v.id}`,
            source: 'visit',
            title: v.next_step || v.purpose || 'Site visit completed',
            contextInfo: `Client: ${v.clients?.client_name || 'N/A'} | Project: ${v.projects?.project_name || 'N/A'}`,
            authorName: v.visited_by || 'Unknown',
            date: v.visit_date || '',
            isOverdue: false,
            rawItem: v
          });
        });
      }
    } catch (e) {
      console.error('Error fetching history visits:', e);
    }

    return items;
  };

  const nextActionsQuery = useQuery({
    queryKey: ['next-actions', organisation?.id, user?.id, user?.email],
    queryFn: fetchNextActions,
    enabled: !!organisation?.id && !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const historyQuery = useQuery({
    queryKey: ['next-actions-history', organisation?.id, user?.id, user?.email],
    queryFn: fetchNextActionsHistory,
    enabled: !!organisation?.id && !!user?.id,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Acknowledge / personal dismissal mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async ({ item, comment }: { item: NextActionItem; comment?: string }) => {
      if (!user) return;
      const userEmail = user.email || '';
      const userId = user.id;
      const orgId = organisation.id;
      
      const realId = item.id.substring(item.id.indexOf('-') + 1);
 
      let tableName = '';
      if (item.source === 'communication') tableName = 'client_communication';
      else if (item.source === 'visit') tableName = 'site_visits';
      else if (item.source === 'report') tableName = 'site_reports';
      else if (item.source === 'issue') tableName = 'issues';
      else if (item.source === 'follow_up_quote') tableName = 'follow_up_quotation_tracking';
      else if (item.source === 'follow_up_podc') tableName = 'follow_up_podc_backlog';
      else if (item.source === 'follow_up_invoice') tableName = 'follow_up_invoice_tracking';
      else if (item.source === 'lead') tableName = 'leads';
 
      if (!tableName) return;
 
      // 1. Fetch current array
      const { data, error: fetchErr } = await supabase
        .from(tableName)
        .select('next_action_acknowledged_by')
        .eq('id', realId)
        .single();
 
      if (fetchErr) throw fetchErr;
 
      const currentAckList: string[] = data?.next_action_acknowledged_by || [];
      if (!currentAckList.includes(userEmail)) {
        currentAckList.push(userEmail);
      }
 
      // 2. Update array
      const { error: updateErr } = await supabase
        .from(tableName)
        .update({ next_action_acknowledged_by: currentAckList })
        .eq('id', realId);
 
      if (updateErr) throw updateErr;

      // 3. Create a thread/reply note if comment is provided and it's a communication
      if (comment && item.source === 'communication') {
        const { error: replyErr } = await supabase
          .from('client_communication')
          .insert({
            organisation_id: orgId,
            parent_communication_id: realId,
            call_brief: `[Noted Reply] ${comment}`,
            call_entered_by: userId,
            call_type: 'Note',
            call_category: item.rawItem.call_category || 'Next Action',
            call_regarding: item.rawItem.call_regarding || 'Next Action',
            status: 'Open',
            is_resolved: false,
            client_id: item.rawItem.client_id,
            vendor_id: item.rawItem.vendor_id,
            subcontractor_id: item.rawItem.subcontractor_id,
            lead_id: item.rawItem.lead_id,
            party_type: item.rawItem.party_type,
          });
        if (replyErr) console.error('Error inserting noted reply:', replyErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
      queryClient.invalidateQueries({ queryKey: ['next-actions-history'] });
      toast.success('Action acknowledged');
    },
    onError: (err) => {
      console.error('Error acknowledging action:', err);
      toast.error('Failed to acknowledge action');
    }
  });
 
  // Global resolve mutation (only for communications)
  const resolveMutation = useMutation({
    mutationFn: async ({ itemId, comment, rawItem }: { itemId: string; comment?: string; rawItem?: any }) => {
      if (!user) return;
      const userId = user.id;
      const orgId = organisation.id;
      
      const realId = itemId.substring(itemId.indexOf('-') + 1);
      const { error } = await supabase
        .from('client_communication')
        .update({ is_resolved: true })
        .eq('id', realId);
 
      if (error) throw error;

      // Create a thread/reply note if comment is provided
      if (comment && rawItem) {
        const { error: replyErr } = await supabase
          .from('client_communication')
          .insert({
            organisation_id: orgId,
            parent_communication_id: realId,
            call_brief: `[Resolution Note] ${comment}`,
            call_entered_by: userId,
            call_type: 'Note',
            call_category: rawItem.call_category || 'Next Action',
            call_regarding: rawItem.call_regarding || 'Next Action',
            status: 'resolved',
            is_resolved: true,
            client_id: rawItem.client_id,
            vendor_id: rawItem.vendor_id,
            subcontractor_id: rawItem.subcontractor_id,
            lead_id: rawItem.lead_id,
            party_type: rawItem.party_type,
          });
        if (replyErr) console.error('Error inserting resolution reply:', replyErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['next-actions'] });
      queryClient.invalidateQueries({ queryKey: ['next-actions-history'] });
      toast.success('Action marked resolved');
    },
    onError: (err) => {
      console.error('Error resolving action:', err);
      toast.error('Failed to resolve action');
    }
  });
 
  return {
    nextActions: nextActionsQuery.data || [],
    history: historyQuery.data || [],
    nextActionsHistory: historyQuery.data || [],
    isLoading: nextActionsQuery.isLoading || historyQuery.isLoading,
    refetch: () => {
      nextActionsQuery.refetch();
      historyQuery.refetch();
    },
    acknowledge: acknowledgeMutation.mutate,
    isAcknowledging: acknowledgeMutation.isPending,
    resolve: resolveMutation.mutate,
    isResolving: resolveMutation.isPending
  };
}
