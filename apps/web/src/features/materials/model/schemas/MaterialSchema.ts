import { z } from 'zod';

export const MaterialFormSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  display_name: z.string().optional(),
  item_code: z.string().min(1, 'Item code is required'),
  main_category: z.string().optional(),
  sub_category: z.string().optional(),
  size: z.string().optional(),
  pressure_class: z.string().optional(),
  make: z.string().optional(),
  material: z.string().optional(),
  end_connection: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  sale_price: z.string().optional(),
  purchase_price: z.string().optional(),
  hsn_code: z.string()
    .regex(/^\d{1,10}$/, 'HSN/SAC must be numeric and up to 10 digits')
    .optional()
    .or(z.literal('')),
  gst_rate: z.number().min(0).max(100).optional(),
  is_active: z.boolean(),
  uses_variant: z.boolean(),
  discount_category_id: z.string().nullable().optional(),
  dimension: z.string().optional(),
  weight: z.string().optional(),
  item_classification: z.string().optional(),
  allow_purchase: z.boolean().optional(),
  allow_sales: z.boolean().optional(),
  show_in_bom: z.boolean().optional(),
  is_manufactured: z.boolean().optional(),
});

export type MaterialFormValidation = z.infer<typeof MaterialFormSchema>;

export function validateMaterialForm(data: unknown) {
  return MaterialFormSchema.safeParse(data);
}
