import { z } from 'zod';

export const WarehouseSchema = z.object({
  warehouse_code: z.string().optional(),
  warehouse_name: z.string().min(1, 'Warehouse name is required'),
  location: z.string().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});
