// hooks/index.ts
// Central export for all hooks

// ─────────────────────────────────────────────────────────────────
// Presence & Tab Visibility Hooks
// ─────────────────────────────────────────────────────────────────
export { usePresence, type PresenceStatus, type UsePresenceOptions, type UsePresenceReturn } from './usePresence';
export { useTabFocus, type UseTabFocusReturn } from './useTabFocus';
export { PresenceProvider, usePresenceContext, type PresenceContextValue } from './PresenceContext';
export { usePresenceAware, type UsePresenceAwareOptions, type UsePresenceAwareReturn } from './usePresenceAware';
export { useTabVisibility, type VisibilityState, type UseTabVisibilityOptions, type UseTabVisibilityReturn } from './useTabVisibility';
export { useRequestManager, type RequestManagerConfig, type UseRequestManagerReturn, getGlobalPendingCount, cancelAllGlobalRequests } from './useRequestManager';
export { TabActivityProvider, useTabActivity, type TabActivityState, type TabActivityActions } from './TabActivityContext';
export { useAsyncInterval, createVisibilityAwarePoller } from './useAsyncInterval';

// ─────────────────────────────────────────────────────────────────
// Data Fetching Hooks (organization-scoped)
// ─────────────────────────────────────────────────────────────────
export { useClients, useClient } from './useClients';
export { useMaterials, useMaterial } from './useMaterials';
export { useProjects, useProject, useActiveProjects } from './useProjects';
export { useWarehouses, useWarehouse } from './useWarehouses';
export { useVariants, useVariant } from './useVariants';
export { useUnits, useUnit } from './useUnits';
export { useMaterialsPageData, useStockDataMap, useMaterialTableCallbacks, 
  MaterialNameCell, MaterialStockCell, MaterialStatusCell, MaterialActionsCell,
  MemoizedTextCell, MemoizedPriceCell, MemoizedGstCell, MemoizedBoolCell } from './useMaterialsPageData';

// ─────────────────────────────────────────────────────────────────
// Subcontractor & Ledger Hooks
// ─────────────────────────────────────────────────────────────────
export { useSubcontractorLedger } from './useSubcontractorLedger';

// ─────────────────────────────────────────────────────────────────
// Measurement & BOQ Hooks
// ─────────────────────────────────────────────────────────────────
export { useMeasurementSheets } from './useMeasurementSheets';

// ─────────────────────────────────────────────────────────────────
// UI & Performance Hooks
// ─────────────────────────────────────────────────────────────────
export { useVirtualizedTable, useMemoizedVirtualizer } from './useVirtualizedTable';
export { usePermissions } from './usePermissions';
export { usePerformanceMonitor, clearPerformanceMetrics, getPerformanceMetrics, getAverageDuration, getSlowQueries, usePageLoadTiming, useQueryTiming } from './usePerformanceMonitor';
export { useTrialRestrictions } from './useTrialRestrictions';

// ─────────────────────────────────────────────────────────────────
// Request Management Hooks
// ─────────────────────────────────────────────────────────────────
export { useRequestManager, cancelAllGlobalRequests, getGlobalPendingCount } from './useRequestManager';
