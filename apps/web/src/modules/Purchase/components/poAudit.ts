/**
 * Purchase-order audit trail.
 *
 * V1 BUG FIXED HERE: V1 wrote its activity log to `po_activity_log`
 * (PurchaseOrders.tsx:485,499). That table exists but has never held a single
 * row — the V1 activity panel has therefore always rendered "No activity
 * recorded yet", and the deletes it performed were recorded elsewhere.
 *
 * The table that is actually written and read across the Purchase module is
 * `purchase_audit_log` (7 rows live), which carries the actor:
 *   id, organisation_id, entity_type, entity_id, action, actor_id, details,
 *   created_at
 *
 * So V2 uses `purchase_audit_log` with entity_type = 'purchase_order'. This is
 * the same convention `useDeletePO` (usePurchaseQueries.ts:553) already uses,
 * so deletes and edits land in one timeline.
 *
 * Note: `listPurchaseAuditLogs` in purchase-requisitions/api.ts hardcodes
 * entity_type = 'REQUISITION', so it cannot serve purchase orders. These
 * helpers query directly instead.
 */
import { supabase } from '../../../supabase';

export const PO_ENTITY_TYPE = 'purchase_order';

export type PoAuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'SUBMIT'
  | 'DELETE'
  | 'DUPLICATE'
  | 'STATUS_CHANGE';

export interface PoAuditEntry {
  id: string;
  organisation_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export interface LogPoActivityInput {
  organisationId: string;
  poId: string;
  action: PoAuditAction;
  /** Short human sentence shown in the timeline. */
  description: string;
  /** Anything else worth keeping: totals, vendor, item count. */
  details?: Record<string, any>;
  /** Who did it. Defaults to the signed-in user via RLS/auth. */
  actorId?: string | null;
}

/**
 * Append one timeline entry. Never throws: an audit failure must not block the
 * business write that already succeeded, but it should be visible in the console.
 */
export async function logPoActivity(input: LogPoActivityInput): Promise<void> {
  try {
    const { error } = await supabase.from('purchase_audit_log').insert({
      organisation_id: input.organisationId,
      entity_type: PO_ENTITY_TYPE,
      entity_id: input.poId,
      action: input.action,
      actor_id: input.actorId ?? null,
      details: { description: input.description, ...(input.details || {}) },
    });
    if (error) {
      console.warn('[poAudit] could not record activity:', error.message);
    }
  } catch (e: any) {
    console.warn('[poAudit] could not record activity:', e?.message || e);
  }
}

/** Timeline for one PO, newest first. */
export async function listPoActivity(
  organisationId: string,
  poId: string,
): Promise<PoAuditEntry[]> {
  const { data, error } = await supabase
    .from('purchase_audit_log')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('entity_type', PO_ENTITY_TYPE)
    .eq('entity_id', poId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as PoAuditEntry[];
}

/** Human label for a stored action code. */
export const poAuditActionLabel = (action: string): string => {
  switch (action) {
    case 'CREATE': return 'Created';
    case 'UPDATE': return 'Edited';
    case 'SUBMIT': return 'Submitted for approval';
    case 'DELETE': return 'Deleted';
    case 'DUPLICATE': return 'Duplicated';
    case 'STATUS_CHANGE': return 'Status changed';
    default: return action;
  }
};
