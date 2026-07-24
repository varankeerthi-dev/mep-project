import { z } from 'zod';

const uuid = z.string().uuid();
const numeric = z.coerce.number();
const optionalNumeric = z.coerce.number().optional().nullable();

export const boqHeaderSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  boq_no: z.string().min(1, 'BOQ number is required'),
  revision_no: z.number().int().default(1),
  title: z.string().optional().nullable(),
  project_id: uuid.optional().nullable(),
  client_id: uuid.optional().nullable(),
  variant_id: uuid.optional().nullable(),
  date: z.string().optional().nullable(),
  status: z.enum(['Draft', 'Final', 'Approved', 'Converted']).default('Draft'),
  currency: z.string().default('INR'),
  terms_conditions: z.string().optional().nullable(),
  preface: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  created_by: uuid.optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type BOQHeaderInput = z.input<typeof boqHeaderSchema>;
export type BOQHeader = z.output<typeof boqHeaderSchema>;

export const boqSectionSchema = z.object({
  id: uuid.optional(),
  boq_id: uuid,
  name: z.string().min(1, 'Section name is required'),
  section_order: z.number().int().default(0),
  description: z.string().optional().nullable(),
});

export type BOQSectionInput = z.input<typeof boqSectionSchema>;
export type BOQSection = z.output<typeof boqSectionSchema>;

export const boqItemSchema = z.object({
  id: uuid.optional(),
  section_id: uuid,
  item_code: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  specification: z.string().optional().nullable(),
  hsn_sac: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  quantity: numeric.default(0),
  rate: optionalNumeric.default(0),
  discount_percent: optionalNumeric.default(0),
  make: z.string().optional().nullable(),
  variant_id: uuid.optional().nullable(),
  material_id: uuid.optional().nullable(),
  rate_after_discount: optionalNumeric.default(0),
  total_amount: optionalNumeric.default(0),
  pressure: z.string().optional().nullable(),
  thickness: z.string().optional().nullable(),
  schedule: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  item_order: z.number().int().default(0),
});

export type BOQItemInput = z.input<typeof boqItemSchema>;
export type BOQItem = z.output<typeof boqItemSchema>;

export const rateAnalysisSchema = z.object({
  id: uuid.optional(),
  boq_item_id: uuid,
  total_resource_cost: optionalNumeric.default(0),
  markup_percent: optionalNumeric.default(0),
  calculated_rate: optionalNumeric.default(0),
  variance_from_boq: optionalNumeric.default(0),
  status: z.enum(['Draft', 'Locked']).default('Draft'),
  notes: z.string().optional().nullable(),
});

export type RateAnalysisInput = z.input<typeof rateAnalysisSchema>;
export type RateAnalysis = z.output<typeof rateAnalysisSchema>;

export const rateResourceSchema = z.object({
  id: uuid.optional(),
  rate_analysis_id: uuid,
  resource_type: z.enum(['labour', 'material', 'equipment', 'overhead', 'subcontract']),
  resource_id: uuid.optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: numeric.default(1),
  unit: z.string().optional().nullable(),
  rate_per_unit: numeric.default(0),
  remark: z.string().optional().nullable(),
});

export type RateResourceInput = z.input<typeof rateResourceSchema>;
export type RateResource = z.output<typeof rateResourceSchema>;

export const labourCatalogSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['skilled', 'semi-skilled', 'unskilled', 'supervisor']),
  default_rate: optionalNumeric,
  unit: z.string().default('day'),
  is_active: z.boolean().default(true),
});

export type LabourCatalogInput = z.input<typeof labourCatalogSchema>;
export type LabourCatalog = z.output<typeof labourCatalogSchema>;

export const equipmentCatalogSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional().nullable(),
  default_rate: optionalNumeric,
  unit: z.string().default('day'),
  is_active: z.boolean().default(true),
});

export type EquipmentCatalogInput = z.input<typeof equipmentCatalogSchema>;
export type EquipmentCatalog = z.output<typeof equipmentCatalogSchema>;

export const rateTemplateSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export type RateTemplateInput = z.input<typeof rateTemplateSchema>;
export type RateTemplate = z.output<typeof rateTemplateSchema>;

export const rateTemplateResourceSchema = z.object({
  id: uuid.optional(),
  template_id: uuid,
  resource_type: z.enum(['labour', 'material', 'equipment', 'overhead', 'subcontract']),
  resource_id: uuid.optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: numeric.default(1),
  unit: z.string().optional().nullable(),
  rate_per_unit: numeric.default(0),
  remark: z.string().optional().nullable(),
});

export type RateTemplateResourceInput = z.input<typeof rateTemplateResourceSchema>;

export const tenderSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  boq_id: uuid.optional().nullable(),
  tender_no: z.string().min(1, 'Tender number is required'),
  title: z.string().optional().nullable(),
  client_id: uuid.optional().nullable(),
  project_id: uuid.optional().nullable(),
  bid_amount: optionalNumeric,
  estimated_cost: optionalNumeric,
  expected_margin: optionalNumeric,
  status: z.enum(['Draft', 'Submitted', 'Won', 'Lost', 'Cancelled']).default('Draft'),
  submission_date: z.string().optional().nullable(),
  decision_date: z.string().optional().nullable(),
  result_notes: z.string().optional().nullable(),
  win_loss_reason: z.string().optional().nullable(),
  award_amount: optionalNumeric,
  loa_reference: z.string().optional().nullable(),
  converted_to_project_id: uuid.optional().nullable(),
  created_by: uuid.optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type TenderInput = z.input<typeof tenderSchema>;
export type Tender = z.output<typeof tenderSchema>;

export const tenderDocumentSchema = z.object({
  id: uuid.optional(),
  tender_id: uuid,
  document_type: z.enum(['technical_bid', 'commercial_bid', 'emd', 'loa', 'other']).optional().nullable(),
  file_name: z.string().optional().nullable(),
  file_url: z.string().optional().nullable(),
  uploaded_at: z.string().optional(),
});

export type TenderDocumentInput = z.input<typeof tenderDocumentSchema>;
export type TenderDocument = z.output<typeof tenderDocumentSchema>;

export const estimationSettingsSchema = z.object({
  id: uuid.optional(),
  organisation_id: uuid,
  status_workflow: z.enum(['loose', 'gated']).default('loose'),
  currency: z.string().default('INR'),
});

export type EstimationSettingsInput = z.input<typeof estimationSettingsSchema>;
export type EstimationSettings = z.output<typeof estimationSettingsSchema>;
