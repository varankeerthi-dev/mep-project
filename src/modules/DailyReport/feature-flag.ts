// ============================================
// Daily Report feature flag
// ============================================
// VITE_DAILY_REPORTS_V2=0 (default)  → Phase 0/1 invisible, app unchanged
// VITE_DAILY_REPORTS_V2=1            → new flow available (Phase 1: read-only)
//
// Phase 2 will add a finer-grained set of sub-flags for
// "create new task inline" and "photo upload via RPC".
// ============================================

export const IS_DAILY_REPORTS_V2 = (() => {
  const raw = import.meta.env.VITE_DAILY_REPORTS_V2;
  if (raw === undefined || raw === null || raw === '') return false;
  return String(raw).toLowerCase() === 'true' || raw === '1' || raw === 1;
})();

/**
 * Used by the standalone test page (Phase 1f) to expose a quick toggle
 * in localStorage — dev only. Lets you flip the flag without restarting Vite.
 */
export const DAILY_REPORTS_V2_LOCALSTORAGE_KEY = 'mep.dailyReportsV2.local';
