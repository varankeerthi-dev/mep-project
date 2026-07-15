import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface NextActionItem {
  id: string;
  source: 'communication' | 'visit' | 'report' | 'issue' | 'follow_up_quote' | 'follow_up_podc' | 'follow_up_invoice' | 'lead';
  title: string;
  contextInfo: string;
  authorName: string;
  date: string;
  isOverdue: boolean;
  creatorText?: string;
  createdAt?: string;
  rawItem: any;
}

export function useNextActionsMobile(isDemo = false) {
  const [nextActions, setNextActions] = useState<NextActionItem[]>([]);
  const [history, setHistory] = useState<NextActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNextActionsData = useCallback(async () => {
    if (isDemo) {
      // Mock demo data for mobile preview
      const demoItems: NextActionItem[] = [
        {
          id: 'comm-demo1',
          source: 'communication',
          title: 'Follow up payment with Client',
          contextInfo: 'Client: Tasman Group',
          authorName: 'Client',
          date: new Date().toISOString().split('T')[0],
          isOverdue: false,
          rawItem: { created_at: new Date().toISOString() }
        },
        {
          id: 'visit-demo2',
          source: 'visit',
          title: 'Arrange site supervision for UG pipe fixing',
          contextInfo: 'Client: Godrej | Project: Godrej Vikhroli',
          authorName: 'Engineer',
          date: '2026-07-01',
          isOverdue: true,
          rawItem: { created_at: '2026-06-25T10:00:00Z' }
        }
      ];
      setNextActions(demoItems);
      setHistory([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Resolve current user and organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userEmail = user.email || '';
      const userId = user.id;

      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      const role = memberData?.role?.toLowerCase() || '';
      const isPowerUser = ['administrator', 'admin', 'project_manager', 'general_manager', 'manager'].includes(role);
      const todayStr = new Date().toISOString().split('T')[0];

      // ═══════════════════════════════════════════════════════════════════════
      // 2. Fetch Active Actions
      // ═══════════════════════════════════════════════════════════════════════
      // Fetch all employees for name mapping
      const { data: profiles } = await supabase
        .from('employees')
        .select('id, name');
      const localUserMap = new Map<string, string>();
      if (profiles) {
        profiles.forEach(p => {
          localUserMap.set(p.id, p.name || 'System');
        });
      }

      const items: NextActionItem[] = [];

      // 2.1 Fetch Communications
      try {
        let commQuery = supabase
          .from('client_communication')
          .select('id, next_action, subject, call_brief, follow_up_date, created_at, status, party_type, call_category, call_regarding, client_id, call_entered_by, call_received_by, assigned_to, next_action_acknowledged_by, is_resolved, client:clients!client_communication_client_id_fkey(client_name)')
          .eq('organisation_id', orgId)
          .eq('is_resolved', false)
          .in('status', ['Open', 'In Progress', 'open', 'in_progress', 'Awaiting Decision', 'awaiting_decision']);

        if (!isPowerUser) {
          commQuery = commQuery.or(`assigned_to.eq.${userId},call_entered_by.eq.${userId}`);
        }

        const { data: comms } = await commQuery;
        if (comms) {
          comms.forEach(c => {
            const ackList: string[] = c.next_action_acknowledged_by || [];
            if (ackList.includes(userEmail)) return;

            const actionTitle = c.next_action || c.subject || c.call_brief || '';
            if (!actionTitle) return;

            const dateVal = c.follow_up_date || '';

            // Resolve creator text using profiles mapping
            let creatorTextText = '';
            if (c.call_category?.toLowerCase() === 'incoming') {
              const name = c.call_received_by ? (localUserMap.get(c.call_received_by) || 'System') : 'System';
              creatorTextText = `Received by: ${name}`;
            } else {
              const name = c.call_entered_by ? (localUserMap.get(c.call_entered_by) || 'System') : 'System';
              creatorTextText = `Entered by: ${name}`;
            }
            
            items.push({
              id: `comm-${c.id}`,
              source: 'communication',
              title: actionTitle,
              contextInfo: `Client: ${(c.client as any)?.client_name || 'N/A'}${c.call_brief && c.call_brief !== actionTitle ? ' | ' + c.call_brief.substring(0, 60) : ''}`,
              authorName: c.party_type || 'Communication',
              date: dateVal,
              isOverdue: dateVal ? dateVal < todayStr : false,
              creatorText: creatorTextText,
              createdAt: c.created_at,
              rawItem: c
            });
          });
        }
      } catch (e) {
        console.error('Error fetching mobile communications:', e);
      }

      // 2.2 Fetch Site Visits
      try {
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
              items.push({
                id: `visit-${v.id}`,
                source: 'visit',
                title: v.next_step || v.purpose,
                contextInfo: `Client: ${v.clients?.client_name || 'N/A'} | Project: ${v.projects?.project_name || 'N/A'}`,
                authorName: v.visited_by || v.engineer || 'Unknown',
                date: dateVal,
                isOverdue: dateVal ? dateVal < todayStr : false,
                createdAt: v.created_at,
                rawItem: v
              });
            }
          });
        }
      } catch (e) {
        console.error('Error fetching mobile site visits:', e);
      }

      // 2.3 Fetch Site Reports
      try {
        let reportsQuery = supabase
          .from('site_reports')
          .select('*, projects(project_name)')
          .eq('organisation_id', orgId)
          .neq('pm_status', 'Draft');

        if (!isPowerUser) {
          reportsQuery = reportsQuery.eq('created_by', userEmail);
        }

        const { data: reports } = await reportsQuery;
        if (reports) {
          reports.forEach(r => {
            const ackList: string[] = r.next_action_acknowledged_by || [];
            if (ackList.includes(userEmail)) return;

            if (r.work_plan_next_day) {
              const dateVal = r.report_date || '';
              items.push({
                id: `report-${r.id}`,
                source: 'report',
                title: r.work_plan_next_day,
                contextInfo: `Project: ${r.projects?.project_name || 'N/A'}`,
                authorName: r.created_by || 'Unknown',
                date: dateVal,
                isOverdue: dateVal ? dateVal < todayStr : false,
                createdAt: r.created_at,
                rawItem: r
              });
            }
          });
        }
      } catch (e) {}

      // 2.4 Fetch Issues
      try {
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
            items.push({
              id: `issue-${i.id}`,
              source: 'issue',
              title: i.title,
              contextInfo: `Client: ${i.clients?.client_name || 'N/A'} | Project: ${i.projects?.project_name || 'N/A'}`,
              authorName: i.reported_by_name || 'System',
              date: dateVal,
              isOverdue: dateVal ? dateVal < todayStr : false,
              createdAt: i.created_at,
              rawItem: i
            });
          });
        }
      } catch (e) {}

      // 2.5 Fetch Leads
      try {
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
              items.push({
                id: `lead-${l.id}`,
                source: 'lead',
                title: l.next_action_label || `Lead follow up: ${l.requirement_summary}`,
                contextInfo: `Lead: ${l.contact_name} | Company: ${l.company_name || 'N/A'}`,
                authorName: l.owner_name || 'System',
                date: dateVal,
                isOverdue: dateVal ? dateVal < todayStr : false,
                createdAt: l.created_at,
                rawItem: l
              });
            }
          });
        }
      } catch (e) {}

      // Sort items by creation date descending (newest first)
      const sortedActive = items.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setNextActions(sortedActive);

      // ═══════════════════════════════════════════════════════════════════════
      // 3. Fetch History Items
      // ═══════════════════════════════════════════════════════════════════════
      const historyItems: NextActionItem[] = [];

      try {
        const [q1, q2] = await Promise.all([
          supabase
            .from('client_communication')
            .select('id, next_action, subject, call_brief, follow_up_date, created_at, status, party_type, call_category, call_regarding, client_id, call_entered_by, call_received_by, assigned_to, next_action_acknowledged_by, is_resolved, client:clients!client_communication_client_id_fkey(client_name), replies:client_communication!parent_communication_id(id, call_brief, created_at, call_entered_by)')
            .eq('organisation_id', orgId)
            .eq('is_resolved', true)
            .order('created_at', { ascending: false })
            .limit(15),
          supabase
            .from('client_communication')
            .select('id, next_action, subject, call_brief, follow_up_date, created_at, status, party_type, call_category, call_regarding, client_id, call_entered_by, call_received_by, assigned_to, next_action_acknowledged_by, is_resolved, client:clients!client_communication_client_id_fkey(client_name), replies:client_communication!parent_communication_id(id, call_brief, created_at, call_entered_by)')
            .eq('organisation_id', orgId)
            .contains('next_action_acknowledged_by', [userEmail])
            .order('created_at', { ascending: false })
            .limit(15)
        ]);

        const commsHistMap = new Map<string, any>();
        if (q1.data) q1.data.forEach(item => commsHistMap.set(item.id, item));
        if (q2.data) q2.data.forEach(item => commsHistMap.set(item.id, item));
        const commsHist = Array.from(commsHistMap.values())
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 15);
        if (commsHist) {
          commsHist.forEach(c => {
            const actionTitle = c.next_action || c.subject || c.call_brief || '';
            if (!actionTitle) return;

            // Resolve creator text using profiles mapping
            let creatorTextText = '';
            if (c.call_category?.toLowerCase() === 'incoming') {
              const name = c.call_received_by ? (localUserMap.get(c.call_received_by) || 'System') : 'System';
              creatorTextText = `Received by: ${name}`;
            } else {
              const name = c.call_entered_by ? (localUserMap.get(c.call_entered_by) || 'System') : 'System';
              creatorTextText = `Entered by: ${name}`;
            }

            historyItems.push({
              id: `comm-${c.id}`,
              source: 'communication',
              title: actionTitle,
              contextInfo: `Client: ${(c.client as any)?.client_name || 'N/A'}${c.call_brief && c.call_brief !== actionTitle ? ' | ' + c.call_brief.substring(0, 60) : ''}`,
              authorName: c.party_type || 'Communication',
              date: c.follow_up_date || '',
              isOverdue: false,
              creatorText: creatorTextText,
              createdAt: c.created_at,
              rawItem: c
            });
          });
        }
      } catch (e) {}

      try {
        const [v1, v2] = await Promise.all([
          supabase
            .from('site_visits')
            .select('*, clients(client_name), projects(project_name)')
            .eq('organisation_id', orgId)
            .in('status', ['completed', 'cancelled'])
            .order('visit_date', { ascending: false })
            .limit(8),
          supabase
            .from('site_visits')
            .select('*, clients(client_name), projects(project_name)')
            .eq('organisation_id', orgId)
            .contains('next_action_acknowledged_by', [userEmail])
            .order('visit_date', { ascending: false })
            .limit(8)
        ]);

        const visitsHistMap = new Map<string, any>();
        if (v1.data) v1.data.forEach(item => visitsHistMap.set(item.id, item));
        if (v2.data) v2.data.forEach(item => visitsHistMap.set(item.id, item));
        const visitsHist = Array.from(visitsHistMap.values())
          .sort((a, b) => new Date(b.visit_date || 0).getTime() - new Date(a.visit_date || 0).getTime())
          .slice(0, 8);
        if (visitsHist) {
          visitsHist.forEach(v => {
            historyItems.push({
              id: `visit-${v.id}`,
              source: 'visit',
              title: v.next_step || v.purpose || 'Site visit completed',
              contextInfo: `Client: ${v.clients?.client_name || 'N/A'} | Project: ${v.projects?.project_name || 'N/A'}`,
              authorName: v.visited_by || 'Unknown',
              date: v.visit_date || '',
              isOverdue: false,
              createdAt: v.created_at,
              rawItem: v
            });
          });
        }
      } catch (e) {}

      // Sort history items by creation date descending (newest first)
      const sortedHistory = historyItems.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setHistory(sortedHistory);

    } catch (e) {
      console.error('Error fetching mobile next actions data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchNextActionsData();
  }, [fetchNextActionsData]);

  // Acknowledge Action mutation equivalent
  const acknowledge = async (item: NextActionItem, comment?: string) => {
    if (isDemo) {
      setNextActions(prev => prev.filter(x => x.id !== item.id));
      alert('Action acknowledged (Demo Mode)');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userEmail = user.email || '';
      const userId = user.id;

      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const orgId = memberData?.organisation_id;
      const realId = item.id.substring(item.id.indexOf('-') + 1);

      let tableName = '';
      if (item.source === 'communication') tableName = 'client_communication';
      else if (item.source === 'visit') tableName = 'site_visits';
      else if (item.source === 'report') tableName = 'site_reports';
      else if (item.source === 'issue') tableName = 'issues';
      else if (item.source === 'lead') tableName = 'leads';

      if (!tableName) return;

      // 1. Fetch current acknowledged list
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

      // 2. Update list
      const { error: updateErr } = await supabase
        .from(tableName)
        .update({ next_action_acknowledged_by: currentAckList })
        .eq('id', realId);

      if (updateErr) throw updateErr;

      // 3. Create comment thread reply
      if (comment && item.source === 'communication' && orgId) {
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
        if (replyErr) console.error('Error creating mobile reply:', replyErr);
      }

      await fetchNextActionsData();
      alert('Action acknowledged');

    } catch (e) {
      console.error('Error acknowledging mobile action:', e);
      alert('Failed to acknowledge action');
    }
  };

  // Resolve Action mutation equivalent
  const resolve = async (itemId: string, rawItem: any, comment?: string) => {
    if (isDemo) {
      setNextActions(prev => prev.filter(x => x.id !== itemId));
      alert('Action resolved (Demo Mode)');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const orgId = memberData?.organisation_id;
      const realId = itemId.substring(itemId.indexOf('-') + 1);

      // 1. Resolve Communication Log
      const { error } = await supabase
        .from('client_communication')
        .update({ is_resolved: true, status: 'Closed' })
        .eq('id', realId);

      if (error) throw error;

      // 2. Create comment thread reply
      if (comment && rawItem && orgId) {
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
        if (replyErr) console.error('Error creating mobile resolution reply:', replyErr);
      }

      await fetchNextActionsData();
      alert('Action resolved');

    } catch (e) {
      console.error('Error resolving mobile action:', e);
      alert('Failed to resolve action');
    }
  };

  return {
    nextActions,
    history,
    isLoading,
    refetch: fetchNextActionsData,
    acknowledge,
    resolve
  };
}
