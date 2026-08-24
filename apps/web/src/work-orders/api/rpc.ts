import { supabase } from '@/lib/supabase'
import {
  getWorkOrderListInputSchema,
  saveWorkOrderDraftInputSchema,
  workOrderListOutputSchema,
  type GetWorkOrderListInput,
  type SaveWorkOrderDraftInput,
  type WorkOrderListOutput,
  type WorkOrderRpcError,
  type WorkOrderRpcResult,
} from '../types'

const RPC_NAMES = {
  list: 'work_orders_list',
  detail: 'work_order_detail',
  saveDraft: 'work_order_save_draft',
  submitForApproval: 'work_order_submit_for_approval',
  bindApproval: 'work_order_bind_approval',
  issue: 'work_order_issue',
} as const

type RpcEnvelope<T> = {
  data?: T | null
  error?: WorkOrderRpcError | null
  request_id?: string
}

function asRpcError(error: unknown, requestId?: string): WorkOrderRpcError {
  if (error && typeof error === 'object') {
    const candidate = error as Partial<WorkOrderRpcError> & { message?: string }
    return {
      code: candidate.code || 'INTERNAL_ERROR',
      message: candidate.message || 'The Work Order operation failed.',
      fieldErrors: candidate.fieldErrors,
      requestId: candidate.requestId || requestId,
      retryable: candidate.retryable ?? false,
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'The Work Order operation failed.',
    requestId,
    retryable: false,
  }
}

function unwrapRpc<T>(payload: T | RpcEnvelope<T> | null, error: unknown): WorkOrderRpcResult<T> {
  if (error) return { data: null, error: asRpcError(error) }
  if (!payload) return { data: null, error: { code: 'RECORD_NOT_FOUND', message: 'No data was returned.', retryable: false } }

  if (typeof payload === 'object' && payload !== null && ('data' in payload || 'error' in payload)) {
    const envelope = payload as RpcEnvelope<T>
    if (envelope.error) return { data: null, error: asRpcError(envelope.error, envelope.request_id) }
    return { data: envelope.data ?? null, error: null }
  }

  return { data: payload as T, error: null }
}

export const workOrderRpc = {
  async list(input: GetWorkOrderListInput): Promise<WorkOrderRpcResult<WorkOrderListOutput>> {
    const parsedInput = getWorkOrderListInputSchema.safeParse(input)
    if (!parsedInput.success) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid Work Order list filters.',
          fieldErrors: parsedInput.error.flatten().fieldErrors as Record<string, string>,
          retryable: false,
        },
      }
    }

    const { data, error } = await supabase.rpc(RPC_NAMES.list, { p_input: parsedInput.data })
    const result = unwrapRpc(data, error)
    if (result.error || !result.data) return result

    const parsedOutput = workOrderListOutputSchema.safeParse(result.data)
    if (!parsedOutput.success) {
      return {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The Work Order list response was invalid.',
          retryable: false,
        },
      }
    }

    return { data: parsedOutput.data, error: null }
  },

  async saveDraft(input: SaveWorkOrderDraftInput): Promise<WorkOrderRpcResult<Record<string, unknown>>> {
    const parsedInput = saveWorkOrderDraftInputSchema.safeParse(input)
    if (!parsedInput.success) {
      return {
        data: null,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid Work Order draft.',
          fieldErrors: parsedInput.error.flatten().fieldErrors as Record<string, string>,
          retryable: false,
        },
      }
    }

    const { data, error } = await supabase.rpc(RPC_NAMES.saveDraft, { p_input: parsedInput.data })
    return unwrapRpc(data, error) as WorkOrderRpcResult<Record<string, unknown>>
  },

  async submitForApproval(input: { organisationId: string; workOrderId: string; clientRequestId: string }) {
    const { data, error } = await supabase.rpc(RPC_NAMES.submitForApproval, { p_input: input })
    return unwrapRpc<Record<string, unknown>>(data, error)
  },

  async approve(input: { organisationId: string; workOrderId: string; clientRequestId: string }) {
    const { data, error } = await supabase.rpc('work_order_approve', { p_input: input })
    return unwrapRpc<Record<string, unknown>>(data, error)
  },

  async bindApproval(input: { organisationId: string; workOrderId: string; approvalId: string }) {
    const { data, error } = await supabase.rpc(RPC_NAMES.bindApproval, { p_input: input })
    return unwrapRpc<Record<string, unknown>>(data, error)
  },

  async issue(input: { organisationId: string; workOrderId: string; clientRequestId: string }) {
    const { data, error } = await supabase.rpc(RPC_NAMES.issue, { p_input: input })
    return unwrapRpc<Record<string, unknown>>(data, error)
  },
}

export { RPC_NAMES }
