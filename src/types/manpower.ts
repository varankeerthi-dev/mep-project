// ============================================
// MANPOWER-BASED SUBCONTRACTOR SYSTEM TYPES
// ============================================

export type WorkUnitType = 'PROJECT' | 'ALTERATION' | 'AMC' | 'WORK_ORDER';

export type RateUnit = 'day' | 'hour' | 'piece';

export type ModifierType = 'RISK' | 'SHIFT' | 'LOCATION' | 'SKILL' | 'OTHER';

export type AttendanceStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export type BillingStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'CANCELLED';

// ============================================
// WORK UNIT
// ============================================
export interface WorkUnit {
  id: string;
  name: string;
  type: WorkUnitType;
  costingMode: 'MEASUREMENT' | 'MANPOWER';
  projectId?: string;
  clientId: string;
}

// ============================================
// LABOUR CATEGORY
// ============================================
export interface LabourCategory {
  id: string;
  organisation_id: string;
  name: string;
  code: string | null;
  description: string | null;
  base_rate: number;
  unit: RateUnit;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLabourCategoryInput {
  organisation_id: string;
  name: string;
  code?: string;
  description?: string;
  base_rate: number;
  unit?: RateUnit;
}

export interface UpdateLabourCategoryInput {
  id: string;
  name?: string;
  code?: string;
  description?: string;
  base_rate?: number;
  unit?: RateUnit;
  is_active?: boolean;
}

// ============================================
// RATE CARD
// ============================================
export interface RateCard {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_unit_id: string | null;
  labour_category_id: string;
  base_rate: number;
  negotiated_rate: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRateCardInput {
  organisation_id: string;
  subcontractor_id: string;
  work_unit_id?: string;
  labour_category_id: string;
  base_rate: number;
  negotiated_rate: number;
  effective_from: string;
  effective_to?: string;
  remarks?: string;
}

export interface UpdateRateCardInput {
  id: string;
  negotiated_rate?: number;
  effective_to?: string;
  is_active?: boolean;
  remarks?: string;
}

// ============================================
// CONTEXT MODIFIER
// ============================================
export interface ContextModifier {
  id: string;
  organisation_id: string;
  name: string;
  code: string | null;
  modifier_type: ModifierType;
  multiplier: number;
  is_percentage: boolean;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContextModifierInput {
  organisation_id: string;
  name: string;
  code?: string;
  modifier_type: ModifierType;
  multiplier: number;
  is_percentage?: boolean;
  description?: string;
}

export interface UpdateContextModifierInput {
  id: string;
  name?: string;
  code?: string;
  modifier_type?: ModifierType;
  multiplier?: number;
  is_percentage?: boolean;
  description?: string;
  is_active?: boolean;
}

// ============================================
// MANPOWER ATTENDANCE
// ============================================
export interface ManpowerAttendance {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_unit_id: string | null;
  work_unit_type: WorkUnitType | null;
  attendance_date: string;
  labour_category_id: string;
  workers_count: number;
  hours_worked: number;
  supervisor_name: string | null;
  applied_modifiers: string[] | null;
  base_rate: number;
  adjusted_rate: number;
  original_amount: number;
  adjusted_amount: number;
  remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateManpowerAttendanceInput {
  organisation_id: string;
  subcontractor_id: string;
  work_unit_id?: string;
  work_unit_type?: WorkUnitType;
  attendance_date: string;
  labour_category_id: string;
  workers_count: number;
  hours_worked?: number;
  supervisor_name?: string;
  applied_modifiers?: string[];
  base_rate: number;
  adjusted_rate: number;
  original_amount: number;
  adjusted_amount: number;
  remarks?: string;
}

export interface UpdateManpowerAttendanceInput {
  id: string;
  workers_count?: number;
  hours_worked?: number;
  supervisor_name?: string;
  applied_modifiers?: string[];
  adjusted_rate?: number;
  adjusted_amount?: number;
  remarks?: string;
  status?: AttendanceStatus;
}

// ============================================
// MANPOWER BILLING
// ============================================
export interface ManpowerBilling {
  id: string;
  organisation_id: string;
  subcontractor_id: string;
  work_unit_id: string | null;
  work_unit_type: WorkUnitType | null;
  billing_period_start: string;
  billing_period_end: string;
  attendance_entries: string[] | null;
  total_original_amount: number;
  total_adjusted_amount: number;
  total_difference: number;
  currency: string;
  status: BillingStatus;
  approved_by: string | null;
  approved_at: string | null;
  payment_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateManpowerBillingInput {
  organisation_id: string;
  subcontractor_id: string;
  work_unit_id?: string;
  work_unit_type?: WorkUnitType;
  billing_period_start: string;
  billing_period_end: string;
  attendance_entries: string[];
  total_original_amount: number;
  total_adjusted_amount: number;
  total_difference: number;
  currency?: string;
  remarks?: string;
}

export interface UpdateManpowerBillingInput {
  id: string;
  status?: BillingStatus;
  remarks?: string;
  payment_id?: string;
}

// ============================================
// BILLING CALCULATION RESULT
// ============================================
export interface BillingCalculationResult {
  attendance_id: string;
  labour_category: string;
  workers_count: number;
  base_rate: number;
  original_amount: number;
  applied_modifiers: ContextModifier[];
  adjusted_rate: number;
  adjusted_amount: number;
  difference: number;
}

export interface BillingSummary {
  total_original_amount: number;
  total_adjusted_amount: number;
  total_difference: number;
  entries: BillingCalculationResult[];
}
