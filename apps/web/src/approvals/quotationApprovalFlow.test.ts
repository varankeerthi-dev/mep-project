import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalAPI } from './api';
import { supabase } from '../supabase';
import { evaluateApprovalGate } from './approvalGateEngine';

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
  currentOrgId: vi.fn().mockResolvedValue('org-123'),
}));

vi.mock('./approvalGateEngine', () => ({
  evaluateApprovalGate: vi.fn(),
}));

vi.mock('./notification-service', () => ({
  ApprovalNotificationService: {
    sendApprovalNotification: vi.fn(),
    sendReturnNotification: vi.fn(),
    sendRejectionNotification: vi.fn(),
  },
}));

describe('Quotation Approval Flow', () => {
  const mockUser = { id: 'user-approver-1' };
  const mockApproval = {
    id: 'appr-123',
    approval_type: 'QUOTATION',
    reference_id: 'quote-456',
    reference_type: 'quotations',
    status: 'PENDING',
    review_status: 'PENDING',
    current_level: 1,
    max_levels: 1,
    organisation_id: 'org-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });
  });

  it('blocks approval if approval gate indicates user lacks authorization during pending review', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { ...mockApproval }, error: null });
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'approvals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: singleMock }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });

    (evaluateApprovalGate as any).mockResolvedValue({
      isAuthorizedToApprove: false,
      blockingReason: 'This document requires preliminary review before entering approval hierarchy.',
    });

    const res = await ApprovalAPI.processApproval('appr-123', {
      action: 'APPROVED',
      comments: 'Trying to approve without authorization',
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('TRANSITION_BLOCKED');
    expect(res.error?.message).toContain('preliminary review');
  });

  it('auto-completes review and approves if authorized approver approves pending-review document', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { ...mockApproval }, error: null });
    const insertActionMock = vi.fn().mockResolvedValue({ error: null });
    const updateApprovalsMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ...mockApproval, status: 'APPROVED', review_status: 'REVIEWED' },
            error: null,
          }),
        }),
      }),
    });
    const updateQuotationMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'approvals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: singleMock }),
          }),
          update: updateApprovalsMock,
        };
      }
      if (table === 'approval_actions') {
        return { insert: insertActionMock };
      }
      if (table === 'quotation_header') {
        return { update: updateQuotationMock };
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    (evaluateApprovalGate as any).mockResolvedValue({
      isAuthorizedToApprove: true,
      actionType: 'SINGLE',
    });

    const res = await ApprovalAPI.processApproval('appr-123', {
      action: 'APPROVED',
      comments: 'Approved directly by authorized approver',
    });

    expect(res.success).toBe(true);
    // Verifies review completion and approval were batched in approval_actions
    expect(insertActionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          approval_id: 'appr-123',
          action: 'FORWARDED',
        }),
        expect.objectContaining({
          approval_id: 'appr-123',
          action: 'APPROVED',
        }),
      ])
    );
    // Verifies quotation_header was updated to Approved
    expect(updateQuotationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Approved',
      })
    );
  });
});
