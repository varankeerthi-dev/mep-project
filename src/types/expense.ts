export type ExpenseEntryType = 'SITE_EXPENSE_REQUEST' | 'SITE_EXPENSE_POST_PURCHASE';
export type ExpenseItemType = 'CONSUMABLE' | 'MATERIAL' | 'BILLABLE';
export type ExpenseCategory = 'CONSUMABLES' | 'CRANE_CHARGES' | 'LABOUR' | 'LOCAL_PURCHASE' | 'OTHER_CHARGES';
export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface ConsumableCatalogItem {
  id: string;
  organisation_id: string;
  name: string;
  category: string;
  preferred_brand?: string | null;
  typical_unit?: string | null;
  created_at: string;
}

export interface ExpenseEntry {
  id: string;
  organisation_id: string;
  entry_type: ExpenseEntryType;
  category: ExpenseCategory;
  item_type: ExpenseItemType;
  consumable_id?: string | null;
  material_id?: string | null;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  amount: number;
  gst_amount?: number | null;
  total_amount: number;
  required_date?: string | null;
  paid_date?: string | null;
  payment_method?: string | null;
  vendor_name?: string | null;
  vendor_invoice_ref?: string | null;
  notes?: string | null;
  status: ExpenseStatus;
  client_id?: string | null;
  project_id?: string | null;
  requested_by: string;
  approval_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEntryInsert {
  organisation_id: string;
  entry_type: ExpenseEntryType;
  category: ExpenseCategory;
  item_type: ExpenseItemType;
  consumable_id?: string | null;
  material_id?: string | null;
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  amount: number;
  gst_amount?: number | null;
  total_amount: number;
  required_date?: string | null;
  payment_method?: string | null;
  vendor_name?: string | null;
  vendor_invoice_ref?: string | null;
  notes?: string | null;
  status?: ExpenseStatus;
  client_id?: string | null;
  project_id?: string | null;
  requested_by: string;
}

export const ENTRY_TYPE_LABEL: Record<ExpenseEntryType, string> = {
  SITE_EXPENSE_REQUEST: 'Site Expense Request',
  SITE_EXPENSE_POST_PURCHASE: 'Post Purchase',
};

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  CONSUMABLES: 'Consumables',
  CRANE_CHARGES: 'Crane Charges',
  LABOUR: 'Labour',
  LOCAL_PURCHASE: 'Local Purchase',
  OTHER_CHARGES: 'Other Charges',
};

export const ITEM_TYPE_LABEL: Record<ExpenseItemType, string> = {
  CONSUMABLE: 'Consumable',
  MATERIAL: 'Material',
  BILLABLE: 'Billable',
};

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid',
};

export const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PAID: 'bg-blue-50 text-blue-700 border-blue-200',
};

export const CONSUMABLE_CATEGORIES = [
  'Cutting Tools',
  'Abrasive Wheels',
  'Drill Bits',
  'Grinding Discs',
  'Welding Consumables',
  'Fasteners',
  'Waste Cloth',
  'Lubricants',
  'Cleaning Supplies',
  'Safety Equipment',
  'Tapes & Adhesives',
  'Packing Material',
  'Marking Tools',
  'Other Consumables',
] as const;

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Company Card',
  'Personal Card',
  'Other',
] as const;
