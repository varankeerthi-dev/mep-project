// hooks/index.ts
// Central export for all hooks
// Last updated: 2024 - Tab inactivity fixes applied

// ─────────────────────────────────────────────────────────────────
// ⚠️  DEPRECATED/UNUSED HOOKS - DO NOT USE
// These hooks exist but are NOT imported anywhere in the app.
// They are kept for reference but should not be used in new code.
// ─────────────────────────────────────────────────────────────────
// export { PresenceProvider, usePresenceContext } from './PresenceContext';
// export { usePresence } from './usePresence';
// export { useTabFocus } from './useTabFocus';
// export { usePresenceAware } from './usePresenceAware';
// export { useTabVisibility } from './useTabVisibility'; // Used internally by useRequestManager
// export { TabActivityProvider, useTabActivity } from './TabActivityContext';

// ─────────────────────────────────────────────────────────────────
// ✅ ACTIVE HOOKS
// ─────────────────────────────────────────────────────────────────

// Data Fetching Hooks (organization-scoped) - RECOMMENDED FOR USE
export { useClients, useClient } from './useClients';
export { useMaterials, useMaterial } from './useMaterials';
export { useProjects, useProject, useActiveProjects } from './useProjects';
export { useWarehouses, useWarehouse } from './useWarehouses';
export { useVariants, useVariant } from './useVariants';
export { useUnits, useUnit } from './useUnits';
export { useMaterialsPageData, useStockDataMap, useMaterialTableCallbacks,
  MaterialNameCell, MaterialStockCell, MaterialStatusCell, MaterialActionsCell,
  MemoizedTextCell, MemoizedPriceCell, MemoizedGstCell, MemoizedBoolCell } from './useMaterialsPageData';

// Request Management
export { useRequestManager, getGlobalPendingCount, cancelAllGlobalRequests } from './useRequestManager';

// Subcontractor & Ledger
export { useSubcontractorLedger } from './useSubcontractorLedger';

// Measurement & BOQ
export { useMeasurementSheets } from './useMeasurementSheets';

// UI & Performance
export { useVirtualizedTable, useMemoizedVirtualizer } from './useVirtualizedTable';
export { usePermissions } from './usePermissions';
export { usePerformanceMonitor, clearPerformanceMetrics, getPerformanceMetrics, getAverageDuration, getSlowQueries, usePageLoadTiming, useQueryTiming } from './usePerformanceMonitor';
export { useTrialRestrictions } from './useTrialRestrictions';
