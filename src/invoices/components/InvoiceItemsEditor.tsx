import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Plus, X, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import type { InvoiceEditorFormValues, InvoiceMaterialOption } from '../ui-utils';
import { createEmptyItem, createLotItem, formatCurrency, round2 } from '../ui-utils';
import { useAuth } from '../../App';

type InvoiceItemsEditorProps = {
  fields: FieldArrayWithId<InvoiceEditorFormValues, 'items', 'id'>[];
  items: InvoiceEditorFormValues['items'];
  register: UseFormRegister<InvoiceEditorFormValues>;
  append: UseFieldArrayAppend<InvoiceEditorFormValues, 'items'>;
  remove: UseFieldArrayRemove;
  move: (from: number, to: number) => void;
  mode: InvoiceEditorFormValues['mode'];
  extraColumnLabel?: string;
  showCustomColumn?: boolean;
  error?: string;
  productOptions?: InvoiceMaterialOption[];
  setValue?: UseFormSetValue<InvoiceEditorFormValues>;
  formState?: any;
  isApplyingPOItems?: boolean;
  warehouses?: Array<{ id: string; warehouse_name?: string; name?: string }>;
  stockRows?: Array<{ item_id: string; warehouse_id: string; company_variant_id: string | null; current_stock: number }>;
  defaultWarehouseId?: string;
};

function SortableRow({ children, id, index }: { children: React.ReactNode; id: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={{ ...style, borderBottom: '1px solid #f0f0f0' }}>
      {children}
    </tr>
  );
}

