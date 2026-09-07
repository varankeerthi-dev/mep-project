export const ATTRIBUTE_DATA_TYPES = [
  'text',
  'alphanumeric',
  'number',
  'date',
  'boolean',
] as const;

export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number];

export const ATTRIBUTE_DATA_TYPE_LABELS: Record<AttributeDataType, string> = {
  text: 'Short text',
  alphanumeric: 'Alphanumeric code',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
};

export function isAttributeDataType(value: unknown): value is AttributeDataType {
  return typeof value === 'string' && ATTRIBUTE_DATA_TYPES.includes(value as AttributeDataType);
}

export function getAttributeInputType(dataType: AttributeDataType): 'text' | 'number' | 'date' {
  if (dataType === 'number') return 'number';
  if (dataType === 'date') return 'date';
  return 'text';
}
