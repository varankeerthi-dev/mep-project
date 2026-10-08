import { z } from 'zod';

// Allows empty (field is optional), otherwise requires a 10-digit phone number
export const siteVisitPhoneSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true; // empty is allowed - phone is optional
      const digits = val.replace(/\D/g, '');
      const localDigits = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
      return localDigits.length === 10;
    },
    { message: 'Phone number must be a 10-digit number' }
  );

// Input mask: strips characters that cannot belong to a phone number as the user
// types, so invalid text never enters the field. Rejects digits beyond 10 (or 12 if with +91).
export const sanitizePhoneInput = (raw: string): string | null => {
  let v = raw.replace(/[^\d\s()+-]/g, ''); // only digits, spaces, + ( ), -
  const hasLeadingPlus = v.startsWith('+');
  v = v.replace(/\+/g, '');
  if (hasLeadingPlus) v = '+' + v; // '+' is only allowed once, at the start
  const digits = v.replace(/\D/g, '');
  const maxAllowed = hasLeadingPlus || digits.startsWith('91') ? 12 : 10;
  if (digits.length > maxAllowed) return null; // reject keystroke/paste beyond length
  return v;
};

export const VISIT_STATUSES = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const siteVisitStatusEnum = z.enum(VISIT_STATUSES);
export const priorityEnum = z.enum(['Standard', 'Urgent', 'Emergency']);

export const siteVisitScheduleSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  visit_date: z.string()
    .min(1, 'Visit date is required')
    .refine((val) => {
      if (!val) return false;
      const selected = new Date(val);
      selected.setHours(0, 0, 0, 0);
      const minAllowed = new Date();
      minAllowed.setDate(minAllowed.getDate() - 7);
      minAllowed.setHours(0, 0, 0, 0);
      return selected >= minAllowed;
    }, { message: 'Visit date cannot be more than 7 days in the past' }),
  engineer: z.string().optional().nullable().default(''),
  employee_id: z
    .string()
    .uuid()
    .or(z.literal(''))
    .optional()
    .nullable()
    .default(''),
  visited_by: z.string().optional().nullable().default(''),
  visit_time: z.string().optional().nullable().default(''),
  site_address: z.string().optional().nullable().default(''),
  location_url: z.string().optional().nullable().default(''),
  status: siteVisitStatusEnum.default('scheduled'),
  follow_up_date: z.string().optional().nullable().default(''),
  postponed_reason: z.string().optional().nullable().default(''),
  is_client_meeting: z.boolean().optional().nullable().default(false),
  project_id: z.string().optional().nullable().default(''),

  // New schedule fields
  po_wo_contract: z.string().optional().nullable().default(''),
  project_manager_id: z.string().optional().nullable().default(''),
  site_contact_person: z.string().optional().nullable().default(''),
  site_contact_phone: siteVisitPhoneSchema.optional().nullable().default(''),
  site_contact_designation: z.string().optional().nullable().default(''),
  site_contacts: z.array(z.object({
    id: z.string().optional(),
    name: z.string().optional().nullable().default(''),
    phone: siteVisitPhoneSchema.optional().nullable().default(''),
    designation: z.string().optional().nullable().default(''),
  })).optional().nullable().default([]),
  instructions_to_site_persons: z.string().optional().nullable().default(''),
  checklist_items: z.array(z.object({
    id: z.string().optional(),
    text: z.string(),
    completed: z.boolean().optional().default(false),
    status: z.string().optional().nullable(),
    observation: z.string().optional().nullable(),
    checked_at: z.string().optional().nullable(),
    checked_by: z.string().optional().nullable(),
  })).optional().nullable().default([]),
  visit_type: z.string().optional().nullable().default('Survey'),
  priority: priorityEnum.optional().nullable().default('Standard'),
  ppe_requirements: z.string().optional().nullable().default(''),
  is_chargeable: z.boolean().optional().nullable().default(false),
  access_restrictions: z.string().optional().nullable().default(''),
});

export type SiteVisitScheduleData = z.infer<typeof siteVisitScheduleSchema>;

// Stoppage intent recorded at checkout (mirrors src/types/siteReportStoppage.ts unions)
export const siteVisitIntentSchema = z.object({
  description: z.string().trim().min(3, 'Describe what stopped the work'),
  category: z.enum([
    'payment',
    'site_clearance',
    'client_confirmation',
    'site_dependency',
    'material',
    'planned_shutdown',
    'other',
  ]),
  blocking_party: z.enum(['client', 'subcontractor', 'our_team', 'external', 'unknown']),
  impact_hours: z.number().min(0).max(10000),
});
export type SiteVisitIntentData = z.infer<typeof siteVisitIntentSchema>;
