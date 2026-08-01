import React, { useState, useRef, useEffect } from 'react';
import { Plus, ArrowUpDown, Trash2, Columns, List, Sigma } from 'lucide-react';
import { SearchableItemSelect } from '../../components/SearchableItemSelect';
import { InlineDescriptionCell } from '../../components/InlineDescriptionCell';
import { UnitDropdownSelect } from '../../components/UnitDropdownSelect';
import { formatCurrency } from '../../utils/formatters';
import type { LineItem } from '../pages/ProformaEditorPage';

interface ProformaItemsTableProps {
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  materials: any[];
  variants: any[];
  variantPricing: Record<string, Record<string, Record<string, number>>>;
  discountCategories: any[];
  discountCategoryMap: Record<string, any>;
  templateSettings: any;
  clientId: string;
  handleItemChange: (index: number, field: keyof LineItem, value: string | number | null) => void;
  handleMaterialChange: (index: number, mat: any) => void;
  handleAddItem: () => void;
  handleRemoveItem: (index: number) => void;
  setShowItemSelectorDrawer: (open: boolean) => void;
  setShowItemCreateDrawer: (open: boolean) => void;
  setShowCustomLabelEditor: (open: boolean) => void;
  onShowItemPicker: () => void;
  onAddSectionHeader: () => void;
  onAddSubtotal: () => void;
  getVisibleColumnCount: () => number;
  getColsBeforeAmount: () => number;

  // Qty drafts
  qtyDrafts: Record<string, string>;
  setQtyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitQtyInput: (itemId: string | number) => void;
  resetQtyInput: (itemId: string | number) => void;

