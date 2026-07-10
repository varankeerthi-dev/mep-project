// Shared helpers for the Work Instruction module.
// Reused by publish (batched per assignee), mid-day add, and close-out streak alerts.
import { supabase } from '../supabase';

// Manager Alerts (MD/manager surface) — distinct from comm-log cards via alert_type.
export async function pushManagerAlert(organisationId: string, summary: string): Promise<void> {
  await supabase.from('manager_alerts').insert({
    organisation_id: organisationId,
    summary,
    alert_type: 'work_instruction',
    status: 'new',
  });
}

// Assignee notifications (reuse existing `notifications` pipe, scoped by notification_type).
// Batched ONE row per distinct assignee for the whole instruction (not per item).
export async function notifyAssignees(
  organisationId: string,
  clientName: string,
  items: { assignees?: string[] }[],
): Promise<void> {
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const a of it.assignees || []) {
      counts.set(a, (counts.get(a) || 0) + 1);
    }
  }
  for (const [userId, n] of counts) {
    await supabase.from('notifications').insert({
      user_id: userId,
      organisation_id: organisationId,
      title: `${n} new work item${n > 1 ? 's' : ''} for ${clientName} today`,
      body: 'Assigned via today’s work instruction.',
      link: '/work-instructions/today',
      notification_type: 'work_instruction',
    });
  }
}

// Mid-day single-item add to an already-published instruction:
// notify ONLY that item's assignees (no re-notify of the whole team).
export async function notifyNewItemAssignees(
  organisationId: string,
  clientName: string,
  item: { assignees?: string[]; description?: string },
): Promise<void> {
  for (const a of item.assignees || []) {
    await supabase.from('notifications').insert({
      user_id: a,
      organisation_id: organisationId,
      title: `New work item added for ${clientName} today`,
      body: item.description || '',
      link: '/work-instructions/today',
      notification_type: 'work_instruction',
    });
  }
}
