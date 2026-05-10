import { z } from 'zod';
import { proformaStatuses, proformaSourceTypes } from './types';

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const CurrencySchema = z.coerce
  .number({
    invalid_type_error: 'Expected a numeric value.',
  })
  .finite('Expected a valid number.')
  .min(0, 'Value cannot be negative.')
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
  z.union([JsonLiteralSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)])
);

export const ProformaItemMetaSchema = z
  .object({
    tax_percent: PercentSchema.optional(),
    source_item_id: z.string().optional(),
    uom: z.string().optional(),
    base_rate: z.number().optional(),
    rate_after_discount: z.number().optional(),
  })
  .catchall(JsonValueSchema);

export const ProformaItemSchema = z
  .object({
    id: z.string().optional(),
    proforma_id: z.string().optional(),
    item_id: z.string().optional().nullable(),
    variant_id: z.string().optional().nullable(),
    description: z.string(),
    hsn_code: z.string().optional().nullable(),
    qty: z.number().default(1),
    rate: z.number().default(0),
    amount: z.number().default(0),
    discount_percent: z.number().default(0),
    discount_amount: z.number().default(0),
    tax_percent: z.number().default(18),
    make: z.string().optional().nullable(),
    variant: z.string().optional().nullable(),
    unit: z.string().optional().nullable(),
    meta_json: z.record(z.any()).default({}),
    sort_order: z.number().optional(),
  });

export const ProformaSchema = z
  .object({
    id: z.string().optional(),
    pi_number: z.string().optional().nullable(),
    client_id: z.string().min(1, 'Client is required.'),
    status: z.enum(proformaStatuses).default('draft'),
    subtotal: z.number().default(0),
    discount_amount: z.number().default(0),
    discount_percent: z.number().default(0),
    cgst: z.number().default(0),
    sgst: z.number().default(0),
    igst: z.number().default(0),
    total: z.number().default(0),
    company_state: z.string().optional().nullable(),
    client_state: z.string().optional().nullable(),
    valid_until: z.string().optional().nullable(),
    accepted_at: z.string().optional().nullable(),
    source_type: z.enum(proformaSourceTypes).default('manual'),
    source_id: z.string().optional().nullable(),
    converted_invoice_id: z.string().optional().nullable(),
    po_number: z.string().optional().nullable(),
    po_date: z.string().optional().nullable(),
    template_id: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    payment_terms: z.string().optional().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    items: z.array(z.object({
      id: z.string().optional(),
      proforma_id: z.string().optional(),
      item_id: z.string().optional().nullable(),
      variant_id: z.string().optional().nullable(),
      description: z.string(),
      hsn_code: z.string().optional().nullable(),
      qty: z.number().default(1),
      rate: z.number().default(0),
      amount: z.number().default(0),
      discount_percent: z.number().default(0),
      discount_amount: z.number().default(0),
      tax_percent: z.number().default(18),
      make: z.string().optional().nullable(),
      variant: z.string().optional().nullable(),
      unit: z.string().optional().nullable(),
      meta_json: z.record(z.any()).default({}),
      sort_order: z.number().optional(),
    })).default([]),
  });

export type ProformaItem = z.infer<typeof ProformaItemSchema>;
export type Proforma = z.infer<typeof ProformaSchema>;
export type ProformaItemInput = z.input<typeof ProformaItemSchema>;
export type ProformaInput = z.input<typeof ProformaSchema>;