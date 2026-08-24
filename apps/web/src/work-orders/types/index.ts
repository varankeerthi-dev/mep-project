import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const moneySchema = z.number().finite().nonnegative()
export const percentageSchema = z.number().finite().min(0).max(100)

export const workOrderStatusSchema = z.enum([
  'Draft',
  'In Review',
  'Approved',
  'Issued',
  'Acknowledged',
  'In Progress',
  'Partially Completed',
  'Completed',
  'On Hold',
  'Cancelled',
])

export const workOrderApprovalStatusSchema = z.enum([
  'Not Required',
  'Pending Approval',
  'Approved',
  'Rejected',
  'Returned',
  'On Hold',
])

export const workOrderRecipientTypeSchema = z.enum([
  'subcontractor',
  'vendor',
  'project_company',
  'consultant',
  'internal_unit',
])

export const workOrderLinkTypeSchema = z.enum([
  'project',
  'task',
  'milestone',
  'mom',
  'mom_decision',
  'mom_action_item',
  'plant',
  'workshop',
  'asset',
  'issue',
  'purchase_order',
  'parent_work_order',
])

export const workOrderPartyInputSchema = z.object({
  role: z.enum(['issuer', 'principal', 'recipient', 'approver', 'site_contact']),
  partyType: workOrderRecipientTypeSchema,
  organisationId: uuidSchema.nullable().optional(),
  vendorId: uuidSchema.nullable().optional(),
  subcontractorId: uuidSchema.nullable().optional(),
  displayNameSnapshot: z.string().trim().min(1).max(255),
  taxIdSnapshot: z.string().trim().max(50).nullable().optional(),
}).strict()

export const workOrderItemInputSchema = z.object({
  id: uuidSchema.optional(),
  itemCode: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  specification: z.string().trim().max(4000).nullable().optional(),
  drawingReference: z.string().trim().max(255).nullable().optional(),
  hsnSac: z.string().trim().max(30).nullable().optional(),
  quantity: z.number().finite().positive(),
  unit: z.string().trim().min(1).max(30),
  rate: moneySchema,
  discountPercent: percentageSchema.default(0),
  taxableAmount: moneySchema,
  cgstPercent: percentageSchema.default(0),
  cgstAmount: moneySchema.default(0),
  sgstPercent: percentageSchema.default(0),
  sgstAmount: moneySchema.default(0),
  igstPercent: percentageSchema.default(0),
  igstAmount: moneySchema.default(0),
  cessAmount: moneySchema.default(0),
  totalAmount: moneySchema,
  measurementBasis: z.string().trim().max(500).nullable().optional(),
  acceptanceCriteria: z.string().trim().max(2000).nullable().optional(),
  milestoneId: uuidSchema.nullable().optional(),
}).strict()

export const workOrderRequirementInputSchema = z.object({
  id: uuidSchema.optional(),
  sequence: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(255),
  specification: z.string().trim().min(1).max(4000),
  deliverable: z.string().trim().max(2000).nullable().optional(),
  drawingReference: z.string().trim().max(255).nullable().optional(),
  acceptanceCriteria: z.string().trim().max(2000).nullable().optional(),
  measurementBasis: z.string().trim().max(500).nullable().optional(),
  responsibleParty: z.enum(['issuer', 'recipient', 'shared']).default('recipient'),
}).strict()

export const workOrderCommercialInputSchema = z.object({
  currency: z.string().trim().length(3).default('INR'),
  exchangeRate: z.number().finite().positive().default(1),
  subtotal: moneySchema,
  discountAmount: moneySchema.default(0),
  taxableAmount: moneySchema,
  cgstAmount: moneySchema.default(0),
  sgstAmount: moneySchema.default(0),
  igstAmount: moneySchema.default(0),
  cessAmount: moneySchema.default(0),
  totalAmount: moneySchema,
  advancePercent: percentageSchema.default(0),
  advanceAmount: moneySchema.default(0),
  tdsApplicable: z.boolean().default(false),
  tdsSection: z.string().trim().max(30).nullable().optional(),
  tdsPercent: percentageSchema.default(0),
  tdsBaseAmount: moneySchema.default(0),
  tdsAmount: moneySchema.default(0),
  retentionPercent: percentageSchema.default(0),
  retentionAmount: moneySchema.default(0),
  retentionDurationMonths: z.number().int().nonnegative().nullable().optional(),
  retentionConditions: z.string().trim().max(2000).nullable().optional(),
  taxType: z.enum(['intra_state', 'inter_state', 'exempt', 'reverse_charge', 'not_applicable']).default('not_applicable'),
  placeOfSupply: z.string().trim().max(100).nullable().optional(),
  reverseCharge: z.boolean().default(false),
}).strict()

export const saveWorkOrderDraftInputSchema = z.object({
  organisationId: uuidSchema,
  workOrderId: uuidSchema.nullable().optional(),
  clientRequestId: z.string().trim().min(16).max(100),
  expectedVersion: z.number().int().nonnegative().nullable().optional(),
  issuer: workOrderPartyInputSchema,
  principal: workOrderPartyInputSchema.nullable().optional(),
  recipient: workOrderPartyInputSchema,
  workOrderNo: z.string().trim().max(100).nullable().optional(),
  issueDate: dateSchema,
  validUntil: dateSchema.nullable().optional(),
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  workDescription: z.string().trim().min(1).max(10000),
  siteLocation: z.string().trim().max(1000).nullable().optional(),
  plantId: uuidSchema.nullable().optional(),
  workshopId: uuidSchema.nullable().optional(),
  projectId: uuidSchema.nullable().optional(),
  clientId: uuidSchema.nullable().optional(),
  parentWorkOrderId: uuidSchema.nullable().optional(),
  workContext: z.string().trim().max(50).nullable().optional(),
  items: z.array(workOrderItemInputSchema).min(1),
  requirements: z.array(workOrderRequirementInputSchema).default([]),
  commercial: workOrderCommercialInputSchema,
  paymentTermsText: z.string().trim().max(4000).nullable().optional(),
  paymentTerms: z.record(z.unknown()).default({}),
  deliveryTerms: z.string().trim().max(4000).nullable().optional(),
  termsConditions: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    text: z.string().trim().min(1).max(4000),
    order: z.number().int().nonnegative(),
  }).strict()).default([]),
  remarks: z.string().trim().max(4000).nullable().optional(),
  links: z.array(z.object({
    linkType: workOrderLinkTypeSchema,
    targetId: uuidSchema,
    sourceId: uuidSchema.nullable().optional(),
  }).strict()).default([]),
}).strict()

