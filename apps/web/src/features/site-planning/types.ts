export type SitePlanStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
export type ClientConfirmationStatus = 'not_confirmed' | 'confirmed' | 'postponement_requested' | 'cancelled';
export type ExecutionStatus = 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
export type WorkType = 'erection_project' | 'service_breakdown' | 'amc_ppm' | 'other';
export type AllocationType = 'employee' | 'subcontractor' | 'headcount_placeholder';
export type AllocationStatus = 'assigned' | 'confirmed' | 'present' | 'absent' | 'replaced';

export interface SitePlanAllocation {
  id: string;
  site_plan_id: string;
  organisation_id: string;
  employee_id: string | null;
  subcontractor_id: string | null;
  allocation_type: AllocationType;
  allocated_trade: string | null;
  headcount: number;
  status: AllocationStatus;
  notes: string | null;
  allocated_by: string | null;
  allocated_at: string;
  // joined relations
  employee?: {
    id: string;
    name: string;
    employee_code?: string;
    designation?: string;
  } | null;
  subcontractor?: {
    id: string;
    vendor_name?: string;
    company_name?: string;
  } | null;
}

export interface SitePlanScheduleHistory {
  id: string;
  site_plan_id: string;
  organisation_id: string;
  previous_date: string;
  new_date: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string;
  client_agreed: boolean;
  rescheduled_by: string | null;
  rescheduled_at: string;
}

export interface SitePlan {
  id: string;
  organisation_id: string;
  project_id: string | null;
  client_id: string | null;
  plan_name: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  trade: string | null;
  headcount_required: number;
  notes: string | null;
  plan_status: SitePlanStatus;
  client_confirmation_status: ClientConfirmationStatus;
  execution_status: ExecutionStatus;
  work_type?: WorkType;
  site_access_cleared?: boolean;
  permits_approved?: boolean;
  materials_staged?: boolean;
  tools_dispatched?: boolean;
  ptw_notes?: string | null;
  tools_required?: string | null;
  emergency_sla_deadline?: string | null;
  readiness_score?: number;
  site_visit_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  created_at: string;
  updated_at: string;
  // joined relations
  project?: {
    id: string;
    title?: string;
    name?: string;
    project_code?: string;
  } | null;
  client?: {
    id: string;
    company_name?: string;
    name?: string;
  } | null;
  allocations?: SitePlanAllocation[];
  allocated_headcount?: number;
}

export interface TomorrowsManpowerSummaryData {
  targetDate: string;
  totalRequired: number;
  totalAllocated: number;
  trades: {
    trade: string;
    required: number;
    allocated: number;
  }[];
  confirmationCounts: {
    confirmed: number;
    notConfirmed: number;
    postponementRequested: number;
  };
  executionCounts: {
    scheduled: number;
    dispatched: number;
  };
  plans: SitePlan[];
}
