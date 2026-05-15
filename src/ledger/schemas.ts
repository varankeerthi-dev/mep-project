import { z } from 'zod';

export const PAYMENT_MODES = ['bank_transfer', 'cash', 'upi', 'cheque'] as const;
export const PAYMENT_STATUSES = ['draft', 'paid', 'refunded'] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RecordPaymentSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  invoice_id: z.string().uuid('Invoice is required'),
  receipt_no: z.string().min(1, 'Payment number is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  receipt_date: z.string().min(1, 'Payment date is required'),
  payment_mode: z.enum(PAYMENT_MODES, { required_error: 'Payment mode is required' }),
  reference_no: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(PAYMENT_STATUSES).default('paid'),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

export const UpdatePaymentSchema = RecordPaymentSchema.extend({
  id: z.string().uuid(),
});

export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: 'Draft',
  paid: 'Paid',
  refunded: 'Refunded',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; color: string }> = {
  draft: { bg: '#f3f4f6', color: '#6b7280' },
  paid: { bg: '#d1fae5', color: '#047857' },
  refunded: { bg: '#fee2e2', color: '#dc2626' },
};
