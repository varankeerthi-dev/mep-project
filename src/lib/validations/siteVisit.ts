import { z } from 'zod';

export const siteVisitStatusEnum = z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']);
export const visitTypeEnum = z.enum(['Survey', 'Installation', 'Maintenance', 'Inspection', 'Repair', 'Handover', 'Consultation', 'Other']);
export const priorityEnum = z.enum(['Standard', 'Urgent', 'Emergency']);

export const siteVisitScheduleSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  visit_date: z.string().min(1, 'Visit date is required'),
  purpose_of_visit: z.string().optional().default(''),
  engineer: z.string().optional().default(''),
  visited_by: z.string().optional().default(''),
  visit_time: z.string().optional().default(''),
  site_address: z.string().optional().default(''),
  location_url: z.string().optional().default(''),
  status: siteVisitStatusEnum.default('scheduled'),
  follow_up_date: z.string().optional().default(''),
  postponed_reason: z.string().optional().default(''),
  is_client_meeting: z.boolean().optional().default(false),
  project_id: z.string().optional().default(''),

  // New schedule fields
  po_wo_contract: z.string().optional().default(''),
  project_manager_id: z.string().optional().default(''),
  site_contact_person: z.string().optional().default(''),
  site_contact_phone: z.string().optional().default(''),
  site_contact_designation: z.string().optional().default(''),
  visit_type: visitTypeEnum.optional().default('Survey'),
  priority: priorityEnum.optional().default('Standard'),
  ppe_requirements: z.string().optional().default(''),
  is_chargeable: z.boolean().optional().default(false),
  access_restrictions: z.string().optional().default(''),
});

export const siteVisitUpdateSchema = z.object({
  out_time: z.string().optional().default(''),
  discussion_points: z.string().optional().default(''),
  measurements: z.string().optional().default(''),
  next_step: z.string().optional().default(''),

  // New update fields
  attendees: z.array(z.object({
    name: z.string(),
    role: z.string().optional().default(''),
  })).optional().default([]),
  equipment_used: z.string().optional().default(''),
  travel_time_minutes: z.number().int().positive().optional().nullable(),
  total_man_hours: z.number().positive().optional().nullable(),
  weather_conditions: z.string().optional().default(''),
  safety_hazards: z.string().optional().default(''),
  issues_found: z.array(z.object({
    description: z.string(),
    severity: z.enum(['Critical', 'Major', 'Minor']),
  })).optional().default([]),
  recommendations: z.string().optional().default(''),
  travel_expense: z.number().nonnegative().optional().nullable(),
  accommodation_expense: z.number().nonnegative().optional().nullable(),
  misc_expense: z.number().nonnegative().optional().nullable(),
});

export type SiteVisitScheduleData = z.infer<typeof siteVisitScheduleSchema>;
export type SiteVisitUpdateData = z.infer<typeof siteVisitUpdateSchema>;
