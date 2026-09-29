import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { formatFollowUpCurrency } from '../lib/followup/currency-format';
import type { LinkedItemType, UnifiedTimelineEntry } from '../types/followup';

function humanEventLabel(eventType: string): string {
  switch (eventType) {
    case 'quotation_reminder_sent': return 'Reminder sent';
    case 'quotation_response_logged': return 'Response logged';
    case 'podc_pack_shared': return 'DC pack shared';
    case 'podc_issue_flagged': return 'Issue flagged';
    case 'invoice_reminder_sent': return 'Payment reminder';
    case 'invoice_escalation_changed': return 'Escalation updated';
    case 'procurement_reminder_sent': return 'PO reminder sent';
    case 'po_created': return 'PO created';
    case 'po_expected_updated': return 'Expected date updated';
    case 'po_supplier_call_logged': return 'Supplier call logged';
    case 'followup_reassigned': return 'Follow-up reassigned';
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

      const [activityRes, commsRes, lifecycle] = await Promise.all([
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
              .select('id, call_brief, call_type, call_regarding, next_action, status, priority, created_at, updated_at, call_entered_by, call_received_by')
              .eq('lead_id', linkedId)
              .order('created_at', { ascending: false })
              .limit(100)
          : supabase
              .from('client_communication')
              .select('id, call_brief, call_type, call_regarding, next_action, status, priority, created_at, updated_at, call_entered_by, call_received_by')
              .eq('linked_type', linkedType)
              .eq('linked_id', linkedId)
              .order('created_at', { ascending: false })
              .limit(100),
        fetchLifecycleMilestones(organisationId, linkedType, linkedId),
      ]);

      if (activityRes.error) {
        console.warn('[item-history] activity source failed, showing remaining sources:', activityRes.error.message);
      }
      if (commsRes.error) {
        console.warn('[item-history] communication source failed, showing remaining sources:', commsRes.error.message);
      }

      const activityEntries: UnifiedTimelineEntry[] = activityRes.error
        ? []
        : ((activityRes.data || []) as Record<string, unknown>[]).map((row) => ({
          id: String(row.id),
          source: 'follow_up' as const,
          title: String(row.title || ''),
          description: String(row.description || ''),
          actor_name: String(row.actor_name || 'System'),
          created_at: String(row.created_at),
          event_type: row.event_type as UnifiedTimelineEntry['event_type'],
          metadata: (row.metadata as Record<string, string>) || undefined,
        }));

      const commRows = (commsRes.error
        ? []
        : (commsRes.data || [])) as Record<string, unknown>[];
      const enteredByIds = commRows.map((row) =>
        String(row.call_entered_by || row.call_received_by || '')
      );
      const enteredByNames = await resolveCreatorNames(enteredByIds);

      const commEntries: UnifiedTimelineEntry[] = commRows.map((row) => {
        const enteredBy = String(row.call_entered_by || row.call_received_by || '');
        return {
          id: String(row.id),
          source: 'client_communication' as const,
          title: `${String(row.call_type || 'Communication')}${row.call_regarding ? ` — ${String(row.call_regarding)}` : ''}`,
          description: String(row.call_brief || ''),
          actor_name: enteredByNames.get(enteredBy) || 'Client Communication',
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
        };
      });

      return [...activityEntries, ...commEntries, ...lifecycle].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!organisationId && !!linkedType && !!linkedId,
  });
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Resolve creator ids (auth user id or user_profiles id) to display names.
 * Empty map when unresolvable — callers keep their fallbacks.
 */
async function resolveCreatorNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;
  try {
    const [byId, byUser] = await Promise.all([
      supabase.from('user_profiles').select('*').in('id', uniq),
      supabase.from('user_profiles').select('*').in('user_id', uniq),
    ]);
    for (const r of [...(byId.data || []), ...(byUser.data || [])]) {
      const rec = r as Record<string, unknown>;
      const name = String(
        rec.full_name || rec.display_name || rec.name || rec.email || ''
      ).trim();
      if (!name) continue;
      if (rec.id) map.set(String(rec.id), name);
      if (rec.user_id) map.set(String(rec.user_id), name);
    }
  } catch {
    /* ignore — fallbacks apply */
  }
  return map;
}

/**
 * Resolve a creator id (auth user id or user_profiles id) to a display
 * name. Null when unresolvable — callers fall back to 'System'.
 */
async function resolveCreatorName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await resolveCreatorNames([id])).get(id) || null;
}

/**
 * Document lifecycle milestones synthesized from the source document itself.
 * The activity log only captures actions taken inside the Follow-Up Centre
 * (reminders, responses, flags) — creation, due-date crossings and receipts
 * are never logged anywhere, so History would be empty for documents that
 * were never acted on here. These entries close that gap.
 *
 * Fail-soft by design: any fetch problem returns [] so the timeline can
 * never break because of lifecycle enrichment.
 */
