import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { LinkedItemType, UnifiedTimelineEntry } from '../types/followup';

function humanEventLabel(eventType: string): string {
  switch (eventType) {
    case 'quotation_reminder_sent': return 'Reminder sent';
    case 'quotation_response_logged': return 'Response logged';
    case 'podc_pack_shared': return 'DC pack shared';
    case 'podc_issue_flagged': return 'Issue flagged';
    case 'invoice_reminder_sent': return 'Payment reminder';
    case 'invoice_escalation_changed': return 'Escalation updated';
    default: return eventType;
  }
}

export function useItemHistory(
  organisationId: string | undefined,
  linkedType: LinkedItemType | undefined,
  linkedId: string | undefined
) {
  return useQuery<UnifiedTimelineEntry[]>({
    queryKey: ['item-history', organisationId, linkedType, linkedId],
    queryFn: async () => {
      if (!organisationId || !linkedType || !linkedId) return [];

      const isLead = linkedType === 'lead';

      const [activityRes, commsRes] = await Promise.all([
        supabase
          .from('follow_up_activity_log')
          .select('id, event_type, title, description, actor_name, created_at, reference_id, reference_label, metadata')
          .eq('organisation_id', organisationId)
          .eq('reference_id', linkedId)
          .order('created_at', { ascending: false })
          .limit(100),
        isLead
          ? supabase
              .from('client_communication')
              .select('id, call_brief, call_type, call_regarding, next_action, status, priority, created_at, updated_at')
              .eq('lead_id', linkedId)
              .order('created_at', { ascending: false })
              .limit(100)
          : supabase
              .from('client_communication')
              .select('id, call_brief, call_type, call_regarding, next_action, status, priority, created_at, updated_at')
              .eq('linked_type', linkedType)
              .eq('linked_id', linkedId)
              .order('created_at', { ascending: false })
              .limit(100),
      ]);

      if (activityRes.error) throw activityRes.error;
      if (commsRes.error) throw commsRes.error;

      const activityEntries: UnifiedTimelineEntry[] = (activityRes.data || []).map(
        (row: Record<string, unknown>) => ({
          id: String(row.id),
          source: 'follow_up' as const,
          title: String(row.title || ''),
          description: String(row.description || ''),
          actor_name: String(row.actor_name || 'System'),
          created_at: String(row.created_at),
          event_type: row.event_type as UnifiedTimelineEntry['event_type'],
          metadata: (row.metadata as Record<string, string>) || undefined,
        })
      );

      const commEntries: UnifiedTimelineEntry[] = (commsRes.data || []).map(
        (row: Record<string, unknown>) => ({
          id: String(row.id),
          source: 'client_communication' as const,
          title: `${String(row.call_type || 'Communication')}${row.call_regarding ? ` — ${String(row.call_regarding)}` : ''}`,
          description: String(row.call_brief || ''),
          actor_name: 'Client Communication',
          created_at: String(row.created_at),
          linked_type: linkedType,
          linked_id: linkedId,
          metadata: {
            call_type: String(row.call_type || ''),
            call_regarding: String(row.call_regarding || ''),
            next_action: String(row.next_action || ''),
            status: String(row.status || ''),
            priority: String(row.priority || ''),
          },
        })
      );

      return [...activityEntries, ...commEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!organisationId && !!linkedType && !!linkedId,
  });
}
