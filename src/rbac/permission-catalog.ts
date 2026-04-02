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
    id: 'org',
    label: 'Organisation',
    actions: [
      { key: 'org.manage_users', label: 'User Management' },
      { key: 'org.manage_roles', label: 'Role Management' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => a.key));

