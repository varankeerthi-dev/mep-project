import { z } from 'zod';

const uuid = z.string().uuid();
const numeric = z.coerce.number();
const optionalNumeric = z.coerce.number().optional().nullable();

export const partnerTypeEnum = z.enum(['subcontractor', 'individual', 'internal_team', 'franchisee']);
export type PartnerType = z.infer<typeof partnerTypeEnum>;

export const allocationStatusEnum = z.enum(['Pending', 'Accepted', 'Rejected', 'In Progress', 'Completed', 'Verified', 'Reassigned']);
export type AllocationStatus = z.infer<typeof allocationStatusEnum>;

export const commissionTypeEnum = z.enum(['fixed', 'percentage']).optional().nullable();
export type CommissionType = z.infer<typeof commissionTypeEnum>;

export const partnerSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  partner_type: partnerTypeEnum.default('individual'),
  business_name: z.string().min(1, 'Business name is required'),
  contact_person: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  subcontractor_id: uuid.optional().nullable(),
  categories: z.array(z.string()).default([]),
  service_areas: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  max_active_jobs: z.number().int().default(0),
  created_by: uuid.optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type PartnerInput = z.input<typeof partnerSchema>;
export type Partner = z.output<typeof partnerSchema>;

export const leadAllocationSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  lead_id: uuid,
  partner_id: uuid,
  status: allocationStatusEnum.default('Pending'),
  assigned_at: z.string().optional(),
  responded_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  dispatcher_notes: z.string().optional().nullable(),
  partner_notes: z.string().optional().nullable(),
  commission_type: commissionTypeEnum,
  commission_value: optionalNumeric,
  estimated_value: numeric.default(0),
  created_by: uuid.optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type LeadAllocationInput = z.input<typeof leadAllocationSchema>;
export type LeadAllocation = z.output<typeof leadAllocationSchema>;
