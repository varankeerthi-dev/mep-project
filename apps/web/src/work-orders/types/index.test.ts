import { describe, expect, it } from 'vitest'
import { getWorkOrderListInputSchema, saveWorkOrderDraftInputSchema } from './index'

describe('Work Order RPC contracts', () => {
  it('requires a UUID tenant and bounds list pagination', () => {
    expect(getWorkOrderListInputSchema.safeParse({
      organisationId: 'not-a-uuid',
      page: 0,
      pageSize: 25,
    }).success).toBe(false)

    expect(getWorkOrderListInputSchema.safeParse({
      organisationId: '00000000-0000-0000-0000-000000000001',
      page: 0,
      pageSize: 101,
    }).success).toBe(false)
  })

  it('accepts a valid bounded read request and applies safe defaults', () => {
    const result = getWorkOrderListInputSchema.safeParse({
      organisationId: '00000000-0000-0000-0000-000000000001',
      page: 0,
      pageSize: 25,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.includeArchived).toBe(false)
      expect(result.data.sort).toBe('issue_date')
      expect(result.data.direction).toBe('desc')
    }
  })

  it('rejects missing request id and negative financial input', () => {
    const result = saveWorkOrderDraftInputSchema.safeParse({
      organisationId: '00000000-0000-0000-0000-000000000001',
      clientRequestId: 'short',
    })

    expect(result.success).toBe(false)
  })
})
