import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SearchableItemSelect } from '../../../components/SearchableItemSelect';
import { InlineDescriptionCell } from '../../../components/InlineDescriptionCell';
import { formatCurrency } from '../../../utils/formatters';
import { StandardRateBadge, ArcRateBadge } from '../../../components/ArcPricingToggle';
import { ArrowUpDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

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
        style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, background: '#fff', border: '1px solid transparent', borderRadius: '0', minHeight: '28px', display: 'flex', alignItems: 'center', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
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
        style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, background: '#fff', border: '1px solid transparent', borderRadius: '0', minHeight: '28px', display: 'flex', alignItems: 'center', userSelect: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
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
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => document.documentElement,
    estimateSize: useCallback((index: number) => {
      const item = items[index];
      if (!item) return 32;
      if (item.is_header) return 36;
      if (item.is_subtotal) return 38;
      return 60;
    }, [items]),
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

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

  return (
    <div className="overflow-x-auto cq-table-container custom-scrollbar">
      <table className="grid-table cq-editable" style={{ minWidth: getTableMinWidth() }}>
        <thead className="grid-table-header-dark">
          <tr>
            <th className="col-shrink" style={{ padding: '6px' }}>
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
            <th className="col-shrink">#</th>
            {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
              <th className="col-hsn">{templateSettings?.column_settings?.labels?.hsn_code || 'HSN'}</th>
            )}
            {templateSettings?.column_settings?.optional?.item !== false && (
              <th className="col-item" style={{ position: 'relative' }}>
                {templateSettings?.column_settings?.labels?.item || 'ITEM'}
              </th>
            )}
            {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
              <th className="col-code">{templateSettings?.column_settings?.labels?.client_part_no || 'CLIENT PART NO'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.client_description === true) && (
              <th className="col-item">{templateSettings?.column_settings?.labels?.client_description || 'CLIENT DESCRIPTION'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.make !== false) && (
              <th className="col-make">{templateSettings?.column_settings?.labels?.make || 'MAKE'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.variant !== false) && (
              <th className="col-variant">{templateSettings?.column_settings?.labels?.variant || 'VARIANT'}</th>
            )}
            <th className="col-disc-cat" style={{ fontSize: '10px', padding: '6px', textAlign: 'center', fontWeight: 700, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', lineHeight: '1.3' }}>Discount<br/>category</th>
            <th className="col-qty">QTY</th>
            <th className="col-unit">UNIT</th>
            <th className="col-rate">RATE</th>
            <th className="col-disc">DISC %</th>
            <th className="col-rate-after-disc">RATE AFTER DISC</th>
            <th className="col-gst">GST %</th>
            {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
              <th className="col-custom">{templateSettings.column_settings.labels.custom1 || 'Custom 1'}</th>
            )}
            {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
              <th className="col-custom">{templateSettings.column_settings.labels.custom2 || 'Custom 2'}</th>
            )}
            <th className="col-amount">AMOUNT</th>
            <th className="col-shrink"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={getVisibleColumnCount()} className="cell-static text-center" style={{ padding: '48px', color: '#94a3b8', fontSize: '14px' }}>No items added. Click "Add Row" or "Add Bulk add".</td>
            </tr>
          ) : (
            <>
              {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                <tr style={{ height: `${virtualItems[0].start}px`, border: 'none' }}>
                  <td colSpan={getVisibleColumnCount() + 1} style={{ height: `${virtualItems[0].start}px`, padding: 0, border: 'none' }} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const item = items[virtualRow.index];
                const index = virtualRow.index;
                const itemCountBefore = items.slice(0, index).filter(i => !i.is_header && !i.is_subtotal).length;
              if (item.is_header) {
                return (
                  <tr 
                    ref={(el) => { if (el) rowVirtualizer.measureElement(el); }}
                    data-index={virtualRow.index}
                    key={item.id} 
                    style={{ background: '#f8fafc' }}
                  >
                    <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <input
                          type="text"
                          className="cell-input"
                          style={{ flex: 1, fontWeight: 'bold', color: '#1e293b', background: 'transparent', border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '14px', textAlign: 'left' }}
                          placeholder="Enter Section Header (e.g. First Floor Piping)..."
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                        <button type="button" className="btn-delete" onClick={() => removeItem(item.id)} style={{ flexShrink: 0, marginLeft: 8 }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              }
              
              // Sub-total row
              if (item.is_subtotal) {
                const groupLabel = item.subtotal_label || 'Sub-total:';
                const groupAmount = calculations.subTotalGroups?.[groupLabel] || 0;
                return (
                  <tr 
                    ref={(el) => { if (el) rowVirtualizer.measureElement(el); }}
                    data-index={virtualRow.index}
                    key={item.id} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnRow(e, item.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    className={draggingItemId === item.id ? 'row-dragging' : ''}
                    style={{ background: '#fef9c3', borderTop: '2px solid #eab308', cursor: 'grab' }}
                  >
                    <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: '16px' }}>
                        <input
                          type="text"
                          className="cell-input"
                          style={{ maxWidth: '240px', fontWeight: 'bold', color: '#b45309', background: 'transparent', border: 'none', borderBottom: '1px dashed #f59e0b', fontSize: '13px', textAlign: 'right' }}
                          placeholder="Sub-total label..."
                          value={item.subtotal_label || ''}
                          onChange={(e) => {
                            updateItem(item.id, 'subtotal_label', e.target.value);
                            updateItem(item.id, 'description', e.target.value);
                          }}
                        />
                        <span className="text-right font-bold" style={{ color: '#b45309', whiteSpace: 'nowrap', minWidth: '100px', textAlign: 'right' }}>
                          {formatCurrency(groupAmount)}
                        </span>
                        <button type="button" className="btn-delete" onClick={() => removeItem(item.id)}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr 
                  ref={(el) => { if (el) rowVirtualizer.measureElement(el); }}
                  data-index={virtualRow.index}
                  key={item.id} 
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnRow(e, item.id)}
                  onFocus={(e) => {
                    if ((e.target as HTMLElement).closest('.btn-delete')) return;
                    if (index === items.length - 1) {
                      addEmptyItemRow();
                    }
                  }}
                  className={`${draggingItemId === item.id ? 'row-dragging' : ''} ${item.is_override ? 'override-indicator' : ''}`}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <td className="text-center cell-static col-shrink" style={{ padding: '6px' }}>
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
                    className="text-center cell-static col-shrink row-drag-handle" 
                    title="Drag to reorder" 
                    style={{ fontSize: '13px' }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                  >
                    {itemCountBefore + 1}
                  </td>
                  {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                    <td className="col-hsn">
                      <input
                        type="text"
                        className="cell-input text-center"
                        value={item.hsn_code || item.material?.hsn_code || ''}
                        readOnly
                        style={{ background: '#f8fafc', padding: '0 2px', fontSize: '11px' }}
                      />
                    </td>
                  )}
                  {templateSettings?.column_settings?.optional?.item !== false && (
                    <td className="col-item" style={{ position: 'relative' }}>
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
                      {hoveredItemId === item.id && item.item_id && (
                        <button
                          type="button"
                          className="btn-x-hover"
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            padding: '2px 6px',
                            fontSize: '12px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            opacity: 0,
                            transform: 'scale(0)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onClick={() => {
                            setItems(prev => prev.map(p => 
                              p.id === item.id ? { ...p, item_id: '', material: null, description: '', hsn_code: '' } : p
                            ));
                            setTimeout(() => {
                              setItemSearch('');
                              setShowItemPicker(true);
                            }, 200);
                          }}
                          title="Clear item and select replacement"
                        >
                          ×
                        </button>
                      )}
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
                    <td className="col-shrink cell-static">
                      <div style={{ fontSize: '12px', color: '#64748b', padding: '4px', textAlign: 'center' }}>
                        {(() => {
                          const mapping = clientId && item.material?.mappings?.find((m: any) => m.client_id === clientId);
                          return mapping?.client_part_no || '-';
                        })()}
                      </div>
                    </td>
                  )}
                  {(templateSettings?.column_settings?.optional?.client_description === true) && (
                    <td className="col-item cell-static">
                      <div style={{ fontSize: '12px', color: '#64748b', padding: '4px' }}>
                        {(() => {
                          const mapping = clientId && item.material?.mappings?.find((m: any) => m.client_id === clientId);
                          return mapping?.client_description || '-';
                        })()}
                      </div>
                    </td>
                  )}
                  {(templateSettings?.column_settings?.optional?.make !== false) && (
                    <td className="col-shrink" style={{ position: 'relative' }}>
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
                    <td className="col-shrink" style={{ position: 'relative' }}>
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
                  <td className="col-disc-cat cell-static">
                    <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', wordBreak: 'break-all' }}>
                      {(() => {
                        const mat = item.material || materials.find(m => m.id === item.item_id);
                        const dcId = item.discount_category_id || mat?.discount_category_id;
                        if (!dcId) return '-';
                        return discountCategoryMap[dcId]?.name || '-';
                      })()}
                    </div>
                  </td>
                  <td className="col-qty">
                    <input
                      type="text"
                      className="cell-input text-right font-medium"
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
                  <td className="col-unit">
                    <input
                      type="text"
                      className="cell-input text-center"
                      value={item.uom || ''}
                      onChange={(e) => updateItem(item.id, 'uom', e.target.value)}
                      style={{ fontSize: '11px', color: '#64748b' }}
                    />
                  </td>
                  <td className="col-rate">
                    <input
                      type="number"
                      className="cell-input text-right font-semibold"
                      value={item.rate || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateItem(item.id, 'rate', val);
                      }}
                    />
                  </td>
                  <td className="col-disc" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <input
                        type="number"
                        className="cell-input text-right font-medium"
                        value={item.discount_percent || 0}
                        onChange={(e) => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                        style={{ paddingRight: item.is_override ? '16px' : '4px' }}
                      />
                      {item.is_override && (
                        <div 
                          style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}
                          title="This discount is overridden from standard variant discount"
                        >
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="col-rate-after-disc text-right font-semibold cell-static bg-zinc-50" style={{ color: '#0f172a' }}>
                    {formatCurrency(item.rate || 0)}
                  </td>
                  <td className="col-gst">
                    <input
                      type="number"
                      className="cell-input text-right"
                      value={item.tax_percent || 0}
                      onChange={(e) => updateItem(item.id, 'tax_percent', parseFloat(e.target.value) || 0)}
                      style={{ fontSize: '11px', color: '#64748b' }}
                    />
                  </td>
                  {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                    <td className="col-custom">
                      <input
                        type="text"
                        className="cell-input"
                        value={item.custom1 || ''}
                        onChange={(e) => updateItem(item.id, 'custom1', e.target.value)}
                        style={{ fontSize: '11px' }}
                      />
                    </td>
                  )}
                  {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                    <td className="col-custom">
                      <input
                        type="text"
                        className="cell-input"
                        value={item.custom2 || ''}
                        onChange={(e) => updateItem(item.id, 'custom2', e.target.value)}
                        style={{ fontSize: '11px' }}
                      />
                    </td>
                  )}
                  <td className="col-amount text-right font-bold cell-static bg-zinc-50" style={{ color: '#0f172a', paddingRight: '12px' }}>
                    {formatCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0))}
                  </td>
                  <td className="delete-cell col-shrink" style={{ paddingLeft: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', position: 'relative' }}>
                      <button
                        type="button"
                        className="btn-move-to"
                        onClick={() => openMoveToDialog(item.id, itemCountBefore + 1, 'materials')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '12px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Move to S.No"
                      >
                        <ArrowUpDown size={12} />
                      </button>

                      {moveToDialog && moveToDialog.itemId === item.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            right: '0',
                            marginBottom: '6px',
                            background: 'white',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            width: '170px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
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
                                padding: '4px 6px',
                                border: `1px solid ${moveToDialog.error ? '#dc2626' : '#cbd5e1'}`,
                                borderRadius: '4px',
                                fontSize: '12px',
                                width: '50px',
                                outline: 'none',
                                color: '#1f2937'
                              }}
                            />
                            <button
                              type="button"
                              onClick={confirmMoveTo}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              Go
                            </button>
                            <button
                              type="button"
                              onClick={() => setMoveToDialog(null)}
                              style={{
                                padding: '4px 6px',
                                fontSize: '11px',
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              ×
                            </button>
                          </div>
                          {moveToDialog.error && (
                            <div style={{ color: '#dc2626', fontSize: '9px', fontWeight: 500 }}>{moveToDialog.error}</div>
                          )}
                        </div>
                      )}

                      <button 
                        type="button" 
                        className="btn-delete" 
                        onClick={() => removeItem(item.id)}
                        style={{ 
                          padding: '2px 6px', 
                          fontSize: '14px',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="Delete entire row"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {virtualItems.length > 0 && (rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end) > 0 && (
              <tr style={{ height: `${rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end}px`, border: 'none' }}>
                <td colSpan={getVisibleColumnCount() + 1} style={{ height: `${rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end}px`, padding: 0, border: 'none' }} />
              </tr>
            )}
          </>
        )}
        </tbody>
      </table>
    </div>
  );
}
