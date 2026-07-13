export type ExpenseEntryType = 'SITE_EXPENSE_REQUEST' | 'SITE_EXPENSE_POST_PURCHASE';

export type ExpenseCategory = 'consumable' | 'crane' | 'labour' | 'other_party' | 'sudden_purchase' | 'material';

export type ExpenseItemType = 'consumable' | 'material' | 'billable';

export type ExpensePaymentMethod = 'engineer_paid_own' | 'company_cash_to_engineer' | 'company_direct';

export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'VERIFIED' | 'PAID' | 'REJECTED' | 'CANCELLED';

export interface ExpenseEntry {
  id: string;
  organisation_id: string;
  project_id: string | null;
  client_id: string | null;
  entry_type: ExpenseEntryType;
  expense_category: ExpenseCategory;
  item_type: ExpenseItemType;
  consumable_catalog_id: string | null;
  material_id: string | null;
  description: string | null;
  amount: number;
  required_date: string | null;
  payment_method: ExpensePaymentMethod | null;
  payment_proof: string | null;
  vendor_name: string | null;
  vendor_gst: string | null;
  requested_by: string;
  status: ExpenseStatus;
  approval_id: string | null;
  created_at: string;
  updated_at: string;
  // Hydrated
  project?: { id: string; project_name: string } | null;
  client?: { id: string; client_name: string } | null;
  consumable_item?: ConsumableCatalogItem | null;
  material?: { id: string; name: string; unit: string } | null;
}

export type ExpenseEntryInsert = Omit<ExpenseEntry, 'id' | 'created_at' | 'updated_at' | 'project' | 'client' | 'consumable_item' | 'material'>;

export type ExpenseEntryUpdate = Partial<ExpenseEntryInsert>;

export interface ConsumableCatalogItem {
  id: string;
  organisation_id: string;
  name: string;
  category: 'Hardware' | 'Electrical' | 'Consumable Tools' | 'Local Purchase' | 'Other';
  unit: string | null;
  default_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ConsumableCatalogInsert = Omit<ConsumableCatalogItem, 'id' | 'created_at' | 'updated_at' | 'is_active'>;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  consumable: 'Consumable',
  crane: 'Crane / Equipment',
  labour: 'Labour',
  other_party: 'Other Party',
  sudden_purchase: 'Sudden Purchase',
  material: 'Material',
};

export const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  VERIFIED: { label: 'Verified', color: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-zinc-100 text-zinc-500' },
};

export const CONSUMABLE_CATEGORIES = ['Hardware', 'Electrical', 'Consumable Tools', 'Local Purchase', 'Other'] as const;
