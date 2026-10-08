import { z } from 'zod';
import {
  invoiceModes,
  invoiceSourceTypes,
  invoiceStatuses,
  invoiceTemplateTypes,
} from './types';

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const CurrencySchema = z.coerce
  .number({
    invalid_type_error: 'Expected a numeric value.',
  })
  .finite('Expected a valid number.')
  .min(0, 'Value cannot be negative.')
  .transform(roundCurrency);

// Round-off is the one monetary field that is legitimately signed: rounding a
// total down produces a negative adjustment. CurrencySchema's min(0) would
// reject every downward adjustment.
const SignedCurrencySchema = z.coerce
  .number({
    invalid_type_error: 'Expected a numeric value.',
  })
  .finite('Expected a valid number.')
  .transform(roundCurrency);

const PositiveQuantitySchema = z.coerce
  .number({
    invalid_type_error: 'Expected a numeric quantity.',
  })
  .finite('Expected a valid number.')
  .positive('Quantity must be greater than zero.')
  .transform(roundCurrency);

const PercentSchema = z.coerce
  .number({
    invalid_type_error: 'Expected a valid percentage.',
  })
  .finite('Expected a valid number.')
  .min(0, 'Percentage cannot be negative.')
  .max(100, 'Percentage cannot exceed 100.')
  .transform(roundCurrency);

const JsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type JsonLiteral = z.infer<typeof JsonLiteralSchema>;
type JsonValue = JsonLiteral | JsonValue[] | { [key: string]: JsonValue };
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonLiteralSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)]),
);

// Persistence writers (PO/quotation/proforma line import) store `null` for
// unlinked uuids — coerce to `undefined` so `.uuid().optional()` validates.
const nullToUndefined = (val: unknown) => (val === null ? undefined : val);

/**
 * Line-item lineage. These keys are written by the PO/quotation/proforma
 * import mappers and consumed by partial-billing and PO billed-quantity logic.
 * Declared explicitly (in addition to the catchall) so the intent is visible
 * and the values stay typed.
 */
const InvoiceItemLineageSchema = {
  po_line_item_id: z.string().nullish(),
  quotation_item_id: z.string().nullish(),
  proforma_item_id: z.string().nullish(),
  challan_item_id: z.string().nullish(),
  source_item_id: z.string().nullish(),
} as const;

const InvoiceItemMetaSchema = z
  .object({
    ...InvoiceItemLineageSchema,
    tax_percent: PercentSchema.optional(),
    client_custom_label: z.string().min(1).optional(),
    client_custom_value: JsonValueSchema.optional(),
    make: z.string().optional(),
    variant: z.string().optional(),
    uom: z.string().optional(),
    base_rate: CurrencySchema.optional(),
    discount_percent: PercentSchema.optional(),
    material_id: z.preprocess(nullToUndefined, z.string().uuid().optional()),
    warehouse_id: z.preprocess(nullToUndefined, z.string().uuid().optional()),
    variant_id: z.preprocess(nullToUndefined, z.string().uuid().optional()),
    is_service: z.boolean().optional(),
    batch_no: z.string().optional(),
    expiry_date: z.string().optional(),
    serial_numbers: z.array(z.string()).optional(),
  })
  .catchall(JsonValueSchema);

export const InvoiceItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    description: z.string().trim().min(1, 'Description is required.'),
    hsn_code: z.string().trim().min(1).nullable().optional(),
    qty: CurrencySchema,
    rate: CurrencySchema,
    amount: CurrencySchema,
    is_header: z.boolean().optional(),
    is_subtotal: z.boolean().optional(),
    subtotal_label: z.string().trim().min(1).nullable().optional(),
    display_order: z.coerce.number().int().optional(),
    custom1: z.string().trim().nullable().optional(),
    custom2: z.string().trim().nullable().optional(),
    meta_json: InvoiceItemMetaSchema.default({}),
  })
  .superRefine((item, ctx) => {
    const isStructural = item.is_header || item.is_subtotal;
    if (!isStructural && item.qty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qty'],
        message: 'Quantity must be greater than zero.',
      });
    }
    if (isStructural) return;
    const computed = roundCurrency(item.qty * item.rate);
    if (Math.abs(item.amount - computed) > 0.05) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: `Amount must match qty x rate (${computed.toFixed(2)}).`,
      });
    }
  });

