import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from 'react-hook-form';
import { Minus, Plus } from 'lucide-react';
import type { InvoiceEditorFormValues } from '../ui-utils';
import { createEmptyItem, createLotItem, formatCurrency, round2 } from '../ui-utils';

type InvoiceItemsEditorProps = {
  fields: FieldArrayWithId<InvoiceEditorFormValues, 'items', 'id'>[];
  items: InvoiceEditorFormValues['items'];
  register: UseFormRegister<InvoiceEditorFormValues>;
  append: UseFieldArrayAppend<InvoiceEditorFormValues, 'items'>;
  remove: UseFieldArrayRemove;
  mode: InvoiceEditorFormValues['mode'];
  extraColumnLabel?: string;
  showCustomColumn?: boolean;
  error?: string;
};

export function InvoiceItemsEditor({
  fields,
  items,
  register,
  append,
  remove,
  mode,
  extraColumnLabel = 'Custom',
  showCustomColumn = false,
  error,
}: InvoiceItemsEditorProps) {
  const editableColumnCount = showCustomColumn ? 5 : 4;

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
          Line Items
        </span>
        {mode !== 'lot' && (
          <button
            type="button"
            onClick={() => append(createEmptyItem())}
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
        )}
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
                color: '#737373',
                width: showCustomColumn ? '30%' : '35%'
              }}>
                Description
              </th>
              {showCustomColumn && (
                <th style={{ 
                  padding: '6px 8px', 
                  textAlign: 'left', 
                  fontSize: '10px', 
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  color: '#737373',
                  width: '15%'
                }}>
                  {extraColumnLabel}
                </th>
              )}
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '12%'
              }}>
                HSN
              </th>
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '10%'
              }}>
                Qty
              </th>
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '12%'
              }}>
                Rate
              </th>
              <th style={{ 
                padding: '6px 8px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '14%'
              }}>
                Amount
              </th>
              <th style={{ padding: '6px 8px', width: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = items[index] ?? createEmptyItem();
              const amount = round2((Number(item.qty) || 0) * (Number(item.rate) || 0));

              return (
                <tr key={field.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      {...register(`items.${index}.description`)}
                      placeholder={mode === 'lot' ? 'As per PO' : 'Item description'}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '12px',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  {showCustomColumn && (
                    <td style={{ padding: '4px 8px' }}>
                      <input
                        {...register(`items.${index}.meta_json.client_custom_value` as const)}
                        placeholder={extraColumnLabel}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid transparent',
                          borderRadius: '2px',
                          fontSize: '12px',
                          background: 'transparent'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      />
                    </td>
                  )}
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      {...register(`items.${index}.hsn_code`)}
                      placeholder="9987"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '12px',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
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
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.rate`, { valueAsNumber: true })}
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
                    <div style={{
                      padding: '4px 6px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#171717',
                      background: '#f5f5f5',
                      borderRadius: '2px'
                    }}>
                      {formatCurrency(amount)}
                    </div>
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    {mode !== 'lot' && fields.length > 1 ? (
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
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode === 'lot' && (
        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#737373', background: '#fafafa', borderTop: '1px solid #e5e5e5' }}>
          Lot mode: Single invoice line with materials listed below.
        </div>
      )}
      {error && <div style={{ padding: '6px 12px', fontSize: '11px', color: '#dc2626' }}>{error}</div>}
    </div>
  );
}
