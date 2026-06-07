// ============================================
// Daily Report Permissions
// Phase 0 of PRD-DAILY-REPORT-TASK-INTEGRATION
// ============================================
// Mirrors the tasks.* permission catalog.
// v1 ships read-only at the component level (PRD FR-12); this
// catalog is defined now so RBAC paths compile in Phase 1+.
//
// Lives in src/modules/DailyReport/ to follow the
// src/modules/Purchase/ feature-module pattern.
// Components can `import { hasDailyReportPermission } from
// '@/modules/DailyReport/permissions'` directly.
// ============================================

export type DailyReportPermission =
  | 'daily_reports.read'
  | 'daily_reports.create'
  | 'daily_reports.update_own'
  | 'daily_reports.update_any'
  | 'daily_reports.delete'
  | 'daily_reports.review'
  | 'daily_reports.rollup'
  | 'daily_reports.create_task';

export const DAILY_REPORT_PERMISSIONS: Record<string, DailyReportPermission[]> = {
  admin: [
    'daily_reports.read', 'daily_reports.create',
    'daily_reports.update_own', 'daily_reports.update_any',
    'daily_reports.delete', 'daily_reports.review',
    'daily_reports.rollup', 'daily_reports.create_task',
  ],
  project_manager: [
    'daily_reports.read', 'daily_reports.create',
    'daily_reports.update_own', 'daily_reports.update_any',
    'daily_reports.delete', 'daily_reports.review',
    'daily_reports.rollup', 'daily_reports.create_task',
  ],
  engineer: [
    'daily_reports.read', 'daily_reports.create',
    'daily_reports.update_own', 'daily_reports.create_task',
  ],
  supervisor: [
    'daily_reports.read', 'daily_reports.create',
    'daily_reports.update_own', 'daily_reports.create_task',
  ],
  viewer: [
    'daily_reports.read', 'daily_reports.rollup',
  ],
  subcontractor: [
    'daily_reports.read',
  ],
};

export const DAILY_REPORT_PERMISSION_KEYS = new Set(
  Object.values(DAILY_REPORT_PERMISSIONS).flat()
);

export function hasDailyReportPermission(
  role: string | null | undefined,
  permission: DailyReportPermission
): boolean {
  if (!role) return false;
  return (DAILY_REPORT_PERMISSIONS[role] ?? []).includes(permission);
}
