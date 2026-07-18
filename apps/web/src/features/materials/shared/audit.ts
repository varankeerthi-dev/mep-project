import { ITEM_AUDIT_STORAGE_KEY } from './constants';

export const getLocalAuditTrail = () => {
  try {
    const raw = localStorage.getItem(ITEM_AUDIT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveLocalAuditTrail = (entries: any[]) => {
  try {
    localStorage.setItem(ITEM_AUDIT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage errors; detail tab still loads DB records if available.
  }
};

export const appendLocalAuditEntry = (entry: any) => {
  const existing = getLocalAuditTrail();
  const next = [entry, ...existing].slice(0, 400);
  saveLocalAuditTrail(next);
};

export const normalizeAuditChanges = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => `${key}: ${val}`);
  }
  return [];
};

export const formatAuditValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export const buildItemChangeLog = (before: any, after: any): string[] => {
  const keys = [
    ['name', 'Item Name'],
    ['display_name', 'Display Name'],
    ['item_code', 'Item Code / SKU'],
    ['main_category', 'Main Category'],
    ['sub_category', 'Sub Category'],
    ['size', 'Size'],
    ['pressure_class', 'Pressure Class'],
    ['make', 'MAKE(Brand name)'],
    ['material', 'Material'],
    ['end_connection', 'End Connection'],
    ['unit', 'Unit'],
    ['purchase_price', 'Purchase Price'],
    ['sale_price', 'Sale Price'],
    ['hsn_code', 'HSN/SAC'],
    ['gst_rate', 'GST Rate'],
    ['is_active', 'Active'],
    ['uses_variant', 'Uses Discount Category'],
  ];

  return keys
    .map(([key, label]) => {
      const oldVal = before?.[key];
      const newVal = after?.[key];
      if (String(oldVal ?? '') === String(newVal ?? '')) return null;
      return `${label}: ${formatAuditValue(oldVal)} -> ${formatAuditValue(newVal)}`;
    })
    .filter(Boolean) as string[];
};

export const isMissingRelationError = (error: any) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /does not exist/i.test(message) || /schema cache/i.test(message);
};
