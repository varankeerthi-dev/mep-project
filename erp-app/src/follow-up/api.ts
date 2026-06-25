import { differenceInCalendarDays, parseISO } from 'date-fns';
import { supabase } from '../supabase';
import { getReminderStage } from '../lib/followup/escalation-engine';
import {
  canTransition,
  detectEffectiveStatus,
  getDbStatus,
  getTransitionToStatus,
  isExpired,
} from '../lib/followup/quotation-workflow';
import type {
  ActivityEventType,
  FollowUpActivityLog,
  FollowUpTab,
  InvoiceFollowUp,
  PodcBacklogItem,
  PodcDeliveryProofStatus,
  PodcDisputeStatus,
  PodcIssueFlag,
  QuotationFollowUp,
  QuotationFollowUpStatus,
  QuotationResponseOption,
  ProcurementFollowUp,
} from '../types/followup';

const QUOTATION_FOLLOW_UP_STATUSES = [
  'Sent',
  'Under Negotiation',
  'Approved',
  'Rejected',
  'Cancelled',
  'PENDING_APPROVAL',
];

function mapQuotationStatus(
  dbStatus: string | null | undefined,
  trackingStatus: string | null | undefined,
  validTill?: string | null | undefined
): QuotationFollowUpStatus {
  if (trackingStatus) {
    const ts = trackingStatus as QuotationFollowUpStatus;
    if (validTill) return detectEffectiveStatus(ts, validTill);
    return ts;
  }
  const s = (dbStatus || 'sent').toLowerCase();
  if (s.includes('negotiation')) return 'in_negotiation';
  if (s.includes('review')) return 'under_review';
  if (s === 'rejected') return 'lost_to_competitor';
  if (s === 'sent') return 'sent';
  if (s === 'approved') return 'approved';
  if (s === 'expired') return 'expired';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending_approval') return 'pending';
  return 'pending';
}

function mapResponseToStatus(response: QuotationResponseOption): QuotationFollowUpStatus {
  return getTransitionToStatus(response);
}

function mapResponseToDbStatus(response: QuotationResponseOption): string {
  return getDbStatus(response);
}

function computeCollectionRisk(daysOverdue: number, balance: number): InvoiceFollowUp['collection_risk'] {
  const stage = getReminderStage(daysOverdue);
  if (stage >= 4 || balance > 2000000) return 'critical';
  if (stage >= 3) return 'high';
  if (stage >= 2) return 'medium';
  return 'low';
}

export function isFollowUpSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('follow_up_') ||
    msg.includes('schema cache')
  );
}

export async function fetchFollowUpQuotations(
  organisationId: string
): Promise<QuotationFollowUp[]> {
  const { data: quotes, error } = await supabase
    .from('quotation_header')
    .select(
      `
      id,
      quotation_no,
      date,
      valid_till,
      grand_total,
      status,
      contact_no,
      client:clients(id, client_name, contact),
      project:projects(id, project_name),
      tracking:follow_up_quotation_tracking(
        follow_up_status,
        last_reminder_at,
        pdf_url,
        contact_phone,
        assignee_user_id
      )
    `
    )
    .eq('organisation_id', organisationId)
    .in('status', QUOTATION_FOLLOW_UP_STATUSES)
    .order('date', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (quotes || []).map((q: Record<string, unknown>) => {
    const tracking = Array.isArray(q.tracking) ? q.tracking[0] : q.tracking;
    const client = q.client as Record<string, unknown> | null;
    const project = q.project as Record<string, unknown> | null;
    const track = tracking as Record<string, unknown> | undefined;

    return {
      id: String(q.id),
      quotation_no: String(q.quotation_no || ''),
      client_name: String(client?.client_name || '—'),
      project_name: String(project?.project_name || '—'),
      total_value: Number(q.grand_total || 0),
      status: mapQuotationStatus(
        q.status as string,
        track?.follow_up_status as string | undefined,
        q.valid_till as string | undefined
      ),
      submitted_date: String(q.date || '').split('T')[0],
      valid_till: String(q.valid_till || '').split('T')[0],
      pdf_url:
        (track?.pdf_url as string) ||
        `${window.location.origin}/quotation/view?id=${q.id}`,
      contact_phone:
        (track?.contact_phone as string) ||
        (client?.contact as string) ||
        (q.contact_no as string) ||
        undefined,
      last_follow_up_at: track?.last_reminder_at
        ? String(track.last_reminder_at).split('T')[0]
        : null,
      assignee_user_id: (track?.assignee_user_id as string) || null,
      assignee_name: null,
    };
  });
}

export async function fetchFollowUpPodc(organisationId: string): Promise<PodcBacklogItem[]> {
  const { data, error } = await supabase
    .from('follow_up_podc_backlog')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('days_pending_po', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    dc_wo_number: String(row.dc_wo_number),
    client_name: String(row.client_name),
    project_name: String(row.project_name || ''),
    estimated_value: Number(row.estimated_value || 0),
    days_pending_po: Number(row.days_pending_po || 0),
    site_engineer: String(row.site_engineer || ''),
    client_coordinator: String(row.client_coordinator || ''),
    delivery_proof_status: (row.delivery_proof_status as PodcDeliveryProofStatus) || 'pending',
    dispute_status: (row.dispute_status as PodcDisputeStatus) || 'none',
    signed_dc_url: String(row.signed_dc_url || '#'),
    delivery_photo_urls: (row.delivery_photo_urls as string[]) || [],
    completion_photo_urls: (row.completion_photo_urls as string[]) || [],
    contact_phone: (row.contact_phone as string) || undefined,
    issue_flag: (row.issue_flag as PodcIssueFlag) || null,
    assignee_user_id: (row.assignee_user_id as string) || null,
    assignee_name: null,
  }));
}

