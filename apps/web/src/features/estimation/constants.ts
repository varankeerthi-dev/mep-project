export const BOQ_STATUS_WORKFLOWS = ['loose', 'gated'] as const;
export type BOQStatusWorkflow = (typeof BOQ_STATUS_WORKFLOWS)[number];

export const BOQ_STATUSES = ['Draft', 'Final', 'Approved', 'Converted'] as const;
export type BOQStatus = (typeof BOQ_STATUSES)[number];

export const RATE_ANALYSIS_STATUSES = ['Draft', 'Locked'] as const;
export type RateAnalysisStatus = (typeof RATE_ANALYSIS_STATUSES)[number];

export const RESOURCE_TYPES = ['labour', 'material', 'equipment', 'overhead', 'subcontract'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const LABOUR_CATEGORIES = ['skilled', 'semi-skilled', 'unskilled', 'supervisor'] as const;
export type LabourCategory = (typeof LABOUR_CATEGORIES)[number];

export const TENDER_STATUSES = ['Draft', 'Submitted', 'Won', 'Lost', 'Cancelled'] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const TENDER_DOCUMENT_TYPES = ['technical_bid', 'commercial_bid', 'emd', 'loa', 'other'] as const;
export type TenderDocumentType = (typeof TENDER_DOCUMENT_TYPES)[number];

export const DEFAULT_CURRENCY = 'INR';

export const MARGIN_THRESHOLDS = {
  healthy: 15,
  warning: 5,
} as const;

export const AUTO_SAVE_DELAY = 3000;

export const QUERY_KEYS = {
  boqs: 'estimation.boqs',
  boq: 'estimation.boq',
  boqSections: 'estimation.boqSections',
  boqItems: 'estimation.boqItems',
  rateAnalyses: 'estimation.rateAnalyses',
  rateResources: 'estimation.rateResources',
  labourCatalog: 'estimation.labourCatalog',
  equipmentCatalog: 'estimation.equipmentCatalog',
  rateTemplates: 'estimation.rateTemplates',
  tenders: 'estimation.tenders',
  tender: 'estimation.tender',
  settings: 'estimation.settings',
} as const;
