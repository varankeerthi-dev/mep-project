import { supabase } from '@/lib/supabase'
import {
  createPaymentRequestInputSchema,
  getPaymentRequestListInputSchema,
  paymentRequestActionInputSchema,
  paymentRequestListOutputSchema,
  type CreatePaymentRequestInput,
  type GetPaymentRequestListInput,
  type PaymentRequestActionInput,
  type PaymentRequestListOutput,
  type PaymentRequestRpcError,
  type PaymentRequestRpcResult,
} from '../types'

type RpcEnvelope<T> = { data?: T | null; error?: PaymentRequestRpcError | null; request_id?: string }

function asRpcError(error: unknown, requestId?: string): PaymentRequestRpcError {
  if (error && typeof error === 'object') {
    const candidate = error as Partial<PaymentRequestRpcError>
    return { code: candidate.code || 'INTERNAL_ERROR', message: candidate.message || 'The Payment Request operation failed.', fieldErrors: candidate.fieldErrors, requestId: candidate.requestId || requestId, retryable: candidate.retryable ?? false }
  }
  return { code: 'INTERNAL_ERROR', message: 'The Payment Request operation failed.', requestId, retryable: false }
}

function unwrap<T>(payload: T | RpcEnvelope<T> | null, error: unknown): PaymentRequestRpcResult<T> {
  if (error) return { data: null, error: asRpcError(error) }
  if (!payload) return { data: null, error: { code: 'RECORD_NOT_FOUND', message: 'No data was returned.', retryable: false } }
  if (typeof payload === 'object' && payload !== null && ('data' in payload || 'error' in payload)) {
    const envelope = payload as RpcEnvelope<T>
    return envelope.error ? { data: null, error: asRpcError(envelope.error, envelope.request_id) } : { data: envelope.data ?? null, error: null }
  }
  return { data: payload as T, error: null }
}

export const paymentRequestRpc = {
  async list(input: GetPaymentRequestListInput): Promise<PaymentRequestRpcResult<PaymentRequestListOutput>> {
    const parsed = getPaymentRequestListInputSchema.safeParse(input)
    if (!parsed.success) return { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid Payment Request filters.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>, retryable: false } }
    const { data, error } = await supabase.rpc('payment_requests_list', { p_input: parsed.data })
    const result = unwrap(data, error)
    if (result.error || !result.data) return result
    const output = paymentRequestListOutputSchema.safeParse(result.data)
    return output.success ? { data: output.data, error: null } : { data: null, error: { code: 'INTERNAL_ERROR', message: 'The Payment Request response was invalid.', retryable: false } }
  },

  async create(input: CreatePaymentRequestInput): Promise<PaymentRequestRpcResult<Record<string, unknown>>> {
    const parsed = createPaymentRequestInputSchema.safeParse(input)
    if (!parsed.success) return { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid Payment Request.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>, retryable: false } }
    const { data, error } = await supabase.rpc('payment_request_create', { p_input: parsed.data })
    return unwrap(data, error) as PaymentRequestRpcResult<Record<string, unknown>>
  },

  async bindApproval(input: { organisationId: string; paymentRequestId: string; approvalId: string }): Promise<PaymentRequestRpcResult<Record<string, unknown>>> {
    const { data, error } = await supabase.rpc('payment_request_bind_approval', { p_input: input })
    return unwrap(data, error) as PaymentRequestRpcResult<Record<string, unknown>>
  },

  async approve(input: PaymentRequestActionInput): Promise<PaymentRequestRpcResult<Record<string, unknown>>> {
    const parsed = paymentRequestActionInputSchema.safeParse(input)
    if (!parsed.success) return { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid Payment Request approval action.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>, retryable: false } }
    const { data, error } = await supabase.rpc('payment_request_approve', { p_input: parsed.data })
    return unwrap(data, error) as PaymentRequestRpcResult<Record<string, unknown>>
  },

  async release(input: PaymentRequestActionInput): Promise<PaymentRequestRpcResult<Record<string, unknown>>> {
    const parsed = paymentRequestActionInputSchema.safeParse(input)
    if (!parsed.success) return { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid Payment Request release action.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>, retryable: false } }
    const { data, error } = await supabase.rpc('payment_request_release', { p_input: parsed.data })
    return unwrap(data, error) as PaymentRequestRpcResult<Record<string, unknown>>
  },
}
