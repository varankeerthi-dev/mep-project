// ============================================
// MANPOWER BILLING CALCULATION UTILITY
// ============================================

import {
  ContextModifier,
  BillingCalculationResult,
  BillingSummary,
  ManpowerAttendance,
  LabourCategory,
} from '../types/manpower';

/**
 * Calculate adjusted rate based on base rate and applied modifiers
 */
export function calculateAdjustedRate(
  baseRate: number,
  modifiers: ContextModifier[]
): number {
  let adjustedRate = baseRate;

  for (const modifier of modifiers) {
    if (modifier.is_percentage) {
      // Percentage multiplier (e.g., 1.25 for 25% increase)
      adjustedRate = adjustedRate * modifier.multiplier;
    } else {
      // Fixed amount addition
      adjustedRate = adjustedRate + modifier.multiplier;
    }
  }

  return Math.round(adjustedRate * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate billing for a single attendance entry
 */
export function calculateAttendanceBilling(
  attendance: ManpowerAttendance,
  labourCategory: LabourCategory,
  allModifiers: ContextModifier[]
): BillingCalculationResult {
  const appliedModifiers = allModifiers.filter(m =>
    attendance.applied_modifiers?.includes(m.id)
  );

  const adjustedRate = calculateAdjustedRate(
    attendance.base_rate,
    appliedModifiers
  );

  const originalAmount = attendance.base_rate * attendance.workers_count;
  const adjustedAmount = adjustedRate * attendance.workers_count;
  const difference = adjustedAmount - originalAmount;

  return {
    attendance_id: attendance.id,
    labour_category: labourCategory.name,
    workers_count: attendance.workers_count,
    base_rate: attendance.base_rate,
    original_amount: originalAmount,
    applied_modifiers: appliedModifiers,
    adjusted_rate: adjustedRate,
    adjusted_amount: adjustedAmount,
    difference: difference,
  };
}

/**
 * Calculate billing summary for multiple attendance entries
 */
export function calculateBillingSummary(
  attendances: ManpowerAttendance[],
  labourCategories: LabourCategory[],
  allModifiers: ContextModifier[]
): BillingSummary {
  const entries: BillingCalculationResult[] = [];

  for (const attendance of attendances) {
    const labourCategory = labourCategories.find(
      lc => lc.id === attendance.labour_category_id
    );

    if (labourCategory) {
      const billing = calculateAttendanceBilling(
        attendance,
        labourCategory,
        allModifiers
      );
      entries.push(billing);
    }
  }

  const totalOriginalAmount = entries.reduce(
    (sum, entry) => sum + entry.original_amount,
    0
  );
  const totalAdjustedAmount = entries.reduce(
    (sum, entry) => sum + entry.adjusted_amount,
    0
  );
  const totalDifference = totalAdjustedAmount - totalOriginalAmount;

  return {
    total_original_amount: Math.round(totalOriginalAmount * 100) / 100,
    total_adjusted_amount: Math.round(totalAdjustedAmount * 100) / 100,
    total_difference: Math.round(totalDifference * 100) / 100,
    entries,
  };
}

/**
 * Calculate attendance entry values before saving
 */
export function calculateAttendanceValues(
  baseRate: number,
  workersCount: number,
  appliedModifierIds: string[],
  allModifiers: ContextModifier[]
): {
  adjusted_rate: number;
  original_amount: number;
  adjusted_amount: number;
} {
  const appliedModifiers = allModifiers.filter(m =>
    appliedModifierIds.includes(m.id)
  );

  const adjustedRate = calculateAdjustedRate(baseRate, appliedModifiers);
  const originalAmount = baseRate * workersCount;
  const adjustedAmount = adjustedRate * workersCount;

  return {
    adjusted_rate: Math.round(adjustedRate * 100) / 100,
    original_amount: Math.round(originalAmount * 100) / 100,
    adjusted_amount: Math.round(adjustedAmount * 100) / 100,
  };
}

/**
 * Get effective rate card for a subcontractor and labour category
 */
export function getEffectiveRateCard(
  rateCards: any[],
  subcontractorId: string,
  labourCategoryId: string,
  workUnitId?: string,
  date?: string
): any {
  const effectiveDate = date || new Date().toISOString().split('T')[0];

  // Filter rate cards by subcontractor, labour category, and work unit
  let filtered = rateCards.filter(
    rc =>
      rc.subcontractor_id === subcontractorId &&
      rc.labour_category_id === labourCategoryId &&
      rc.is_active
  );

  // If work unit specified, prefer work unit specific rate cards
  if (workUnitId) {
    const workUnitSpecific = filtered.filter(
      rc => rc.work_unit_id === workUnitId
    );
    if (workUnitSpecific.length > 0) {
      filtered = workUnitSpecific;
    } else {
      // Fall back to general rate cards (no work unit)
      filtered = filtered.filter(rc => !rc.work_unit_id);
    }
  } else {
    // No work unit specified, use general rate cards
    filtered = filtered.filter(rc => !rc.work_unit_id);
  }

  // Find rate card effective on the given date
  const effectiveCard = filtered.find(
    rc =>
      rc.effective_from <= effectiveDate &&
      (!rc.effective_to || rc.effective_to >= effectiveDate)
  );

  return effectiveCard || null;
}

/**
 * Group attendances by date for reporting
 */
export function groupAttendancesByDate(
  attendances: ManpowerAttendance[]
): Record<string, ManpowerAttendance[]> {
  return attendances.reduce((acc, attendance) => {
    const date = attendance.attendance_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(attendance);
    return acc;
  }, {} as Record<string, ManpowerAttendance[]>);
}

/**
 * Group attendances by labour category for reporting
 */
export function groupAttendancesByCategory(
  attendances: ManpowerAttendance[],
  labourCategories: LabourCategory[]
): Record<string, { category: LabourCategory; attendances: ManpowerAttendance[] }> {
  const result: Record<string, { category: LabourCategory; attendances: ManpowerAttendance[] }> = {};

  for (const attendance of attendances) {
    const category = labourCategories.find(
      lc => lc.id === attendance.labour_category_id
    );

    if (category) {
      if (!result[category.id]) {
        result[category.id] = { category, attendances: [] };
      }
      result[category.id].attendances.push(attendance);
    }
  }

  return result;
}

/**
 * Calculate total workers per day
 */
export function calculateTotalWorkersPerDay(
  attendances: ManpowerAttendance[]
): Record<string, number> {
  const grouped = groupAttendancesByDate(attendances);

  return Object.entries(grouped).reduce((acc, [date, dayAttendances]) => {
    acc[date] = dayAttendances.reduce(
      (sum, att) => sum + att.workers_count,
      0
    );
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Calculate total workers per category
 */
export function calculateTotalWorkersPerCategory(
  attendances: ManpowerAttendance[],
  labourCategories: LabourCategory[]
): Record<string, { categoryName: string; totalWorkers: number }> {
  const grouped = groupAttendancesByCategory(attendances, labourCategories);

  return Object.entries(grouped).reduce((acc, [categoryId, data]) => {
    acc[categoryId] = {
      categoryName: data.category.name,
      totalWorkers: data.attendances.reduce(
        (sum, att) => sum + att.workers_count,
        0
      ),
    };
    return acc;
  }, {} as Record<string, { categoryName: string; totalWorkers: number }>);
}
