export type QuickQuoteSourceType = 'size' | 'sub_size' | 'none';

export type QuickQuoteSettings = {
  org_id: string;
  default_material: string | null;
  default_variant: string | null;
  default_make: string | null;
  default_spec: string | null;
  enable_valves: boolean;
  enable_thread_items: boolean;
};

export type QuickQuoteSizeMapping = {
  org_id: string | null;
  mm_size: string;
  inch_size: string;
};

export type QuickQuoteTemplate = {
  id: string;
  org_id: string;
  name: string;
  is_active?: boolean;
};

export type QuickQuoteTemplateItem = {
  id: string;
  template_id: string;
  item_type: string | null;
  material_id: string | null;
  size_formula: string | null;
  size_source: QuickQuoteSourceType;
  use_inch: boolean;
  include_valves: boolean | null;
  include_thread_items: boolean | null;
  sequence_no: number;
  description_override: string | null;
};

export type MaterialRecord = {
  id: string;
  name?: string | null;
  display_name?: string | null;
  item_code?: string | null;
  hsn_code?: string | null;
  sale_price?: number | string | null;
  unit?: string | null;
  gst_rate?: number | string | null;
  make?: string | null;
  item_type?: string | null;
  uses_variant?: boolean | null;
};

export type MaterialAttribute = {
  material_id: string;
  key: string;
  value: string;
};

export type QuickQuoteGenerateInput = {
  size: string;
  subSize?: string;
  variantId?: string | null;
  variantName?: string | null;
  make?: string | null;
  spec?: string | null;
  includeValves: boolean;
  includeThreadItems: boolean;
  quantity?: number;
};

export type QuickQuoteConfig = {
  settings: QuickQuoteSettings | null;
  mappings: QuickQuoteSizeMapping[];
  templates: QuickQuoteTemplate[];
  templateItems: QuickQuoteTemplateItem[];
  attributes: MaterialAttribute[];
  materials: MaterialRecord[];
  variantPricing: Array<{
    item_id: string;
    company_variant_id: string | null;
    sale_price: number | string | null;
    make: string | null;
  }>;
};

export type QuickQuoteGeneratedItem = {
  material: MaterialRecord;
  templateItemId: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  tax_percent: number;
  variant_id: string | null;
  make: string;
};

export type GenerateQuickQuoteArgs = {
  templateId: string;
  input: QuickQuoteGenerateInput;
  config: QuickQuoteConfig;
};
