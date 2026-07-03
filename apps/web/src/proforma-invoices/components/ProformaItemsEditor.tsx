import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Plus, X, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import type { ProformaMaterialOption } from '../ui-utils';
import { createEmptyProformaItem, formatCurrency, round2 } from '../ui-utils';
import { useAuth } from '../../App';
import { supabase } from '../../supabase';

type ProformaItemsEditorProps = {
  fields: FieldArrayWithId<any, 'items', 'id'>[];
  items: any[];
  register: UseFormRegister<any>;
  append: UseFieldArrayAppend<any, 'items'>;
  remove: UseFieldArrayRemove;
  move: (from: number, to: number) => void;
  error?: string;
  productOptions?: ProformaMaterialOption[];
  setValue?: UseFormSetValue<any>;
  formState?: any;
  templateSettings?: any;
  discountSettings?: Record<string, { default: number; min: number; max: number }>;
  headerDiscounts?: Record<string, number>;
  onHeaderDiscountChange?: (variantId: string, value: number) => void;
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

export function ProformaItemsEditor({
  fields,
  items,
  register,
  append,
  remove,
  move,
  error,
  productOptions = [],
  setValue,
  formState,
  templateSettings,
  discountSettings,
  headerDiscounts,
  onHeaderDiscountChange,
}: ProformaItemsEditorProps) {
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

  const handleMaterialSelect = useCallback(async (index: number, materialId: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (material) {
      setValue(`items.${index}.item_id`, materialId, { shouldDirty: true });
      setValue(`items.${index}.description`, material.name || '', { shouldDirty: true });
      setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
      const firstVariant = material.variants && material.variants.length > 0 ? material.variants[0].variant_name || '' : '';
      setValue(`items.${index}.variant`, firstVariant, { shouldDirty: true });
      setValue(`items.${index}.unit`, material.unit || '', { shouldDirty: true });
      
      // Fetch variant pricing from item_variant_pricing if variant and make are available
      const selectedMake = selectedMakes[index] || '';
      const selectedVariant = selectedVariants[index] || firstVariant;
      
      let baseRate = material.sale_price;
      
      if (selectedMake && selectedVariant && organisation?.id) {
        try {
          const { data: variantPricing } = await supabase
            .from('item_variant_pricing')
            .select('sale_price')
            .eq('item_id', materialId)
            .eq('make', selectedMake)
            .eq('company_variant_id', selectedVariant)
            .single();
          
          if (variantPricing?.sale_price) {
            baseRate = variantPricing.sale_price;
          }
        } catch (err) {
          console.error('Error fetching variant pricing:', err);
        }
      }
      
      if (baseRate) {
        // Set base_rate
        setValue(`items.${index}.meta_json.base_rate`, baseRate, { shouldDirty: true });
        
        // Auto-calculate rate after discount and set to Rate/Unit field
        const discountPercent = Number(items[index]?.discount_percent || 0);
        const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
        const roundedRate = roundOffEnabled ? Math.round(rateAfterDiscount) : rateAfterDiscount;
        
        // Set the calculated rate to Rate/Unit field (this is what gets saved)
        setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
        // Store the rate after discount in meta for reference
        setValue(`items.${index}.meta_json.rate_after_discount`, roundedRate, { shouldDirty: true });
      }
    }
    setOpenDropdowns(prev => ({ ...prev, [index]: false }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, [productOptions, setValue, items, roundOffEnabled, selectedMakes, selectedVariants, organisation?.id]);

  const handleSearchChange = useCallback((index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    setOpenDropdowns(prev => ({ ...prev, [index]: true }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, []);

  const handleMaterialChange = useCallback(async (index: number, materialId: string) => {
    const material = productOptions.find(m => m.id === materialId);
    if (material) {
      setValue(`items.${index}.item_id`, materialId, { shouldDirty: true });
      setValue(`items.${index}.description`, material.name || '', { shouldDirty: true });
      setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
      const firstVariant = material.variants && material.variants.length > 0 ? material.variants[0].variant_name || '' : '';
      setValue(`items.${index}.variant`, firstVariant, { shouldDirty: true });
      setValue(`items.${index}.unit`, material.unit || '', { shouldDirty: true });
      
      // Fetch variant pricing from item_variant_pricing if variant and make are available
      const selectedMake = selectedMakes[index] || '';
      const selectedVariant = selectedVariants[index] || firstVariant;
      
      let baseRate = material.sale_price;
      
      if (selectedMake && selectedVariant && organisation?.id) {
        try {
          const { data: variantPricing } = await supabase
            .from('item_variant_pricing')
            .select('sale_price')
            .eq('item_id', materialId)
            .eq('make', selectedMake)
            .eq('company_variant_id', selectedVariant)
            .single();
          
          if (variantPricing?.sale_price) {
            baseRate = variantPricing.sale_price;
          }
        } catch (err) {
          console.error('Error fetching variant pricing:', err);
        }
      }
      
      if (baseRate) {
        // Set base_rate
        setValue(`items.${index}.meta_json.base_rate`, baseRate, { shouldDirty: true });
        
        // Auto-calculate rate after discount and set to Rate/Unit field
        const discountPercent = Number(items[index]?.discount_percent || 0);
        const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
        const roundedRate = roundOffEnabled ? Math.round(rateAfterDiscount) : rateAfterDiscount;
        
        // Set the calculated rate to Rate/Unit field (this is what gets saved)
        setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
        // Store the rate after discount in meta for reference
        setValue(`items.${index}.meta_json.rate_after_discount`, roundedRate, { shouldDirty: true });
      }
    }
    setOpenDropdowns(prev => ({ ...prev, [index]: false }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, [productOptions, setValue, items, roundOffEnabled, selectedMakes, selectedVariants, organisation?.id]);

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
    const materialId = items[index]?.item_id as string | undefined;
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
          setValue(`items.${index}.item_id`, '', { shouldDirty: true });
          setValue(`items.${index}.description`, '', { shouldDirty: true });
          setValue(`items.${index}.hsn_code`, '', { shouldDirty: true });
          setSearchTerms(prev => ({ ...prev, [index]: '' }));
        }
        break;
    }
  }, [getFilteredMaterials, selectedIndices, handleMaterialChange, setValue]);

  const handleMakeSelect = useCallback((index: number, make: string) => {
    setValue(`items.${index}.make`, make, { shouldDirty: true });
    setSelectedMakes(prev => ({ ...prev, [index]: make }));
    setMakeDropdowns(prev => ({ ...prev, [index]: false }));
  }, [setValue]);

  const handleVariantSelect = useCallback((index: number, variant: string) => {
    setValue(`items.${index}.variant`, variant, { shouldDirty: true });
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
        <button
          type="button"
          onClick={() => append(createEmptyProformaItem())}
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
                  const item = items[index] ?? createEmptyProformaItem();
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
                          {...register(`items.${index}.make`)}
                          placeholder="Make"
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
                          {...register(`items.${index}.variant`)}
                          placeholder="Variant"
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
                          {...register(`items.${index}.qty`)}
                          type="number"
                          step="0.001"
                          placeholder="1"
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid transparent',
                            borderRadius: '2px',
                            fontSize: '11px',
                            background: 'transparent',
                            textAlign: 'right'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                          onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                        />
                      </td>
                      <td style={{ padding: '4px' }}>
                        <input
                          {...register(`items.${index}.unit`)}
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
                          {...register(`items.${index}.rate`)}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid transparent',
                            borderRadius: '2px',
                            fontSize: '11px',
                            background: 'transparent',
                            textAlign: 'right'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                          onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                        />
                      </td>
                      <td style={{ padding: '4px' }}>
                        <input
                          {...register(`items.${index}.discount_percent`)}
                          type="number"
                          step="0.01"
                          placeholder="0"
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid transparent',
                            borderRadius: '2px',
                            fontSize: '11px',
                            background: 'transparent',
                            textAlign: 'right'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                          onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                        />
                      </td>
                      <td style={{ padding: '4px', textAlign: 'right', color: '#737373' }}>
                        {formatCurrency(rateAfterDiscount)}
                      </td>
                      <td style={{ padding: '4px' }}>
                        <input
                          {...register(`items.${index}.tax_percent`)}
                          type="number"
                          step="0.01"
                          placeholder="18"
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            border: '1px solid transparent',
                            borderRadius: '2px',
                            fontSize: '11px',
                            background: 'transparent',
                            textAlign: 'right'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                          onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                        />
                      </td>
                      <td style={{ padding: '4px', textAlign: 'right', fontWeight: 600, color: '#171717' }}>
                        {formatCurrency(amount)}
                      </td>
                      <td style={{ padding: '4px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '2px',
                            color: '#a3a3a3',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#991b1b';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#a3a3a3';
                          }}
                        >
                          <X size={12} />
                        </button>
                      </td>
                    </SortableRow>
                  );
                })}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
      {error && (
        <div style={{ padding: '8px 12px', color: '#dc2626', fontSize: '11px', background: '#fef2f2' }}>
          {error}
        </div>
      )}
    </div>
  );
}
