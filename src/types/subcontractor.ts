export type SubcontractorStatus = 'Active' | 'Inactive' | 'Suspended' | 'Blacklisted';
export type WorkOrderStatus = 'Draft' | 'Pending' | 'Approved' | 'In Progress' | 'Completed' | 'Cancelled' | 'On Hold';
export type InvoiceStatus = 'Draft' | 'Pending' | 'Approved' | 'Paid' | 'Rejected' | 'Overdue';
export type PaymentMode = 'Bank Transfer' | 'Cash' | 'Cheque' | 'UPI' | 'RTGS/NEFT' | 'Other';
export type AmendmentStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';
export type TDSPaymentStatus = 'Pending' | 'Paid';
export type IssuePriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type DocumentType = 'PAN Card' | 'Bank Passbook' | 'Aadhar Card' | 'GST Certificate' | 'NDA' | 'Contract' | 'Insurance' | 'License' | 'Other';
export type LedgerEntryType = 'WO-ISSUED' | 'WO-AMD' | 'INVOICE' | 'PAYMENT' | 'RETENTION' | 'RETENTION-RELEASE';
export type OnboardingStep = 'company_info' | 'compliance' | 'bank_details' | 'documents' | 'team_members' | 'work_orders';

export interface Subcontractor {
  id: string;
  organisation_id: string;
  sub_number: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  state: string | null;
  gstin: string | null;
  pincode: string | null;
  pan_card: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_account_type: string | null;
  previous_projects: string | null;
  nature_of_work: string | null;
  internal_remarks: string | null;
  nda_signed: boolean;
  contract_signed: boolean;
  nda_date: string | null;
  contract_date: string | null;
  status: SubcontractorStatus;
  tds_percentage: number;
  tds_applicable: boolean;
  pan_number: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorWorkOrder {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_order_no: string;
  work_description: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_value: number | null;
  total_amount: number;
  status: WorkOrderStatus;
  is_amendment: boolean;
  amendment_no: number;
  amendment_status: AmendmentStatus;
  parent_work_order_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderAmendment {
  id: string;
  organisation_id: string;
  work_order_id: string;
  amendment_no: number;
  previous_amount: number;
  new_amount: number;
  difference_amount: number;
  reason: string;
  status: AmendmentStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorInvoice {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_order_id: string | null;
  invoice_no: string;
  invoice_date: string;
  amount: number;
  status: InvoiceStatus;
  remarks: string | null;
  description: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorPayment {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_order_id: string | null;
  invoice_id: string | null;
  amount: number;
  gross_amount: number | null;
  tds_percentage: number | null;
  tds_amount: number | null;
  net_amount: number | null;
  payment_date: string;
  payment_mode: PaymentMode | null;
  reference_no: string | null;
  description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorAttendance {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  attendance_date: string;
  workers_count: number;
  supervisor_name: string | null;
  remarks: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorDailyLog {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_order_id: string | null;
  log_date: string;
  work_done: string | null;
  delays: string | null;
  safety_incidents: string | null;
  workers_count: number | null;
  remarks: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorDocument {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  document_name: string | null;
  document_url: string;
  document_type: DocumentType | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface SubcontractorIssue {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_order_id: string | null;
  issue_date: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  resolved_date: string | null;
  remarks: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TDSPayment {
  id: string;
  subcontractor_id: string;
  payment_id: string;
  tds_amount: number;
  challan_no: string | null;
  challan_date: string | null;
  quarter: string | null;
  financial_year: string | null;
  status: TDSPaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface RetentionRecord {
  id: string;
  work_order_id: string;
  subcontractor_id: string;
  retention_percentage: number;
  retention_amount: number;
  scheduled_release_date: string;
  actual_release_date: string | null;
  payment_reference: string | null;
  notes: string | null;
  is_released: boolean;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  reference: string;
  workOrderRef?: string;
  description?: string;
  debit: number;
  credit: number;
  tdsAmount: number;
  balance: number;
  details?: Record<string, unknown>;
}

export interface LedgerSummary {
  contractValue: number;
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
  totalTDS: number;
  totalRetention: number;
  releasedRetention: number;
}

export interface WorkOrderWithValue {
  id: string;
  work_order_no: string;
  work_description: string;
  total_amount: number;
  contract_value: number;
  status: WorkOrderStatus;
  is_amendment: boolean;
  amendment_no: number;
  parent_work_order_id?: string;
}

export interface SubcontractorFormData {
  sub_number: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin: string;
  pincode: string;
  pan_card: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_account_type: string;
  previous_projects: string;
  nature_of_work: string;
  internal_remarks: string;
  nda_signed: boolean;
  contract_signed: boolean;
  nda_date: string;
  contract_date: string;
  status: SubcontractorStatus;
}

export interface TeamMemberFormData {
  name: string;
  mobile: string;
  aadhar_number: string;
}

export interface DocumentUploadFormData {
  pan_card_doc: File | null;
  bank_passbook_doc: File | null;
  aadhar_card_doc: File | null;
}

export interface OnboardingChecklist {
  company_info: boolean;
  compliance: boolean;
  bank_details: boolean;
  documents: boolean;
  team_members: boolean;
  work_orders: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SubcontractorStats {
  total: number;
  active: number;
  inactive: number;
  withActiveWO: number;
  complianceComplete: number;
  complianceIncomplete: number;
  totalContractValue: number;
  totalPaid: number;
  totalOutstanding: number;
}
