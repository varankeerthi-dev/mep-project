import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Minus, Plus } from 'lucide-react';
import type { InvoiceEditorFormValues, InvoiceMaterialOption } from '../ui-utils';
import { createEmptyMaterial } from '../ui-utils';
import { InlineDescriptionCell } from '../../components/InlineDescriptionCell';

type InvoiceMaterialsEditorProps = {
  fields: FieldArrayWithId<InvoiceEditorFormValues, 'materials', 'id'>[];
  register: UseFormRegister<InvoiceEditorFormValues>;
  append: UseFieldArrayAppend<InvoiceEditorFormValues, 'materials'>;
  remove: UseFieldArrayRemove;
  materials: InvoiceEditorFormValues['materials'];
  productOptions: InvoiceMaterialOption[];
  setValue: UseFormSetValue<InvoiceEditorFormValues>;
  watch: UseFormWatch<InvoiceEditorFormValues>;
  error?: string;
  warehouses?: Array<{ id: string; warehouse_name?: string; name?: string }>;
  defaultWarehouseId?: string;
};

export function InvoiceMaterialsEditor({
  fields,
  register,
  append,
  remove,
  materials,
  productOptions,
  setValue,
  watch,
  error,
  warehouses = [],
  defaultWarehouseId,
}: InvoiceMaterialsEditorProps) {
  return (
    <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#f5f5f5',
        borderBottom: '1px solid #d4d4d4'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#171717' }}>
          Materials Used
        </span>
        <button
          type="button"
          onClick={() => append(createEmptyMaterial())}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            border: '1px solid #d4d4d4',
            borderRadius: '4px',
            background: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            color: '#525252',
            cursor: 'pointer'
          }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373'
              }}>
                Product
              </th>
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '120px'
              }}>
                Qty Used
              </th>
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '150px'
              }}>
                Warehouse
              </th>
              <th style={{ padding: '6px 8px', width: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '4px 8px' }}>
                  <select
                    {...register(`materials.${index}.product_id`)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid transparent',
                      borderRadius: '2px',
                      fontSize: '12px',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    <option value="">Select product</option>
                    {productOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <InlineDescriptionCell
                    materialName=""
                    description={watch(`materials.${index}.description`) as string}
                    onSave={(desc) => setValue(`materials.${index}.description`, desc, { shouldDirty: true })}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`materials.${index}.qty_used`, { valueAsNumber: true })}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid transparent',
                      borderRadius: '2px',
                      fontSize: '12px',
                      textAlign: 'right',
                      background: 'transparent'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <select
                    {...register(`materials.${index}.warehouse_id`)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      border: '1px solid transparent',
                      borderRadius: '2px',
                      fontSize: '12px',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.warehouse_name || wh.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      border: 'none',
                      borderRadius: '2px',
                      background: 'transparent',
                      color: '#a3a3a3',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fef2f2';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#a3a3a3';
                    }}
                    title="Remove"
                  >
                    <Minus size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fields.length === 0 && (
        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#737373' }}>
          No materials added yet.
        </div>
      )}
      {error && <div style={{ padding: '6px 12px', fontSize: '11px', color: '#dc2626' }}>{error}</div>}
    </div>
  );
}
