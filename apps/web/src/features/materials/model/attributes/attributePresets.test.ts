import { describe, expect, it } from 'vitest';
import { getCategoryPresets } from './attributePresets';
import { isAttributeDataType } from './attributeTypes';

describe('material attribute presets', () => {
  it('prioritises manufacturing details for manufacturing categories', () => {
    const names = getCategoryPresets('Manufacturing').map((preset) => preset.name);

    expect(names).toEqual(expect.arrayContaining(['Grade', 'Model Number', 'Serial Number', 'Service Date']));
  });

  it('prioritises storage details for medical categories', () => {
    const names = getCategoryPresets('Medical Supplies').map((preset) => preset.name);

    expect(names).toEqual(expect.arrayContaining(['Storage Temperature']));
  });

  it('rejects unknown persisted data types safely', () => {
    expect(isAttributeDataType('date')).toBe(true);
    expect(isAttributeDataType('currency')).toBe(false);
  });
});