export const getWorkOrderListInputSchema = z.object({
  organisationId: uuidSchema,
  page: z.number().int().nonnegative().default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).nullable().optional(),
  status: workOrderStatusSchema.nullable().optional(),
  approvalStatus: workOrderApprovalStatusSchema.nullable().optional(),
  recipientType: workOrderRecipientTypeSchema.nullable().optional(),
  recipientId: uuidSchema.nullable().optional(),
  projectId: uuidSchema.nullable().optional(),
  plantId: uuidSchema.nullable().optional(),
  workshopId: uuidSchema.nullable().optional(),
  issuedFrom: dateSchema.nullable().optional(),
  issuedTo: dateSchema.nullable().optional(),
  includeArchived: z.boolean().default(false),
  sort: z.enum(['issue_date', 'work_order_no', 'total_amount', 'updated_at']).default('issue_date'),
  direction: z.enum(['asc', 'desc']).default('desc'),
}).strict()

export const workOrderListRowSchema = z.object({
  id: uuidSchema,
  organisationId: uuidSchema,
  workOrderNo: z.string(),
  issueDate: dateSchema,
  issuerName: z.string(),
  recipientName: z.string(),
  recipientType: workOrderRecipientTypeSchema,
  projectName: z.string().nullable(),
  plantName: z.string().nullable(),
  workshopName: z.string().nullable(),
  scopePreview: z.string().nullable(),
  status: workOrderStatusSchema,
  approvalStatus: workOrderApprovalStatusSchema,
  totalAmount: z.number().finite(),
  billedAmount: z.number().finite(),
  balanceAmount: z.number().finite(),
  currentVersion: z.number().int().nonnegative(),
}).strict()

export const workOrderListMetricsSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  pendingApprovalCount: z.number().int().nonnegative(),
  issuedCount: z.number().int().nonnegative(),
  openAmount: z.number().finite(),
  billedAmount: z.number().finite(),
}).strict()

export const workOrderListOutputSchema = z.object({
  rows: z.array(workOrderListRowSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  metrics: workOrderListMetricsSchema,
}).strict()

export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>
export type WorkOrderApprovalStatus = z.infer<typeof workOrderApprovalStatusSchema>
export type WorkOrderRecipientType = z.infer<typeof workOrderRecipientTypeSchema>
export type WorkOrderLinkType = z.infer<typeof workOrderLinkTypeSchema>
export type WorkOrderPartyInput = z.infer<typeof workOrderPartyInputSchema>
export type WorkOrderItemInput = z.infer<typeof workOrderItemInputSchema>
export type WorkOrderRequirementInput = z.infer<typeof workOrderRequirementInputSchema>
export type WorkOrderCommercialInput = z.infer<typeof workOrderCommercialInputSchema>
export type SaveWorkOrderDraftInput = z.infer<typeof saveWorkOrderDraftInputSchema>
export type GetWorkOrderListInput = z.infer<typeof getWorkOrderListInputSchema>
export type WorkOrderListRow = z.infer<typeof workOrderListRowSchema>
export type WorkOrderListMetrics = z.infer<typeof workOrderListMetricsSchema>
export type WorkOrderListOutput = z.infer<typeof workOrderListOutputSchema>

export type WorkOrderRpcErrorCode =
  | 'UNAUTHENTICATED'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_ACCESS_DENIED'
  | 'PERMISSION_DENIED'
  | 'RECORD_NOT_FOUND'
  | 'CROSS_TENANT_REFERENCE'
  | 'INVALID_STATE_TRANSITION'
  | 'CONCURRENT_UPDATE'
  | 'DUPLICATE_REQUEST'
  | 'DUPLICATE_DOCUMENT_NUMBER'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_TAX_CONFIGURATION'
  | 'INVALID_TDS_CONFIGURATION'
  | 'INVALID_RETENTION_CONFIGURATION'
  | 'OVER_BILLING'
  | 'SOURCE_NOT_ELIGIBLE'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR'

export type WorkOrderRpcError = {
  code: WorkOrderRpcErrorCode | string
  message: string
  fieldErrors?: Record<string, string>
  requestId?: string
  retryable?: boolean
}

export type WorkOrderRpcResult<T> = {
  data: T | null
  error: WorkOrderRpcError | null
}

export const WORK_ORDER_PERMISSIONS = {
  read: 'work_orders.read',
  create: 'work_orders.create',
  edit: 'work_orders.edit',
  submit: 'work_orders.submit',
  approve: 'work_orders.approve',
  issue: 'work_orders.issue',
  amend: 'work_orders.amend',
  link: 'work_orders.link',
  billRead: 'bills.read',
  billCreate: 'bills.create',
  paymentRequestRead: 'payment_requests.read',
  paymentRequestCreate: 'payment_requests.create',
  paymentRequestApprove: 'payment_requests.approve',
  paymentPost: 'payments.post',
} as const
