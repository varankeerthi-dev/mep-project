import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { calculateItemTotals, detectInterState } from '../logic';
import type { CNItemTotals } from '../logic';
import { InlineDescriptionCell } from '../../components/InlineDescriptionCell';

type CNItemForm = {
  id?: string;
  description: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  discount_amount: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  meta_json?: {
    material_id?: string;
    variant?: string;
    variant_id?: string;
    make?: string;
    unit?: string;
    warehouse_id?: string;
  };
};

type CNEditorFormValues = {
  client_id: string;
  invoice_id: string;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  authorized_signatory_id: string;
  default_warehouse_id: string;
  items: CNItemForm[];
};

type CNItemsEditorProps = {
  fields: FieldArrayWithId<CNEditorFormValues, 'items', 'id'>[];
  items: CNEditorFormValues['items'];
  register: UseFormRegister<CNEditorFormValues>;
  append: UseFieldArrayAppend<CNEditorFormValues, 'items'>;
  remove: UseFieldArrayRemove;
  setValue: UseFormSetValue<CNEditorFormValues>;
  watch: UseFormWatch<CNEditorFormValues>;
  companyState: string | null;
  clientState: string | null;
  roundOffEnabled?: boolean;
  error?: string;
  warehouses?: Array<{ id: string; warehouse_name?: string | null; name?: string | null }>;
  stockRows?: Array<{ item_id: string; warehouse_id: string; company_variant_id: string | null; current_stock: number }>;
  defaultWarehouseId?: string;
};

function createEmptyCNItem(): CNItemForm {
  return {
    description: '',
    hsn_code: '',
    quantity: 1,
    rate: 0,
    discount_amount: 0,
    cgst_percent: 9,
    sgst_percent: 9,
    igst_percent: 18,
    taxable_value: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    total_amount: 0,
    meta_json: {},
  };
}