export const InvoiceMaterialSchema = z
  .object({
    id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    product_id: z.string().uuid('Valid product id is required.'),
    qty_used: PositiveQuantitySchema,
    warehouse_id: z.preprocess(nullToUndefined, z.string().uuid().nullable().optional()),
    variant_id: z.preprocess(nullToUndefined, z.string().uuid().nullable().optional()),
  });

export const InvoiceSchema = z
  .object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid('Valid client id is required.'),
    organisation_id: z.string().uuid().optional().nullable(),
    template_id: z.string().uuid('Valid template id is required.').optional().nullable(),
    invoice_no: z.string().optional().nullable(),
    invoice_date: z.string().optional().nullable(),
    due_date: z.string().optional().nullable(),
    po_number: z.string().optional().nullable(),
    po_date: z.string().optional().nullable(),
    source_type: z.enum(invoiceSourceTypes),
    source_id: z.string().uuid('Valid source id is required.').optional().nullable(),
    proforma_id: z.string().uuid().optional().nullable(),
    template_type: z.enum(invoiceTemplateTypes),
    mode: z.enum(invoiceModes),
    subtotal: CurrencySchema,
    cgst: CurrencySchema,
    sgst: CurrencySchema,
    igst: CurrencySchema,
    round_off: SignedCurrencySchema.default(0),
    total: CurrencySchema,
    paid_amount: CurrencySchema.default(0),
    status: z.enum(invoiceStatuses).default('draft'),
    prepared_by: z.string().optional().nullable(),
    remarks: z.string().trim().nullable().optional(),
    authorized_signatory_id: z.string().uuid().nullable().optional(),
    submitted_date: z.string().optional().nullable(),
    submitted_by: z.string().optional().nullable(),
    submitted_file_url: z.string().url().optional().nullable(),
    created_at: z.string().datetime({ offset: true }).optional(),
    company_state: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().trim().min(1).optional().nullable()
    ),
    client_state: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().trim().min(1).optional().nullable()
    ),
    shipping_address_id: z.string().uuid().optional().nullable(),
    deduct_stock_on_finalize: z.boolean().default(false),
    allow_insufficient_stock: z.boolean().default(false),
    items: z.array(InvoiceItemSchema).min(1, 'At least one invoice item is required.').default([]),
    materials: z.array(InvoiceMaterialSchema).default([]),
  })
  .superRefine((invoice, ctx) => {
    const taxTotal = roundCurrency(invoice.cgst + invoice.sgst + invoice.igst);
    const roundOff = invoice.round_off ?? 0;
    const expectedTotal = roundCurrency(invoice.subtotal + taxTotal + roundOff);

    // Round-off is now persisted, so the identity is exact rather than
    // approximate. The 0.05 tolerance only absorbs float noise.
    if (Math.abs(invoice.total - expectedTotal) > 0.05) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['total'],
        message: 'Total must equal subtotal plus GST plus round off.',
      });
    }

    if (invoice.igst > 0 && (invoice.cgst > 0 || invoice.sgst > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['igst'],
        message: 'Use IGST alone for interstate invoices.',
      });
    }

    if (invoice.igst === 0 && invoice.cgst !== invoice.sgst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sgst'],
        message: 'CGST and SGST must be equal for intrastate invoices.',
      });
    }

    if (invoice.mode === 'lot' && invoice.items.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Lot invoices must contain exactly one invoice item.',
      });
    }

    if (invoice.mode !== 'lot' && invoice.materials.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['materials'],
        message: 'Invoice materials are only supported in lot mode.',
      });
    }

    if (invoice.template_type === 'lot' && invoice.mode !== 'lot') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['template_type'],
        message: 'Lot templates must use lot mode.',
      });
    }

    if (invoice.company_state && invoice.client_state) {
      const companyState = invoice.company_state.trim().toLowerCase();
      const clientState = invoice.client_state.trim().toLowerCase();
      const sameState = companyState === clientState;

      if (sameState && invoice.igst > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['igst'],
          message: 'Use CGST and SGST when client state matches company state.',
        });
      }

      if (!sameState && (invoice.cgst > 0 || invoice.sgst > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cgst'],
          message: 'Use IGST only for interstate invoices.',
        });
      }
    }
  });

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type InvoiceMaterial = z.infer<typeof InvoiceMaterialSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceItemInput = z.input<typeof InvoiceItemSchema>;
export type InvoiceMaterialInput = z.input<typeof InvoiceMaterialSchema>;
export type InvoiceInput = z.input<typeof InvoiceSchema>;
