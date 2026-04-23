import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import type { InvoiceEditorFormValues, InvoiceMaterialOption } from '../ui-utils';
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
  productOptions?: InvoiceMaterialOption[];
  setValue?: UseFormSetValue<InvoiceEditorFormValues>;
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
  productOptions = [],
  setValue,
}: InvoiceItemsEditorProps) {
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({});
  const [selectedIndices, setSelectedIndices] = useState<Record<number, number>>({});
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleMaterialChange = (index: number, materialId: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (material && setValue) {
      setValue(`items.${index}.description`, material.name, { shouldDirty: true });
      setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
      setValue(`items.${index}.meta_json.material_id`, materialId, { shouldDirty: true });
    }
    setOpenDropdowns({ ...openDropdowns, [index]: false });
    setSelectedIndices({ ...selectedIndices, [index]: 0 });
  };

  const handleSearchChange = (index: number, value: string) => {
    setSearchTerms({ ...searchTerms, [index]: value });
    setOpenDropdowns({ ...openDropdowns, [index]: true });
    setSelectedIndices({ ...selectedIndices, [index]: 0 });
  };

  const getFilteredMaterials = useCallback((index: number) => {
    const searchTerm = searchTerms[index] || '';
    if (!searchTerm) return productOptions;
    return productOptions.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerms, productOptions]);

  const getSelectedMaterialName = useCallback((index: number) => {
    const materialId = items[index]?.meta_json?.material_id as string | undefined;
    if (materialId) {
      const material = productOptions.find(m => m.id === materialId);
      return material?.name || '';
    }
    return searchTerms[index] || '';
  }, [items, productOptions, searchTerms]);

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    const filtered = getFilteredMaterials(index);
    const currentIdx = selectedIndices[index] || 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filtered.length > 0) {
          const nextIdx = Math.min(currentIdx + 1, filtered.length - 1);
          setSelectedIndices({ ...selectedIndices, [index]: nextIdx });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filtered.length > 0) {
          const prevIdx = Math.max(currentIdx - 1, 0);
          setSelectedIndices({ ...selectedIndices, [index]: prevIdx });
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered.length > 0 && filtered[currentIdx]) {
          handleMaterialChange(index, filtered[currentIdx].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpenDropdowns({ ...openDropdowns, [index]: false });
        break;
      case 'Delete':
        // Clear selected material (not delete row)
        e.preventDefault();
        if (setValue) {
          setValue(`items.${index}.meta_json.material_id`, '', { shouldDirty: true });
          setValue(`items.${index}.description`, '', { shouldDirty: true });
          setValue(`items.${index}.hsn_code`, '', { shouldDirty: true });
          setSearchTerms({ ...searchTerms, [index]: '' });
        }
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      Object.keys(dropdownRefs.current).forEach(index => {
        const dropdown = dropdownRefs.current[Number(index)];
        const input = inputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setOpenDropdowns(prev => ({ ...prev, [Number(index)]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Position dropdown below input
  useEffect(() => {
    Object.keys(openDropdowns).forEach(index => {
      if (openDropdowns[Number(index)]) {
        const input = inputRefs.current[Number(index)];
        const dropdown = dropdownRefs.current[Number(index)];
        if (input && dropdown) {
          const rect = input.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + 2}px`;
          dropdown.style.left = `${rect.left}px`;
          dropdown.style.width = `${rect.width}px`;
        }
      }
    });
  }, [openDropdowns]);

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

      {/* Table - Quotation Style */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'center', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '40px'
              }}>
                #
              </th>
              {mode === 'itemized' && (
                <th style={{ 
                  padding: '6px 4px', 
                  textAlign: 'left', 
                  fontSize: '10px', 
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  color: '#737373',
                  minWidth: '150px'
                }}>
                  MATERIAL
                </th>
              )}
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '60px'
              }}>
                HSN
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                minWidth: '180px'
              }}>
                ITEM
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '80px'
              }}>
                MAKE
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '80px'
              }}>
                VARIANT
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '60px'
              }}>
                QTY
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'center', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '60px'
              }}>
                UNIT
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '80px'
              }}>
                RATE
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '60px'
              }}>
                DISC %
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '80px'
              }}>
                RATE AFTER DISC
              </th>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '60px'
              }}>
                GST %
              </th>
              {showCustomColumn && (
                <th style={{ 
                  padding: '6px 4px', 
                  textAlign: 'left', 
                  fontSize: '10px', 
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  color: '#737373',
                  width: '80px'
                }}>
                  {extraColumnLabel}
                </th>
              )}
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'right', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '90px'
              }}>
                AMOUNT
              </th>
              <th style={{ padding: '6px 4px', width: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = items[index] ?? createEmptyItem();
              const meta = item.meta_json as Record<string, unknown> | undefined;
              const taxPercent = Number(meta?.tax_percent) || 18;
              const discountPercent = Number(item.discount_percent) || 0;
              const baseRate = Number(item.rate || 0);
              const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
              const amount = round2((Number(item.qty) || 0) * rateAfterDiscount);

              return (
                <tr key={field.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#737373' }}>{index + 1}</span>
                  </td>
                  {mode === 'itemized' && (
                    <td style={{ padding: '4px', position: 'relative' }}>
                      <input
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        value={getSelectedMaterialName(index)}
                        onChange={(e) => handleSearchChange(index, e.target.value)}
                        onFocus={() => setOpenDropdowns({ ...openDropdowns, [index]: true })}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        placeholder=""
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid transparent',
                          borderRadius: '2px',
                          fontSize: '11px',
                          background: 'transparent',
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      />
                      {openDropdowns[index] && (
                        <div
                          ref={(el) => { dropdownRefs.current[index] = el; }}
                          style={{
                            position: 'fixed',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            background: '#fff',
                            border: '1px solid #d4d4d4',
                            borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 9999,
                            minWidth: '150px',
                          }}
                        >
                          {getFilteredMaterials(index).length === 0 ? (
                            <div style={{ padding: '8px', fontSize: '11px', color: '#737373' }}>
                              No materials found
                            </div>
                          ) : (
                            getFilteredMaterials(index).slice(0, 50).map((option, idx) => (
                              <div
                                key={option.id}
                                onClick={() => handleMaterialChange(index, option.id)}
                                style={{
                                  padding: '6px 8px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  background: idx === (selectedIndices[index] || 0) ? '#e5e7eb' : '#fff'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f5f5f5';
                                  setSelectedIndices({ ...selectedIndices, [index]: idx });
                                }}
                                onMouseLeave={(e) => e.currentTarget.style.background = idx === (selectedIndices[index] || 0) ? '#e5e7eb' : '#fff'}
                              >
                                {option.name}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '4px' }}>
                    <input
                      {...register(`items.${index}.hsn_code`)}
                      placeholder="9987"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'left'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      {...register(`items.${index}.description`)}
                      placeholder="Item description"
                      onKeyDown={(e) => {
                        if (e.key === 'Delete' && mode === 'itemized') {
                          e.preventDefault();
                          if (setValue) {
                            setValue(`items.${index}.meta_json.material_id`, '', { shouldDirty: true });
                            setValue(`items.${index}.description`, '', { shouldDirty: true });
                            setValue(`items.${index}.hsn_code`, '', { shouldDirty: true });
                            setSearchTerms({ ...searchTerms, [index]: '' });
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      {...register(`items.${index}.meta_json.make` as const)}
                      placeholder="-"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'left'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      {...register(`items.${index}.meta_json.variant` as const)}
                      placeholder="-"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'left'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        textAlign: 'right',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      {...register(`items.${index}.meta_json.uom` as const)}
                      placeholder="Nos"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'center'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.meta_json.base_rate` as const)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        textAlign: 'right',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.discount_percent` as const)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        textAlign: 'right',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.rate`, { valueAsNumber: true })}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        textAlign: 'right',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.meta_json.tax_percent` as const)}
                      placeholder="18"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        textAlign: 'right',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  {showCustomColumn && (
                    <td style={{ padding: '4px' }}>
                      <input
                        {...register(`items.${index}.meta_json.client_custom_value` as const)}
                        placeholder={extraColumnLabel}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid transparent',
                          borderRadius: '2px',
                          fontSize: '11px',
                          background: 'transparent'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      />
                    </td>
                  )}
                  <td style={{ padding: '4px' }}>
                    <div style={{
                      padding: '4px 6px',
                      textAlign: 'right',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#171717',
                      background: '#f5f5f5',
                      borderRadius: '2px'
                    }}>
                      {formatCurrency(amount)}
                    </div>
                  </td>
                  <td style={{ padding: '4px' }}>
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
                          color: '#dc2626',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fef2f2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Delete row"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#fafafa', borderTop: '1px solid #e5e5e5' }}>
              <td colSpan={4} style={{ padding: '8px 4px', fontWeight: 600, fontSize: '11px', color: '#171717' }}>
                TOTAL
              </td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontSize: '11px', color: '#171717' }}>
                {items.reduce((sum, i) => sum + (parseFloat(String(i.qty)) || 0), 0).toFixed(2)}
              </td>
              <td colSpan={showCustomColumn ? 8 : 7}></td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: '#171717' }}>
                {formatCurrency(items.reduce((sum, i) => {
                  const qty = parseFloat(String(i.qty)) || 0;
                  const rate = parseFloat(String(i.rate)) || 0;
                  const discountPercent = parseFloat(String((i as any).discount_percent)) || 0;
                  const rateAfterDiscount = rate - (rate * discountPercent / 100);
                  return sum + (qty * rateAfterDiscount);
                }, 0))}
              </td>
              <td></td>
            </tr>
          </tfoot>
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