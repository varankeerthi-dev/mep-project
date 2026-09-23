import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SearchableItemSelect } from '../../../components/SearchableItemSelect';
import { InlineDescriptionCell } from '../../../components/InlineDescriptionCell';
import { UnitDropdownSelect } from '../../../components/UnitDropdownSelect';
import { formatCurrency } from '../../../utils/formatters';
import { Button } from '../../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { StandardRateBadge, ArcRateBadge } from '../../../components/ArcPricingToggle';
import { ArrowUpDown, ChevronDown, GripVertical, Lock, CornerDownRight, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

// --- Stitch UX redesign tokens (UI only, Inter exclusively) ---
const INTER = "'Inter', system-ui, -apple-system, sans-serif";
const SURFACE_LOWEST = '#ffffff';
const SURFACE_LOW = '#EFF4FF';
const SURFACE_CONTAINER = '#E5EEFF';
const SURFACE_HIGH = '#DCE9FF';
const BORDER_SUBTLE = '#E2E8F0';
const BORDER_STRONG = '#CBD5E1';
const INK = '#0B1C30';
const INK_MUTED = '#475569';
const INK_FAINT = '#64748B';
const PRIMARY = '#2563EB';
const ERROR_BG = 'rgba(255, 218, 214, 0.3)';
const ERROR_INK = '#93000A';

const HEADER_CELL: React.CSSProperties = {
  fontFamily: INTER,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#334155',
  padding: '0 8px',
  height: '40px',
  borderBottom: `1px solid ${BORDER_STRONG}`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  background: 'transparent',
};

const NUM_CELL: React.CSSProperties = {
  fontFamily: INTER,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
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
        style={{ padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: INTER, color: value ? INK : '#94a3b8', fontWeight: value ? 500 : 400, background: value ? SURFACE_CONTAINER : '#fff', border: '1px solid transparent', borderRadius: '4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER_STRONG; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {value || 'No Make'}
      </div>
      {open && (
        <div ref={listRef} style={{ ...dropdownStyle as React.CSSProperties, borderRadius: '8px', overflow: 'hidden' }}>
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
        style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: INTER, color: value ? INK_MUTED : '#94a3b8', fontWeight: value ? 500 : 400, background: '#fff', border: '1px solid transparent', borderRadius: '4px', minHeight: '28px', display: 'flex', alignItems: 'center', userSelect: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER_STRONG; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {selected ? selected.variant_name : 'No Variant'}
      </div>
      {open && (
        <div ref={listRef} style={{ ...dropdownStyle as React.CSSProperties, borderRadius: '8px', overflow: 'hidden' }}>
          <div 
            onClick={() => { onChange(null); setOpen(false); }} 
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 400, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >No Variant</div>
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

const formatStockQty = (v: any) => {
  const n = parseFloat(v) || 0;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
};

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

  // Compact min-width floor tuned to the redesigned fixed column widths
  // (base always-visible columns sum to 749px). Mirrors the same visibility
  // flags as the parent's getTableMinWidth so defaults fit ~1000px viewports
  // without horizontal scroll; extra toggled columns overflow + sticky Actions.
  const compactMinWidth = (() => {
    const opt = templateSettings?.column_settings?.optional;
    let w = 749;
    if (opt?.hsn_code !== false) w += 60;
    if (opt?.make !== false) w += 80;
    if (opt?.variant !== false) w += 90;
    if (opt?.client_part_no === true) w += 100;
    if (opt?.client_description === true) w += 140;
    if (opt?.custom1 !== false && templateSettings?.column_settings?.labels) w += 90;
    if (opt?.custom2 !== false && templateSettings?.column_settings?.labels) w += 90;
    return `${w}px`;
  })();

  return (
    <div className="overflow-x-auto cq-table-container custom-scrollbar" style={{ fontFamily: INTER, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: '8px', background: SURFACE_LOWEST, boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.05)' }}>
      <table className="grid-table cq-editable" style={{ minWidth: compactMinWidth, border: 'none', borderRadius: '8px', overflow: 'hidden' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr style={{ height: '40px', background: SURFACE_LOW }}>
            <th className="col-check" style={{ ...HEADER_CELL, width: '30px', textAlign: 'center', padding: '0 8px' }}>
              <input
                type="checkbox"
                style={{ width: '14px', height: '14px', accentColor: PRIMARY, cursor: 'pointer', verticalAlign: 'middle' }}
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
            <th className="col-sno" style={{ ...HEADER_CELL, width: '35px', textAlign: 'center' }}>#</th>
            {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
              <th className="col-hsn" style={{ ...HEADER_CELL, width: '60px', textAlign: 'left' }}>{templateSettings?.column_settings?.labels?.hsn_code || 'HSN'}</th>
            )}
            {templateSettings?.column_settings?.optional?.item !== false && (
              <th className="col-item" style={{ ...HEADER_CELL, position: 'relative', textAlign: 'left', color: PRIMARY, width: 'auto', minWidth: '120px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {templateSettings?.column_settings?.labels?.item || 'ITEM & SPECIFICATIONS'}
                  <span style={{ fontSize: '12px', lineHeight: 1 }}>↑</span>
                </span>
                <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: PRIMARY }} />
              </th>
            )}
            {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
              <th className="col-code" style={{ ...HEADER_CELL, textAlign: 'left', width: '100px' }}>{templateSettings?.column_settings?.labels?.client_part_no || 'CLIENT PART NO'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.client_description === true) && (
              <th className="col-item" style={{ ...HEADER_CELL, textAlign: 'left', width: '140px', minWidth: '140px' }}>{templateSettings?.column_settings?.labels?.client_description || 'CLIENT DESCRIPTION'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.make !== false) && (
              <th className="col-make" style={{ ...HEADER_CELL, textAlign: 'left', width: '80px' }}>{templateSettings?.column_settings?.labels?.make || 'MAKE / BRAND'}</th>
            )}
            {(templateSettings?.column_settings?.optional?.variant !== false) && (
              <th className="col-variant" style={{ ...HEADER_CELL, textAlign: 'left', width: '90px' }}>{templateSettings?.column_settings?.labels?.variant || 'VARIANT / GRADE'}</th>
            )}
            <th className="col-qty" style={{ ...HEADER_CELL, textAlign: 'right', width: '60px' }}>QTY</th>
            <th className="col-unit" style={{ ...HEADER_CELL, textAlign: 'center', width: '52px' }}>UNIT</th>
            <th className="col-rate" style={{ ...HEADER_CELL, textAlign: 'right', width: '96px' }}>UNIT RATE (₹)</th>
            <th className="col-disc" style={{ ...HEADER_CELL, textAlign: 'right', width: '56px' }}>DISC %</th>
            <th className="col-rate-after-disc" style={{ ...HEADER_CELL, textAlign: 'right', width: '70px' }}>NET RATE (₹)</th>
            <th className="col-gst" style={{ ...HEADER_CELL, textAlign: 'center', width: '50px' }}>GST %</th>
            {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
              <th className="col-custom" style={{ ...HEADER_CELL, textAlign: 'left', width: '90px' }}>{templateSettings.column_settings.labels.custom1 || 'Custom 1'}</th>
            )}
            {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
              <th className="col-custom" style={{ ...HEADER_CELL, textAlign: 'left', width: '90px' }}>{templateSettings.column_settings.labels.custom2 || 'Custom 2'}</th>
            )}
            <th className="col-amount" style={{ ...HEADER_CELL, textAlign: 'right', color: PRIMARY, fontWeight: 700, width: '104px' }}>TOTAL AMOUNT (₹)</th>
            <th className="col-shrink" style={{ ...HEADER_CELL, textAlign: 'center', position: 'sticky', right: 0, background: SURFACE_LOW, zIndex: 11, width: '76px', minWidth: '76px', boxShadow: 'inset 1px 0 0 #CBD5E1' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={getVisibleColumnCount()} className="cell-static text-center" style={{ padding: '48px', color: '#94a3b8', fontSize: '13px', fontFamily: INTER }}>No items added. Click "Add Row" or "Add Bulk add".</td>
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
                    style={{ background: SURFACE_CONTAINER, height: '36px', borderTop: `1px solid ${BORDER_STRONG}`, borderBottom: `1px solid ${BORDER_SUBTLE}` }}
                  >
                    <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '4px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', color: INK_MUTED }}>
                            <ChevronDown size={14} />
                          </span>
                          <input
                            type="text"
                            className="cell-input"
                            style={{ flex: 1, fontWeight: 700, fontFamily: INTER, color: INK, background: 'transparent', border: 'none', fontSize: '12px', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left', boxShadow: 'none' }}
                            placeholder="Enter Section Header (e.g. First Floor Piping)..."
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          />
                          <span style={{ padding: '2px 8px', borderRadius: '9999px', background: '#CCE5FF', color: '#001D31', fontSize: '10px', fontWeight: 600, fontFamily: INTER, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            Category
                          </span>
                        </div>
                        <button type="button" className="btn-delete-v2" onClick={() => removeItem(item.id)} style={{ flexShrink: 0, marginLeft: 8, color: INK_FAINT }}>×</button>
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
                    style={{ background: SURFACE_HIGH, height: '44px', borderTop: `1px solid ${BORDER_STRONG}`, borderBottom: '3px double #94A3B8', cursor: 'grab' }}
                  >
                    <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', gap: '16px', fontFamily: INTER }}>
                        <span style={{ display: 'inline-flex', color: PRIMARY }}>
                          <CornerDownRight size={14} />
                        </span>
                        <input
                          type="text"
                          className="cell-input"
                          style={{ maxWidth: '240px', fontWeight: 700, fontFamily: INTER, color: INK, background: 'transparent', border: 'none', fontSize: '12px', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'right', boxShadow: 'none' }}
                          placeholder="Sub-total label..."
                          value={item.subtotal_label || ''}
                          onChange={(e) => {
                            updateItem(item.id, 'subtotal_label', e.target.value);
                            updateItem(item.id, 'description', e.target.value);
                          }}
                        />
                        <span className="text-right font-bold" style={{ ...NUM_CELL, color: INK, whiteSpace: 'nowrap', minWidth: '100px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>
                          {formatCurrency(groupAmount)}
                        </span>
                        <span style={{ display: 'inline-flex', color: '#94A3B8' }}>
                          <Lock size={12} />
                        </span>
                        <button type="button" className="btn-delete-v2" onClick={() => removeItem(item.id)}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              }

              const isChecked = selectedItemIds.includes(String(item.id));
              const isAlertRow = item.is_override;
              const stockRows = getStockRowsForItem(item);
              const stockTotal = getStockTotalForItem(item);
              const stockUom = item.uom || '';
              // Solid bg for the sticky actions cell (translucent row tints would show scrolled content bleeding through)
              const stickyBg = isChecked ? SURFACE_LOW : isAlertRow ? '#FDECEA' : SURFACE_LOWEST;
              return (
                <tr 
                  ref={(el) => { if (el) rowVirtualizer.measureElement(el); }}
                  data-index={virtualRow.index}
                  key={item.id} 
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnRow(e, item.id)}
                  onFocus={(e) => {
                    if ((e.target as HTMLElement).closest('.btn-delete-v2')) return;
                    if (index === items.length - 1) {
                      addEmptyItemRow();
                    }
                  }}
                  className={`group ${draggingItemId === item.id ? 'row-dragging' : ''} ${item.is_override ? 'override-indicator' : ''}`}
                  style={{
                    height: '40px',
                    background: isChecked ? SURFACE_LOW : isAlertRow ? ERROR_BG : SURFACE_LOWEST,
                    borderBottom: `1px solid ${BORDER_SUBTLE}`,
                    fontFamily: INTER,
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <td className="text-center cell-static col-check" style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle', minWidth: '30px' }}>
                    <input
                      type="checkbox"
                      style={{ width: '14px', height: '14px', accentColor: PRIMARY, cursor: 'pointer', verticalAlign: 'middle' }}
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
                    className="text-center cell-static col-sno row-drag-handle" 
                    title="Drag to reorder" 
                    style={{ ...NUM_CELL, fontSize: '11px', fontWeight: 500, color: isAlertRow ? ERROR_INK : INK_FAINT, textAlign: 'center', verticalAlign: 'middle', minWidth: '35px' }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="group-hover:hidden">{itemCountBefore + 1}</span>
                    <span className="hidden group-hover:inline-flex" style={{ color: PRIMARY, cursor: 'grab', verticalAlign: 'middle' }}>
                      <GripVertical size={12} />
                    </span>
                  </td>
                  {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                    <td className="col-hsn" style={{ verticalAlign: 'middle', minWidth: '60px' }}>
                      <input
                        type="text"
                        className="cell-input text-center"
                        value={item.hsn_code || item.material?.hsn_code || ''}
                        readOnly
                        style={{ ...NUM_CELL, background: 'transparent', padding: '4px 2px', fontSize: '11px', color: INK_FAINT, boxShadow: 'none' }}
                      />
                    </td>
                  )}
                  {templateSettings?.column_settings?.optional?.item !== false && (
                    <td className="col-item" style={{ position: 'relative', verticalAlign: 'middle', padding: '4px 8px' }}>
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
                          className="btn-x-hover-v2"
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
                      {item.item_id && (() => {
                        const mat = item.material || materials.find(m => m.id === item.item_id);
                        const dcId = item.discount_category_id || mat?.discount_category_id;
                        const dcName = dcId ? discountCategoryMap[dcId]?.name : null;
                        const hsn = item.hsn_code || mat?.hsn_code || '';
                        return (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '2px' }}>
                            {dcName && (
                              <div
                                title={`Discount category: ${dcName}`}
                                style={{ padding: '1px 6px', fontSize: '10px', fontFamily: INTER, fontWeight: 600, letterSpacing: '0.04em', color: '#00476E', background: '#CCE5FF', borderRadius: '4px', marginTop: '2px', lineHeight: '1.4', whiteSpace: 'nowrap', flexShrink: 0 }}
                              >
                                {dcName}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0, fontFamily: INTER }}>
                              {hsn && (
                                <div style={{ fontSize: '11px', fontFamily: INTER, color: INK_FAINT, lineHeight: '1.4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  HSN: {hsn}
                                </div>
                              )}
                              <InlineDescriptionCell
                                materialName=""
                                description={item.description}
                                onSave={(desc) => updateItem(item.id, 'description', desc)}
                              />
                            </div>
                          </div>
                        );
                      })()}
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
                  <td className="col-qty" style={{ verticalAlign: 'middle', textAlign: 'right' }}>
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
                      style={{ ...NUM_CELL, textAlign: 'right', fontWeight: 600, fontSize: '13px', color: INK, background: 'transparent', boxShadow: 'none' }}
                    />
                    {item.item_id ? (
                      <Popover open={activeStockPopoverId === item.id} onOpenChange={(next: boolean) => setActiveStockPopoverId(next ? item.id : null)}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="View warehouse-wise stock"
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px',
                              marginTop: '2px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                              fontFamily: INTER, fontSize: '10px', fontWeight: 600, lineHeight: 1.4,
                              color: stockTotal > 0 ? PRIMARY : INK_FAINT,
                              maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${formatStockQty(stockTotal)}${stockUom ? ` ${stockUom}` : ''}`}</span>
                            <ChevronDown size={10} strokeWidth={2.5} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" side="bottom" className="w-60" style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER_SUBTLE}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontFamily: INTER, fontSize: '12px', fontWeight: 700, color: INK }}>Stock Details</span>
                            <span style={{ fontFamily: INTER, fontSize: '10px', fontWeight: 600, color: INK_MUTED, background: SURFACE_LOW, borderRadius: '9999px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                              {`Total: ${formatStockQty(stockTotal)}${stockUom ? ` ${stockUom}` : ''}`}
                            </span>
                          </div>
                          {stockRows.length > 0 ? (
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                              {stockRows.map((r: any, i: number) => (
                                <div key={r.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '5px 0', borderTop: i === 0 ? 'none' : `1px solid ${BORDER_SUBTLE}` }}>
                                  <span style={{ fontFamily: INTER, fontSize: '11px', fontWeight: 500, color: INK_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.warehouse_name}</span>
                                  <span style={{ fontFamily: INTER, fontSize: '11px', fontWeight: 700, color: INK, whiteSpace: 'nowrap' }}>{`${formatStockQty(r.current_stock)}${stockUom ? ` ${stockUom}` : ''}`}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontFamily: INTER, fontSize: '11px', color: INK_FAINT, padding: '4px 0' }}>No stock records for this item.</div>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </td>
                  <td className="col-unit" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                    <UnitDropdownSelect
                      value={item.uom || ''}
                      materialId={item.item_id}
                      materials={materials}
                      onChange={(val) => updateItem(item.id, 'uom', val)}
                    />
                  </td>
                  <td className="col-rate" style={{ verticalAlign: 'middle', textAlign: 'right' }}>
                    <input
                      type="number"
                      className="cell-input text-right font-semibold"
                      value={item.base_rate_snapshot ?? item.rate ?? 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateItem(item.id, 'base_rate_snapshot', val);
                      }}
                      title="MRP (auto-fetched rate) — editing recomputes only the net rate"
                      style={{ ...NUM_CELL, textAlign: 'right', fontWeight: 500, fontSize: '13px', color: INK, background: 'transparent', boxShadow: 'none' }}
                    />
                  </td>
                  <td className="col-disc" style={{ position: 'relative', verticalAlign: 'middle', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        className="cell-input text-right font-medium"
                        value={item.discount_percent || 0}
                        onChange={(e) => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)}
                        style={{ ...NUM_CELL, paddingRight: item.is_override ? '16px' : '4px', textAlign: 'right', fontSize: '13px', color: INK_FAINT, background: 'transparent', boxShadow: 'none' }}
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
                  <td className="col-rate-after-disc text-right font-semibold cell-static" style={{ ...NUM_CELL, color: INK, fontWeight: 600, fontSize: '13px', textAlign: 'right', verticalAlign: 'middle' }}>
                    {formatCurrency(item.rate || 0)}
                  </td>
                  <td className="col-gst" style={{ verticalAlign: 'middle', textAlign: 'center', minWidth: '50px' }}>
                    <input
                      type="number"
                      className="cell-input text-right"
                      value={item.tax_percent || 0}
                      onChange={(e) => updateItem(item.id, 'tax_percent', parseFloat(e.target.value) || 0)}
                      style={{ ...NUM_CELL, fontSize: '11px', color: INK_FAINT, textAlign: 'center', background: 'transparent', boxShadow: 'none' }}
                    />
                  </td>
                  {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                    <td className="col-custom" style={{ verticalAlign: 'middle' }}>
                      <input
                        type="text"
                        className="cell-input"
                        value={item.custom1 || ''}
                        onChange={(e) => updateItem(item.id, 'custom1', e.target.value)}
                        style={{ fontSize: '11px', fontFamily: INTER, background: 'transparent', boxShadow: 'none' }}
                      />
                    </td>
                  )}
                  {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                    <td className="col-custom" style={{ verticalAlign: 'middle' }}>
                      <input
                        type="text"
                        className="cell-input"
                        value={item.custom2 || ''}
                        onChange={(e) => updateItem(item.id, 'custom2', e.target.value)}
                        style={{ fontSize: '11px', fontFamily: INTER, background: 'transparent', boxShadow: 'none' }}
                      />
                    </td>
                  )}
                  <td className="col-amount text-right font-bold cell-static" style={{ ...NUM_CELL, color: INK, fontWeight: 700, fontSize: '13px', textAlign: 'right', paddingRight: '12px', verticalAlign: 'middle' }}>
                    {formatCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0))}
                  </td>
                  <td className="delete-cell col-shrink" style={{ paddingLeft: '8px', paddingRight: '8px', verticalAlign: 'middle', textAlign: 'center', position: 'sticky', right: 0, background: stickyBg, zIndex: 2, width: '76px', minWidth: '76px', boxShadow: 'inset 1px 0 0 #E2E8F0' }}>
                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                      <button
                        type="button"
                        className="btn-move-to-v2"
                        onClick={() => openMoveToDialog(item.id, itemCountBefore + 1, 'materials')}
                        style={{
                          padding: '6px',
                          color: INK_MUTED,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Move to S.No"
                      >
                        <ArrowUpDown size={14} />
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
                        className="btn-delete-v2" 
                        onClick={() => removeItem(item.id)}
                        style={{ 
                          padding: '6px',
                          color: INK_FAINT,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#E11D48'; e.currentTarget.style.background = '#FFF1F2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = INK_FAINT; e.currentTarget.style.background = 'transparent'; }}
                        title="Delete entire row"
                      >
                        <Trash2 size={14} />
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
