import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SearchableItemSelect } from '../../../components/SearchableItemSelect';
import { InlineDescriptionCell } from '../../../components/InlineDescriptionCell';
import { formatCurrency } from '../../../utils/formatters';
import { StandardRateBadge, ArcRateBadge } from '../../../components/ArcPricingToggle';
import { ArrowUpDown } from 'lucide-react';

const cell = {
  border: '1px solid #cbd5e1',
  padding: '2px 6px',
  height: '26px',
};

const cellInput = {
  width: '100%',
  height: '100%',
  border: 'none',
  padding: '0 4px',
  fontSize: '11px',
  background: 'transparent',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const cellSelect = {
  width: '100%',
  height: '100%',
  border: 'none',
  padding: '0 4px',
  fontSize: '11px',
  background: 'transparent',
  outline: 'none',
  boxSizing: 'border-box' as const,
  cursor: 'pointer',
};

const openDropdownAtRef = (ref: React.RefObject<any>, setStyle: (style: any) => void) => {
  if (ref.current) {
    const rect = ref.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: 9999,
      background: '#fff',
      border: '1px solid #d4d4d4',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxHeight: '200px',
      overflowY: 'auto',
    });
  }
};

interface MakeCellProps {
  value: string;
  makes: string[];
  onChange: (make: string) => void;
}

