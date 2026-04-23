/**
 * Column config for invoice list grids (aligned with Invoice / InvoiceWithRelations).
 * Dynamic string columns use empty checkbox options — fill with `distinctOptions(rows, key)` at runtime.
 */
import { createTableSchema, col, checkboxOptions } from '@/lib/table-schema';
import type { InvoiceWithRelations } from './api';
import { invoiceSourceTypes, invoiceStatuses } from './types';
import { getInvoiceDisplayNumber } from './ui-utils';

export function invoiceToListRow(invoice: InvoiceWithRelations): Record<string, unknown> {
  const taxAmount = invoice.cgst + invoice.sgst + invoice.igst;
  return {
    invoiceNumber: getInvoiceDisplayNumber(invoice),
    customerName: invoice.client?.name ?? 'Unknown',
    issueDate: invoice.created_at ?? null,
    dueDate: null,
    subtotal: invoice.subtotal,
    taxAmount,
    totalAmount: invoice.total,
    status: invoice.status,
    sourceType: invoice.source_type,
    primaryDescription: invoice.items[0]?.description?.trim() || '—',
  };
}

export const invoiceListTableSchema = createTableSchema({
  invoiceNumber: col
    .string()
    .label('Invoice No')
    .display('code')
    .filterable('checkbox', { options: [] })
    .size(130)
    .sheet(),

  customerName: col
    .string()
    .label('Client Name')
    .display('badge')
    .filterable('checkbox', { options: [] })
    .size(160)
    .sheet(),

  issueDate: col.presets
    .timestamp()
    .label('Issue Date')
    .sortable()
    .commandDisabled()
    .size(220)
    .sheet(),

  /** Not on invoice row yet — hidden until API provides due_at / due_date. */
  dueDate: col.presets
    .timestamp()
    .label('Due Date')
    .hidden()
    .commandDisabled()
    .size(220)
    .sheet(),

  subtotal: col.presets
    .duration(undefined, { min: 0, max: 1_000_000_000 })
    .label('Subtotal')
    .display('number')
    .sortable()
    .size(120)
    .sheet(),

  taxAmount: col
    .number({ min: 0, max: 1_000_000_000 })
    .label('Tax Amount')
    .sortable()
    .size(120)
    .sheet(),

  totalAmount: col.presets
    .duration(undefined, { min: 0, max: 1_000_000_000 })
    .label('Total')
    .display('number')
    .sortable()
    .size(120)
    .sheet(),

  status: col
    .enum(invoiceStatuses)
    .label('Status')
    .display('badge', { colorMap: { draft: '#64748b', final: '#059669' } })
    .filterable('checkbox', { options: checkboxOptions(invoiceStatuses) })
    .size(130)
    .sheet(),

  /** Maps to `source_type` in the domain model (quotation | challan | po). */
  sourceType: col
    .enum(invoiceSourceTypes)
    .label('Source')
    .display('badge')
    .filterable('checkbox', { options: checkboxOptions(invoiceSourceTypes) })
    .size(130)
    .sheet(),

  /** First line item description or summary — options from `distinctOptions`. */
  primaryDescription: col
    .string()
    .label('Description')
    .display('badge')
    .filterable('checkbox', { options: [] })
    .size(200)
    .sheet(),
});

export type InvoiceListRowView = {
  invoiceNumber: string;
  customerName: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: (typeof invoiceStatuses)[number];
  sourceType: (typeof invoiceSourceTypes)[number];
  primaryDescription: string;
};
