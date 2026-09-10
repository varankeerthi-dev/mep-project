import { describe, it, expect } from 'vitest';
import { SaveBOMPayloadSchema } from './bomSchemas';

describe('SaveBOMPayloadSchema null/empty handling', () => {
  const baseHeader = {
    bom_code: 'BOM-1',
    product_name: 'P',
    output_qty: 10,
    output_unit: 'nos',
    organisation_id: '11111111-1111-1111-1111-111111111111',
  };
  const baseItem = {
    material_id: '22222222-2222-2222-2222-222222222222',
    required_qty: 1,
    unit: 'kg',
  };

  it('accepts nulls the editor sends', () => {
    const result = SaveBOMPayloadSchema.parse({
      header: { ...baseHeader, valid_to: null, effective_date: null },
      items: [{ ...baseItem, scrap_factor: null, yield_pct: null }],
    });
    expect(result.header.valid_to).toBeNull();
    expect(result.items[0].scrap_factor).toBeNull();
  });

  it('coerces empty-string uuid selects to null', () => {
    const result = SaveBOMPayloadSchema.parse({
      header: { ...baseHeader, product_id: '' },
      items: [{ ...baseItem, company_variant_id: '', warehouse_id: '', alternate_material_id: '' }],
    });
    expect(result.header.product_id).toBeNull();
    expect(result.items[0].company_variant_id).toBeNull();
    expect(result.items[0].warehouse_id).toBeNull();
  });

  it('still rejects bad uuids', () => {
    expect(() =>
      SaveBOMPayloadSchema.parse({
        header: baseHeader,
        items: [{ ...baseItem, company_variant_id: 'not-a-uuid' }],
      }),
    ).toThrow();
  });
});
