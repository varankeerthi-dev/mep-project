import type { PermissionKey } from './schemas';

export type PermissionModule = {
  id: string;
  label: string;
  actions: Array<{ key: PermissionKey; label: string }>;
};

const make = (prefix: string, action: string) => `${prefix}.${action}` as PermissionKey;

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'clients',
    label: 'Clients',
    actions: [
      { key: make('clients', 'read'), label: 'View' },
      { key: make('clients', 'create'), label: 'Create' },
      { key: make('clients', 'update'), label: 'Edit' },
      { key: make('clients', 'delete'), label: 'Delete' },
    ],
  },
  {
    id: 'quotations',
    label: 'Quotations',
    actions: [
      { key: make('quotations', 'read'), label: 'View' },
      { key: make('quotations', 'create'), label: 'Create' },
      { key: make('quotations', 'update'), label: 'Edit' },
      { key: make('quotations', 'delete'), label: 'Delete' },
      { key: make('quotations', 'approve'), label: 'Approval' },
    ],
  },
  {
    id: 'delivery_challans',
    label: 'Delivery Challans',
    actions: [
      { key: make('delivery_challans', 'read'), label: 'View' },
      { key: make('delivery_challans', 'create'), label: 'Create' },
      { key: make('delivery_challans', 'update'), label: 'Edit' },
      { key: make('delivery_challans', 'delete'), label: 'Delete' },
      { key: make('delivery_challans', 'approve'), label: 'Approval' },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    actions: [
      { key: make('invoices', 'read'), label: 'View' },
      { key: make('invoices', 'create'), label: 'Create' },
      { key: make('invoices', 'update'), label: 'Edit' },
      { key: make('invoices', 'delete'), label: 'Delete' },
      { key: make('invoices', 'approve'), label: 'Approval' },
    ],
  },
  {
    id: 'site_visits',
    label: 'Site Visits',
    actions: [
      { key: make('site_visits', 'read'), label: 'View' },
      { key: make('site_visits', 'create'), label: 'Create' },
      { key: make('site_visits', 'update'), label: 'Edit' },
      { key: make('site_visits', 'delete'), label: 'Delete' },
      { key: make('site_visits', 'approve'), label: 'Approval' },
    ],
  },
  {
    id: 'materials',
    label: 'Materials',
    actions: [
      { key: make('materials', 'read'), label: 'View' },
      { key: make('materials', 'create'), label: 'Create' },
      { key: make('materials', 'update'), label: 'Edit' },
      { key: make('materials', 'delete'), label: 'Delete' },
    ],
  },
  {
    id: 'material_intents',
    label: 'Material Intents',
    actions: [
      { key: make('material_intents', 'read'), label: 'View' },
      { key: make('material_intents', 'create'), label: 'Create' },
      { key: make('material_intents', 'update'), label: 'Edit' },
      { key: make('material_intents', 'delete'), label: 'Delete' },
      { key: make('material_intents', 'assign'), label: 'Assign Stock' },
      { key: make('material_intents', 'create_dc'), label: 'Create DC' },
    ],
  },
  {
    id: 'material_usage',
    label: 'Material Usage',
    actions: [
      { key: make('material_usage', 'read'), label: 'View' },
      { key: make('material_usage', 'create'), label: 'Log Usage' },
      { key: make('material_usage', 'update'), label: 'Edit Usage' },
      { key: make('material_usage', 'delete'), label: 'Delete Usage' },
    ],
  },
  {
    id: 'advances_expenses',
    label: 'Advances & Expenses',
    actions: [
      { key: make('advances_expenses', 'read'), label: 'View' },
      { key: make('advances_expenses', 'create'), label: 'Create' },
      { key: make('advances_expenses', 'update'), label: 'Edit' },
      { key: make('advances_expenses', 'delete'), label: 'Delete' },
      { key: make('advances_expenses', 'approve'), label: 'Approve' },
    ],
  },
  {
    id: 'quick_lookup',
    label: 'Quick Lookup',
    actions: [
      { key: make('quick_lookup', 'read'), label: 'Access' },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    actions: [
      { key: make('projects', 'read'), label: 'View' },
      { key: make('projects', 'create'), label: 'Create' },
      { key: make('projects', 'update'), label: 'Edit' },
      { key: make('projects', 'delete'), label: 'Delete' },
      { key: make('projects', 'close'), label: 'Close Project' },
      { key: make('projects', 'archive'), label: 'Archive' },
      { key: make('projects', 'manage_scope'), label: 'Manage Scope' },
    ],
  },
  {
    id: 'estimation.boq',
    label: 'Estimation - BOQ',
    actions: [
      { key: 'estimation.boq.read', label: 'View' },
      { key: 'estimation.boq.create', label: 'Create' },
      { key: 'estimation.boq.update', label: 'Edit' },
      { key: 'estimation.boq.delete', label: 'Delete' },
    ],
  },
  {
    id: 'estimation.tender',
    label: 'Estimation - Tenders',
    actions: [
      { key: 'estimation.tender.read', label: 'View' },
      { key: 'estimation.tender.create', label: 'Create' },
      { key: 'estimation.tender.update', label: 'Edit' },
      { key: 'estimation.tender.delete', label: 'Delete' },
    ],
  },
  {
    id: 'estimation.resources',
    label: 'Estimation - Resource Catalog',
    actions: [
      { key: 'estimation.resources.read', label: 'View' },
      { key: 'estimation.resources.create', label: 'Create' },
      { key: 'estimation.resources.update', label: 'Edit' },
    ],
  },
  {
    id: 'partners',
    label: 'Partner Allocation - Partners',
    actions: [
      { key: make('partners', 'read'), label: 'View' },
      { key: make('partners', 'create'), label: 'Create' },
      { key: make('partners', 'update'), label: 'Edit' },
      { key: make('partners', 'delete'), label: 'Delete' },
    ],
  },
  {
    id: 'allocations',
    label: 'Partner Allocation - Allocations',
    actions: [
      { key: make('allocations', 'read'), label: 'View' },
      { key: make('allocations', 'create'), label: 'Assign' },
      { key: make('allocations', 'update'), label: 'Update Status' },
      { key: make('allocations', 'verify'), label: 'Verify' },
    ],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    actions: [
      { key: make('manufacturing', 'clear_activity_log'), label: 'Clear Activity Log' },
    ],
  },
  {
    id: 'org',
    label: 'Organisation',
    actions: [
      { key: 'org.manage_users', label: 'User Management' },
      { key: 'org.manage_roles', label: 'Role Management' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => a.key));

