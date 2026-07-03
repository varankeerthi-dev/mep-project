export type AeType = 'ADVANCE' | 'EXPENSE' | 'REIMBURSEMENT';
export type AeRequestType = 'REIMBURSEMENT' | 'PRE_APPROVAL';
export type AePayoutMethod = 'IMMEDIATE' | 'WITH_SALARY';
export type AeStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
export type FloatStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface AdvanceExpense {
  id: string;
  organisation_id: string;
  type: AeType;
  request_type?: AeRequestType;
  transaction_no?: string;
  employee_id: string;
  employee_name?: string;
  project_id?: string;
  project_name?: string;
  category_id?: string;
  category_name?: string;
  amount: number;
  narration?: string;
  remarks?: string;
  advance_id?: string;
  float_id?: string;
  payout_method: AePayoutMethod;
  status: AeStatus;
  approval_id?: string;
  workflow_step: string;
  approval_status: string;
  is_deleted: boolean;
  deleted_at?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PettyCashFloat {
  id: string;
  organisation_id: string;
  holder_id: string;
  holder_name?: string;
  project_id?: string;
  project_name?: string;
  float_amount: number;
  current_balance: number;
  status: FloatStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AeFormData {
  type: AeType;
  request_type: AeRequestType;
  employee_id: string;
  project_id: string;
  category_id: string;
  amount: number;
  payout_method: AePayoutMethod;
  advance_id?: string;
  float_id?: string;
  narration: string;
  remarks: string;
}

export interface FloatFormData {
  holder_id: string;
  project_id: string;
  float_amount: number;
}

export interface AeFilters {
  type?: AeType | 'ALL';
  status?: AeStatus | 'ALL';
  employee_id?: string;
  project_id?: string;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface AeKpiData {
  advances_total: number;
  expenses_total: number;
  awaiting_payment: number;
  paid_out: number;
  accrued: number;
  float_balances: number;
}

export const AE_TYPE_OPTIONS: { value: AeType; label: string }[] = [
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
];

export const REQUEST_TYPE_OPTIONS: { value: AeRequestType; label: string }[] = [
  { value: 'REIMBURSEMENT', label: 'Already Spent (Reimbursement)' },
  { value: 'PRE_APPROVAL', label: 'Need Money (Pre-Approval)' },
];

export const PAYOUT_METHOD_OPTIONS: { value: AePayoutMethod; label: string }[] = [
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'WITH_SALARY', label: 'With Salary' },
];

export const STATUS_CONFIG: Record<AeStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  PENDING: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  APPROVED: { label: 'Approved', color: '#10B981', bg: '#D1FAE5' },
  REJECTED: { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2' },
  PAID: { label: 'Paid', color: '#185FA5', bg: '#DBEAFE' },
  CANCELLED: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6' },
};
