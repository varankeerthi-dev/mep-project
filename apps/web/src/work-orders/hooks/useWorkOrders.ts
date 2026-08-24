import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workOrderRpc } from '../api/rpc'
import type {
  GetWorkOrderListInput,
  SaveWorkOrderDraftInput,
} from '../types'

export const workOrderQueryKeys = {
  all: ['work-orders'] as const,
  list: (input: GetWorkOrderListInput) => [...workOrderQueryKeys.all, 'list', input] as const,
  detail: (organisationId: string, workOrderId: string) => [
    ...workOrderQueryKeys.all,
    'detail',
    organisationId,
    workOrderId,
  ] as const,
}

export function useWorkOrderList(input: GetWorkOrderListInput, enabled = true) {
  return useQuery({
    queryKey: workOrderQueryKeys.list(input),
    queryFn: async () => {
      const result = await workOrderRpc.list(input)
      if (result.error) throw result.error
      return result.data
    },
    enabled: enabled && Boolean(input.organisationId),
    staleTime: 30_000,
  })
}

export function useSaveWorkOrderDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveWorkOrderDraftInput) => {
      const result = await workOrderRpc.saveDraft(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: workOrderQueryKeys.all })
      if (input.workOrderId) {
        await queryClient.invalidateQueries({
          queryKey: workOrderQueryKeys.detail(input.organisationId, input.workOrderId),
        })
      }
    },
  })
}

export function useSubmitWorkOrderForApproval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { organisationId: string; workOrderId: string; clientRequestId: string }) => {
      const result = await workOrderRpc.submitForApproval(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: workOrderQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: workOrderQueryKeys.detail(input.organisationId, input.workOrderId),
      })
    },
  })
}

export function useIssueWorkOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { organisationId: string; workOrderId: string; clientRequestId: string }) => {
      const result = await workOrderRpc.issue(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: workOrderQueryKeys.all })
      await queryClient.invalidateQueries({
        queryKey: workOrderQueryKeys.detail(input.organisationId, input.workOrderId),
      })
    },
  })
}
