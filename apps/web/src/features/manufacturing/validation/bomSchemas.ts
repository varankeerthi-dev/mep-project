import { z } from 'zod';

const BOMHeaderSchema = z.object({
  id: z.string().uuid().optional(),
  bom_code: z.string(),
  product_name: z.string(),
  product_id: z.string().uuid().nullable().optional(),
  output_qty: z.number().positive(),
  output_unit: z.string(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  batch_no: z.string().optional(),
  approval_status: z.string().default('draft'),
  organisation_id: z.string().uuid(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  custom_attributes: z.record(z.string(), z.any()).default({}),
  total_estimated_cost: z.number().nonnegative().default(0).optional(),
  estimated_production_minutes: z.number().int().nonnegative().default(0).optional(),
  revision: z.string().optional(),
  effective_date: z.string().optional(),
  valid_to: z.string().optional(),
  product_code: z.string().optional(),
  bom_type: z.enum(['assembly', 'repetitive', 'formula']).default('assembly').optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  product_category: z.enum(['standard', 'custom', 'prototype']).optional(),
  created_by_name: z.string().optional(),
  approved_by_name: z.string().optional(),
});

const BOMItemSchema = z.object({
  id: z.string().uuid().optional(),
  bom_id: z.string().uuid().optional(),
  material_id: z.string().uuid(),
  material_name: z.string().optional(),
  required_qty: z.number().positive(),
  unit: z.string(),
  wastage_pct: z.number().min(0).max(100).default(5),
  notes: z.string().optional(),
  company_variant_id: z.string().uuid().nullable().optional(),
  variant_name: z.string().optional(),
  make: z.string().optional(),
  lead_time_days: z.number().int().nonnegative().default(0),
  bom_level: z.number().int().nonnegative().default(0).optional(),
  parent_material_id: z.string().uuid().nullable().optional(),
  custom_attributes: z.record(z.string(), z.any()).default({}),
  unit_cost: z.number().nonnegative().default(0).optional(),
  sequence_no: z.number().int().nonnegative().default(0).optional(),
  work_center_id: z.string().uuid().nullable().optional(),
  is_critical: z.boolean().default(false).optional(),
  alternate_material_id: z.string().uuid().nullable().optional(),
  drawing_reference: z.string().optional(),
  inspection_required: z.boolean().default(false).optional(),
  shelf_life_days: z.number().int().positive().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  scrap_factor: z.number().min(0).max(100).optional(),
  yield_pct: z.number().min(0).max(100).optional(),
});

export const SaveBOMPayloadSchema = z.object({
  header: BOMHeaderSchema.partial(),
  items: z.array(BOMItemSchema),
});

export type BOMHeader = z.infer<typeof BOMHeaderSchema>;
export type BOMItem = z.infer<typeof BOMItemSchema>;
export type SaveBOMPayload = z.infer<typeof SaveBOMPayloadSchema>;