export function CNItemsEditor({
  fields,
  items,
  register,
  append,
  remove,
  setValue,
  watch,
  companyState,
  clientState,
  roundOffEnabled = false,
  error,
  warehouses = [],
  stockRows = [],
  defaultWarehouseId,
}: CNItemsEditorProps) {
  const { organisation } = useAuth();
  const isInterState = detectInterState(companyState, clientState);

  const [materialOptions, setMaterialOptions] = useState<Array<{
    id: string;
    name: string;
    display_name: string;
    hsn_code: string | null;
    unit: string | null;
    sale_price: number | null;
    make: string | null;
    variants: Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>;
  }>>([]);

  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [editingInputs, setEditingInputs] = useState<Record<number, boolean>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({});
  const [selectedIndices, setSelectedIndices] = useState<Record<number, number>>({});
  const [variantDropdowns, setVariantDropdowns] = useState<Record<number, boolean>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const variantInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const variantDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!organisation?.id) return;

    Promise.all([
      supabase.from('materials').select('id, name, display_name, hsn_code, unit, sale_price, make').eq('organisation_id', organisation.id).order('name'),
      supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make'),
      supabase.from('company_variants').select('id, variant_name').eq('organisation_id', organisation.id).eq('is_active', true),
    ]).then(([materialsRes, pricingRes, variantsRes]) => {
      if (!materialsRes.data) return;

      const variantNames = new Map<string, string>();
      variantsRes.data?.forEach(v => variantNames.set(String(v.id), String(v.variant_name)));

      const pricingByMaterial = new Map<string, Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>>();
      pricingRes.data?.forEach(p => {
        const matId = String(p.item_id);
        const vid = String(p.company_variant_id);
        const vname = variantNames.get(vid) ?? vid;
        const list = pricingByMaterial.get(matId) ?? [];
        list.push({ variant_id: vid, variant_name: vname, make: p.make ?? null, sale_price: p.sale_price ?? null });
        pricingByMaterial.set(matId, list);
      });

      setMaterialOptions(materialsRes.data.map(m => ({
        id: String(m.id),
        name: String(m.name ?? ''),
        display_name: String(m.display_name ?? m.name ?? ''),
        hsn_code: m.hsn_code ?? null,
        unit: m.unit ?? null,
        sale_price: m.sale_price ?? null,
        make: m.make ?? null,
        variants: pricingByMaterial.get(String(m.id)) ?? [],
      })));
    });
  }, [organisation?.id]);

  const getRateForMaterial = useCallback((materialId: string, variantId?: string | null, make?: string | null) => {
    const material = materialOptions.find(m => m.id === materialId);
    if (!material) return 0;

    if (material.variants.length > 0) {
      const exactMatch = material.variants.find(v => v.variant_id === variantId && (v.make ?? '') === (make ?? ''));
      if (exactMatch?.sale_price != null) return exactMatch.sale_price;

      if (variantId) {
        const variantMatch = material.variants.find(v => v.variant_id === variantId);
        if (variantMatch?.sale_price != null) return variantMatch.sale_price;
      }

      if (make) {
        const makeMatch = material.variants.find(v => (v.make ?? '') === make);
        if (makeMatch?.sale_price != null) return makeMatch.sale_price;
      }
    }

    return material.sale_price ?? 0;
  }, [materialOptions]);

  const getMaterialVariants = useCallback((materialId: string) => {
    const material = materialOptions.find(m => m.id === materialId);
    return material?.variants ?? [];
  }, [materialOptions]);

  const recalcItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;

      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const discountAmount = Number(item.discount_amount) || 0;
      const cgstPercent = Number(item.cgst_percent) || 0;
      const sgstPercent = Number(item.sgst_percent) || 0;
      const igstPercent = Number(item.igst_percent) || 0;

      const totals: CNItemTotals = calculateItemTotals(
        quantity, rate, discountAmount, cgstPercent, sgstPercent, igstPercent, isInterState
      );

      setValue(`items.${index}.taxable_value`, totals.taxable_value, { shouldDirty: true });
      setValue(`items.${index}.cgst_amount`, totals.cgst_amount, { shouldDirty: true });
      setValue(`items.${index}.sgst_amount`, totals.sgst_amount, { shouldDirty: true });
      setValue(`items.${index}.igst_amount`, totals.igst_amount, { shouldDirty: true });
      setValue(`items.${index}.total_amount`, totals.total_amount, { shouldDirty: true });
    },
    [items, setValue, isInterState]
  );

  const watchedItems = watch('items');

  useEffect(() => {
    let taxableAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let grandTotal = 0;

    for (const item of watchedItems ?? []) {
      taxableAmount += Number(item.taxable_value) || 0;
      cgstTotal += Number(item.cgst_amount) || 0;
      sgstTotal += Number(item.sgst_amount) || 0;
      igstTotal += Number(item.igst_amount) || 0;
      grandTotal += Number(item.total_amount) || 0;
    }

    setValue('taxable_amount', Math.round(taxableAmount * 100) / 100, { shouldDirty: true });
    setValue('cgst_amount', Math.round(cgstTotal * 100) / 100, { shouldDirty: true });
    setValue('sgst_amount', Math.round(sgstTotal * 100) / 100, { shouldDirty: true });
    setValue('igst_amount', Math.round(igstTotal * 100) / 100, { shouldDirty: true });
    setValue('total_amount', Math.round(grandTotal * 100) / 100, { shouldDirty: true });
  }, [watchedItems, setValue]);

  const handleMaterialSelect = useCallback((index: number, materialId: string) => {
    const material = materialOptions.find(m => m.id === materialId);
    if (!material) return;

    const variants = material.variants;
    const firstVariant = variants.length > 0 ? variants[0] : null;
    const baseRate = firstVariant?.sale_price ?? material.sale_price ?? 0;
    const roundedRate = roundOffEnabled ? Math.round(baseRate) : baseRate;

    setValue(`items.${index}.meta_json.material_id`, materialId, { shouldDirty: true });
    setValue(`items.${index}.description`, material.display_name || material.name, { shouldDirty: true });
    setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.make`, firstVariant?.make ?? material.make ?? '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.unit`, material.unit || '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.variant`, firstVariant?.variant_name ?? '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.variant_id`, firstVariant?.variant_id ?? undefined, { shouldDirty: true });
    setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });

    const currentWarehouse = items[index]?.meta_json?.warehouse_id as string | undefined;
    if (!currentWarehouse && defaultWarehouseId) {
      setValue(`items.${index}.meta_json.warehouse_id`, defaultWarehouseId, { shouldDirty: true });
    }

    setTimeout(() => recalcItem(index), 0);
    setOpenDropdowns(prev => ({ ...prev, [index]: false }));
    setEditingInputs(prev => ({ ...prev, [index]: false }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, [materialOptions, setValue, roundOffEnabled, recalcItem, items, defaultWarehouseId]);

  const handleVariantSelect = useCallback((index: number, variant: { variant_id: string; variant_name: string; make: string | null; sale_price: number | null }) => {
    const materialId = items[index]?.meta_json?.material_id as string | undefined;
    if (!materialId) return;

    const baseRate = variant.sale_price ?? 0;
    const roundedRate = roundOffEnabled ? Math.round(baseRate) : baseRate;

    setValue(`items.${index}.meta_json.variant`, variant.variant_name, { shouldDirty: true });
    setValue(`items.${index}.meta_json.variant_id`, variant.variant_id, { shouldDirty: true });
    if (variant.make) setValue(`items.${index}.meta_json.make`, variant.make, { shouldDirty: true });
    setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });

    setTimeout(() => recalcItem(index), 0);
    setVariantDropdowns(prev => ({ ...prev, [index]: false }));
  }, [setValue, items, roundOffEnabled, recalcItem]);

  const handleSearchChange = useCallback((index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    setEditingInputs(prev => ({ ...prev, [index]: true }));
    setOpenDropdowns(prev => ({ ...prev, [index]: true }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, []);

  const getFilteredMaterials = useCallback((index: number) => {
    const searchTerm = searchTerms[index] || '';
    if (!searchTerm) return materialOptions;
    return materialOptions.filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.make && m.make.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerms, materialOptions]);

  const getSelectedMaterialName = useCallback((index: number) => {
    if (editingInputs[index]) {
      return searchTerms[index] || '';
    }
    const materialId = items[index]?.meta_json?.material_id as string | undefined;
    if (materialId) {
      const material = materialOptions.find(m => m.id === materialId);
      return material?.display_name || material?.name || '';
    }
    return searchTerms[index] || '';
  }, [items, materialOptions, searchTerms, editingInputs]);

  const handleKeyDown = useCallback((index: number, e: KeyboardEvent<HTMLInputElement>) => {
    const filtered = getFilteredMaterials(index);
    const currentIdx = selectedIndices[index] || 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (filtered.length > 0) setSelectedIndices(prev => ({ ...prev, [index]: Math.min(currentIdx + 1, filtered.length - 1) }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (filtered.length > 0) setSelectedIndices(prev => ({ ...prev, [index]: Math.max(currentIdx - 1, 0) }));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered.length > 0 && filtered[currentIdx]) handleMaterialSelect(index, filtered[currentIdx].id);
        break;
      case 'Escape':
        e.preventDefault();
        setOpenDropdowns(prev => ({ ...prev, [index]: false }));
        break;
    }
  }, [getFilteredMaterials, selectedIndices, handleMaterialSelect]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      Object.keys(dropdownRefs.current).forEach(index => {
        const dropdown = dropdownRefs.current[Number(index)];
        const input = inputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setOpenDropdowns(prev => ({ ...prev, [Number(index)]: false }));
        }
      });
      Object.keys(variantDropdownRefs.current).forEach(index => {
        const dropdown = variantDropdownRefs.current[Number(index)];
        const input = variantInputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setVariantDropdowns(prev => ({ ...prev, [Number(index)]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    Object.keys(variantDropdowns).forEach(index => {
      if (variantDropdowns[Number(index)]) {
        const input = variantInputRefs.current[Number(index)];
        const dropdown = variantDropdownRefs.current[Number(index)];
        if (input && dropdown) {
          const rect = input.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + window.scrollY + 2}px`;
          dropdown.style.left = `${rect.left + window.scrollX}px`;
          dropdown.style.width = `${Math.max(rect.width, 120)}px`;
        }
      }
    });
  }, [openDropdowns, variantDropdowns]);

  return (
    <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #d4d4d4' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#171717' }}>Line Items</span>
        <button type="button" onClick={() => append(createEmptyCNItem())} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid #d4d4d4', borderRadius: '4px', background: '#fff', fontSize: '11px', fontWeight: 600, color: '#525252', cursor: 'pointer' }}>
          <Plus size={12} /> Add
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', fontSize: '12px', borderBottom: '1px solid #fee2e2' }}>{error}</div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '2px solid #e5e5e5' }}>
              <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '40px' }}>#</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', minWidth: '180px' }}>MATERIAL</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>HSN</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>MAKE</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '90px' }}>VARIANT</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '120px' }}>WAREHOUSE</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '50px' }}>STOCK</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>RATE</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '50px' }}>QTY</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '60px' }}>DISC</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '60px' }}>GST%</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>TAXABLE</th>
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>{isInterState ? 'IGST' : 'CGST'}</th>
              {!isInterState && <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>SGST</th>}
              <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>TOTAL</th>
              <th style={{ padding: '6px 4px', width: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = items[index] ?? createEmptyCNItem();
              const materialId = item.meta_json?.material_id as string | undefined;
              const material = materialId ? materialOptions.find(m => m.id === materialId) : null;
              const variants = getMaterialVariants(materialId);

              return (
                <tr key={field.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#737373' }}>{index + 1}</span>
                  </td>
                  <td style={{ padding: '4px', position: 'relative' }}>
                    <input
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      value={getSelectedMaterialName(index)}
                      onChange={(e) => handleSearchChange(index, e.target.value)}
                      onFocus={() => {
                        const matId = items[index]?.meta_json?.material_id as string | undefined;
                        if (matId) {
                          const mat = materialOptions.find(m => m.id === matId);
                          setSearchTerms(prev => ({ ...prev, [index]: mat?.display_name || mat?.name || '' }));
                        }
                        setEditingInputs(prev => ({ ...prev, [index]: true }));
                        setOpenDropdowns(prev => ({ ...prev, [index]: true }));
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          const matId = items[index]?.meta_json?.material_id as string | undefined;
                          if (matId) {
                            setEditingInputs(prev => ({ ...prev, [index]: false }));
                            setSearchTerms(prev => ({ ...prev, [index]: '' }));
                          }
                        }, 150);
                      }}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      placeholder="Search material..."
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent' }}
                    />
                    {openDropdowns[index] && (
                      <div ref={(el) => { dropdownRefs.current[index] = el; }} style={{ position: 'fixed', background: 'white', border: '1px solid #d4d4d4', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', minWidth: '200px' }}>
                        {getFilteredMaterials(index).map((m, idx) => (
                          <div key={m.id} onClick={() => handleMaterialSelect(index, m.id)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6', background: selectedIndices[index] === idx ? '#f5f5f5' : 'white' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                            <div style={{ fontWeight: 500 }}>{m.display_name || m.name}</div>
                            {(m.make || m.sale_price) && (
                              <div style={{ fontSize: '10px', color: '#737373', marginTop: '2px' }}>
                                {m.make && <span>{m.make}</span>}
                                {m.make && m.sale_price && <span> · </span>}
                                {m.sale_price && <span>₹{m.sale_price}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                        {getFilteredMaterials(index).length === 0 && <div style={{ padding: '8px 12px', fontSize: '11px', color: '#737373' }}>No materials found</div>}
                      </div>
                    )}
                    <InlineDescriptionCell
                      materialName=""
                      description={item.description}
                      onSave={(desc) => setValue(`items.${index}.description`, desc, { shouldDirty: true })}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input {...register(`items.${index}.hsn_code`)} placeholder="HSN" style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', textAlign: 'left' }} />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={(item.meta_json?.make as string) || ''}
                      readOnly
                      placeholder="-"
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', opacity: material ? 1 : 0.5 }}
                    />
                  </td>
                  <td style={{ padding: '4px', position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        ref={(el) => { variantInputRefs.current[index] = el; }}
                        type="text"
                        value={(item.meta_json?.variant as string) || ''}
                        readOnly={!materialId || variants.length === 0}
                        onClick={() => {
                          if (materialId && variants.length > 0) {
                            setVariantDropdowns(prev => ({ ...prev, [index]: !prev[index] }));
                          }
                        }}
                        placeholder={materialId && variants.length > 0 ? 'Select variant' : '-'}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', cursor: materialId && variants.length > 0 ? 'pointer' : 'default', opacity: materialId ? 1 : 0.5, paddingRight: materialId && variants.length > 0 ? '18px' : '6px' }}
                      />
                      {materialId && variants.length > 0 && (
                        <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#a3a3a3' }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                    {variantDropdowns[index] && materialId && variants.length > 0 && (
                      <div ref={(el) => { variantDropdownRefs.current[index] = el; }} style={{ position: 'fixed', background: 'white', border: '1px solid #d4d4d4', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', minWidth: '120px' }}>
                        {variants.map((v, i) => (
                          <div key={v.variant_id} onClick={() => handleVariantSelect(index, v)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6', background: 'white' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                            <div style={{ fontWeight: 500 }}>{v.variant_name}</div>
                            {v.sale_price != null && <div style={{ fontSize: '10px', color: '#737373' }}>₹{v.sale_price}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '4px' }}>
                    {item.meta_json?.material_id ? (
                      <select
                        {...register(`items.${index}.meta_json.warehouse_id` as any)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent' }}
                      >
                        <option value="">Select</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name || 'Warehouse'}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#a3a3a3' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>
                    {(() => {
                      const matId = item.meta_json?.material_id as string | undefined;
                      const whId = item.meta_json?.warehouse_id as string | undefined;
                      const varId = item.meta_json?.variant_id as string | undefined;
                      if (!matId || !whId) return <span style={{ fontSize: '11px', color: '#a3a3a3' }}>-</span>;
                      const stockRow = stockRows.find(s =>
                        s.item_id === matId &&
                        s.warehouse_id === whId &&
                        (varId ? s.company_variant_id === varId : s.company_variant_id === null)
                      );
                      const stock = stockRow?.current_stock || 0;
                      return <span style={{ fontSize: '11px', fontWeight: 600, color: stock > 0 ? '#171717' : '#dc2626' }}>{stock}</span>;
                    })()}
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.rate`)}
                      onChange={(e) => { register(`items.${index}.rate`).onChange(e); setTimeout(() => recalcItem(index), 0); }}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.quantity`)}
                      onChange={(e) => { register(`items.${index}.quantity`).onChange(e); setTimeout(() => recalcItem(index), 0); }}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.discount_amount`)}
                      onChange={(e) => { register(`items.${index}.discount_amount`).onChange(e); setTimeout(() => recalcItem(index), 0); }}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.${isInterState ? 'igst_percent' : 'cgst_percent'}`)}
                      onChange={(e) => { register(`items.${index}.${isInterState ? 'igst_percent' : 'cgst_percent'}`).onChange(e); setTimeout(() => recalcItem(index), 0); }}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '4px', textAlign: 'right', fontSize: '11px', color: '#525252' }}>{Number(item.taxable_value).toFixed(2)}</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontSize: '11px', color: '#525252' }}>
                    {isInterState ? Number(item.igst_amount).toFixed(2) : Number(item.cgst_amount).toFixed(2)}
                  </td>
                  {!isInterState && <td style={{ padding: '4px', textAlign: 'right', fontSize: '11px', color: '#525252' }}>{Number(item.sgst_amount).toFixed(2)}</td>}
                  <td style={{ padding: '4px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: '#171717' }}>{Number(item.total_amount).toFixed(2)}</td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <button type="button" onClick={() => remove(index)} disabled={fields.length <= 1} style={{ border: 'none', background: 'transparent', cursor: fields.length <= 1 ? 'not-allowed' : 'pointer', color: fields.length <= 1 ? '#d4d4d4' : '#dc2626', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
