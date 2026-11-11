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
    // Review completion is recorded as metadata on the APPROVED row, not as a second
    // synthetic FORWARDED row (removed in api.ts — it duplicated every approval in History).
    expect(insertActionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          approval_id: 'appr-123',
          action: 'APPROVED',
          metadata: expect.objectContaining({ review_auto_completed: true }),
        }),
      ])
    );
    expect(insertActionMock.mock.calls[0][0]).toHaveLength(1);
    // Verifies quotation_header was updated to Approved
    expect(updateQuotationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Approved',
      })
    );
  });

  describe('rejection keeps the client-facing document unchanged (PRD v3.4 Q2 / H7)', () => {
    const mockApprovalRejected = { ...mockApproval, review_status: 'NOT_REQUIRED' };

    const wireMocks = ({
      singleMock,
      updateApprovalsMock,
      insertActionMock,
      updateQuotationMock,
    }: {
      singleMock: any;
      updateApprovalsMock: any;
      insertActionMock: any;
      updateQuotationMock: any;
    }) => {
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
    };

    it('returns the document to Sent and records the outcome in approval_status', async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { ...mockApprovalRejected }, error: null });
      const insertActionMock = vi.fn().mockResolvedValue({ error: null });
      const updateApprovalsMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...mockApprovalRejected, status: 'REJECTED' },
              error: null,
            }),
          }),
        }),
      });
      const updateQuotationMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      wireMocks({ singleMock, updateApprovalsMock, insertActionMock, updateQuotationMock });

      const res = await ApprovalAPI.processApproval('appr-123', {
        action: 'REJECTED',
        comments: 'Rates too high for this scope',
      });

      expect(res.success).toBe(true);
      const payload = updateQuotationMock.mock.calls[0][0];
      expect(payload.approval_status).toBe('Rejected');
      // 'Rejected' in quotation_header.status means the client declined, and it is outside
      // QUOTATION_FOLLOW_UP_STATUSES, which would hide the quotation from the Follow-up Center.
      // Leaving status untouched is worse: the header stays on PENDING_APPROVAL after the request
      // closes, so the Approve button stays live and change_quotation_stage refuses every later
      // stage change with QUOTATION_UNDER_APPROVAL. §4.1's edge is Pending Approval -> Sent.
      expect(payload.status).toBe('Sent');
      expect(typeof payload.approval_completed_at).toBe('string');
    });

    it('reverts the approval and reports failure when the source-document write fails', async () => {
      const singleMock = vi.fn().mockResolvedValue({ data: { ...mockApprovalRejected }, error: null });
      const insertActionMock = vi.fn().mockResolvedValue({ error: null });
      const updateApprovalsMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...mockApprovalRejected, status: 'REJECTED' },
              error: null,
            }),
          }),
        }),
      });
      const updateQuotationMock = vi.fn().mockImplementation(() => {
        throw new Error('rls denied update');
      });

      wireMocks({ singleMock, updateApprovalsMock, insertActionMock, updateQuotationMock });

      const res = await ApprovalAPI.processApproval('appr-123', {
        action: 'REJECTED',
        comments: 'Rates too high for this scope',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('TRANSITION_FAILED');
      // Fail-closed: the approval row is put back to PENDING so the operator can retry.
      const revertPayload = updateApprovalsMock.mock.calls[updateApprovalsMock.mock.calls.length - 1][0];
      expect(revertPayload).toMatchObject({ status: 'PENDING' });
    });
  });
});
