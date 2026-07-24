export const SUBCONTRACTOR_V2_QUERY_KEYS = {
  all: () => ['subcontractors-v2'] as const,
  list: (orgId: string | null, filter: string) => ['subcontractors-v2', 'list', orgId, filter] as const,
  detail: (id: string | null) => ['subcontractors-v2', 'detail', id] as const,
  workOrders: (subId: string | null) => ['subcontractors-v2', 'workOrders', subId] as const,
  amendments: (woIds: string[]) => ['subcontractors-v2', 'amendments', woIds] as const,
  attendance: (subId: string | null) => ['subcontractors-v2', 'attendance', subId] as const,
  dailyLogs: (subId: string | null) => ['subcontractors-v2', 'dailyLogs', subId] as const,
  payments: (subId: string | null) => ['subcontractors-v2', 'payments', subId] as const,
  invoices: (subId: string | null) => ['subcontractors-v2', 'invoices', subId] as const,
  documents: (subId: string | null) => ['subcontractors-v2', 'documents', subId] as const,
} as const;
