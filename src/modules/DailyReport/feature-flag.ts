// ============================================
// Daily Report feature flag
// ============================================
// VITE_DAILY_REPORTS_V2=0 (default)  → Phase 0/1 invisible, app unchanged
// VITE_DAILY_REPORTS_V2=1            → new flow available (Phase 1: read-only)
//
// Phase 2+ sub-flags (all off by default):
//   VITE_DR_V2_INLINE_TASK=1          → "+ New task" opens TaskMiniDrawer
//                                      in the typeahead
//   VITE_DR_V2_PHOTO_RPC=1            → photo upload routes through
//                                      fn_link_daily_report_photo
//   VITE_DR_V2_LOCK_BANNER=1          → section-level lock banner in
//                                      SiteReport workItems
//   VITE_DR_V2_ROLLUP=1               → /projects/:id/reports/rollup
//                                      link in ProjectOverview
//
// Sub-flags exist so we can roll out pieces independently.
// When the parent flag is off, every sub-flag is treated as off.
//
// Phase 6.1 — SiteReport should consult IS_DAILY_REPORTS_V2
// before rendering the structured WorkItemRow list. The legacy
// `work_carried_out` text rows remain the default.
// ============================================

const env = (key: string): string | undefined => {
  const raw = (import.meta as any).env?.[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  return String(raw);
};

const isTruthy = (v: string | undefined): boolean =>
  !!v && (v.toLowerCase() === 'true' || v === '1' || v === 'yes');

export const IS_DAILY_REPORTS_V2 = isTruthy(env('VITE_DAILY_REPORTS_V2'));

export const IS_DR_V2_INLINE_TASK = IS_DAILY_REPORTS_V2 && isTruthy(env('VITE_DR_V2_INLINE_TASK'));
export const IS_DR_V2_PHOTO_RPC = IS_DAILY_REPORTS_V2 && isTruthy(env('VITE_DR_V2_PHOTO_RPC'));
export const IS_DR_V2_LOCK_BANNER = IS_DAILY_REPORTS_V2 && isTruthy(env('VITE_DR_V2_LOCK_BANNER'));
export const IS_DR_V2_ROLLUP = IS_DAILY_REPORTS_V2 && isTruthy(env('VITE_DR_V2_ROLLUP'));

/**
 * Used by the standalone test page (Phase 1f) to expose a quick toggle
 * in localStorage — dev only. Lets you flip the flag without restarting Vite.
 */
export const DAILY_REPORTS_V2_LOCALSTORAGE_KEY = 'mep.dailyReportsV2.local';

/**
 * Helper for the future SiteReport integration (Phase 6.1).
 * Returns true when the structured form should be rendered
 * instead of the legacy `work_carried_out` text rows.
 */
export function shouldRenderStructuredWorkItems(): boolean {
  // The lock banner sub-flag gates the structured work-items list,
  // since the banner is the first user-visible artifact.
  return IS_DR_V2_LOCK_BANNER;
}