export async function fetchFollowUpInvoices(organisationId: string): Promise<InvoiceFollowUp[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      `
      id,
      invoice_no,
      invoice_date,
      due_date,
      total,
      paid_amount,
      status,
      client:clients(id, client_name, contact, email),
      tracking:follow_up_invoice_tracking(
        last_reminder_at,
        collection_risk,
        payment_link,
        contact_phone,
        assignee_user_id
      )
    `
    )
    .eq('organisation_id', organisationId)
    .eq('status', 'final')
    .order('due_date', { ascending: true })
    .limit(500);

  if (error) throw error;

  const today = new Date();

  return (data || [])
    .map((inv: Record<string, unknown>) => {
      const total = Number(inv.total || 0);
      const paid = Number(inv.paid_amount || 0);
      const balance = Math.max(0, total - paid);
      if (balance <= 0) return null;

      const dueStr = String(inv.due_date || inv.invoice_date || '').split('T')[0];
      let daysOverdue = 0;
      try {
        daysOverdue = differenceInCalendarDays(today, parseISO(dueStr));
      } catch {
        daysOverdue = 0;
      }

      const tracking = Array.isArray(inv.tracking) ? inv.tracking[0] : inv.tracking;
      const track = tracking as Record<string, unknown> | undefined;
      const client = inv.client as Record<string, unknown> | null;

      return {
        id: String(inv.id),
        invoice_no: String(inv.invoice_no || `INV-${String(inv.id).slice(0, 8)}`),
        client_name: String(client?.client_name || '—'),
        project_name: '—',
        balance_due: balance,
        total_amount: total,
        due_date: dueStr,
        days_overdue: daysOverdue,
        payment_link: (track?.payment_link as string) || undefined,
        contact_phone:
          (track?.contact_phone as string) ||
          (client?.contact as string) ||
          undefined,
        collection_risk:
          (track?.collection_risk as InvoiceFollowUp['collection_risk']) ||
          computeCollectionRisk(daysOverdue, balance),
        last_reminder_at: (track?.last_reminder_at as string) || null,
        assignee_user_id: (track?.assignee_user_id as string) || null,
        assignee_name: null,
      } satisfies InvoiceFollowUp;
    })
    .filter(Boolean) as InvoiceFollowUp[];
}

export async function fetchFollowUpActivity(
  organisationId: string,
  limit = 200
): Promise<FollowUpActivityLog[]> {
  const { data, error } = await supabase
    .from('follow_up_activity_log')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    event_type: row.event_type as ActivityEventType,
    tab_source: row.tab_source as FollowUpTab,
    title: String(row.title),
    description: String(row.description || ''),
    actor_name: String(row.actor_name || 'System'),
    reference_id: String(row.reference_id || ''),
    reference_label: String(row.reference_label || ''),
    created_at: String(row.created_at),
    metadata: (row.metadata as Record<string, string>) || undefined,
  }));
}

async function logActivity(
  organisationId: string,
  payload: {
    event_type: ActivityEventType;
    tab_source: FollowUpTab;
    title: string;
    description?: string;
    reference_id?: string;
    reference_label?: string;
    metadata?: Record<string, string>;
    actor_name?: string;
  }
) {
  const { error } = await supabase.rpc('follow_up_log_activity', {
    p_organisation_id: organisationId,
    p_event_type: payload.event_type,
    p_tab_source: payload.tab_source,
    p_title: payload.title,
    p_description: payload.description ?? '',
    p_reference_id: payload.reference_id ?? null,
    p_reference_label: payload.reference_label ?? '',
    p_metadata: payload.metadata ?? {},
    p_actor_name: payload.actor_name ?? null,
  });

  if (error) {
    const { error: insertError } = await supabase.from('follow_up_activity_log').insert({
      organisation_id: organisationId,
      event_type: payload.event_type,
      tab_source: payload.tab_source,
      title: payload.title,
      description: payload.description ?? '',
      reference_id: payload.reference_id ?? null,
      reference_label: payload.reference_label ?? '',
      metadata: payload.metadata ?? {},
      actor_name: payload.actor_name ?? 'User',
    });
    if (insertError) throw insertError;
  }
}

