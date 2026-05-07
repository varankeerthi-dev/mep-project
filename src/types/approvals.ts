export type ApprovalType = 
  | 'PURCHASE_ORDER'
  | 'WORK_ORDER'
  | 'QUOTATION'
  | 'INVOICE'
  | 'PROFORMA_INVOICE'
  | 'PAYMENT_REQUEST'
  | 'MATERIAL_DISPATCH'
  | 'SITE_VISIT'
  | 'EXPENSE_CLAIM';

export type ApprovalStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'HOLD'
  | 'FORWARDED';

export type ApprovalPriority = 
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export type ApprovalAction = 
  | 'APPROVED'
  | 'REJECTED'
  | 'HOLD'
  | 'FORWARDED'
  | 'CANCELLED';

export type NotificationType = 
  | 'EMAIL'
  | 'SMS'
  | 'IN_APP';

export interface Approval {
  id: string;
  approval_type: ApprovalType;
  reference_id: string;
  reference_type: string;
  title: string;
  description?: string;
  amount?: number;
  currency: string;
  requested_by: string;
  requested_at: string;
  current_level: number;
  max_levels: number;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflow {
  id: string;
  approval_type: ApprovalType;
  level: number;
  min_amount: number;
  max_amount?: number;
  approver_role: string;
  approver_id?: string;
  is_active: boolean;
  organisation_id: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalActionLog {
  id: string;
  approval_id: string;
  action: ApprovalAction;
  approver_id?: string;
  approver_role?: string;
  comments?: string;
  action_at: string;
  ip_address?: string;
  user_agent?: string;
  organisation_id: string;
  created_at: string;
}

export interface ApprovalNotification {
  id: string;
  approval_id: string;
  user_id: string;
  notification_type: NotificationType;
  sent_at?: string;
  read_at?: string;
  organisation_id: string;
  created_at: string;
}

export interface ApprovalRequest {
  approval_type: ApprovalType;
  reference_id: string;
  reference_type: string;
  title: string;
  description?: string;
  amount?: number;
  priority?: ApprovalPriority;
}

export interface ApprovalActionRequest {
  action: ApprovalAction;
  comments?: string;
  forward_to?: string;
}

export interface ApprovalFilters {
  status?: ApprovalStatus[];
  type?: ApprovalType[];
  priority?: ApprovalPriority[];
  date_from?: string;
  date_to?: string;
  requested_by?: string;
  search?: string;
}

export interface ApprovalStats {
  total_approvals: number;
  pending_approvals: number;
  approved_approvals: number;
  rejected_approvals: number;
  hold_approvals: number;
  today_approvals: number;
  week_approvals: number;
  avg_approval_hours: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
    timestamp: string;
  };
}

export interface ApprovalTypeConfig {
  type: ApprovalType;
  label: string;
  color: string;
  icon: string;
  description: string;
}

export const APPROVAL_TYPES: ApprovalTypeConfig[] = [
  {
    type: 'PURCHASE_ORDER',
    label: 'Purchase Order',
    color: '#3B82F6',
    icon: 'ShoppingCartIcon',
    description: 'Approval for vendor purchase orders'
  },
  {
    type: 'WORK_ORDER',
    label: 'Work Order',
    color: '#10B981',
    icon: 'ClipboardDocumentListIcon',
    description: 'Approval for subcontractor work orders'
  },
  {
    type: 'QUOTATION',
    label: 'Quotation',
    color: '#8B5CF6',
    icon: 'DocumentDuplicateIcon',
    description: 'Approval for client quotations'
  },
  {
    type: 'INVOICE',
    label: 'Invoice',
    color: '#F59E0B',
    icon: 'DocumentTextIcon',
    description: 'Approval for client invoices'
  },
  {
    type: 'PROFORMA_INVOICE',
    label: 'Proforma Invoice',
    color: '#8B5CF6',
    icon: 'DocumentTextIcon',
    description: 'Approval for proforma invoices'
  },
  {
    type: 'PAYMENT_REQUEST',
    label: 'Payment Request',
    color: '#EF4444',
    icon: 'CurrencyDollarIcon',
    description: 'Approval for payment requests'
  },
  {
    type: 'MATERIAL_DISPATCH',
    label: 'Material Dispatch',
    color: '#06B6D4',
    icon: 'TruckIcon',
    description: 'Approval for material dispatch'
  },
  {
    type: 'SITE_VISIT',
    label: 'Site Visit',
    color: '#84CC16',
    icon: 'MapPinIcon',
    description: 'Approval for site visit reports'
  },
  {
    type: 'EXPENSE_CLAIM',
    label: 'Expense Claim',
    color: '#F97316',
    icon: 'ReceiptRefundIcon',
    description: 'Approval for expense claims'
  }
];

export const APPROVAL_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: '#6B7280', bgColor: '#F3F4F6' },
  APPROVED: { label: 'Approved', color: '#10B981', bgColor: '#D1FAE5' },
  REJECTED: { label: 'Rejected', color: '#EF4444', bgColor: '#FEE2E2' },
  HOLD: { label: 'On Hold', color: '#F59E0B', bgColor: '#FEF3C7' },
  FORWARDED: { label: 'Forwarded', color: '#8B5CF6', bgColor: '#EDE9FE' }
};

export const APPROVAL_PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: '#6B7280' },
  NORMAL: { label: 'Normal', color: '#3B82F6' },
  HIGH: { label: 'High', color: '#F59E0B' },
  URGENT: { label: 'Urgent', color: '#EF4444' }
};
