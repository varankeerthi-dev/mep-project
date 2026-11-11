import { describe, expect, it } from 'vitest';
import {
  isQuotationApprovalInFlight,
  normalizeQuotationDocumentStatus,
  quotationApprovalLockMessage,
  QUOTATION_FOLLOW_UP_STATUSES,
  stageFromDocumentStatus,
} from './quotation-status';

describe('quotation document status vocabulary', () => {
  it('normalises the spellings that exist in the data', () => {
    expect(normalizeQuotationDocumentStatus('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
    expect(normalizeQuotationDocumentStatus('Pending Approval')).toBe('PENDING_APPROVAL');
    expect(normalizeQuotationDocumentStatus(' Approved')).toBe('Approved');
    expect(normalizeQuotationDocumentStatus('under negotiation')).toBe('Under Negotiation');
    expect(normalizeQuotationDocumentStatus('Returned/Query')).toBeNull();
    expect(normalizeQuotationDocumentStatus(null)).toBeNull();
  });

  it('gates the approve button on either pending spelling', () => {
    expect(isQuotationApprovalInFlight('PENDING_APPROVAL')).toBe(true);
    expect(isQuotationApprovalInFlight('Pending Approval')).toBe(true);
    expect(isQuotationApprovalInFlight('Approved')).toBe(false);
  });

  it('derives the same stage the list has always shown', () => {
    expect(stageFromDocumentStatus('Sent')).toBe('sent');
    expect(stageFromDocumentStatus(null)).toBe('sent');
    expect(stageFromDocumentStatus('Under Negotiation')).toBe('in_negotiation');
    expect(stageFromDocumentStatus('Rejected')).toBe('lost_to_competitor');
    expect(stageFromDocumentStatus('PENDING_APPROVAL')).toBe('pending');
    expect(stageFromDocumentStatus('Draft')).toBe('pending');
    expect(stageFromDocumentStatus('Converted')).toBe('pending');
  });

  it('keeps the follow-up filter on the tokens the database actually holds', () => {
    expect(QUOTATION_FOLLOW_UP_STATUSES).toContain('PENDING_APPROVAL');
    expect(QUOTATION_FOLLOW_UP_STATUSES).not.toContain('Draft');
    expect(QUOTATION_FOLLOW_UP_STATUSES).not.toContain('Pending Approval');
  });
});

describe('quotation edit lock message', () => {
  it('shows the sentence the database wrote, without the machine marker', () => {
    const fromDb =
      'QUOTATION_UNDER_APPROVAL: Q/2026/0041 is locked while its approval request is pending (level 1 of 2). Current approver: Priya R.';
    expect(quotationApprovalLockMessage(fromDb)).toBe(
      'Q/2026/0041 is locked while its approval request is pending (level 1 of 2). Current approver: Priya R.'
    );
  });

  it('still reads as a sentence when only the marker arrives', () => {
    expect(quotationApprovalLockMessage('QUOTATION_UNDER_APPROVAL:')).toBe(
      'This quotation is locked while its approval request is pending.'
    );
  });

  it('stays out of the way for every other save failure', () => {
    expect(quotationApprovalLockMessage('Approved or Converted quotations cannot be modified')).toBeNull();
    expect(quotationApprovalLockMessage('duplicate key value violates unique constraint')).toBeNull();
    expect(quotationApprovalLockMessage('')).toBeNull();
    expect(quotationApprovalLockMessage(undefined)).toBeNull();
  });
});