const MakeCell = ({ value, makes, onChange }: MakeCellProps) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    if (open) {
      document.addEventListener('mousedown', handler);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        document.removeEventListener('mousedown', handler);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [open]);

  return (
    <>
      <div
        ref={ref}
        onClick={() => { openDropdownAtRef(ref, setDropdownStyle); setOpen(true); }}
        style={{ ...cell, cursor: 'pointer', fontSize: '11px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, display: 'flex', alignItems: 'center', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value || 'No Make'}
      </div>
      {open && (
        <div ref={listRef} style={dropdownStyle}>
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 400, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >No Make</div>
          {makes.map(m => (
            <div
              key={m}
              onClick={() => { onChange(m); setOpen(false); }}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: '#1e293b', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >{m}</div>
          ))}
        </div>
      )}
    </>
  );
};

interface VariantCellProps {
  value: string;
  variants: any[];
  itemId: string;
  variantPricing: any;
  onChange: (val: string | null) => void;
}

const VariantCell = ({ value, variants: vList, itemId, variantPricing: vPricing, onChange }: VariantCellProps) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    if (open) {
      document.addEventListener('mousedown', handler);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        document.removeEventListener('mousedown', handler);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [open]);

  const selected = vList.find(v => v.id === value);
  const filtered = vList.filter(v => {
    if (!itemId) return true;
    const itemVariants = vPricing[itemId];
    return itemVariants && itemVariants[v.id];
  });

  return (
    <>
      <div
        ref={ref}
        onClick={() => { openDropdownAtRef(ref, setDropdownStyle); setOpen(true); }}
        style={{ ...cell, cursor: 'pointer', fontSize: '11px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, display: 'flex', alignItems: 'center', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {selected ? selected.variant_name : 'No Category'}
      </div>
      {open && (
        <div ref={listRef} style={dropdownStyle}>
          <div
            onClick={() => { onChange(null); setOpen(false); }}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 400, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >No Category</div>
          {filtered.map(v => (
            <div
              key={v.id}
              onClick={() => { onChange(v.id); setOpen(false); }}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: '#1e293b', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >{v.variant_name}</div>
          ))}
        </div>
      )}
    </>
  );
};

interface QuotationItemsTableProps {
  items: any[];
  materials: any[];
  variants: any[];
  variantPricing: any;
  itemMakes: any;
  headerDiscounts: any;
  discountCategoryMap: any;
  templateSettings: any;
  qtyDrafts: Record<string, string>;
  setQtyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateItem: (id: string | number, fieldOrUpdates: any, value?: any) => void;
  removeItem: (id: string | number) => void;
  addEmptyItemRow: () => void;
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  hoveredItemId: string | number | null;
  setHoveredItemId: (id: string | number | null) => void;
  setItemSearch: (val: string) => void;
  setShowItemPicker: (show: boolean) => void;
  activeStockPopoverId: string | number | null;
  setActiveStockPopoverId: (id: string | number | null) => void;
  getStockTotalForItem: (item: any) => number;
  getStockRowsForItem: (item: any) => any[];
  getVisibleColumnCount: () => number;
  getColsBeforeQty: () => number;
  getColsBeforeAmount: () => number;
  getColsBeforeGst: () => number;
  openMoveToDialog: (itemId: string | number, currentSNo: number, section: 'materials' | 'erection') => void;
  moveToDialog: any;
  confirmMoveTo: () => void;
  setMoveToDialog: (dlg: any) => void;
  draggingItemId: string | number | null;
  handleDragStart: (e: React.DragEvent, id: string | number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDropOnRow: (e: React.DragEvent, id: string | number) => void;
  handleDragEnd: () => void;
  calculations: any;
  clientId: string;
  getRateForMaterialVariant: (material: any, variantId: string | null, make: string) => number;
  calculateVariantDiscountedRate: (baseRate: number, discountPercent: number) => number;
  getTableMinWidth: () => string;
  selectedItemIds: string[];
  setSelectedItemIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function QuotationItemsTable({
  items,
  materials,
  variants,
  variantPricing,
  itemMakes,
  headerDiscounts,
  discountCategoryMap,
  templateSettings,
  qtyDrafts,
  setQtyDrafts,
  updateItem,
  removeItem,
  addEmptyItemRow,
  setItems,
  hoveredItemId,
  setHoveredItemId,
  setItemSearch,
  setShowItemPicker,
  activeStockPopoverId,
  setActiveStockPopoverId,
  getStockTotalForItem,
  getStockRowsForItem,
  getVisibleColumnCount,
  getColsBeforeQty,
  getColsBeforeAmount,
  getColsBeforeGst,
  openMoveToDialog,
  moveToDialog,
  confirmMoveTo,
  setMoveToDialog,
  draggingItemId,
  handleDragStart,
  handleDragOver,
  handleDropOnRow,
  handleDragEnd,
  calculations,
  clientId,
  getRateForMaterialVariant,
  calculateVariantDiscountedRate,
  getTableMinWidth,
  selectedItemIds,
  setSelectedItemIds,
}: QuotationItemsTableProps) {

  const commitQtyInput = (itemId: string | number) => {
    setQtyDrafts((prev) => {
      if (!(itemId in prev)) return prev;
      const rawValue = prev[itemId].trim();
      const parsedQty = rawValue === '' ? 0 : Math.max(0, parseFloat(rawValue) || 0);
      updateItem(itemId, 'qty', parsedQty);
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const resetQtyInput = (itemId: string | number) => {
    setQtyDrafts((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const headerStyle = {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    padding: '3px 6px',
    fontWeight: 700,
    color: '#334155',
    fontSize: '10px',
    textAlign: 'left' as const,
  };

  return (
    <div className="overflow-x-auto" style={{ border: '1px solid #cbd5e1', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: getTableMinWidth() }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, width: '30px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={items.length > 0 && items.filter(item => !item.is_header && !item.is_subtotal).every(item => selectedItemIds.includes(String(item.id)))}
                onChange={(e) => {
                  if (e.target.checked) {
                    const allIds = items.filter(item => !item.is_header && !item.is_subtotal).map(item => String(item.id));
                    setSelectedItemIds(allIds);
                  } else {
                    setSelectedItemIds([]);
                  }
                }}
              />
            </th>
            <th style={{ ...headerStyle, width: '32px', textAlign: 'center' }}>#</th>
            {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
              <th style={{ ...headerStyle, width: '60px', textAlign: 'center' }}>{templateSettings?.column_settings?.labels?.hsn_code || 'HSN'}</th>
            )}
            {templateSettings?.column_settings?.optional?.item !== false && (
              <th style={{ ...headerStyle, minWidth: '180px' }}>{templateSettings?.column_settings?.labels?.item || 'ITEM'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
              <th style={{ ...headerStyle, width: '90px', textAlign: 'center' }}>{templateSettings?.column_settings?.labels?.client_part_no || 'CLIENT PART NO'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.client_description === true) && (
              <th style={{ ...headerStyle, minWidth: '140px' }}>{templateSettings?.column_settings?.labels?.client_description || 'CLIENT DESCRIPTION'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.make !== false) && (
              <th style={{ ...headerStyle, width: '80px' }}>{templateSettings?.column_settings?.labels?.make || 'MAKE'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.variant !== false) && (
              <th style={{ ...headerStyle, width: '100px' }}>{templateSettings?.column_settings?.labels?.variant || 'VARIANT'}</th>
            )}
            <th style={{ ...headerStyle, width: '72px', textAlign: 'center', fontSize: '9px' }}>Discount<br />category</th>
            <th style={{ ...headerStyle, width: '55px', textAlign: 'right' }}>QTY</th>
            <th style={{ ...headerStyle, width: '45px', textAlign: 'center' }}>UNIT</th>
            <th style={{ ...headerStyle, width: '75px', textAlign: 'right' }}>RATE</th>
            <th style={{ ...headerStyle, width: '50px', textAlign: 'right' }}>DISC %</th>
            <th style={{ ...headerStyle, width: '85px', textAlign: 'right' }}>RATE AFTER DISC</th>
            <th style={{ ...headerStyle, width: '45px', textAlign: 'right' }}>GST %</th>
            {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
              <th style={{ ...headerStyle, width: '90px' }}>{templateSettings.column_settings.labels.custom1 || 'Custom 1'}</th>
            )}
            {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
              <th style={{ ...headerStyle, width: '90px' }}>{templateSettings.column_settings.labels.custom2 || 'Custom 2'}</th>
            )}
            <th style={{ ...headerStyle, width: '90px', textAlign: 'right' }}>AMOUNT</th>
            <th style={{ ...headerStyle, width: '60px', textAlign: 'center' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={getVisibleColumnCount()} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px', border: '1px solid #cbd5e1' }}>
                No items added. Click "Add Row" or "Bulk add".
              </td>
            </tr>
          ) : (
            items.map((item, index) => {
              const itemCountBefore = items.slice(0, index).filter(i => !i.is_header && !i.is_subtotal).length;

              if (item.is_header) {
                return (
                  <tr key={item.id} style={{ background: '#f8fafc' }}>
                    <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <input
                          type="text"
                          style={{ flex: 1, fontWeight: 'bold', color: '#1e293b', background: 'transparent', border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '13px', outline: 'none' }}
                          placeholder="Enter Section Header (e.g. First Floor Piping)..."
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              if (item.is_subtotal) {
                const groupLabel = item.subtotal_label || 'Sub-total:';
                const groupAmount = calculations.subTotalGroups?.[groupLabel] || 0;
                return (
                  <tr
                    key={item.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnRow(e, item.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    style={{ background: '#fef9c3', borderTop: '2px solid #eab308', cursor: 'grab' }}
                  >
                    <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '4px 8px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                        <input
                          type="text"
                          style={{ maxWidth: '200px', fontWeight: 'bold', color: '#b45309', background: 'transparent', border: 'none', borderBottom: '1px dashed #f59e0b', fontSize: '12px', textAlign: 'right', outline: 'none' }}
                          placeholder="Sub-total label..."
                          value={item.subtotal_label || ''}
                          onChange={(e) => {
                            updateItem(item.id, 'subtotal_label', e.target.value);
                            updateItem(item.id, 'description', e.target.value);
                          }}
                        />
                        <span style={{ fontWeight: 700, color: '#b45309', minWidth: '80px', textAlign: 'right', fontSize: '12px' }}>
                          {formatCurrency(groupAmount)}
                        </span>
                        <button type="button" onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={item.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnRow(e, item.id)}
                  onFocus={(e) => {
                    if ((e.target as HTMLElement).closest('.btn-delete')) return;
                    if (index === items.length - 1) {
                      addEmptyItemRow();
                    }
                  }}
                  style={{ background: item.is_override ? '#eff6ff' : 'transparent' }}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <td style={{ ...cell, textAlign: 'center', width: '30px' }}>
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(String(item.id))}
                      onChange={(e) => {
                        const sId = String(item.id);
                        if (e.target.checked) {
                          setSelectedItemIds(prev => [...prev, sId]);
                        } else {
                          setSelectedItemIds(prev => prev.filter(id => id !== sId));
                        }
                      }}
                    />
                  </td>
                  <td
                    style={{ ...cell, textAlign: 'center', color: '#64748b', cursor: 'grab', fontSize: '11px', width: '32px' }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    title="Drag to reorder"
                  >
                    {itemCountBefore + 1}
                  </td>
                  {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                    <td style={{ ...cell, textAlign: 'center', width: '60px' }}>
                      <input
                        type="text"
                        style={{ ...cellInput, textAlign: 'center', background: '#f8fafc', fontSize: '10px' }}
                        value={item.hsn_code || item.material?.hsn_code || ''}
                        readOnly
                      />
                    </td>
                  )}
                  {templateSettings?.column_settings?.optional?.item !== false && (
                    <td style={{ ...cell, position: 'relative', minWidth: '180px', padding: '0' }}>
                      <div style={{ ...cellInput, display: 'flex', alignItems: 'center' }}>
                        <SearchableItemSelect
                          value={item.item_id}
                          materials={materials}
                          onChange={(materialId, mat) => {
                            if (mat) {
                              const makes = itemMakes[mat.id] || [];
                              const autoMake = makes.length === 1 ? makes[0] : '';
                              const newRate = getRateForMaterialVariant(mat, item.variant_id || null, autoMake);
                              const dcId = mat.discount_category_id || null;
                              const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
                              const finalRate = calculateVariantDiscountedRate(newRate, categoryDiscount);

                              updateItem(item.id, {
                                item_id: materialId,
                                material: mat,
                                hsn_code: mat.hsn_code || '',
                                uom: mat.unit || '',
                                description: '',
                                tax_percent: mat.gst_rate || 0,
                                discount_category_id: dcId,
                                make: autoMake,
                                base_rate_snapshot: newRate,
                                discount_percent: categoryDiscount,
                                applied_discount_percent: categoryDiscount,
                                is_override: false,
                                rate: finalRate
                              });
                            } else {
                              updateItem(item.id, {
                                item_id: '',
                                material: null,
                                hsn_code: '',
                                uom: '',
                                description: '',
                                tax_percent: 0,
                                discount_category_id: null,
                                make: '',
                                base_rate_snapshot: 0,
                                discount_percent: 0,
                                applied_discount_percent: 0,
                                is_override: false,
                                rate: 0
                              });
                            }
                          }}
                        />
                      </div>
                      {item.item_id && (
                        <InlineDescriptionCell
                          materialName=""
                          description={item.description}
                          onSave={(desc) => updateItem(item.id, 'description', desc)}
                        />
                      )}
                    </td>
                  )}
                  {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                    <td style={{ ...cell, textAlign: 'center', color: '#64748b', fontSize: '11px', width: '90px' }}>
                      {(() => {
                        const mapping = clientId && item.material?.mappings?.find((m: any) => m.client_id === clientId);
                        return mapping?.client_part_no || '-';
                      })()}
                    </td>
                  )}
                  {(templateSettings?.column_settings?.optional?.client_description === true) && (
                    <td style={{ ...cell, color: '#64748b', fontSize: '11px', minWidth: '140px' }}>
                      {(() => {
                        const mapping = clientId && item.material?.mappings?.find((m: any) => m.client_id === clientId);
                        return mapping?.client_description || '-';
                      })()}
                    </td>
                  )}
                  {(templateSettings?.column_settings?.optional?.make !== false) && (
                    <td style={{ ...cell, position: 'relative', width: '80px', padding: '0' }}>
                      <MakeCell
                        value={item.make || ''}
                        makes={itemMakes[item.item_id] || []}
                        onChange={(nextMake) => {
                          const mat = materials.find(m => m.id === item.item_id);
                          if (mat) {
                            const newRate = getRateForMaterialVariant(mat, item.variant_id || null, nextMake);
                            const dcId = item.discount_category_id || mat.discount_category_id || null;
                            const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
                            const finalRate = calculateVariantDiscountedRate(newRate, categoryDiscount);
                            updateItem(item.id, {
                              make: nextMake,
                              base_rate_snapshot: newRate,
                              discount_percent: categoryDiscount,
                              applied_discount_percent: categoryDiscount,
                              is_override: false,
                              rate: finalRate
                            });
                          }
                        }}
                      />
                    </td>
                  )}
                  {(templateSettings?.column_settings?.optional?.variant !== false) && (
                    <td style={{ ...cell, position: 'relative', width: '100px', padding: '0' }}>
                      <VariantCell
                        value={item.variant_id || ''}
                        variants={variants}
                        itemId={item.item_id}
                        variantPricing={variantPricing}
                        onChange={(newVariantId) => {
                          const mat = materials.find(m => m.id === item.item_id);
                          if (mat) {
                            const make = item.make || '';
                            const newRate = getRateForMaterialVariant(mat, newVariantId, make);
                            const dcId = mat.discount_category_id || null;
                            const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
                            const finalRate = calculateVariantDiscountedRate(newRate, categoryDiscount);
                            updateItem(item.id, {
                              variant_id: newVariantId,
                              base_rate_snapshot: newRate,
                              discount_percent: categoryDiscount,
                              applied_discount_percent: categoryDiscount,
                              is_override: false,
                              rate: finalRate
                            });
                          }
                        }}
                      />
                    </td>
                  )}
                  <td style={{ ...cell, textAlign: 'center', color: '#475569', fontSize: '10px', width: '72px' }}>
                    {(() => {
                      const mat = item.material || materials.find(m => m.id === item.item_id);
                      const dcId = item.discount_category_id || mat?.discount_category_id;
                      if (!dcId) return '-';
                      return discountCategoryMap[dcId]?.name || '-';
                    })()}
                  </td>
                  <td style={{ ...cell, padding: '0', width: '55px' }}>
                    <input
                      type="text"
                      style={{ ...cellInput, textAlign: 'right', fontWeight: 500 }}
                      placeholder="0.00"
                      value={item.id in qtyDrafts ? qtyDrafts[item.id] : (item.qty === null ? '' : item.qty)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (/^\d*\.?\d*$/.test(raw)) {
                          setQtyDrafts((prev) => ({ ...prev, [item.id]: raw }));
                        }
                      }}
                      onBlur={() => commitQtyInput(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitQtyInput(item.id);
                        if (e.key === 'Escape') resetQtyInput(item.id);
                      }}
                    />
                  </td>
                  <td style={{ ...cell, padding: '0', width: '45px' }}>
                    <input
                      type="text"
                      style={{ ...cellInput, textAlign: 'center', color: '#64748b' }}
                      value={item.uom || ''}
                      onChange={(e) => updateItem(item.id, 'uom', e.target.value)}
                    />
                  </td>
                  <td style={{ ...cell, padding: '0', width: '75px' }}>
                    <input
                      type="number"
                      style={{ ...cellInput, textAlign: 'right', fontWeight: 600 }}
                      value={item.rate || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateItem(item.id, 'rate', val);
                      }}
                    />
                  </td>
                  <td style={{ ...cell, padding: '0', position: 'relative', width: '50px' }}>
                    <input
                      type="number"
                      style={{ ...cellInput, textAlign: 'right', fontWeight: 500, paddingRight: item.is_override ? '14px' : '4px' }}
                      value={item.discount_percent || 0}
                      onChange={(e) => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                    />
                    {item.is_override && (
                      <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} title="This discount is overridden from standard variant discount" />
                    )}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 600, color: '#0f172a', background: '#f8fafc', width: '85px' }}>
                    {formatCurrency(item.rate || 0)}
                  </td>
                  <td style={{ ...cell, padding: '0', width: '45px' }}>
                    <input
                      type="number"
                      style={{ ...cellInput, textAlign: 'right', color: '#64748b' }}
                      value={item.tax_percent || 0}
                      onChange={(e) => updateItem(item.id, 'tax_percent', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                    <td style={{ ...cell, padding: '0', width: '90px' }}>
                      <input
                        type="text"
                        style={cellInput}
                        value={item.custom1 || ''}
                        onChange={(e) => updateItem(item.id, 'custom1', e.target.value)}
                      />
                    </td>
                  )}
                  {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                    <td style={{ ...cell, padding: '0', width: '90px' }}>
                      <input
                        type="text"
                        style={cellInput}
                        value={item.custom2 || ''}
                        onChange={(e) => updateItem(item.id, 'custom2', e.target.value)}
                      />
                    </td>
                  )}
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: '#0f172a', background: '#f8fafc', width: '90px' }}>
                    {formatCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0))}
                  </td>
                  <td style={{ ...cell, textAlign: 'center', width: '60px', padding: '2px 4px' }}>
                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openMoveToDialog(item.id, itemCountBefore + 1, 'materials')}
                        style={{ padding: '2px 4px', fontSize: '11px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        title="Move to S.No"
                      >
                        <ArrowUpDown size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        style={{ padding: '2px 5px', fontSize: '13px', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '3px', lineHeight: 1, fontWeight: 700 }}
                        title="Delete row"
                      >
                        ×
                      </button>
                    </div>
                    {moveToDialog && moveToDialog.itemId === item.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: '0',
                          marginBottom: '4px',
                          background: 'white',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 100,
                          width: '160px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                          Move above S.No:
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min={1}
                            autoFocus
                            value={moveToDialog.value}
                            onChange={(e) => setMoveToDialog({ ...moveToDialog, value: e.target.value, error: '' })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmMoveTo();
                              if (e.key === 'Escape') setMoveToDialog(null);
                            }}
                            style={{
                              flex: 1,
                              padding: '3px 6px',
                              border: `1px solid ${moveToDialog.error ? '#dc2626' : '#cbd5e1'}`,
                              borderRadius: '4px',
                              fontSize: '11px',
                              width: '40px',
                              outline: 'none',
                              color: '#1f2937',
                            }}
                          />
                          <button
                            type="button"
                            onClick={confirmMoveTo}
                            style={{ padding: '3px 8px', fontSize: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Go
                          </button>
                          <button
                            type="button"
                            onClick={() => setMoveToDialog(null)}
                            style={{ padding: '3px 5px', fontSize: '10px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        </div>
                        {moveToDialog.error && (
                          <div style={{ color: '#dc2626', fontSize: '9px', fontWeight: 500, textAlign: 'left' }}>{moveToDialog.error}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
