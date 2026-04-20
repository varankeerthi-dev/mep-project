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

### Phase 2: Update App.tsx ✅ COMPLETED
**Status:** COMPLETED
**Files Modified:**
- `src/App.tsx`

**Changes:**
- Import `refreshSessionIfNeeded` from queryClient
- Import `useQueryClient` hook
- Added `useQueryClient()` hook in component
- Updated visibility handler to refresh session BEFORE refetching
- Force logout if session refresh fails
- Fixed useCallback dependencies (added handleLogout to useEffect)
- AuthContext value properly memoized with correct dependencies

**Audit Results:** ✅ PASSED
- Code compiles successfully (tsconfig deprecation warning is unrelated)
- All imports are correct
- Session refresh logic implemented correctly
- Visibility handler properly refreshes session before refetching

---

### Phase 3: Update High-Priority Hooks
**Status:** PENDING
**Files to Modify:**
- `src/hooks/useClients.ts`
- `src/hooks/useProjects.ts`
- `src/modules/Purchase/hooks/usePurchaseQueries.ts`
- `src/invoices/hooks.ts`

**Changes Required:**
- Import `withSessionCheck` from queryClient
- Wrap all `queryFn` functions with `withSessionCheck()`
- Wrap all `mutationFn` functions with `withSessionCheck()`

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

### Phase 8: Testing & Verification
**Status:** PENDING
**Test Scenarios:**
- Normal navigation (session valid)
- Leave for 6 minutes, return, navigate (session expired but refreshable)
- Leave for 24 hours, return (refresh token expired)
- Multiple rapid navigations
- Concurrent queries on different tabs

**Expected Results:**
- No infinite spinners after long inactivity
- Session refresh happens automatically
- Graceful logout when refresh token expires

---

## Progress Summary
- **Total Phases:** 8
- **Completed:** 2/8
- **In Progress:** 0/8
- **Pending:** 6/8
- **Total Files to Modify:** 41

## Last Updated
Phase 2 completed at: 2026-04-20 07:30 UTC+05:30
