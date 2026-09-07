import type { AttributeDataType } from './attributeTypes';

export interface AttributePreset {
  name: string;
  description: string;
  data_type: AttributeDataType;
  default_unit?: string;
  category_keywords: string[];
}

export const ATTRIBUTE_PRESETS: AttributePreset[] = [
  {
    name: 'Grade',
    description: 'Material or quality grade',
    data_type: 'text',
    category_keywords: ['manufacturing', 'steel', 'metal', 'fabrication'],
  },
  {
    name: 'Model Number',
    description: 'Manufacturer or product model reference',
    data_type: 'alphanumeric',
    category_keywords: ['manufacturing', 'electrical', 'equipment', 'machine'],
  },
  {
    name: 'Serial Number',
    description: 'Unique identifier for an individual unit',
    data_type: 'alphanumeric',
    category_keywords: ['manufacturing', 'electrical', 'equipment', 'machine'],
  },
  {
    name: 'Service Date',
    description: 'Next scheduled service or inspection date',
    data_type: 'date',
    category_keywords: ['manufacturing', 'equipment', 'machine', 'service'],
  },
  {
    name: 'Warranty Period',
    description: 'Warranty duration for the item',
    data_type: 'number',
    default_unit: 'months',
    category_keywords: ['manufacturing', 'equipment', 'machine', 'electrical'],
  },
  {
    name: 'Storage Temperature',
    description: 'Recommended storage temperature',
    data_type: 'number',
    default_unit: '°C',
    category_keywords: ['medical', 'pharma', 'chemical', 'food'],
  },
];

export function getCategoryPresets(category: string): AttributePreset[] {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return ATTRIBUTE_PRESETS.slice(0, 4);

  const matching = ATTRIBUTE_PRESETS.filter((preset) =>
    preset.category_keywords.some((keyword) => normalized.includes(keyword) || keyword.includes(normalized))
  );

  return matching.length > 0 ? matching : ATTRIBUTE_PRESETS.slice(0, 4);
}
