import type {
  GenerateQuickQuoteArgs,
  MaterialAttribute,
  MaterialRecord,
  QuickQuoteGeneratedItem,
  QuickQuoteTemplateItem,
} from './types';

type AttributeMap = Record<string, Record<string, string>>;

const normalize = (value?: string | null): string => (value || '').trim().toLowerCase();

const parseNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildAttributeMap = (attributes: MaterialAttribute[]): AttributeMap => {
  return attributes.reduce<AttributeMap>((acc, row) => {
    if (!acc[row.material_id]) acc[row.material_id] = {};
    acc[row.material_id][normalize(row.key)] = row.value;
    return acc;
  }, {});
};

const resolveTokenizedValue = (template: string | null, size: string, subSize: string): string => {
  if (!template) return '';
  return template
    .replaceAll('{size}', size)
    .replaceAll('{sub_size}', subSize)
    .replace(/\s+/g, ' ')
    .trim();
};

const resolveSize = (
  item: QuickQuoteTemplateItem,
  size: string,
  subSize: string,
  mmToInchMap: Map<string, string>,
): string => {
  const sourceValue = item.size_formula
    ? resolveTokenizedValue(item.size_formula, size, subSize)
    : item.size_source === 'sub_size'
      ? subSize
      : item.size_source === 'none'
        ? ''
        : size;

  if (!item.use_inch || !sourceValue) return sourceValue;

  return mmToInchMap.get(normalize(sourceValue)) || sourceValue;
};

const isTruthyAttr = (value?: string): boolean => {
  const n = normalize(value);
  return n === 'true' || n === '1' || n === 'yes' || n === 'y';
};

const matches = (actual: string | null | undefined, expected: string | null | undefined): boolean => {
  if (!expected) return true;
  if (!actual) return false;

  const left = normalize(actual);
  const right = normalize(expected);
  return left === right || left.includes(right) || right.includes(left);
};

const isValveMaterial = (material: MaterialRecord, attrs: Record<string, string>): boolean => {
  return matches(material.item_type, 'valve') || matches(attrs['item_type'], 'valve') || matches(attrs['category'], 'valve');
};

const isThreadMaterial = (material: MaterialRecord, attrs: Record<string, string>): boolean => {
  return isTruthyAttr(attrs['is_thread'])
    || isTruthyAttr(attrs['thread'])
    || matches(attrs['connection_type'], 'thread')
    || matches(material.item_type, 'thread');
};

const getAttr = (attrs: Record<string, string>, key: string): string => attrs[normalize(key)] || '';

const getVariantRate = (
  materialId: string,
  selectedVariantId: string | null,
  selectedMake: string,
  variantPricing: Array<{ item_id: string; company_variant_id: string | null; sale_price: number | string | null; make: string | null }>,
  fallback: number,
): number => {
  const rows = variantPricing.filter((row) => row.item_id === materialId);
  if (rows.length === 0) return fallback;

  const strict = rows.find((row) => (row.company_variant_id || null) === (selectedVariantId || null) && normalize(row.make) === normalize(selectedMake));
  if (strict) return parseNumber(strict.sale_price, fallback);

  const variantOnly = rows.find((row) => (row.company_variant_id || null) === (selectedVariantId || null));
  if (variantOnly) return parseNumber(variantOnly.sale_price, fallback);

  const makeOnly = rows.find((row) => normalize(row.make) === normalize(selectedMake));
  if (makeOnly) return parseNumber(makeOnly.sale_price, fallback);

  return parseNumber(rows[0].sale_price, fallback);
};

const applyFilters = (
  material: MaterialRecord,
  attrs: Record<string, string>,
  resolvedSize: string,
  selectedVariant: string | null,
  selectedMake: string,
  selectedSpec: string,
  includeValves: boolean,
  includeThreadItems: boolean,
  matchVariant = true,
  matchMake = true,
): boolean => {
  if (!includeValves && isValveMaterial(material, attrs)) return false;
  if (!includeThreadItems && isThreadMaterial(material, attrs)) return false;

  const sizeMatch = !resolvedSize || matches(getAttr(attrs, 'size') || getAttr(attrs, 'nominal_size'), resolvedSize);
  if (!sizeMatch) return false;

  if (selectedSpec && !matches(getAttr(attrs, 'spec'), selectedSpec)) return false;

  if (matchVariant && selectedVariant && !matches(getAttr(attrs, 'variant_id') || getAttr(attrs, 'variant'), selectedVariant)) {
    return false;
  }

  if (matchMake && selectedMake && !matches(material.make || getAttr(attrs, 'make'), selectedMake)) {
    return false;
  }

  return true;
};