export async function upsertQuotationResponse(
  organisationId: string,
  quotationId: string,
  response: QuotationResponseOption,
  meta: { quotation_no: string; client_name: string },
  previousStatus?: QuotationFollowUpStatus | null
) {
  if (previousStatus && !canTransition(previousStatus, response)) {
    throw new Error(
      `Cannot transition from "${previousStatus}" to "${response}". Allowed transitions: ${canTransition(previousStatus, response) ? 'allowed' : 'denied'}`
    );
  }

  const followStatus = mapResponseToStatus(response);
  const dbStatus = mapResponseToDbStatus(response);

  const { data: existingTracking } = await supabase
    .from('follow_up_quotation_tracking')
    .select('follow_up_status')
    .eq('organisation_id', organisationId)
    .eq('quotation_id', quotationId)
    .maybeSingle();

  const prevTrackingStatus = (existingTracking?.follow_up_status as QuotationFollowUpStatus) || previousStatus || null;

  const { error: trackError } = await supabase.from('follow_up_quotation_tracking').upsert(
    {
      organisation_id: organisationId,
      quotation_id: quotationId,
      follow_up_status: followStatus,
      notes: `Status changed: ${prevTrackingStatus || 'unknown'} → ${followStatus}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organisation_id,quotation_id' }
  );
  if (trackError) throw trackError;

  const { error: quoteError } = await supabase
    .from('quotation_header')
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .eq('id', quotationId)
    .eq('organisation_id', organisationId);
  if (quoteError) throw quoteError;

  await logActivity(organisationId, {
    event_type: 'quotation_status_changed',
    tab_source: 'quotation',
    title: `${meta.quotation_no} → ${response.replace(/_/g, ' ')}`,
    description: `${meta.client_name} — status changed from ${prevTrackingStatus || 'new'} to ${followStatus.replace(/_/g, ' ')}`,
    reference_id: quotationId,
    reference_label: meta.quotation_no,
    metadata: {
      response,
      previous_status: prevTrackingStatus || 'unknown',
      new_status: followStatus,
    },
  });

  await logActivity(organisationId, {
    event_type: 'quotation_response_logged',
    tab_source: 'quotation',
    title: `Response: ${response.replace(/_/g, ' ')}`,
    description: `${meta.client_name} — ${meta.quotation_no}`,
    reference_id: quotationId,
    reference_label: meta.quotation_no,
    metadata: { response },
  });
}

export async function recordQuotationReminder(
  organisationId: string,
  quotationId: string,
  meta: { quotation_no: string; client_name: string }
) {
  const now = new Date().toISOString();
  await supabase.from('follow_up_quotation_tracking').upsert(
    {
      organisation_id: organisationId,
      quotation_id: quotationId,
      last_reminder_at: now,
      updated_at: now,
    },
    { onConflict: 'organisation_id,quotation_id' }
  );

  await logActivity(organisationId, {
    event_type: 'quotation_reminder_sent',
    tab_source: 'quotation',
    title: 'Quotation reminder sent',
    description: `${meta.client_name} — ${meta.quotation_no}`,
    reference_id: quotationId,
    reference_label: meta.quotation_no,
  });
}

export async function flagPodcIssue(
  organisationId: string,
  backlogId: string,
  issue: PodcIssueFlag,
  meta: { dc_wo_number: string }
) {
  const { error } = await supabase
    .from('follow_up_podc_backlog')
    .update({
      issue_flag: issue,
      dispute_status: 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', backlogId)
    .eq('organisation_id', organisationId);
  if (error) throw error;

  await logActivity(organisationId, {
    event_type: 'podc_issue_flagged',
    tab_source: 'podc',
    title: `Issue: ${issue.replace(/_/g, ' ')}`,
    description: meta.dc_wo_number,
    reference_id: backlogId,
    reference_label: meta.dc_wo_number,
    metadata: { issue },
  });
}

export async function recordPodcPackShared(
  organisationId: string,
  backlogId: string,
  meta: { dc_wo_number: string; client_name: string }
) {
  await logActivity(organisationId, {
    event_type: 'podc_pack_shared',
    tab_source: 'podc',
    title: 'Signed DC pack shared',
    description: `${meta.client_name} — ${meta.dc_wo_number}`,
    reference_id: backlogId,
    reference_label: meta.dc_wo_number,
  });
}

export async function recordInvoiceReminder(
  organisationId: string,
  invoiceId: string,
  meta: { invoice_no: string; client_name: string }
) {
  const now = new Date().toISOString();
  await supabase.from('follow_up_invoice_tracking').upsert(
    {
      organisation_id: organisationId,
      invoice_id: invoiceId,
      last_reminder_at: now,
      updated_at: now,
    },
    { onConflict: 'organisation_id,invoice_id' }
  );

  await logActivity(organisationId, {
    event_type: 'invoice_reminder_sent',
    tab_source: 'invoice',
    title: 'Payment reminder sent',
    description: `${meta.client_name} — ${meta.invoice_no}`,
    reference_id: invoiceId,
    reference_label: meta.invoice_no,
  });
}

export async function recordProcurementReminder(
  organisationId: string,
  poId: string,
  meta: { po_no: string; vendor_name: string }
) {
  const now = new Date().toISOString();
  await supabase.from('follow_up_procurement_tracking').upsert(
    {
      organisation_id: organisationId,
      po_id: poId,
      last_reminder_at: now,
      updated_at: now,
    },
    { onConflict: 'organisation_id,po_id' }
  );

  await logActivity(organisationId, {
    event_type: 'procurement_reminder_sent',
    tab_source: 'procurement',
    title: 'Procurement reminder sent',
    description: `${meta.vendor_name} — ${meta.po_no}`,
    reference_id: poId,
    reference_label: meta.po_no,
  });
}

export async function assignFollowUpOwner(
  organisationId: string,
  source: 'quotation' | 'podc' | 'invoice' | 'procurement',
  sourceId: string,
  assigneeUserId: string | null
) {
  const payload = {
    organisation_id: organisationId,
    assignee_user_id: assigneeUserId,
    updated_at: new Date().toISOString(),
  };

  if (source === 'quotation') {
    const { error } = await supabase.from('follow_up_quotation_tracking').upsert(
      { ...payload, quotation_id: sourceId },
      { onConflict: 'organisation_id,quotation_id' }
    );
    if (error) throw error;
    return;
  }

  if (source === 'podc') {
    const { error } = await supabase
      .from('follow_up_podc_backlog')
      .update({ assignee_user_id: assigneeUserId, updated_at: payload.updated_at })
      .eq('id', sourceId)
      .eq('organisation_id', organisationId);
    if (error) throw error;
    return;
  }

  if (source === 'procurement') {
    const { error } = await supabase.from('follow_up_procurement_tracking').upsert(
      { ...payload, po_id: sourceId },
      { onConflict: 'organisation_id,po_id' }
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('follow_up_invoice_tracking').upsert(
    { ...payload, invoice_id: sourceId },
    { onConflict: 'organisation_id,invoice_id' }
  );
  if (error) throw error;
}

export async function fetchFollowUpProcurement(
  organisationId: string
): Promise<ProcurementFollowUp[]> {
  const { data, error } = await supabase
    .from('purchase_order_headers')
    .select(`
      id,
      po_no,
      vendor:vendors(id, name, contact),
      project:projects(id, project_name),
      grand_total,
      status,
      date,
      delivery_date,
      tracking:follow_up_procurement_tracking(
        last_reminder_at,
        contact_phone,
        assignee_user_id
      )
    `)
    .eq('organisation_id', organisationId)
    .order('date', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data || []).map((row: any) => {
    const tracking = Array.isArray(row.tracking) ? row.tracking[0] : row.tracking;
    const vendor = row.vendor as any;
    const project = row.project as any;
    const track = tracking as any;

    const today = new Date();
    const dueStr = String(row.delivery_date || row.date || '').split('T')[0];
    let daysPending = 0;
    try {
      if (row.status !== 'completed' && row.date) {
        daysPending = differenceInCalendarDays(today, parseISO(row.date));
      }
    } catch {
      daysPending = 0;
    }

    return {
      id: String(row.id),
      po_no: String(row.po_no || ''),
      vendor_name: String(vendor?.name || '—'),
      project_name: String(project?.project_name || '—'),
      total_value: Number(row.grand_total || 0),
      status: (row.status as ProcurementFollowUp['status']) || 'po_draft',
      submitted_date: String(row.date || '').split('T')[0],
      due_date: dueStr,
      contact_phone: track?.contact_phone || vendor?.contact || undefined,
      days_pending_vendor: daysPending,
      last_follow_up_at: track?.last_reminder_at
        ? String(track.last_reminder_at).split('T')[0]
        : null,
      assignee_user_id: track?.assignee_user_id || null,
      assignee_name: null,
    };
  });
}
