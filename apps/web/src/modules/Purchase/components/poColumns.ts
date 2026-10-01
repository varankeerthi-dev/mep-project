/**
 * Line-item column visibility for the V2 purchase order.
 *
 * Mirrors CreateQuotation's `document_templates.column_settings` contract
 * (pages/CreateQuotation/index.tsx:830-855, 1083-1110):
 *
 *   mandatory — always rendered, cannot be hidden
 *   optional  — a name -> boolean map; true or unset means visible
 *   labels    — per-column header override
 *
 * The template is read from `document_templates` for document_type
 * 'Purchase Order'. When no template exists the defaults below apply, which is
 * exactly what CreateQuotation does when its template query returns nothing.
 *
 * The toggle UI lives in the toolbar above the line items so the user can hide
 * columns they do not use; a hidden column is not rendered at all, so the table
 * does not grow a horizontal scrollbar for fields nobody reads.
 */

export type PoColumnKey =
  | 'item_code'
  | 'description'
  | 'hsn_code'
  | 'make'
  | 'variant'
  | 'qty'
  | 'uom'
  | 'rate'
  | 'discount_percent'
  | 'discount_category'
  | 'rate_after_discount'
  | 'tax_percent'
  | 'line_total';

export interface PoColumnSettings {
  mandatory: string[];
  optional: Record<string, boolean>;
  labels: Record<string, string>;
}

export const PO_MANDATORY_COLUMNS: PoColumnKey[] = ['sno', 'item', 'qty', 'uom'];

/** Default when no Purchase Order template is configured. */
export const PO_DEFAULT_COLUMN_SETTINGS: PoColumnSettings = {
  mandatory: PO_MANDATORY_COLUMNS as unknown as string[],
  optional: {
    item_code: true,
    description: true,
    hsn_code: true,
    make: true,
    variant: true,
    rate: true,
    discount_percent: true,
    discount_category: true,
    rate_after_discount: true,
    tax_percent: true,
    line_total: true,
  },
  labels: {
    discount_category: 'Category',
    rate_after_discount: 'Rate/Unit',
  },
};

export const PO_COLUMN_LABELS: Record<PoColumnKey, string> = {
  item_code: 'Item Code',
  description: 'Description',
  hsn_code: 'HSN',
  make: 'Make',
  variant: 'Variant',
  qty: 'Qty',
  uom: 'Unit',
  rate: 'Rate',
  discount_percent: 'Disc%',
  discount_category: 'Category',
  rate_after_discount: 'Rate/Unit',
  tax_percent: 'GST%',
  line_total: 'Amount',
};

/** Is a column currently visible? Unset optional keys default to visible. */
export function isColumnVisible(settings: PoColumnSettings, key: PoColumnKey): boolean {
  if (PO_MANDATORY_COLUMNS.includes(key)) return true;
  if (settings.mandatory?.includes(key)) return true;
  return settings.optional?.[key] !== false;
}

/** Human header text, honouring a template label override. */
export function columnLabel(settings: PoColumnSettings, key: PoColumnKey): string {
  return settings.labels?.[key] || PO_COLUMN_LABELS[key] || key;
}

/** The optional columns a user is allowed to toggle, in display order. */
export const PO_TOGGLEABLE_COLUMNS: PoColumnKey[] = [
  'item_code',
  'description',
  'hsn_code',
  'make',
  'variant',
  'discount_category',
  'discount_percent',
  'rate_after_discount',
  'tax_percent',
  'line_total',
];

/**
 * Merge a template's column_settings over the defaults. A template that omits a
 * key must not hide that column, so absence resolves to the default rather than
 * to undefined.
 */
export function mergeColumnSettings(raw: any): PoColumnSettings {
  if (!raw || typeof raw !== 'object') return PO_DEFAULT_COLUMN_SETTINGS;
  return {
    mandatory: Array.isArray(raw.mandatory) ? raw.mandatory : PO_DEFAULT_COLUMN_SETTINGS.mandatory,
    optional: { ...PO_DEFAULT_COLUMN_SETTINGS.optional, ...(raw.optional || {}) },
    labels: { ...PO_DEFAULT_COLUMN_SETTINGS.labels, ...(raw.labels || {}) },
  };
}
