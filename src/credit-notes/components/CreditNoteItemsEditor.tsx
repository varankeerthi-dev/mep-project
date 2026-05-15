import { useState, useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { calculateItemTotals, detectInterState } from '../logic';
import type { CNItemTotals } from '../logic';

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
    base_rate?: number;
    unit?: string;
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
    variants: Array<{ variant_id?: string | null; variant_name: string | null; make: string | null; sale_price: number | null }>;
  }>>([]);

  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({});
  const [selectedIndices, setSelectedIndices] = useState<Record<number, number>>({});
  const [makeDropdowns, setMakeDropdowns] = useState<Record<number, boolean>>({});
  const [variantDropdowns, setVariantDropdowns] = useState<Record<number, boolean>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const dropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const makeInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const makeDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const variantInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const variantDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!organisation?.id) return;
    supabase
      .from('materials')
      .select('id, name, display_name, hsn_code, unit, sale_price, make, variants')
      .eq('organisation_id', organisation.id)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setMaterialOptions(data.map(m => ({
            id: String(m.id),
            name: String(m.name ?? ''),
            display_name: String(m.display_name ?? m.name ?? ''),
            hsn_code: m.hsn_code ?? null,
            unit: m.unit ?? null,
            sale_price: m.sale_price ?? null,
            make: m.make ?? null,
            variants: (m.variants as any[]) ?? [],
          })));
        }
      });
  }, [organisation?.id]);

  const getRateForMaterial = useCallback((materialId: string, variantId?: string | null, make?: string | null) => {
    const material = materialOptions.find(m => m.id === materialId);
    if (!material) return 0;

    const targetVariantId = variantId || null;
    const targetMake = (make || '').trim();

    if (material.variants && material.variants.length > 0) {
      const exactMatch = material.variants.find(v =>
        (v.variant_id || null) === targetVariantId && (v.make || '').trim() === targetMake
      );
      if (exactMatch?.sale_price) return exactMatch.sale_price;

      if (targetVariantId) {
        const variantMatch = material.variants.find(v => (v.variant_id || null) === targetVariantId);
        if (variantMatch?.sale_price) return variantMatch.sale_price;
      }

      if (targetMake) {
        const makeMatch = material.variants.find(v => (v.make || '').trim() === targetMake);
        if (makeMatch?.sale_price) return makeMatch.sale_price;
      }
    }

    return material.sale_price ?? 0;
  }, [materialOptions]);

  const getMaterialMakes = useCallback((materialId: string) => {
    const material = materialOptions.find(m => m.id === materialId);
    if (!material) return [];
    const makesSet = new Set<string>();
    if (material.make && material.make.trim()) makesSet.add(material.make.trim());
    (material.variants || []).forEach(v => {
      if (v.make && v.make.trim()) makesSet.add(v.make.trim());
    });
    return Array.from(makesSet).sort();
  }, [materialOptions]);

  const getMaterialVariants = useCallback((materialId: string) => {
    const material = materialOptions.find(m => m.id === materialId);
    return material?.variants || [];
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

    const allVariants = getMaterialVariants(materialId);
    const allMakes = getMaterialMakes(materialId);
    const firstVariant = allVariants.length > 0 ? allVariants[0] : null;
    const firstMake = allMakes.length > 0 ? allMakes[0] : (material.make || '');

    const baseRate = getRateForMaterial(materialId, firstVariant?.variant_id, firstVariant?.make || firstMake);
    const discountPercent = Number(items[index]?.discount_amount) || 0;
    const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
    const roundedRate = roundOffEnabled ? Math.round(rateAfterDiscount) : rateAfterDiscount;

    setValue(`items.${index}.meta_json.material_id`, materialId, { shouldDirty: true });
    setValue(`items.${index}.description`, material.display_name || material.name, { shouldDirty: true });
    setValue(`items.${index}.hsn_code`, material.hsn_code || '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.variant`, firstVariant?.variant_name || '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.variant_id`, firstVariant?.variant_id || undefined, { shouldDirty: true });
    setValue(`items.${index}.meta_json.make`, firstVariant?.make || firstMake, { shouldDirty: true });
    setValue(`items.${index}.meta_json.unit`, material.unit || '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.base_rate`, baseRate, { shouldDirty: true });
    setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });

    const qty = Number(items[index]?.quantity) || 0;
    const amount = Math.round(qty * roundedRate * 100) / 100;
    setValue(`items.${index}.total_amount`, amount, { shouldDirty: true });

    setTimeout(() => recalcItem(index), 0);
    setOpenDropdowns(prev => ({ ...prev, [index]: false }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, [materialOptions, setValue, items, roundOffEnabled, getMaterialVariants, getMaterialMakes, getRateForMaterial, recalcItem]);

  const handleSearchChange = useCallback((index: number, value: string) => {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
    setOpenDropdowns(prev => ({ ...prev, [index]: true }));
    setSelectedIndices(prev => ({ ...prev, [index]: 0 }));
  }, []);

  const getFilteredMaterials = useCallback((index: number) => {
    const searchTerm = searchTerms[index] || '';
    if (!searchTerm) return materialOptions;
    return materialOptions.filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerms, materialOptions]);

  const getSelectedMaterialName = useCallback((index: number) => {
    const materialId = items[index]?.meta_json?.material_id as string | undefined;
    if (materialId) {
      const material = materialOptions.find(m => m.id === materialId);
      return material?.display_name || material?.name || '';
    }
    return searchTerms[index] || '';
  }, [items, materialOptions, searchTerms]);

  const handleMakeSelect = useCallback((index: number, make: string) => {
    const materialId = items[index]?.meta_json?.material_id as string | undefined;
    const currentVariantId = items[index]?.meta_json?.variant_id as string | undefined;

    setValue(`items.${index}.meta_json.make`, make, { shouldDirty: true });
    setMakeDropdowns(prev => ({ ...prev, [index]: false }));

    if (materialId) {
      const newRate = getRateForMaterial(materialId, currentVariantId, make);
      const roundedRate = roundOffEnabled ? Math.round(newRate) : newRate;
      setValue(`items.${index}.meta_json.base_rate`, newRate, { shouldDirty: true });
      setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
      setTimeout(() => recalcItem(index), 0);
    }
  }, [setValue, items, getRateForMaterial, roundOffEnabled, recalcItem]);

  const handleVariantSelect = useCallback((index: number, variant: { variant_name: string | null; variant_id?: string | null; make?: string | null }) => {
    const materialId = items[index]?.meta_json?.material_id as string | undefined;

    setValue(`items.${index}.meta_json.variant`, variant.variant_name || '', { shouldDirty: true });
    setValue(`items.${index}.meta_json.variant_id`, variant.variant_id || undefined, { shouldDirty: true });
    if (variant.make) {
      setValue(`items.${index}.meta_json.make`, variant.make, { shouldDirty: true });
    }
    setVariantDropdowns(prev => ({ ...prev, [index]: false }));

    if (materialId) {
      const newRate = getRateForMaterial(materialId, variant.variant_id, variant.make);
      const roundedRate = roundOffEnabled ? Math.round(newRate) : newRate;
      setValue(`items.${index}.meta_json.base_rate`, newRate, { shouldDirty: true });
      setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
      setTimeout(() => recalcItem(index), 0);
    }
  }, [setValue, items, getRateForMaterial, roundOffEnabled, recalcItem]);

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
      Object.keys(makeDropdownRefs.current).forEach(index => {
        const dropdown = makeDropdownRefs.current[Number(index)];
        const input = makeInputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setMakeDropdowns(prev => ({ ...prev, [Number(index)]: false }));
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
    Object.keys(makeDropdowns).forEach(index => {
      if (makeDropdowns[Number(index)]) {
        const input = makeInputRefs.current[Number(index)];
        const dropdown = makeDropdownRefs.current[Number(index)];
        if (input && dropdown) {
          const rect = input.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + window.scrollY + 2}px`;
          dropdown.style.left = `${rect.left + window.scrollX}px`;
          dropdown.style.width = `${Math.max(rect.width, 120)}px`;
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
  }, [openDropdowns, makeDropdowns, variantDropdowns]);

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
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', minWidth: '150px' }}>MATERIAL</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>HSN</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>MAKE</th>
              <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>VARIANT</th>
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
                      onFocus={() => setOpenDropdowns(prev => ({ ...prev, [index]: true }))}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      placeholder="Search material..."
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent' }}
                    />
                    {openDropdowns[index] && (
                      <div ref={(el) => { dropdownRefs.current[index] = el; }} style={{ position: 'fixed', background: 'white', border: '1px solid #d4d4d4', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', minWidth: '200px' }}>
                        {getFilteredMaterials(index).map((m, idx) => (
                          <div key={m.id} onClick={() => handleMaterialSelect(index, m.id)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6', background: selectedIndices[index] === idx ? '#f5f5f5' : 'white' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                            {m.display_name || m.name}
                          </div>
                        ))}
                        {getFilteredMaterials(index).length === 0 && <div style={{ padding: '8px 12px', fontSize: '11px', color: '#737373' }}>No materials found</div>}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input {...register(`items.${index}.hsn_code`)} placeholder="HSN" style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', textAlign: 'left' }} />
                  </td>
                  <td style={{ padding: '4px', position: 'relative' }}>
                    <input
                      ref={(el) => { makeInputRefs.current[index] = el; }}
                      type="text"
                      value={(item.meta_json?.make as string) || ''}
                      readOnly={!materialId}
                      onClick={() => { if (materialId) setMakeDropdowns(prev => ({ ...prev, [index]: true })); }}
                      placeholder="-"
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', cursor: materialId ? 'pointer' : 'default', opacity: materialId ? 1 : 0.5 }}
                    />
                    {makeDropdowns[index] && materialId && (
                      <div ref={(el) => { makeDropdownRefs.current[index] = el; }} style={{ position: 'fixed', background: 'white', border: '1px solid #d4d4d4', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', minWidth: '120px' }}>
                        {(() => {
                          const makes = getMaterialMakes(materialId);
                          if (makes.length === 0) return <div style={{ padding: '8px 12px', fontSize: '11px', color: '#737373', fontStyle: 'italic' }}>No makes</div>;
                          return (
                            <>
                              <div onClick={() => handleMakeSelect(index, '')} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6', fontStyle: 'italic', color: '#737373' }}>-- None --</div>
                              {makes.map((make, i) => (
                                <div key={i} onClick={() => handleMakeSelect(index, make)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6' }}>{make}</div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '4px', position: 'relative' }}>
                    <input
                      ref={(el) => { variantInputRefs.current[index] = el; }}
                      type="text"
                      value={(item.meta_json?.variant as string) || ''}
                      readOnly={!materialId}
                      onClick={() => { if (materialId) setVariantDropdowns(prev => ({ ...prev, [index]: true })); }}
                      placeholder="-"
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '11px', background: 'transparent', cursor: materialId ? 'pointer' : 'default', opacity: materialId ? 1 : 0.5 }}
                    />
                    {variantDropdowns[index] && materialId && (
                      <div ref={(el) => { variantDropdownRefs.current[index] = el; }} style={{ position: 'fixed', background: 'white', border: '1px solid #d4d4d4', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', minWidth: '120px' }}>
                        {(() => {
                          const variants = getMaterialVariants(materialId);
                          if (variants.length === 0) return <div style={{ padding: '8px 12px', fontSize: '11px', color: '#737373', fontStyle: 'italic' }}>No variants</div>;
                          return (
                            <>
                              <div onClick={() => handleVariantSelect(index, { variant_name: '', variant_id: null, make: null })} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6', fontStyle: 'italic', color: '#737373' }}>-- None --</div>
                              {variants.map((v, i) => (
                                <div key={i} onClick={() => handleVariantSelect(index, v)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6' }}>{v.variant_name || 'Unnamed'}</div>
                              ))}
                            </>
                          );
                        })()}
                      </div>
                    )}
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
