import type { QuotationFollowUpStatus } from '../../types/followup';

/**
 * The vocabulary of quotation_header.status, exactly as the live database holds it.
 *
 * 'PENDING_APPROVAL' is the literal the approval integration writes (approvals/integration.ts);
 * 'Pending Approval' is the approval_status display value. Both spellings normalise to the same
 * entry, because documents created before the integration settled on one token exist in the data.
 * The status CHECK constraint and the Phase 1b trigger are both meant to be built from this list.
 */
export type QuotationDocumentStatus =
  | 'Draft'
  | 'Sent'
  | 'PENDING_APPROVAL'
  | 'Under Negotiation'
  | 'Approved'
  | 'Rejected'
  | 'Converted'
  | 'Cancelled'
  | 'Expired';

export const QUOTATION_DOCUMENT_STATUSES: readonly QuotationDocumentStatus[] = [
  'Draft',
  'Sent',
  'PENDING_APPROVAL',
  'Under Negotiation',
  'Approved',
  'Rejected',
  'Converted',
  'Cancelled',
  'Expired',
];

/**
 * The statuses the Follow-up Center selects. Deliberately excludes Draft (not sent yet) and
 * Converted (already became an order). Changing this list changes which rows users see, so it
 * is a product decision, not a refactor.
 */
export const QUOTATION_FOLLOW_UP_STATUSES: readonly QuotationDocumentStatus[] = [
  'Sent',
  'Under Negotiation',
  'Approved',
  'Rejected',
  'Cancelled',
  'PENDING_APPROVAL',
];

const CANONICAL_BY_NORMALISED: Record<string, QuotationDocumentStatus> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  'PENDING APPROVAL': 'PENDING_APPROVAL',
  'UNDER NEGOTIATION': 'Under Negotiation',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CONVERTED: 'Converted',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

/** Case, spacing and underscore tolerant. Returns null for a token outside the vocabulary. */
export function normalizeQuotationDocumentStatus(
  raw: string | null | undefined
): QuotationDocumentStatus | null {
  const key = (raw ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return CANONICAL_BY_NORMALISED[key] ?? null;
}

export function isQuotationApprovalInFlight(raw: string | null | undefined): boolean {
  return normalizeQuotationDocumentStatus(raw) === 'PENDING_APPROVAL';
}

/**
 * The database refuses a save on a quotation whose approval request is open with a message
 * prefixed QUOTATION_UNDER_APPROVAL. Returns the human half of it, or null when the error is
 * something else. PostgREST drops the SQLSTATE and hint, so the prefix is the only signal.
 */
export function quotationApprovalLockMessage(
  message: string | null | undefined
): string | null {
  if (!message || !message.includes('QUOTATION_UNDER_APPROVAL')) return null;
  const text = message.replace(/^[\s\S]*QUOTATION_UNDER_APPROVAL:\s*/, '').trim();
  return text || 'This quotation is locked while its approval request is pending.';
}

/**
 * Document status -> sales stage, used when a quotation has no
 * follow_up_quotation_tracking row. Mirrors the CASE inside change_quotation_stage; the two
 * have to move together or the compare-and-set reports a conflict the user cannot see.
 */
export function stageFromDocumentStatus(
  dbStatus: string | null | undefined
): QuotationFollowUpStatus {
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
