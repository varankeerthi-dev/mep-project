import { z } from 'zod'

export const billSourceTypeSchema = z.enum(['purchase_bill', 'subcontractor_bill', 'purchase', 'subcontractor'])

const uuid = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const paymentRequestStatusSchema = z.enum(['Draft', 'Pending', 'Approved', 'Returned', 'Rejected', 'Partially Paid', 'Paid', 'On Hold', 'Cancelled'])
export const paymentPrioritySchema = z.enum(['Low', 'Normal', 'High', 'Urgent'])
export const paymentSettlementTypeSchema = z.enum(['purchase', 'subcontractor'])

export const getPaymentRequestListInputSchema = z.object({
  organisationId: uuid,
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).nullable().optional(),
  status: paymentRequestStatusSchema.nullable().optional(),
  sourceType: billSourceTypeSchema.nullable().optional(),
  workOrderId: uuid.nullable().optional(),
  dueFrom: date.nullable().optional(),
  dueTo: date.nullable().optional(),
  includeCancelled: z.boolean().default(false),
}).strict()

export const createPaymentRequestInputSchema = z.object({
  organisationId: uuid,
  clientRequestId: z.string().trim().min(16).max(100),
  sourceType: billSourceTypeSchema,
  sourceBillId: uuid,
  workOrderId: uuid.nullable().optional(),
  amountRequested: z.number().finite().positive(),
  priority: paymentPrioritySchema.default('Normal'),
  dueDate: date.nullable().optional(),
  paymentMode: z.string().trim().max(50).nullable().optional(),
  bankAccountId: uuid.nullable().optional(),
  reason: z.string().trim().min(1).max(4000),
}).strict()

export const paymentRequestActionInputSchema = z.object({
  organisationId: uuid,
  paymentRequestId: uuid,
  clientRequestId: z.string().trim().min(16).max(100),
  note: z.string().trim().max(2000).nullable().optional(),
}).strict()

export const paymentRequestRowSchema = z.object({
  id: uuid,
  organisationId: uuid,
  requestNo: z.string(),
  sourceType: billSourceTypeSchema,
  sourceBillId: uuid.nullable(),
  workOrderId: uuid.nullable(),
  workOrderNo: z.string().nullable(),
  payeeName: z.string(),
  amountRequested: z.number().finite(),
  approvedAmount: z.number().finite(),
  paidAmount: z.number().finite(),
  balanceAmount: z.number().finite(),
  priority: paymentPrioritySchema,
  dueDate: date.nullable(),
  status: paymentRequestStatusSchema,
  approvalStatus: z.string(),
  workflowStep: z.string().nullable(),
  settlementType: paymentSettlementTypeSchema,
}).strict()

export const paymentRequestListOutputSchema = z.object({
  rows: z.array(paymentRequestRowSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
}).strict()

export type PaymentRequestStatus = z.infer<typeof paymentRequestStatusSchema>
export type PaymentPriority = z.infer<typeof paymentPrioritySchema>
export type PaymentSettlementType = z.infer<typeof paymentSettlementTypeSchema>
export type GetPaymentRequestListInput = z.infer<typeof getPaymentRequestListInputSchema>
export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestInputSchema>
export type PaymentRequestActionInput = z.infer<typeof paymentRequestActionInputSchema>
export type PaymentRequestRow = z.infer<typeof paymentRequestRowSchema>
export type PaymentRequestListOutput = z.infer<typeof paymentRequestListOutputSchema>
export type PaymentRequestRpcError = { code: string; message: string; fieldErrors?: Record<string, string>; requestId?: string; retryable?: boolean }
export type PaymentRequestRpcResult<T> = { data: T | null; error: PaymentRequestRpcError | null }