  // Drag & drop
  draggingItemId: string | number | null;
  handleDragStart: (e: React.DragEvent, itemId: string | number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDropOnRow: (e: React.DragEvent, targetId: string | number) => void;
  handleDragEnd: () => void;

  // Move To dialog
  moveToDialog: { open: boolean; itemId: string | number | null; currentSNo: number; value: string; error: string } | null;
  openMoveToDialog: (itemId: string | number, currentSNo: number) => void;
  confirmMoveTo: () => void;
  setMoveToDialog: (dlg: any) => void;

  // Calculations
  totals: {
    subtotal: number;
    discount: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    roundOffAmount: number;
    amountInWords: string;
  };
  roundOff: boolean;
}

// ─── Dynamic VariantCell (filters variants by itemId + variantPricing) ────────

interface VariantCellInnerProps {
  value: string | null;
  variants: any[];
  itemId: string;
  variantPricing: Record<string, Record<string, Record<string, number>>>;
  onChange: (val: string | null) => void;
}

const VariantCellInner = ({ value, variants: vList, itemId, variantPricing: vPricing, onChange }: VariantCellInnerProps) => {
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

  // Filter variants to only show those associated with the current item
  const filtered = vList.filter(v => {
    if (!itemId) return true;
    const itemVariants = vPricing[itemId];
    return itemVariants && itemVariants[v.id];
  });

  const selected = vList.find(v => v.id === value);

  const openDropdownAtRef = (elRef: React.RefObject<HTMLDivElement>, setStyle: (s: any) => void) => {
    if (elRef.current) {
      const rect = elRef.current.getBoundingClientRect();
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

  return (
    <>
      <div
        ref={ref}
        onClick={() => { openDropdownAtRef(ref, setDropdownStyle); setOpen(true); }}
        style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: value ? '#0f172a' : '#94a3b8', fontWeight: value ? 500 : 400, background: '#fff', border: '1px solid transparent', borderRadius: '0', minHeight: '28px', display: 'flex', alignItems: 'center', userSelect: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {selected ? selected.variant_name : (filtered.length > 0 ? 'No Category' : '-')}
      </div>
      {filtered.length > 0 && open && (
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

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProformaItemsTable({
  items,
  setItems,
  materials,
  variants,
  variantPricing,
  discountCategories,
  discountCategoryMap,
  templateSettings,
  clientId,
  handleItemChange,
  handleMaterialChange,
  handleAddItem,
  handleRemoveItem,
  setShowItemSelectorDrawer,
  setShowItemCreateDrawer,
  setShowCustomLabelEditor,
  onShowItemPicker,
  onAddSectionHeader,
  onAddSubtotal,
  getVisibleColumnCount,
  getColsBeforeAmount,
  qtyDrafts,
  setQtyDrafts,
  commitQtyInput,
  resetQtyInput,
  draggingItemId,
  handleDragStart,
  handleDragOver,
  handleDropOnRow,
  handleDragEnd,
  moveToDialog,
  openMoveToDialog,
  confirmMoveTo,
  setMoveToDialog,
  totals,
  roundOff,
}: ProformaItemsTableProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const hasItems = items.length > 0;

  return (
    <>
      <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-zinc-900">Line Items</h3>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-none">
              {items.length} {items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onShowItemPicker}
              className="h-9 px-3 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm"
            >
              <List size={14} /> Add Multiple Items
            </button>
            <button
              type="button"
              onClick={onAddSectionHeader}
              className="h-9 px-3 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm"
            >
              <Plus size={14} /> Section
            </button>
            <button
              type="button"
              onClick={onAddSubtotal}
              className="h-9 px-3 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm"
            >
              <Sigma size={14} /> Subtotal
            </button>
            <button
              type="button"
              onClick={() => setShowCustomLabelEditor(true)}
              className="h-9 px-3 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm"
            >
              <Columns size={14} /> Columns
            </button>
            <button type="button" onClick={handleAddItem} className="h-9 px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm">
              <Plus size={14} /> Add Item
            </button>
            <button type="button" onClick={() => setShowItemSelectorDrawer(true)} className="h-9 px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm">
              <Plus size={14} /> Inventory
            </button>
            <button type="button" onClick={() => setShowItemCreateDrawer(true)} className="h-9 px-4 text-xs font-bold text-zinc-600 hover:text-blue-600 transition-all flex items-center justify-center gap-1.5 bg-white border border-zinc-200 rounded shadow-sm">
              <Plus size={14} /> New Material
            </button>
          </div>
        </div>

        <div className="grid-table-container">
          <table className="grid-table cq-editable">
            <thead className="grid-table-header-dark">
              <tr>
                <th className="col-check" style={{ padding: '6px', width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={hasItems && items.every(item => selectedItemIds.includes(String(item.id || items.indexOf(item))))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItemIds(items.map((_, i) => String(i)));
                      } else {
                        setSelectedItemIds([]);
                      }
                    }}
                  />
                </th>
                <th className="col-sno" style={{ width: '40px' }}>#</th>
                {(templateSettings?.column_settings?.optional?.hsn_code !== false) && <th className="col-hsn">HSN Code</th>}
                {(templateSettings?.column_settings?.optional?.item !== false) && (
                  <th className="col-item" style={{ position: 'relative' }}>
                    {templateSettings?.column_settings?.labels?.item || 'Description'}
                  </th>
                )}
                {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                  <th className="col-code">{templateSettings?.column_settings?.labels?.client_part_no || 'Client Part No'}</th>
                )}
                {(templateSettings?.column_settings?.optional?.client_description === true) && (
                  <th className="col-item">{templateSettings?.column_settings?.labels?.client_description || 'Client Description'}</th>
                )}
                {(templateSettings?.column_settings?.optional?.make !== false) && <th className="col-make">Make</th>}
                {(templateSettings?.column_settings?.optional?.variant !== false) && <th className="col-variant">Variant</th>}
                <th className="col-disc-cat">Discount Category</th>
                <th className="col-qty">Qty</th>
                {(templateSettings?.column_settings?.optional?.unit !== false) && <th className="col-unit">Unit</th>}
                {(templateSettings?.column_settings?.optional?.rate !== false) && <th className="col-rate">Rate</th>}
                {(templateSettings?.column_settings?.optional?.discount_percent !== false) && <th className="col-disc">Discount %</th>}
                {(templateSettings?.column_settings?.optional?.rate_after_discount !== false) && <th className="col-rate-after-disc">Rate After Disc</th>}
                {(templateSettings?.column_settings?.optional?.tax_percent !== false) && <th className="col-gst">Tax %</th>}
                {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                  <th className="col-custom">{templateSettings.column_settings.labels.custom1 || 'Custom 1'}</th>
                )}
                {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                  <th className="col-custom">{templateSettings.column_settings.labels.custom2 || 'Custom 2'}</th>
                )}
                <th className="col-amount">Amount</th>
                <th style={{ width: '70px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const itemId = item.id || index;
                const sno = items.slice(0, index).filter(i => !i.is_header && !i.is_subtotal).length + 1;

                // ── Section Header Row ──────────────
                if (item.is_header) {
                  return (
                    <tr key={item.id || `hdr-${index}`} style={{ background: '#f8fafc' }}>
                      <td colSpan={getVisibleColumnCount() + 1} style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <input
                            type="text"
                            className="cell-input"
                            style={{ flex: 1, fontWeight: 'bold', color: '#1e293b', background: 'transparent', border: 'none', borderBottom: '1px dashed #cbd5e1', fontSize: '14px', textAlign: 'left' }}
                            placeholder="Enter Section Header (e.g. First Floor Piping)..."
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          />
                          <button type="button" className="btn-delete" onClick={() => handleRemoveItem(index)} style={{ flexShrink: 0, marginLeft: 8, padding: '2px 8px', fontSize: '14px', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>&times;</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // ── Subtotal Row ─────────────────────
                if (item.is_subtotal) {
                  const groupLabel = item.subtotal_label || 'Sub-total:';
                  const groupAmount = items.reduce((sum, it) => {
                    if (it.is_header || it.is_subtotal) return sum;
                    return sum + (it.amount || 0);
                  }, 0);
                  return (
                    <tr
                      key={item.id || `st-${index}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnRow(e, itemId)}
                      className={draggingItemId === itemId ? 'row-dragging' : ''}
                      style={{ background: '#fef9c3', borderTop: '2px solid #eab308' }}
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
                              handleItemChange(index, 'subtotal_label', e.target.value);
                              handleItemChange(index, 'description', e.target.value);
                            }}
                          />
                          <span className="text-right font-bold" style={{ color: '#b45309', whiteSpace: 'nowrap', minWidth: '100px', textAlign: 'right' }}>
                            {formatCurrency(groupAmount)}
                          </span>
                          <button type="button" className="btn-delete" onClick={() => handleRemoveItem(index)} style={{ padding: '2px 8px', fontSize: '14px', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>&times;</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // ── Regular Item Row ─────────────────
                return (
                  <tr
                    key={item.id || index}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnRow(e, itemId)}
                    className={draggingItemId === itemId ? 'row-dragging' : ''}
                  >
                    {/* Checkbox */}
                    <td className="text-center cell-static" style={{ padding: '6px' }}>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(String(itemId))}
                        onChange={(e) => {
                          const sid = String(itemId);
                          if (e.target.checked) {
                            setSelectedItemIds(prev => [...prev, sid]);
                          } else {
                            setSelectedItemIds(prev => prev.filter(id => id !== sid));
                          }
                        }}
                      />
                    </td>

                    {/* S.No with drag handle */}
                    <td
                      className="text-center font-semibold text-[11px] text-zinc-500 pt-2 row-drag-handle"
                      draggable
                      onDragStart={(e) => handleDragStart(e, itemId)}
                      onDragEnd={handleDragEnd}
                      title="Drag to reorder"
                      style={{ cursor: 'grab' }}
                    >
                      {sno}
                    </td>

                    {/* HSN Code */}
                    {(templateSettings?.column_settings?.optional?.hsn_code !== false) && (
                      <td>
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.hsn_code ?? ''}
                          onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                          placeholder="HSN"
                        />
                      </td>
                    )}

                    {/* Description/Item with InlineDescriptionCell pen icon */}
                    {(templateSettings?.column_settings?.optional?.item !== false) && (
                      <td className="col-item pr-6 relative">
                        <SearchableItemSelect
                          value={item.item_id || ''}
                          materials={materials}
                          onChange={(materialId, mat) => handleMaterialChange(index, mat)}
                        />
                        {/* Show description + pen icon when item has a description (free-text from PO or material-linked) */}
                        {(item.item_id || item.description) && (
                          <InlineDescriptionCell
                            materialName=""
                            description={item.description}
                            onSave={(desc) => handleItemChange(index, 'description', desc)}
                          />
                        )}
                      </td>
                    )}

                    {/* Client Part No */}
                    {(templateSettings?.column_settings?.optional?.client_part_no === true) && (
                      <td className="col-shrink cell-static text-center" style={{ fontSize: '11px', color: '#64748b', padding: '4px' }}>
                        {(() => {
                          const matItem = materials.find((m: any) => m.id === item.item_id);
                          const mapping = matItem?.mappings?.find((m: any) => m.client_id === clientId);
                          return mapping?.client_part_no || '-';
                        })()}
                      </td>
                    )}

                    {/* Client Description */}
                    {(templateSettings?.column_settings?.optional?.client_description === true) && (
                      <td className="col-item cell-static" style={{ fontSize: '11px', color: '#64748b', padding: '4px' }}>
                        {(() => {
                          const matItem = materials.find((m: any) => m.id === item.item_id);
                          const mapping = matItem?.mappings?.find((m: any) => m.client_id === clientId);
                          return mapping?.client_description || '-';
                        })()}
                      </td>
                    )}

                    {/* Make */}
                    {(templateSettings?.column_settings?.optional?.make !== false) && (
                      <td>
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.make ?? ''}
                          onChange={(e) => handleItemChange(index, 'make', e.target.value)}
                          placeholder="Make"
                        />
                      </td>
                    )}

                    {/* Variant — dynamic (filtered by itemId + variantPricing) */}
                    {(templateSettings?.column_settings?.optional?.variant !== false) && (
                      <td className="col-shrink relative">
                        <VariantCellInner
                          value={item.variant_id}
                          variants={variants}
                          itemId={item.item_id || ''}
                          variantPricing={variantPricing}
                          onChange={(nextVariant) => {
                            const selectedVariant = variants.find((v: any) => v.id === nextVariant);
                            handleItemChange(index, 'variant_id', nextVariant);
                            handleItemChange(index, 'variant', selectedVariant?.variant_name || null);
                          }}
                        />
                      </td>
                    )}

                    {/* Discount Category */}
                    <td>
                      <select
                        className="cell-input text-center"
                        value={item.discount_category_id || ''}
                        onChange={(e) => handleItemChange(index, 'discount_category_id', e.target.value || null)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px' }}
                      >
                        <option value="">None</option>
                        {discountCategories.map((dc: any) => (
                          <option key={dc.id} value={dc.id}>{dc.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Qty with draft pattern */}
                    <td>
                      <input
                        type="text"
                        className="cell-input text-right font-medium"
                        placeholder="0.00"
                        value={itemId in qtyDrafts ? qtyDrafts[String(itemId)] : (item.qty === null ? '' : item.qty)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (/^\d*\.?\d*$/.test(raw)) {
                            setQtyDrafts((prev) => ({ ...prev, [String(itemId)]: raw }));
                          }
                        }}
                        onBlur={() => commitQtyInput(itemId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitQtyInput(itemId);
                          if (e.key === 'Escape') resetQtyInput(itemId);
                        }}
                      />
                    </td>

                    {/* Unit */}
                    {(templateSettings?.column_settings?.optional?.unit !== false) && (
                      <td>
                        <UnitDropdownSelect
                          value={item.unit ?? ''}
                          materialId={item.item_id || ''}
                          materials={materials}
                          onChange={(val) => handleItemChange(index, 'unit', val)}
                        />
                      </td>
                    )}

                    {/* Rate */}
                    <td>
                      <input
                        type="number"
                        className="cell-input text-right"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))}
                        min="0"
                        step="0.01"
                      />
                    </td>

                    {/* Discount % */}
                    {(templateSettings?.column_settings?.optional?.discount_percent !== false) && (
                      <td>
                        <input
                          type="number"
                          className="cell-input text-right"
                          value={item.discount_percent}
                          onChange={(e) => handleItemChange(index, 'discount_percent', Number(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                        />
                      </td>
                    )}

                    {/* Rate After Disc */}
                    {(templateSettings?.column_settings?.optional?.rate_after_discount !== false) && (
                      <td>
                        <input
                          type="number"
                          className="cell-input text-right bg-zinc-50/50 cursor-default font-medium"
                          value={item.rate_after_discount}
                          readOnly
                          placeholder="0"
                        />
                      </td>
                    )}

                    {/* Tax % */}
                    {(templateSettings?.column_settings?.optional?.tax_percent !== false) && (
                      <td>
                        <input
                          type="number"
                          className="cell-input text-right"
                          value={item.tax_percent}
                          onChange={(e) => handleItemChange(index, 'tax_percent', Number(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="18"
                        />
                      </td>
                    )}

                    {/* Custom 1 */}
                    {templateSettings?.column_settings?.optional?.custom1 !== false && templateSettings?.column_settings?.labels && (
                      <td>
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.custom1 || ''}
                          onChange={(e) => handleItemChange(index, 'custom1', e.target.value)}
                          placeholder={templateSettings.column_settings.labels.custom1 || 'Custom 1'}
                          style={{ width: '100%' }}
                        />
                      </td>
                    )}

                    {/* Custom 2 */}
                    {templateSettings?.column_settings?.optional?.custom2 !== false && templateSettings?.column_settings?.labels && (
                      <td>
                        <input
                          type="text"
                          className="cell-input text-center"
                          value={item.custom2 || ''}
                          onChange={(e) => handleItemChange(index, 'custom2', e.target.value)}
                          placeholder={templateSettings.column_settings.labels.custom2 || 'Custom 2'}
                          style={{ width: '100%' }}
                        />
                      </td>
                    )}

                    {/* Amount */}
                    <td className="text-right pr-4 font-semibold text-[12px] pt-2 tabular-nums" style={{ color: '#0f172a' }}>
                      {formatCurrency(item.amount)}
                    </td>

                    {/* Actions: Move To + Delete */}
                    <td className="text-center pt-1.5">
                      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', position: 'relative' }}>
                        <button
                          type="button"
                          className="btn-move-to"
                          onClick={() => openMoveToDialog(itemId, sno)}
                          style={{
                            padding: '2px 4px',
                            fontSize: '11px',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            borderRadius: '3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Move to S.No"
                        >
                          <ArrowUpDown size={11} />
                        </button>

                        {moveToDialog && moveToDialog.itemId === itemId && (
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
                                &times;
                              </button>
                            </div>
                            {moveToDialog.error && (
                              <div style={{ color: '#dc2626', fontSize: '9px', fontWeight: 500 }}>{moveToDialog.error}</div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:bg-red-50 hover:text-red-700 w-5 h-5 rounded flex items-center justify-center transition-all"
                          disabled={items.length === 1}
                          style={{ padding: '2px 4px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Subtotal & taxes breakdown */}
              <tr className="footer-breakdown-row">
                <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4 font-semibold" style={{ textAlign: 'right' }}>Subtotal</td>
                <td className="text-right pr-4 tabular-nums font-semibold" style={{ textAlign: 'right', paddingRight: '16px' }}>
                  {formatCurrency(totals.subtotal)}
                </td>
                <td></td>
              </tr>

              {totals.discount > 0 && (
                <tr className="footer-breakdown-row">
                  <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4 text-red-600 font-medium" style={{ textAlign: 'right' }}>Discount</td>
                  <td className="text-right pr-4 tabular-nums text-red-600 font-medium" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    -{formatCurrency(totals.discount)}
                  </td>
                  <td></td>
                </tr>
              )}

              {totals.cgst > 0 && (
                <tr className="footer-breakdown-row">
                  <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4" style={{ textAlign: 'right' }}>CGST</td>
                  <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {formatCurrency(totals.cgst)}
                  </td>
                  <td></td>
                </tr>
              )}

              {totals.sgst > 0 && (
                <tr className="footer-breakdown-row">
                  <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4" style={{ textAlign: 'right' }}>SGST</td>
                  <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {formatCurrency(totals.sgst)}
                  </td>
                  <td></td>
                </tr>
              )}

              {totals.igst > 0 && (
                <tr className="footer-breakdown-row">
                  <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4" style={{ textAlign: 'right' }}>IGST</td>
                  <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {formatCurrency(totals.igst)}
                  </td>
                  <td></td>
                </tr>
              )}

              {roundOff && totals.roundOffAmount !== 0 && (
                <tr className="footer-breakdown-row">
                  <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4" style={{ textAlign: 'right' }}>Round Off</td>
                  <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                    {formatCurrency(totals.roundOffAmount)}
                  </td>
                  <td></td>
                </tr>
              )}

              <tr className="footer-breakdown-row grand-total-row">
                <td colSpan={getColsBeforeAmount() + 1} className="text-right pr-4" style={{ textAlign: 'right' }}>Grand Total</td>
                <td className="text-right pr-4 tabular-nums" style={{ textAlign: 'right', paddingRight: '16px' }}>
                  {formatCurrency(totals.total)}
                </td>
                <td></td>
              </tr>

              {totals.amountInWords && (
                <tr className="footer-breakdown-row amount-words-row">
                  <td colSpan={getVisibleColumnCount() + 1} className="text-right pr-4" style={{ textAlign: 'right' }}>
                    INR {totals.amountInWords}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
