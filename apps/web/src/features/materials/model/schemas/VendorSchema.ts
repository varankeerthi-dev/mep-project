import { z } from 'zod';

export const VendorMappingSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  variant_id: z.string().nullable().optional(),
  make: z.string().optional(),
  base_rate: z.number().min(0, 'Base rate must be positive'),
  discount_percent: z.number().min(0).max(100),
  is_preferred: z.boolean().optional(),
});