const pickBestCandidate = (
  candidates: MaterialRecord[],
  templateItem: QuickQuoteTemplateItem,
): MaterialRecord | null => {
  if (candidates.length === 0) return null;
  if (templateItem.material_id) {
    const exact = candidates.find((material) => material.id === templateItem.material_id);
    if (exact) return exact;
  }
  return candidates[0];
};

export const generateQuickQuoteItems = ({ templateId, input, config }: GenerateQuickQuoteArgs): QuickQuoteGeneratedItem[] => {
  const templateItems = config.templateItems
    .filter((row) => row.template_id === templateId)
    .sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0));

  if (templateItems.length === 0) return [];

  const attributeMap = buildAttributeMap(config.attributes);
  const mmToInchMap = new Map(config.mappings.map((row) => [normalize(row.mm_size), row.inch_size]));

  const size = input.size.trim();
  const subSize = (input.subSize || '').trim();
  const selectedVariant = input.variantId || input.variantName || null;
  const selectedMake = (input.make || '').trim();
  const selectedSpec = (input.spec || '').trim();
  const baseQty = input.quantity && input.quantity > 0 ? input.quantity : 1;

  const results: QuickQuoteGeneratedItem[] = [];

  templateItems.forEach((templateItem) => {
    const resolvedSize = resolveSize(templateItem, size, subSize, mmToInchMap);
    const scopeByItemType = normalize(templateItem.item_type);

    const includeValves = templateItem.include_valves ?? input.includeValves;
    const includeThreadItems = templateItem.include_thread_items ?? input.includeThreadItems;

    const basePool = config.materials.filter((material) => {
      if (templateItem.material_id && material.id !== templateItem.material_id) return false;
      if (scopeByItemType && !matches(material.item_type, scopeByItemType)) {
        const attrs = attributeMap[material.id] || {};
        if (!matches(getAttr(attrs, 'item_type'), scopeByItemType)) return false;
      }
      return true;
    });

    const strictCandidates = basePool.filter((material) =>
      applyFilters(
        material,
        attributeMap[material.id] || {},
        resolvedSize,
        selectedVariant,
        selectedMake,
        selectedSpec,
        includeValves,
        includeThreadItems,
        true,
        true,
      ),
    );

    const variantFallbackCandidates = strictCandidates.length
      ? strictCandidates
      : basePool.filter((material) =>
          applyFilters(
            material,
            attributeMap[material.id] || {},
            resolvedSize,
            selectedVariant,
            selectedMake,
            selectedSpec,
            includeValves,
            includeThreadItems,
            false,
            true,
          ),
        );

    const makeFallbackCandidates = variantFallbackCandidates.length
      ? variantFallbackCandidates
      : basePool.filter((material) =>
          applyFilters(
            material,
            attributeMap[material.id] || {},
            resolvedSize,
            selectedVariant,
            selectedMake,
            selectedSpec,
            includeValves,
            includeThreadItems,
            false,
            false,
          ),
        );

    const material = pickBestCandidate(makeFallbackCandidates, templateItem);
    if (!material) return;

    const fallbackRate = parseNumber(material.sale_price, 0);
    const rate = getVariantRate(material.id, input.variantId || null, selectedMake, config.variantPricing, fallbackRate);

    results.push({
      material,
      templateItemId: templateItem.id,
      description: templateItem.description_override || material.display_name || material.name || 'Quick Quote Item',
      qty: baseQty,
      uom: material.unit || 'Nos',
      rate,
      tax_percent: parseNumber(material.gst_rate, 18),
      variant_id: input.variantId || null,
      make: selectedMake || material.make || '',
    });
  });

  return results;
};
