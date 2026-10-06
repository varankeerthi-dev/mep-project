import { describe, it, expect } from 'vitest';
import { mergeAttributeSet, normalizeAttributeSetLines } from './attributeSets';
import type { MaterialCustomAttribute } from '../entities/Material';

function row(name: string, value: string, sortOrder: number): MaterialCustomAttribute {
  return {
    attribute_name: name,
    attribute_value: value,
    attribute_unit: '',
    data_type: 'text',
    sort_order: sortOrder,
  };
}

const pipeSet = [
  { attribute_name: 'Grade', attribute_value: 'IS 2062 E250', attribute_unit: '', data_type: 'text' },
  { attribute_name: 'Pressure Rating', attribute_value: '16 bar', attribute_unit: '', data_type: 'text' },
  { attribute_name: 'End Connection', attribute_value: 'Flanged', attribute_unit: '', data_type: 'text' },
];

describe('mergeAttributeSet', () => {
  it('adds every line to an empty item, carrying values across', () => {
    const { merged, applied, skipped } = mergeAttributeSet([], pipeSet);

    expect(merged).toHaveLength(3);
    expect(applied).toHaveLength(3);
    expect(skipped).toHaveLength(0);
    expect(merged.map((r) => r.attribute_name)).toEqual(['Grade', 'Pressure Rating', 'End Connection']);
    expect(merged.map((r) => r.attribute_value)).toEqual(['IS 2062 E250', '16 bar', 'Flanged']);
  });

  it('skips a name the item already has and never overwrites the typed value', () => {
    const existing = [row('Grade', 'IS 2062 E250 BR', 0)];

    const { merged, applied, skipped } = mergeAttributeSet(existing, pipeSet);

    expect(applied).toHaveLength(2);
    expect(skipped.map((l) => l.attribute_name)).toEqual(['Grade']);
    expect(merged).toHaveLength(3);
    expect(merged[0].attribute_value).toBe('IS 2062 E250 BR');
  });

  it('matches names case-insensitively and ignoring surrounding whitespace', () => {
    const existing = [row('  grade  ', 'A', 0)];

    const { applied } = mergeAttributeSet(existing, pipeSet);

    expect(applied.map((l) => l.attribute_name)).toEqual(['Pressure Rating', 'End Connection']);
  });

  it('continues sort_order from the current max so ordering stays stable', () => {
    const existing = [row('Grade', 'A', 7), row('Colour', 'Red', 3)];

    // Grade is already present, so only Pressure Rating and End Connection are added.
    const { merged } = mergeAttributeSet(existing, pipeSet);

    expect(merged.map((r) => r.sort_order)).toEqual([7, 3, 8, 9]);
    expect(merged.map((r) => r.attribute_name)).toEqual(['Grade', 'Colour', 'Pressure Rating', 'End Connection']);
  });

  it('is idempotent: applying the same set twice adds nothing the second time', () => {
    const first = mergeAttributeSet([], pipeSet).merged;
    const second = mergeAttributeSet(first, pipeSet);

    expect(second.merged).toHaveLength(3);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
  });

  it('drops blank-named lines instead of creating unusable rows', () => {
    const { merged } = mergeAttributeSet([], [{ attribute_name: '   ', attribute_value: 'x', attribute_unit: '' }]);

    expect(merged).toHaveLength(0);
  });

  it('defaults a missing data_type to text', () => {
    const { merged } = mergeAttributeSet([], [{ attribute_name: 'Grade', attribute_value: 'A', attribute_unit: '' }]);

    expect(merged[0].data_type).toBe('text');
  });
});

describe('normalizeAttributeSetLines', () => {
  it('trims names and drops blank entries', () => {
    const result = normalizeAttributeSetLines([
      { attribute_name: '  Grade  ', attribute_value: 'A', attribute_unit: '' },
      { attribute_name: '   ', attribute_value: 'B', attribute_unit: '' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].attribute_name).toBe('Grade');
  });

  it('caps the stored line count', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      attribute_name: `Attr ${i}`,
      attribute_value: '',
      attribute_unit: '',
    }));

    expect(normalizeAttributeSetLines(many)).toHaveLength(50);
  });
});
