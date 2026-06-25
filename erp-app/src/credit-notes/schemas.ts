import { z } from 'zod';

export const CN_TYPES = ['Sales Return', 'Rate Difference', 'Discount', 'Rejection', 'Other'] as const;
export const CN_APPROVAL_STATUSES = ['Approved', 'Pending', 'Rejected'] as const;

export type CNType = (typeof CN_TYPES)[number];
export type CNApprovalStatus = (typeof CN_APPROVAL_STATUSES)[number];

export const CreditNoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Description is required'),
  hsn_code: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0, 'Quantity must be >= 0'),
  rate: z.coerce.number().min(0, 'Rate must be >= 0'),
  discount_amount: z.coerce.number().min(0, 'Discount must be >= 0').default(0),
  taxable_value: z.coerce.number().min(0, 'Taxable value must be >= 0').default(0),
  cgst_percent: z.coerce.number().min(0).max(100).default(0),
  cgst_amount: z.coerce.number().min(0).default(0),
  sgst_percent: z.coerce.number().min(0).max(100).default(0),
  sgst_amount: z.coerce.number().min(0).default(0),
  igst_percent: z.coerce.number().min(0).max(100).default(0),
  igst_amount: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().min(0).default(0),
});

export type CreditNoteItemInput = z.infer<typeof CreditNoteItemSchema>;

export const CreateCreditNoteSchema = z.object({
  organisation_id: z.string().uuid(),
  client_id: z.string().uuid('Client is required'),
  invoice_id: z.string().uuid().optional().nullable(),
  cn_number: z.string().min(1, 'Credit note number is required'),
  cn_date: z.string().min(1, 'Date is required'),
  cn_type: z.enum(CN_TYPES, { required_error: 'Type is required' }),
  reason: z.string().optional().nullable(),
  taxable_amount: z.coerce.number().min(0).default(0),
  cgst_amount: z.coerce.number().min(0).default(0),
  sgst_amount: z.coerce.number().min(0).default(0),
  igst_amount: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().min(0, 'Total must be >= 0'),
  approval_status: z.enum(CN_APPROVAL_STATUSES).default('Pending'),
  authorized_signatory_id: z.string().uuid().optional().nullable(),
  items: z.array(CreditNoteItemSchema).min(1, 'At least one item is required'),
});

export type CreateCreditNoteInput = z.infer<typeof CreateCreditNoteSchema>;

export const UpdateCreditNoteSchema = CreateCreditNoteSchema.extend({
  id: z.string().uuid(),
});

export type UpdateCreditNoteInput = z.infer<typeof UpdateCreditNoteSchema>;

export const CN_TYPE_LABELS: Record<CNType, string> = {
  'Sales Return': 'Sales Return',
  'Rate Difference': 'Rate Difference',
  'Discount': 'Discount',
  'Rejection': 'Rejection',
  'Other': 'Other',
};

export const CN_STATUS_LABELS: Record<CNApprovalStatus, string> = {
  Approved: 'Approved',
  Pending: 'Pending',
  Rejected: 'Rejected',
};

export const CN_STATUS_COLORS: Record<CNApprovalStatus, { bg: string; color: string }> = {
  Approved: { bg: '#d1fae5', color: '#047857' },
  Pending: { bg: '#fef3c7', color: '#b45309' },
  Rejected: { bg: '#fee2e2', color: '#dc2626' },
};
