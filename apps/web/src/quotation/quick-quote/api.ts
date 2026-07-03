import { supabase } from '../../supabase';
import { timedSupabaseQuery } from '../../utils/queryTimeout';
import type {
  MaterialAttribute,
  MaterialRecord,
  QuickQuoteConfig,
  QuickQuoteSettings,
  QuickQuoteSizeMapping,
  QuickQuoteTemplate,
  QuickQuoteTemplateItem,
} from './types';

export const loadQuickQuoteConfig = async (orgId: string): Promise<QuickQuoteConfig> => {
  const [settings, mappings, templates, templateItems, attributes] = await Promise.all([
    timedSupabaseQuery(
      supabase
        .from('quick_quote_settings')
        .select('org_id, default_material, default_variant, default_make, default_spec, enable_valves, enable_thread_items')
        .eq('org_id', orgId)
        .maybeSingle(),
      'Quick quote settings',
    ),
    timedSupabaseQuery(
      supabase
        .from('quick_quote_size_mappings')
        .select('org_id, mm_size, inch_size')
        .or(`org_id.eq.${orgId},org_id.is.null`),
      'Quick quote size mappings',
    ),
    timedSupabaseQuery(
      supabase
        .from('quick_quote_templates')
        .select('id, org_id, name, is_active')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name'),
      'Quick quote templates',
    ),
    timedSupabaseQuery(
      supabase
        .from('quick_quote_template_items')
        .select('id, template_id, item_type, material_id, size_formula, size_source, use_inch, include_valves, include_thread_items, sequence_no, description_override')
        .order('sequence_no', { ascending: true }),
      'Quick quote template items',
    ),
    timedSupabaseQuery(
      supabase.from('material_attributes').select('material_id, key, value'),
      'Quick quote material attributes',
    ),
  ]);

  return {
    settings: (settings as QuickQuoteSettings | null) || null,
    mappings: (mappings as QuickQuoteSizeMapping[]) || [],
    templates: (templates as QuickQuoteTemplate[]) || [],
    templateItems: (templateItems as QuickQuoteTemplateItem[]) || [],
    attributes: (attributes as MaterialAttribute[]) || [],
    materials: [],
    variantPricing: [],
  };
};

export const saveQuickQuoteSettings = async (payload: QuickQuoteSettings) => {
  const { error } = await supabase
    .from('quick_quote_settings')
    .upsert(payload, { onConflict: 'org_id' });

  if (error) throw error;
};

export const saveQuickQuoteSizeMappings = async (orgId: string, mappings: QuickQuoteSizeMapping[]) => {
  const { error: deleteError } = await supabase
    .from('quick_quote_size_mappings')
    .delete()
    .eq('org_id', orgId);

  if (deleteError) throw deleteError;

  if (!mappings.length) return;

  const payload = mappings
    .filter((row) => row.mm_size.trim() && row.inch_size.trim())
    .map((row) => ({ org_id: orgId, mm_size: row.mm_size.trim(), inch_size: row.inch_size.trim() }));

  if (!payload.length) return;

  const { error: insertError } = await supabase
    .from('quick_quote_size_mappings')
    .insert(payload);

  if (insertError) throw insertError;
};

export const saveQuickQuoteTemplateItems = async (
  templateId: string,
  items: QuickQuoteTemplateItem[],
) => {
  const { error: deleteError } = await supabase
    .from('quick_quote_template_items')
    .delete()
    .eq('template_id', templateId);

  if (deleteError) throw deleteError;

  if (!items.length) return;

  const payload = items.map((row, index) => ({
    template_id: templateId,
    item_type: row.item_type,
    material_id: row.material_id,
    size_formula: row.size_formula,
    size_source: row.size_source,
    use_inch: row.use_inch,
    include_valves: row.include_valves,
    include_thread_items: row.include_thread_items,
    sequence_no: index,
    description_override: row.description_override,
  }));

  const { error: insertError } = await supabase
    .from('quick_quote_template_items')
    .insert(payload);

  if (insertError) throw insertError;
};

export const normalizeQuickQuoteConfig = (
  baseConfig: QuickQuoteConfig,
  materials: MaterialRecord[],
  variantPricing: QuickQuoteConfig['variantPricing'],
): QuickQuoteConfig => ({
  ...baseConfig,
  materials,
  variantPricing,
});
