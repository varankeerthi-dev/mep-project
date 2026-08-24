import { beforeEach, describe, expect, it, vi } from 'vitest'
import { approvalTransition } from './rpc'
import { supabase } from '../lib/supabase'

const rpcMock = vi.mocked(supabase.rpc)

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('approvalTransition security boundary', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('rejects invalid tenant or reference identifiers before transport', async () => {
    const result = await approvalTransition({
      organisationId: 'not-a-uuid',
      referenceType: 'work_orders',
      referenceId: 'not-a-uuid',
      action: 'approve',
    })

    expect(result.error?.code).toBe('VALIDATION_FAILED')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('sends the organization, source identity, action, and idempotency key to the RPC', async () => {
    rpcMock.mockResolvedValue({
      data: { id: '11111111-1111-4111-8111-111111111111', status: 'Approved' },
      error: null,
    } as any)

    const result = await approvalTransition({
      organisationId: '11111111-1111-4111-8111-111111111111',
      referenceType: 'payment_requests',
      referenceId: '22222222-2222-4222-8222-222222222222',
      action: 'approve',
      clientRequestId: 'request-approval-0001',
    })

    expect(result.error).toBeNull()
    expect(rpcMock).toHaveBeenCalledWith('approval_transition', {
      p_input: {
        organisationId: '11111111-1111-4111-8111-111111111111',
        referenceType: 'payment_requests',
        referenceId: '22222222-2222-4222-8222-222222222222',
        action: 'approve',
        clientRequestId: 'request-approval-0001',
      },
    })
  })

  it('does not expose raw transport errors as trusted success data', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'PERMISSION_DENIED' } } as any)

    const result = await approvalTransition({
      organisationId: '11111111-1111-4111-8111-111111111111',
      referenceType: 'work_orders',
      referenceId: '22222222-2222-4222-8222-222222222222',
      action: 'return',
    })

    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('P0001')
  })
})
