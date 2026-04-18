/**
 * Standardized Query Keys Factory
 * 
 * Provides consistent query key patterns across the application.
 * All data fetching should use these keys for proper cache coordination.
 */

// Base query keys for organization-scoped data
export const queryKeys = {
  // ─────────────────────────────────────────────────────────────────
  // Core Entity Queries (organization-scoped)
  // ─────────────────────────────────────────────────────────────────
  
  /** All materials for an organization */
  materials: (orgId: string | undefined) => ['materials', orgId] as const,
  
  /** Materials page data (parallel query for all related data) */
  materialsPageData: (orgId: string | undefined) => ['materials-page-data', orgId] as const,
  
  /** All clients for an organization */
  clients: (orgId: string | undefined) => ['clients', orgId] as const,
  
  /** All projects for an organization */
  projects: (orgId: string | undefined) => ['projects', orgId] as const,
  
  /** All warehouses for an organization */
  warehouses: (orgId: string | undefined) => ['warehouses', orgId] as const,
  
  /** All variants for an organization */
  variants: (orgId: string | undefined) => ['variants', orgId] as const,
  
  /** All units for an organization */
  units: (orgId: string | undefined) => ['units', orgId] as const,
  
  /** All categories for an organization */
  categories: (orgId: string | undefined) => ['categories', orgId] as const,
  
  // ─────────────────────────────────────────────────────────────────
  // Dashboard Queries
  // ─────────────────────────────────────────────────────────────────
  
  dashboard: {
    all: () => ['dashboard'] as const,
    stats: () => ['dashboard', 'stats'] as const,
    todaySites: (date: string) => ['dashboard', 'todaySites', date] as const,
    approvals: () => ['dashboard', 'approvals'] as const,
    clientComms: () => ['dashboard', 'clientComms'] as const,
    visitPlan: () => ['dashboard', 'visitPlan'] as const,
    quotationApproval: () => ['dashboard', 'quotationApproval'] as const,
    invoices: () => ['dashboard', 'invoices'] as const,
    deliveryChallans: () => ['dashboard', 'deliveryChallans'] as const,
    recentUpdates: () => ['dashboard', 'recentUpdates'] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Sales & Commercial Queries
  // ─────────────────────────────────────────────────────────────────
  
  quotations: {
    all: (orgId: string | undefined) => ['quotations', orgId] as const,
    byStatus: (orgId: string | undefined, status: string) => ['quotations', orgId, status] as const,
    detail: (id: string) => ['quotation', id] as const,
    items: (quotationId: string) => ['quotation-items', quotationId] as const,
  },
  
  invoices: {
    all: (orgId: string | undefined) => ['invoices', orgId] as const,
    byStatus: (orgId: string | undefined, status: string) => ['invoices', orgId, status] as const,
    detail: (id: string) => ['invoice', id] as const,
  },
  
  deliveryChallans: {
    all: (orgId: string | undefined) => ['deliveryChallans', orgId] as const,
    byStatus: (orgId: string | undefined, status: string) => ['deliveryChallans', orgId, status] as const,
    detail: (id: string) => ['deliveryChallan', id] as const,
    init: (orgId: string | undefined) => ['dc-init', orgId] as const,
    consolidation: {
      dateWise: (orgId: string | undefined, startDate: string, endDate: string) => 
        ['dc-consolidation', 'dateWise', orgId, startDate, endDate] as const,
      materialWise: (orgId: string | undefined, startDate: string, endDate: string) => 
        ['dc-consolidation', 'materialWise', orgId, startDate, endDate] as const,
    },
  },
  
  purchaseOrders: {
    all: (orgId: string | undefined) => ['purchaseOrders', orgId] as const,
    detail: (id: string) => ['purchaseOrder', id] as const,
  },
  
  ledger: {
    client: (orgId: string | undefined, clientId: string) => ['ledger', 'client', orgId, clientId] as const,
    subcontractor: (orgId: string | undefined, subcontractorId: string) => 
      ['ledger', 'subcontractor', orgId, subcontractorId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Inventory Queries
  // ─────────────────────────────────────────────────────────────────
  
  stock: {
    all: (orgId: string | undefined) => ['stock', orgId] as const,
    byItem: (orgId: string | undefined, itemId: string) => ['stock', orgId, itemId] as const,
    byWarehouse: (orgId: string | undefined, warehouseId: string) => ['stock', 'warehouse', orgId, warehouseId] as const,
    balance: (orgId: string | undefined) => ['stock-balance', orgId] as const,
  },
  
  inventory: {
    inward: (orgId: string | undefined) => ['inventory', 'inward', orgId] as const,
    outward: (orgId: string | undefined) => ['inventory', 'outward', orgId] as const,
    transfers: (orgId: string | undefined) => ['inventory', 'transfers', orgId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Project Management Queries
  // ─────────────────────────────────────────────────────────────────
  
  dailyUpdates: (orgId: string | undefined, projectId?: string) => 
    ['dailyUpdates', orgId, projectId] as const,
  
  siteMaterials: (orgId: string | undefined, projectId?: string) => 
    ['siteMaterials', orgId, projectId] as const,
  
  boq: {
    all: (orgId: string | undefined) => ['boq', orgId] as const,
    detail: (id: string) => ['boq', id] as const,
    items: (boqId: string) => ['boq', 'items', boqId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Subcontractor Queries
  // ─────────────────────────────────────────────────────────────────
  
  subcontractors: {
    all: (orgId: string | undefined) => ['subcontractors', orgId] as const,
    detail: (id: string) => ['subcontractor', id] as const,
    attendance: (orgId: string | undefined, subcontractorId: string) => 
      ['subcontractor', 'attendance', orgId, subcontractorId] as const,
    payments: (orgId: string | undefined, subcontractorId: string) => 
      ['subcontractor', 'payments', orgId, subcontractorId] as const,
    invoices: (orgId: string | undefined, subcontractorId: string) => 
      ['subcontractor', 'invoices', orgId, subcontractorId] as const,
  },
  
  workOrders: {
    all: (orgId: string | undefined) => ['workOrders', orgId] as const,
    detail: (id: string) => ['workOrder', id] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Client Management Queries
  // ─────────────────────────────────────────────────────────────────
  
  client: {
    detail: (id: string) => ['client', id] as const,
    communications: (clientId: string) => ['client', 'communications', clientId] as const,
    meetings: (clientId: string) => ['client', 'meetings', clientId] as const,
    siteVisits: (clientId: string) => ['client', 'siteVisits', clientId] as const,
    requests: (orgId: string | undefined) => ['clientRequests', orgId] as const,
  },
  
  meetings: {
    all: (orgId: string | undefined) => ['meetings', orgId] as const,
    detail: (id: string) => ['meeting', id] as const,
  },
  
  siteVisits: {
    all: (orgId: string | undefined) => ['siteVisits', orgId] as const,
    detail: (id: string) => ['siteVisit', id] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Settings & Configuration
  // ─────────────────────────────────────────────────────────────────
  
  settings: {
    all: (orgId: string | undefined) => ['settings', orgId] as const,
    byKey: (orgId: string | undefined, key: string) => ['settings', orgId, key] as const,
  },
  
  templates: {
    all: (orgId: string | undefined) => ['templates', orgId] as const,
    byType: (orgId: string | undefined, type: string) => ['templates', orgId, type] as const,
    detail: (id: string) => ['template', id] as const,
  },
  
  organisation: {
    detail: (orgId: string | undefined) => ['organisation', orgId] as const,
    members: (orgId: string | undefined) => ['organisation', 'members', orgId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // User & Auth Queries
  // ─────────────────────────────────────────────────────────────────
  
  auth: {
    session: () => ['auth', 'session'] as const,
    profile: (userId: string) => ['auth', 'profile', userId] as const,
    organisations: (userId: string) => ['auth', 'organisations', userId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Reports Queries
  // ─────────────────────────────────────────────────────────────────
  
  reports: {
    stockBalance: (orgId: string | undefined) => ['reports', 'stockBalance', orgId] as const,
    stockReport: (orgId: string | undefined, filters?: Record<string, string>) => 
      ['reports', 'stockReport', orgId, filters] as const,
    purchaseReport: (orgId: string | undefined, filters?: Record<string, string>) => 
      ['reports', 'purchaseReport', orgId, filters] as const,
    salesReport: (orgId: string | undefined, filters?: Record<string, string>) => 
      ['reports', 'salesReport', orgId, filters] as const,
  },
} as const;

/**
 * Helper type for organization-scoped queries
 */
export type OrgScopedQueryKey<T extends string> = readonly [T, string | undefined];

/**
 * Create a query key for a specific item by ID
 */
export function itemKey<T extends string>(base: T, id: string): readonly [T, string] {
  return [base, id] as const;
}

/**
 * Create a paginated query key
 */
export function paginatedKey<T extends string>(
  base: T,
  orgId: string | undefined,
  page: number,
  pageSize: number
): readonly [T, string | undefined, number, number] {
  return [base, orgId, page, pageSize] as const;
}

/**
 * Create a filtered query key
 */
export function filteredKey<T extends string>(
  base: T,
  orgId: string | undefined,
  filters: Record<string, unknown>
): readonly [T, string | undefined, Record<string, unknown>] {
  return [base, orgId, filters] as const;
}