export function InvoiceItemsEditor({
  fields,
  items,
  register,
  append,
  remove,
  move,
  mode,
  extraColumnLabel = 'Custom',
  showCustomColumn = false,
  error,
  productOptions = [],
  setValue,
  formState,
  isApplyingPOItems = false,
  warehouses = [],
  stockRows = [],
  defaultWarehouseId,
}: InvoiceItemsEditorProps) {
  const { organisation } = useAuth();
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({});
  const [selectedIndices, setSelectedIndices] = useState<Record<number, number>>({});
  const [makeDropdowns, setMakeDropdowns] = useState<Record<number, boolean>>({});
  const [variantDropdowns, setVariantDropdowns] = useState<Record<number, boolean>>({});
  const [selectedMakes, setSelectedMakes] = useState<Record<number, string>>({});
  const [selectedVariants, setSelectedVariants] = useState<Record<number, string>>({});
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const makeDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const variantDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Get round off setting from organisation
  const roundOffEnabled = organisation?.round_off_enabled !== false;

  // DnD sensors for smooth drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        move(oldIndex, newIndex);
      }
    }
  };

  const handleMaterialSelect = useCallback((index: number, materialId: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (material) {
      setValue(`items.${index}.meta_json.material_id`, materialId, { shouldDirty: true });
      setValue(`items.${index}.description`, material.name || '', { shouldDirty: true });
      setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
      const firstVariant = material.variants && material.variants.length > 0 ? material.variants[0].variant_name || '' : '';
      setValue(`items.${index}.meta_json.variant`, firstVariant, { shouldDirty: true });
      setValue(`items.${index}.meta_json.unit`, material.unit || '', { shouldDirty: true });
      if (material.sale_price) {
        // Set base_rate to be material's landing rate
        setValue(`items.${index}.meta_json.base_rate`, material.sale_price, { shouldDirty: true });
        
        // Auto-calculate rate after discount and set to Rate/Unit field
        const discountPercent = Number(items[index]?.discount_percent || 0);
        const rateAfterDiscount = material.sale_price - (material.sale_price * discountPercent / 100);
        const roundedRate = roundOffEnabled ? Math.round(rateAfterDiscount) : rateAfterDiscount;
        
        // Set the calculated rate to Rate/Unit field (this is what gets saved)
        setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
        // Store the rate after discount in meta for reference
        setValue(`items.${index}.meta_json.rate_after_discount`, roundedRate, { shouldDirty: true });
      }
    }
    setOpenDropdowns(prev => ({ ...prev, [index]: false }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, [productOptions, setValue, items, roundOffEnabled]);

  const handleSearchChange = useCallback((index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    setOpenDropdowns(prev => ({ ...prev, [index]: true }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, []);

  const handleMaterialChange = useCallback((index: number, materialId: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (material) {
      setValue(`items.${index}.meta_json.material_id`, materialId, { shouldDirty: true });
      setValue(`items.${index}.description`, material.display_name || material.name, { shouldDirty: true });
      setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
      // Auto-set default warehouse if not already set
      const currentWarehouse = items[index]?.meta_json?.warehouse_id as string | undefined;
      if (!currentWarehouse && defaultWarehouseId) {
        setValue(`items.${index}.meta_json.warehouse_id`, defaultWarehouseId, { shouldDirty: true });
        
        // Auto-calculate rate after discount and set to Rate/Unit field
        const discountPercent = Number(items[index]?.discount_percent || 0);
        const rateAfterDiscount = material.sale_price - (material.sale_price * discountPercent / 100);
        const roundedRate = roundOffEnabled ? Math.round(rateAfterDiscount) : rateAfterDiscount;
        
        // Set the calculated rate to Rate/Unit field (this is what gets saved)
        setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
        // Store the rate after discount in meta for reference
        setValue(`items.${index}.meta_json.rate_after_discount`, roundedRate, { shouldDirty: true });
      }
    }
    setOpenDropdowns(prev => ({ ...prev, [index]: false }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, [productOptions, setValue, items, roundOffEnabled]);

  const handleInputClick = useCallback((index: number) => {
    setOpenDropdowns(prev => ({ ...prev, [index]: true }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, []);

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

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    const filtered = getFilteredMaterials(index);
    const currentIdx = selectedIndices[index] || 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filtered.length > 0) {
          const nextIdx = Math.min(currentIdx + 1, filtered.length - 1);
          setSelectedIndices(prev => ({ ...prev, [index]: nextIdx }));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filtered.length > 0) {
          const prevIdx = Math.max(currentIdx - 1, 0);
          setSelectedIndices(prev => ({ ...prev, [index]: prevIdx }));
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
        setOpenDropdowns(prev => ({ ...prev, [index]: false }));
        break;
      case 'Delete':
      case 'Backspace':
        // Clear selected material (not delete row)
        e.preventDefault();
        if (setValue) {
          setValue(`items.${index}.meta_json.material_id`, '', { shouldDirty: true });
          setValue(`items.${index}.description`, '', { shouldDirty: true });
          setValue(`items.${index}.hsn_code`, '', { shouldDirty: true });
          setSearchTerms(prev => ({ ...prev, [index]: '' }));
        }
        break;
    }
  }, [getFilteredMaterials, selectedIndices, handleMaterialChange, setValue]);

  const handleMakeSelect = useCallback((index: number, make: string) => {
    setValue(`items.${index}.meta_json.make`, make, { shouldDirty: true });
    setSelectedMakes(prev => ({ ...prev, [index]: make }));
    setMakeDropdowns(prev => ({ ...prev, [index]: false }));
  }, [setValue]);

  const handleVariantSelect = useCallback((index: number, variant: string) => {
    setValue(`items.${index}.meta_json.variant`, variant, { shouldDirty: true });
    setSelectedVariants(prev => ({ ...prev, [index]: variant }));
    setVariantDropdowns(prev => ({ ...prev, [index]: false }));
  }, [setValue]);

  const getMaterialMakes = useCallback((materialId: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (!material || !material.variants) return [];
    const makes = [...new Set(material.variants.map(v => v.make || '').filter(Boolean))];
    return makes;
  }, [productOptions]);

  const getMaterialVariants = useCallback((materialId: string, make?: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (!material || !material.variants) return [];
    return material.variants.filter(v => !make || v.make === make);
  }, [productOptions]);

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

      // Close make dropdowns
      Object.keys(makeDropdownRefs.current).forEach(index => {
        const dropdown = makeDropdownRefs.current[Number(index)];
        const input = inputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setMakeDropdowns(prev => ({ ...prev, [Number(index)]: false }));
        }
      });

      // Close variant dropdowns
      Object.keys(variantDropdownRefs.current).forEach(index => {
        const dropdown = variantDropdownRefs.current[Number(index)];
        const input = inputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setVariantDropdowns(prev => ({ ...prev, [Number(index)]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdowns, makeDropdowns, variantDropdowns]);

  // Cleanup refs when fields are removed
  useEffect(() => {
    const currentFieldIds = new Set(fields.map(f => f.id));
    Object.keys(dropdownRefs.current).forEach(key => {
      const index = Number(key);
      if (index >= fields.length) {
        dropdownRefs.current[index] = null;
        inputRefs.current[index] = null;
      }
    });
    Object.keys(makeDropdownRefs.current).forEach(key => {
      const index = Number(key);
      if (index >= fields.length) {
        makeDropdownRefs.current[index] = null;
      }
    });
    Object.keys(variantDropdownRefs.current).forEach(key => {
      const index = Number(key);
      if (index >= fields.length) {
        variantDropdownRefs.current[index] = null;
      }
    });
  }, [fields.length]);

  // Position dropdown below input
  useEffect(() => {
    Object.keys(openDropdowns).forEach(index => {
      if (openDropdowns[Number(index)]) {
        const input = inputRefs.current[Number(index)];
        const dropdown = dropdownRefs.current[Number(index)];
        if (input && dropdown) {
          const rect = input.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + window.scrollY + 2}px`;
          dropdown.style.left = `${rect.left + window.scrollX}px`;
          dropdown.style.width = `${rect.width}px`;
        }
      }
    });

    Object.keys(makeDropdowns).forEach(index => {
      if (makeDropdowns[Number(index)]) {
        const input = inputRefs.current[Number(index)];
        const dropdown = makeDropdownRefs.current[Number(index)];
        if (input && dropdown) {
          const rect = input.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + 2}px`;
          dropdown.style.left = `${rect.left}px`;
          dropdown.style.width = `${rect.width}px`;
        }
      }
    });

    Object.keys(variantDropdowns).forEach(index => {
      if (variantDropdowns[Number(index)]) {
        const input = inputRefs.current[Number(index)];
        const dropdown = variantDropdownRefs.current[Number(index)];
        if (input && dropdown) {
          const rect = input.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + 2}px`;
          dropdown.style.left = `${rect.left}px`;
          dropdown.style.width = `${rect.width}px`;
        }
      }
    });
  }, [openDropdowns, makeDropdowns, variantDropdowns]);

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
            <tr style={{ background: '#fafafa', borderBottom: '2px solid #e5e5e5' }}>
              <th style={{ 
                padding: '6px 4px', 
                textAlign: 'center', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '32px'
              }} />
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
              {mode !== 'itemized' && (
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
                textAlign: 'left', 
                fontSize: '10px', 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: '#737373',
                width: '120px'
              }}>
                WAREHOUSE
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
                STOCK
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
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
                    <SortableRow key={field.id} id={field.id} index={index}>
                      <td style={{ padding: '4px', textAlign: 'center', cursor: 'grab' }}>
                        <GripVertical size={14} style={{ color: '#a3a3a3' }} />
                      </td>
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
                        onFocus={(e) => {
                          setOpenDropdowns({ ...openDropdowns, [index]: true });
                          e.currentTarget.style.borderColor = '#d4d4d4';
                        }}
                        onClick={() => handleInputClick(index)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                        placeholder=""
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid transparent',
                          borderRadius: '2px',
                          fontSize: '11px',
                          background: 'transparent',
                        }}
                      />
                      {openDropdowns[index] && (
                        <div
                          ref={(el) => { dropdownRefs.current[index] = el; }}
                          style={{
                            position: 'fixed',
                            background: 'white',
                            border: '1px solid #d4d4d4',
                            borderRadius: '4px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            zIndex: 9999,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            minWidth: '200px'
                          }}
                        >
                          {getFilteredMaterials(index).map((material, idx) => (
                            <div
                              key={material.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMaterialSelect(index, material.id);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                borderBottom: '1px solid #f3f4f6',
                                background: selectedIndices[index] === idx ? '#f5f5f5' : 'white'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              {material.name}
                            </div>
                          ))}
                          {getFilteredMaterials(index).length === 0 && (
                            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#737373' }}>
                              No materials found
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {mode !== 'itemized' && (
                    <td style={{ padding: '4px', position: 'relative' }}>
                      <input
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        value={getSelectedMaterialName(index)}
                        onChange={(e) => handleSearchChange(index, e.target.value)}
                        onFocus={(e) => {
                          setOpenDropdowns({ ...openDropdowns, [index]: true });
                          e.currentTarget.style.borderColor = '#d4d4d4';
                        }}
                        onClick={() => handleInputClick(index)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                        placeholder=""
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          border: '1px solid transparent',
                          borderRadius: '2px',
                          fontSize: '11px',
                          background: 'transparent',
                        }}
                      />
                      {openDropdowns[index] && (
                        <div
                          ref={(el) => { dropdownRefs.current[index] = el; }}
                          style={{
                            position: 'fixed',
                            background: 'white',
                            border: '1px solid #d4d4d4',
                            borderRadius: '4px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            zIndex: 9999,
                            maxHeight: '200px',
                            overflowY: 'auto',
                            minWidth: '200px'
                          }}
                        >
                          {getFilteredMaterials(index).map((material, idx) => (
                            <div
                              key={material.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMaterialSelect(index, material.id);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                borderBottom: '1px solid #f3f4f6',
                                background: selectedIndices[index] === idx ? '#f5f5f5' : 'white'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              {material.name}
                            </div>
                          ))}
                          {getFilteredMaterials(index).length === 0 && (
                            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#737373' }}>
                              No materials found
                            </div>
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
                        if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'itemized') {
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
                  <td style={{ padding: '4px', position: 'relative' }}>
                    <input
                      {...register(`items.${index}.meta_json.make` as const)}
                      placeholder="-"
                      onClick={() => {
                        const materialId = items[index]?.meta_json?.material_id as string | undefined;
                        if (materialId) {
                          setMakeDropdowns(prev => ({ ...prev, [index]: true }));
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#d4d4d4';
                        const materialId = items[index]?.meta_json?.material_id as string | undefined;
                        if (materialId) {
                          setMakeDropdowns(prev => ({ ...prev, [index]: true }));
                        }
                      }}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                    {makeDropdowns[index] && (
                      <div
                        ref={(el) => { makeDropdownRefs.current[index] = el; }}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'white',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          zIndex: 1000,
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}
                      >
                        {(() => {
                          const materialId = items[index]?.meta_json?.material_id as string | undefined;
                          const makes = materialId ? getMaterialMakes(materialId) : [];
                          return makes.map((make, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleMakeSelect(index, make)}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                borderBottom: '1px solid #f3f4f6'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              {make}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '4px', position: 'relative' }}>
                    <input
                      {...register(`items.${index}.meta_json.variant` as const)}
                      placeholder="-"
                      onClick={() => {
                        const materialId = items[index]?.meta_json?.material_id as string | undefined;
                        if (materialId) {
                          setVariantDropdowns(prev => ({ ...prev, [index]: true }));
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#d4d4d4';
                        const materialId = items[index]?.meta_json?.material_id as string | undefined;
                        if (materialId) {
                          setVariantDropdowns(prev => ({ ...prev, [index]: true }));
                        }
                      }}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                    {variantDropdowns[index] && (
                      <div
                        ref={(el) => { variantDropdownRefs.current[index] = el; }}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'white',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          zIndex: 1000,
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}
                      >
                        {(() => {
                          const materialId = items[index]?.meta_json?.material_id as string | undefined;
                          const selectedMake = selectedMakes[index] || items[index]?.meta_json?.make as string;
                          const variants = materialId ? getMaterialVariants(materialId, selectedMake) : [];
                          return variants.map((variant, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleVariantSelect(index, variant.variant_name || '')}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                borderBottom: '1px solid #f3f4f6'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                              {variant.variant_name || `${variant.make} - ${variant.sale_price}`}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '4px' }}>
                    {item.meta_json?.material_id ? (
                      <select
                        {...register(`items.${index}.meta_json.warehouse_id` as const)}
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
                      >
                        <option value="">Select warehouse</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.warehouse_name || wh.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#a3a3a3' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>
                    {(() => {
                      const materialId = item.meta_json?.material_id as string | undefined;
                      const warehouseId = item.meta_json?.warehouse_id as string | undefined;
                      const variantId = item.meta_json?.variant_id as string | undefined;
                      
                      if (!materialId || !warehouseId) {
                        return <span style={{ fontSize: '11px', color: '#a3a3a3' }}>-</span>;
                      }
                      
                      const stockRow = stockRows.find(s => 
                        s.item_id === materialId && 
                        s.warehouse_id === warehouseId && 
                        (variantId ? s.company_variant_id === variantId : s.company_variant_id === null)
                      );
                      
                      const stock = stockRow?.current_stock || 0;
                      const hasStock = stock > 0;
                      
                      return (
                        <span style={{ 
                          fontSize: '11px', 
                          color: hasStock ? '#171717' : '#dc2626',
                          fontWeight: hasStock ? 'normal' : 600
                        }}>
                          {stock}
                        </span>
                      );
                    })()}
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
                      {...register(`items.${index}.discount_percent` as const, {
                        onChange: () => {
                          const baseRate = Number(items[index]?.meta_json?.base_rate || items[index]?.rate || 0);
                          const discountPercent = Number(items[index]?.discount_percent || 0);
                          const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
                          const roundedRate = roundOffEnabled ? Math.round(rateAfterDiscount) : rateAfterDiscount;
                          if (setValue) {
                            setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
                            setValue(`items.${index}.meta_json.rate_after_discount`, roundedRate, { shouldDirty: true });
                          }
                        }
                      })}
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
                      step={roundOffEnabled ? "1" : "0.01"}
                      {...register(`items.${index}.rate`, { 
                        valueAsNumber: true,
                        onChange: (e) => {
                          // Prevent focus handling during PO item application
                          if (isApplyingPOItems) {
                            return;
                          }
                          
                          // Debug: Log rate changes
                          console.log(`Rate ${index} changed:`, e.target.value);
                          
                          // Recalculate amount when rate changes
                          const qty = Number(items[index]?.qty || 0);
                          const rate = Number(e.target.value || 0);
                          const discountPercent = Number(items[index]?.discount_percent || 0);
                          const rateAfterDiscount = rate - (rate * discountPercent / 100);
                          const amount = round2(qty * rateAfterDiscount);
                          if (setValue) {
                            setValue(`items.${index}.amount`, amount, { shouldDirty: true });
                          }
                        },
                        onBlur: (e) => {
                          // Debug: Log rate on blur
                          console.log(`Rate ${index} blurred:`, e.target.value);
                          
                          // Ensure rate is not negative on blur
                          const rate = Number(e.target.value || 0);
                          if (rate < 0 && setValue) {
                            setValue(`items.${index}.rate`, 0, { shouldDirty: true });
                          }
                        }
                      })}
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
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                        // Additional blur handling
                        const rate = Number(e.target.value || 0);
                        if (rate < 0 && setValue) {
                          setValue(`items.${index}.rate`, 0, { shouldDirty: true });
                        }
                      }}
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
                  <td style={{ 
                    padding: '4px 6px',
                    textAlign: 'right',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#171717',
                    background: '#f5f5f5',
                    borderRadius: '2px'
                  }}>
                    {formatCurrency(amount)}
                  </td>
                  <td style={{ padding: '4px' }}>
                    {mode !== 'lot' && fields.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          border: 'none',
                          background: 'transparent',
                          color: '#dc2626',
                          cursor: 'pointer',
                          borderRadius: '2px',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </td>
                </SortableRow>
              );
            })}
              </tbody>
            </SortableContext>
          </DndContext>
          <tfoot>
            <tr style={{ background: '#fafafa', borderTop: '1px solid #e5e5e5' }}>
              <td colSpan={5} style={{ padding: '8px 4px', fontWeight: 600, fontSize: '11px', color: '#171717' }}>
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