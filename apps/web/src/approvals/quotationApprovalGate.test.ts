import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalIntegration } from './integration';
import { supabase } from '../lib/supabase';
import { ApprovalAPI } from './api';

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
  currentOrgId: vi.fn(),
}));

vi.mock('./api', () => ({
  ApprovalAPI: { createApprovalRequest: vi.fn() },
}));

vi.mock('../work-orders', () => ({ workOrderRpc: {} }));
vi.mock('../payment-requests', () => ({ paymentRequestRpc: {} }));

const requirement = {
  needed: true,
  reason: 'ABOVE_THRESHOLD',
  amount: 250000,
  organisation_id: 'org-123',
  requires_review: false,
  reviewer_id: null,
};

describe('Quotation approval gate is decided by the database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as any).mockReturnValue({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    });
  });

  it('asks the RPC which quotation to gate, not the caller', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: requirement, error: null });
    (ApprovalAPI.createApprovalRequest as any).mockResolvedValue({ success: true, data: { id: 'appr-1' } });

    const res = await ApprovalIntegration.createQuotationApproval('quote-456', 'Acme', 'QT-001');

    expect(supabase.rpc).toHaveBeenCalledWith('quotation_approval_requirement', {
      p_quotation_id: 'quote-456',
    });
    expect(res.success).toBe(true);
    expect(ApprovalAPI.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 250000, approval_type: 'QUOTATION', reference_id: 'quote-456' })
    );
  });

  it('aborts the submission when the gate cannot be evaluated (fail closed)', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const res = await ApprovalIntegration.createQuotationApproval('quote-456', 'Acme', 'QT-001');

    expect(res.success).toBe(false);
    expect(res.error).toContain('permission denied');
    expect(ApprovalAPI.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('treats a decision-less response as a failure rather than as auto-approval', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: {}, error: null });

    const res = await ApprovalIntegration.createQuotationApproval('quote-456', 'Acme', 'QT-001');

    expect(res.success).toBe(false);
    expect(ApprovalAPI.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('reports a below-threshold quotation as needing no approval without creating a request', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: { ...requirement, needed: false, reason: 'BELOW_THRESHOLD' },
      error: null,
    });

    const res = await ApprovalIntegration.createQuotationApproval('quote-456', 'Acme', 'QT-001');

    expect(res.success).toBe(true);
    expect(res.error).toContain('No approval required (BELOW_THRESHOLD)');
    expect(ApprovalAPI.createApprovalRequest).not.toHaveBeenCalled();
  });
});
