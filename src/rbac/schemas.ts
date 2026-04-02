import { z } from 'zod';

export const orgAccessRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrgAccessRequestStatus = z.infer<typeof orgAccessRequestStatusSchema>;

export const employeeStatusSchema = z.enum(['active', 'inactive']);
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;

export const permissionKeySchema = z
  .string()
  .min(1)
  .regex(/^[a-z_]+\.(read|create|update|delete|approve|manage_users|manage_roles)$/);
export type PermissionKey = z.infer<typeof permissionKeySchema>;

export const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  organisation_id: z.string().uuid(),
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional().nullable(),
  status: employeeStatusSchema.default('active'),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const roleSchema = z.object({
  id: z.string().uuid().optional(),
  organisation_id: z.string().uuid(),
  name: z.string().min(2),
  is_system: z.boolean().optional(),
});
export type RoleInput = z.infer<typeof roleSchema>;

export const rolePermissionSchema = z.object({
  role_id: z.string().uuid(),
  permission_key: permissionKeySchema,
});
export type RolePermissionInput = z.infer<typeof rolePermissionSchema>;

export const orgAccessRequestSchema = z.object({
  id: z.string().uuid().optional(),
  organisation_id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),
  status: orgAccessRequestStatusSchema.default('pending'),
  review_note: z.string().optional().nullable(),
});
export type OrgAccessRequestInput = z.infer<typeof orgAccessRequestSchema>;

