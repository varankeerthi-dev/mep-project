export const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  Draft:                { dot: '#94a3b8', label: 'Draft' },
  Active:               { dot: '#10b981', label: 'Active' },
  'Execution Completed':{ dot: '#f59e0b', label: 'Execution' },
  'Financially Closed': { dot: '#6366f1', label: 'Financially Closed' },
  Closed:               { dot: '#64748b', label: 'Closed' },
  Archived:             { dot: '#a1a1aa', label: 'Archived' },
};

export const PO_STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  'Not Required': { dot: '#10b981', label: 'Not Required' },
  Pending:        { dot: '#f59e0b', label: 'Pending' },
  Received:       { dot: '#3b82f6', label: 'Received' },
};

export const STATUS_FILTER_OPTIONS = ['All', 'Active', 'Execution Completed', 'Financially Closed', 'Closed', 'Draft', 'Archived'];
export const PROJECT_STATUS_STATS = ['Active', 'Draft', 'Closed'];

export const MANDATORY_COLUMNS = ['project', 'actions'];
export const ALL_COLUMNS = [
  { id: 'project', label: 'Project' },
  { id: 'client', label: 'Client' },
  { id: 'type', label: 'Type' },
  { id: 'est_value', label: 'Est. Value' },
  { id: 'po_value', label: 'PO Value' },
  { id: 'po_status', label: 'PO Status' },
  { id: 'status', label: 'Status' },
  { id: 'completion', label: 'Completion' },
  { id: 'actions', label: 'Action' },
];

export const PROJECT_TEMPLATES: Record<string, { contractor: string, client: string, excluded: string }> = {
  'Standard MEP Install': {
    contractor: '1. Supply and installation of HVAC equipment\n2. Electrical wiring and panel installation\n3. Plumbing and piping works',
    client: '1. Site clearance and access\n2. Uninterrupted power and water supply\n3. Storage space for materials',
    excluded: '1. Civil works and masonry\n2. Statutory approvals from local authorities'
  },
  'Service & Maintenance': {
    contractor: '1. Routine inspection of AC units\n2. Filter cleaning and replacement\n3. Performance testing and reporting',
    client: '1. Access to all indoor and outdoor units\n2. Approvals for scheduled downtime',
    excluded: '1. Replacement of major compressors (billed separately)\n2. Upgrades to existing infrastructure'
  }
};

export const FORM_STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', color: '#64748b' },
  'Active': { bg: '#dcfce7', color: '#16a34a' },
  'Execution Completed': { bg: '#fef3c7', color: '#d97706' },
  'Financially Closed': { bg: '#e0e7ff', color: '#4f46e5' },
  'Closed': { bg: '#f1f5f9', color: '#475569' },
  'Archived': { bg: '#f4f4f5', color: '#a1a1aa' },
};

export const BRAND_BLUE = '#185FA5';