async function fetchLifecycleMilestones(
  organisationId: string,
  linkedType: LinkedItemType,
  linkedId: string
): Promise<UnifiedTimelineEntry[]> {
  try {
    switch (linkedType) {
      case 'quotation': {
        const { data, error } = await supabase
          .from('quotation_header')
          .select('*')
          .eq('organisation_id', organisationId)
          .eq('id', linkedId)
          .maybeSingle();
        if (error || !data) return [];
        const q = data as Record<string, unknown>;
        const no = String(q.quotation_no || '');
        const submitted = String(q.created_at || q.date || '');
        const validTill = String(q.valid_till || '');
        const creatorRaw = String(q.created_by || q.prepared_by || '').trim();
        const actor = isUuid(creatorRaw)
          ? ((await resolveCreatorName(creatorRaw)) || 'System')
          : creatorRaw || 'System';
        const out: UnifiedTimelineEntry[] = [];
        if (submitted) {
          out.push({
            id: `lc-quotation-${linkedId}-created`,
            source: 'follow_up',
            title: `Quotation ${no} submitted`,
            description: `${formatFollowUpCurrency(Number(q.grand_total || 0))} · Status: ${String(q.status || '')}`,
            actor_name: actor,
            created_at: submitted,
          });
        }
        if (validTill && new Date(validTill).getTime() < Date.now()) {
          out.push({
            id: `lc-quotation-${linkedId}-expired`,
            source: 'follow_up',
            title: 'Validity expired',
            description: `Valid till ${validTill}`,
            actor_name: actor,
            created_at: validTill,
          });
        }
        return out;
      }
      case 'invoice': {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('organisation_id', organisationId)
          .eq('id', linkedId)
          .maybeSingle();
        if (error || !data) return [];
        const inv = data as Record<string, unknown>;
        const no = String(inv.invoice_no || '');
        const raised = String(inv.created_at || inv.invoice_date || '');
        const due = String(inv.due_date || '');
        const balance = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
        const creatorRaw = String(inv.created_by || '').trim();
        const actor = isUuid(creatorRaw)
          ? ((await resolveCreatorName(creatorRaw)) || 'System')
          : creatorRaw || 'System';
        const out: UnifiedTimelineEntry[] = [];
        if (raised) {
          out.push({
            id: `lc-invoice-${linkedId}-raised`,
            source: 'follow_up',
            title: `Invoice ${no} raised`,
            description: `${formatFollowUpCurrency(Number(inv.total || 0))} · Due ${due || '—'}`,
            actor_name: actor,
            created_at: raised,
          });
        }
        if (due && balance > 0 && new Date(due).getTime() < Date.now()) {
          out.push({
            id: `lc-invoice-${linkedId}-due-crossed`,
            source: 'follow_up',
            title: 'Payment due date crossed',
            description: `Balance due ${formatFollowUpCurrency(balance)}`,
            actor_name: actor,
            created_at: due,
          });
        }
        return out;
      }
      case 'podc': {
        const { data, error } = await supabase
          .from('follow_up_podc_backlog')
          .select('*')
          .eq('organisation_id', organisationId)
          .eq('id', linkedId)
          .maybeSingle();
        if (error || !data) return [];
        const b = data as Record<string, unknown>;
        const label = String(b.dc_wo_number || '');
        const opened = String(b.created_at || '');
        const creatorRaw = String(b.created_by || '').trim();
        const actor = isUuid(creatorRaw)
          ? ((await resolveCreatorName(creatorRaw)) || 'System')
          : creatorRaw || 'System';
        const out: UnifiedTimelineEntry[] = [];
        if (opened) {
          out.push({
            id: `lc-podc-${linkedId}-delivered`,
            source: 'follow_up',
            title: `${label} delivered — PO pending`,
            description: `${formatFollowUpCurrency(Number(b.estimated_value || 0))} · ${Number(b.days_pending_po || 0)}d without PO`,
            actor_name: actor,
            created_at: opened,
          });
        }
        if (b.issue_flag) {
          const flaggedAt = String(b.updated_at || opened);
          if (flaggedAt) {
            out.push({
              id: `lc-podc-${linkedId}-issue`,
              source: 'follow_up',
              title: `Issue flagged: ${String(b.issue_flag).replace(/_/g, ' ')}`,
              description: label,
              actor_name: actor,
              created_at: flaggedAt,
            });
          }
        }
        if (b.po_received_at) {
          const received = String(b.po_received_at);
          if (received) {
            out.push({
              id: `lc-podc-${linkedId}-po-received`,
              source: 'follow_up',
              title: 'Client PO received',
              description: label,
              actor_name: actor,
              created_at: received,
            });
          }
        }
        return out;
      }
      case 'lead': {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('organisation_id', organisationId)
          .eq('id', linkedId)
          .maybeSingle();
        if (error || !data) return [];
        const l = data as Record<string, unknown>;
        const name = String(l.company_name || l.contact_name || '');
        const captured = String(l.created_at || l.updated_at || '');
        const creatorRaw = String(l.created_by || '').trim();
        const actor = isUuid(creatorRaw)
          ? ((await resolveCreatorName(creatorRaw)) || 'System')
          : creatorRaw || 'System';
        const out: UnifiedTimelineEntry[] = [];
        if (captured) {
          out.push({
            id: `lc-lead-${linkedId}-captured`,
            source: 'follow_up',
            title: `Lead captured: ${name}`,
            description: `Status: ${String(l.status || '')}`,
            actor_name: actor,
            created_at: captured,
          });
        }
        return out;
      }
      case 'procurement': {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('organisation_id', organisationId)
          .eq('id', linkedId)
          .maybeSingle();
        if (error || !data) return [];
        const po = data as Record<string, unknown>;
        const no = String(po.po_number || po.po_no || '');
        const raised = String(po.created_at || po.po_date || po.date || '');
        const creatorRaw = String(po.created_by || '').trim();
        const actor = isUuid(creatorRaw)
          ? ((await resolveCreatorName(creatorRaw)) || 'System')
          : creatorRaw || 'System';
        const out: UnifiedTimelineEntry[] = [];
        if (raised) {
          out.push({
            id: `lc-procurement-${linkedId}-created`,
            source: 'follow_up',
            title: `PO ${no} created`,
            description: `${formatFollowUpCurrency(Number(po.total_amount || po.grand_total || 0))} · Status: ${String(po.status || '')}`,
            actor_name: actor,
            created_at: raised,
          });
        }
        return out;
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}
