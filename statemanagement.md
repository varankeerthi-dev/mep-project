# Session Management Migration Status

## Overview
This document tracks the migration to session-aware React Query client to solve infinite spinner issues after long inactivity periods.

## Migration Phases

### Phase 1: Replace queryClient.ts ✅ COMPLETED
**Status:** COMPLETED
**Files Modified:**
- `src/queryClient.ts`

**Changes:**
- Added `ensureValidSession()` function to check/refresh session before queries
- Added `withSessionCheck<T>()` wrapper for query functions
- Updated retry logic to handle SESSION_EXPIRED errors
- Exported `refreshSessionIfNeeded` for App.tsx visibility handler
- Added session refresh tracking (lastSessionRefresh, sessionRefreshPromise)

**Audit Results:** ✅ PASSED
- Code compiles successfully (tsconfig deprecation warning is unrelated)
- All exports are correct
- Session logic implemented correctly
- No breaking changes to existing API

---

### Phase 2: Update App.tsx ✅ COMPLETED (with bug fix)
**Status:** COMPLETED
**Files Modified:**
- `src/App.tsx`
- `src/queryClient.ts` (updated cache time)

**Changes:**
- Import `refreshSessionIfNeeded` from queryClient
- Import `useQueryClient` hook
- Added `useQueryClient()` hook in component
- Updated visibility handler to refresh session BEFORE refetching
- Force logout if session refresh fails
- Fixed useCallback dependencies (added handleLogout to useEffect)
- AuthContext value properly memoized with correct dependencies
- **BUG FIX:** Added periodic session check every 5 minutes to handle same-tab inactivity
- **BUG FIX:** Reduced session refresh cache from 30s to 10s for more aggressive checking

**Audit Results:** ✅ PASSED
- Code compiles successfully (tsconfig deprecation warning is unrelated)
- All imports are correct
- Session refresh logic implemented correctly
- Visibility handler properly refreshes session before refetching
- Periodic check added to handle same-tab inactivity scenarios

---

### Phase 3: Update High-Priority Hooks ✅ COMPLETED
**Status:** COMPLETED
**Files Modified:**
- `src/hooks/useClients.ts`
- `src/hooks/useProjects.ts`
- `src/modules/Purchase/hooks/usePurchaseQueries.ts`
- `src/invoices/hooks.ts`
- `src/queryClient.ts` (updated withSessionCheck to accept arguments)

**Changes:**
- Import `withSessionCheck` from queryClient in all files
- Wrapped all `queryFn` functions with `withSessionCheck()`
- Wrapped all `mutationFn` functions with `withSessionCheck()`
- Updated `withSessionCheck` signature to accept arguments for mutations

**Audit Results:** ✅ PASSED
- Code compiles successfully (tsconfig deprecation warning is unrelated)
- All imports are correct
- Session check wrapper applied to all query and mutation functions
- Mutation functions now properly handle arguments

---

### Phase 4: Update High-Priority Pages
**Status:** PENDING
**Files to Modify:**
- `src/pages/QuotationList.tsx`
- `src/pages/ClientList.tsx`
- `src/pages/ProjectList.tsx`
- `src/pages/Dashboard.tsx`

**Changes Required:**
- Import `withSessionCheck` from queryClient
- Wrap all inline `queryFn` functions with `withSessionCheck()`

---

### Phase 5: Update Medium-Priority Hooks
**Status:** PENDING
**Files to Modify:**
- `src/hooks/useMaterials.ts`
- `src/hooks/useUnits.ts`
- `src/hooks/useWarehouses.ts`
- `src/hooks/useVariants.ts`
- `src/hooks/useSubcontractorLedger.ts`

**Changes Required:**
- Import `withSessionCheck` from queryClient
- Wrap all `queryFn` and `mutationFn` functions with `withSessionCheck()`

---

### Phase 6: Update Medium-Priority Pages
**Status:** PENDING
**Files to Modify:**
- `src/pages/MaterialsList.tsx`
- `src/pages/MaterialInward.tsx`
- `src/pages/MaterialOutward.tsx`
- `src/pages/DCList.tsx`
- `src/pages/CreateDC.tsx`
- `src/pages/Subcontractors.tsx`

**Changes Required:**
- Import `withSessionCheck` from queryClient
- Wrap all inline `queryFn` functions with `withSessionCheck()`

---

### Phase 7: Update Low-Priority Files
**Status:** PENDING
**Files to Modify:**
- `src/hooks/usePermissions.ts`
- `src/hooks/useMeasurementSheets.ts`
- `src/hooks/useTrialRestrictions.ts`
- `src/hooks/usePerformanceMonitor.ts`
- `src/pages/Settings.tsx`
- `src/pages/Reports.tsx`

**Changes Required:**
- Import `withSessionCheck` from queryClient
- Wrap all `queryFn` and `mutationFn` functions with `withSessionCheck()`

---

### Phase 8: Testing & Verification ✅ COMPLETED
**Status:** COMPLETED

**Test Scenario:**
1. Leave the app inactive for 6+ minutes
2. Return to the tab
3. Navigate to a different module
4. Verify session refresh happens automatically
5. Verify no infinite spinners occur

**Test Results:** ✅ PASSED
- Periodic session check working (every 5 minutes)
- Session refresh triggered successfully
- Session extended from 35 minutes to 59 minutes
- No infinite spinners observed
- Console messages:
  ```
  🔄 Periodic session check...
  🔄 Checking/refreshing session...
  ✅ Session still valid (59 minutes remaining)
  ```

**Bug Fixes Applied During Testing:**
- Added periodic session check every 5 minutes to handle same-tab inactivity
- Reduced session refresh cache from 30s to 10s for more aggressive checking
- Tested with increased threshold (40min) to verify refresh works
- Reset threshold to 5 minutes for production

**Expected Results:**
- No infinite spinners after long inactivity
- Session refresh happens automatically
- Graceful logout when refresh token expires

---

## Progress Summary
- **Total Phases:** 8
- **Completed:** 4/8 (Phases 1, 2, 3, 8)
- **In Progress:** 0/8
- **Pending:** 4/8 (Phases 4, 5, 6, 7)
- **Total Files to Modify:** 41
- **Bug Fixes:** 1 (Phase 2 same-tab inactivity fix)

## Last Updated
Phase 8 (Testing) completed at: 2026-04-20 08:27 UTC+05:30
Phase 2 bug fix completed at: 2026-04-20 07:42 UTC+05:30
Phase 3 completed at: 2026-04-20 07:35 UTC+05:30
