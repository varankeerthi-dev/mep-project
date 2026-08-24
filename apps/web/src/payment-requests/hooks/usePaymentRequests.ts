import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentRequestRpc } from '../api/rpc'
import type { CreatePaymentRequestInput, GetPaymentRequestListInput, PaymentRequestActionInput } from '../types'

export const paymentRequestQueryKeys = {
  all: ['payment-requests'] as const,
  list: (input: GetPaymentRequestListInput) => [...paymentRequestQueryKeys.all, 'list', input] as const,
}

export function usePaymentRequestList(input: GetPaymentRequestListInput, enabled = true) {
  return useQuery({
    queryKey: paymentRequestQueryKeys.list(input),
    queryFn: async () => {
      const result = await paymentRequestRpc.list(input)
      if (result.error) throw result.error
      return result.data
    },
    enabled: enabled && Boolean(input.organisationId),
    staleTime: 30_000,
  })
}

function usePaymentRequestMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paymentRequestQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['bills'] })
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })
}

export function useCreatePaymentRequest() {
  return usePaymentRequestMutation<CreatePaymentRequestInput>(async (input) => {
    const result = await paymentRequestRpc.create(input)
    if (result.error) throw result.error
    return result.data
  })
}

export function useApprovePaymentRequestRpc() {
  return usePaymentRequestMutation<PaymentRequestActionInput>(async (input) => {
    const result = await paymentRequestRpc.approve(input)
    if (result.error) throw result.error
    return result.data
  })
}

export function useReleasePaymentRequest() {
  return usePaymentRequestMutation<PaymentRequestActionInput>(async (input) => {
    const result = await paymentRequestRpc.release(input)
    if (result.error) throw result.error
    return result.data
  })
}
