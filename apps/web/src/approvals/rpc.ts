import { z } from 'zod'
import { supabase } from '../lib/supabase'

const approvalTransitionInputSchema = z.object({
  organisationId: z.string().uuid(),
  referenceType: z.enum(['work_orders', 'payment_requests', 'purchase_payments', 'subcontractor_payments']),
  referenceId: z.string().uuid(),
  action: z.enum(['approve', 'return', 'resubmit']),
  clientRequestId: z.string().min(16).max(100).optional(),
}).strict()

export type ApprovalTransitionInput = {
  organisationId: string
  referenceType: 'work_orders' | 'payment_requests' | 'purchase_payments' | 'subcontractor_payments'
  referenceId: string
  action: 'approve' | 'return' | 'resubmit'
  clientRequestId?: string
}

type ApprovalTransitionResult = {
  data: Record<string, unknown> | null
  error: { code: string; message: string; retryable?: boolean } | null
}

export async function approvalTransition(input: ApprovalTransitionInput): Promise<ApprovalTransitionResult> {
  const parsed = approvalTransitionInputSchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid approval transition input.', retryable: false } }
  }

  const clientRequestId = parsed.data.clientRequestId || crypto.randomUUID()
  const { data, error } = await supabase.rpc('approval_transition', {
    p_input: { ...parsed.data, clientRequestId },
  })

  if (error) {
    return {
      data: null,
      error: {
        code: (error as any).code || 'INTERNAL_ERROR',
        message: (error as any).message || 'Approval transition failed.',
        retryable: false,
      },
    }
  }

  if (!data || typeof data !== 'object') {
    return { data: null, error: { code: 'INTERNAL_ERROR', message: 'Approval transition returned no result.', retryable: false } }
  }

  return { data: data as Record<string, unknown>, error: null }
}
