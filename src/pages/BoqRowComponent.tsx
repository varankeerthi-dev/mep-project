import React, { useState, useMemo, memo, useRef, useEffect } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

interface BoqRowProps {
  row: any;
  index: number;
  sno: number;
  visibleColumns: any[];
  sheetId: string;
  variants: any[];
  makes: (string | null | undefined)[];
  defaultVariantId: string;
  baseDiscount: number;
  priceMap: Map<string, number>;
  onUpdate: (index: number, field: string, value: any) => void;
  onDelete: (index: number) => void;
  onInsert: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onFocus: (index: number) => void;
  onMaterialPick: (index: number, mat: any) => void;
  materials: any[];
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>;
  materialSearchActive: { sheetId: string; index: number } | null;
  setMaterialSearchActive: (v: { sheetId: string; index: number } | null) => void;
  getVariantDiscount: (variantId: string) => number;
}

const FIELD_ORDER = ['itemId', 'variantId', 'make', 'quantity', 'rate', 'discountPercent', 'specification', 'remarks'];

const calcRow = (rate: any, discountPercent: any, quantity: any) => {
  const r = parseFloat(rate) || 0;
  const d = parseFloat(discountPercent) || 0;
  const q = parseFloat(quantity) || 0;
  const rateAfterDiscount = Math.round(r - (r * d) / 100);
  const totalAmount = rateAfterDiscount * q;
  return { rateAfterDiscount, totalAmount };
};

const cellInputStyle: React.CSSProperties = {
  width: '100%', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '3px',
  fontSize: '12px', background: '#fff', outline: 'none', boxSizing: 'border-box'
};
const iconBtnStyle: React.CSSProperties = {
  padding: '2px', border: '1px solid transparent', background: 'transparent',
  cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center'
};
const excelCellStyle: React.CSSProperties = {
  padding: '2px 4px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
  borderLeft: '1px solid #e2e8f0', background: '#fff'
};
const excelRowHeaderCellStyle: React.CSSProperties = {
  background: '#f3f4f6', borderRight: '1px solid #cbd5e1'
};

export function BoqRowComponent({
  row, index, sno, visibleColumns, sheetId, variants, makes,
  defaultVariantId, baseDiscount,
  onUpdate, onDelete, onInsert, onDragStart, onDrop, onFocus,
  onMaterialPick, materials, inputRefs,
  materialSearchActive, setMaterialSearchActive, getVariantDiscount,
}: BoqRowProps) {
  const [localSearch, setLocalSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredMats = useMemo(() => {
    if (!localSearch) return materials.slice(0, 10);
    const s = localSearch.toLowerCase();
    return materials.filter((m: any) => m.name.toLowerCase().includes(s)).slice(0, 10);
  }, [localSearch, materials]);

  const { rateAfterDiscount, totalAmount } = useMemo(
    () => calcRow(row.rate, row.discountPercent, row.quantity),
    [row.rate, row.discountPercent, row.quantity],
  );

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const fi = FIELD_ORDER.indexOf(field);
      if (fi < FIELD_ORDER.length - 1) {
        const nextKey = `${sheetId}-${index}-${FIELD_ORDER[fi + 1]}`;
        inputRefs.current[nextKey]?.focus();
      } else if (e.key === 'Enter') {
        onInsert(index);
      }
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
      e.preventDefault();
      inputRefs.current[`${sheetId}-${index + 1}-${field}`]?.focus();
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
      e.preventDefault();
      inputRefs.current[`${sheetId}-${index - 1}-${field}`]?.focus();
    }
  };

  if (row.isHeaderRow) {
    return (
      <tr style={{ background: '#e8e8e8' }} draggable onDragStart={(e) => onDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(index)}>
        <td colSpan={visibleColumns.length} style={{ padding: '6px 8px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ cursor: 'grab', color: '#9ca3af' }}><GripVertical size={14} /></span>
            <button onClick={() => onDelete(index)} style={iconBtnStyle} title="Delete Header Row"><Trash2 size={14} /></button>
            <input type="text" defaultValue={row.headerText} key={`${row.id}-header`}
              onBlur={(e) => onUpdate(index, 'headerText', e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 'bold', width: '100%', fontSize: '13px' }} />
          </div>
        </td>
      </tr>
    );
  }

  const isRowEmpty = !row.description && !row.itemId && !row.quantity && !row.rate;
  const effectiveVariantId = row.variantId || defaultVariantId;
  const base = getVariantDiscount(effectiveVariantId);
  const currentDisc = parseFloat(String(row.discountPercent)) || 0;
  const isOverride = row.discountPercent !== '' && row.discountPercent !== null && currentDisc !== base;

  return (
    <tr style={{ background: '#fff' }} draggable onDragStart={(e) => onDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(index)}>
      {visibleColumns.map((col: any) => (
        <td key={col.key} style={{ ...excelCellStyle, ...(col.key === 'rowControl' || col.key === 'sno' ? excelRowHeaderCellStyle : {}) }}>
          {col.key === 'rowControl' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ cursor: 'grab', color: '#9ca3af' }}><GripVertical size={14} /></span>
              <button onClick={() => onDelete(index)} style={iconBtnStyle}><Trash2 size={14} /></button>
            </div>
          )}
          {col.key === 'sno' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{isRowEmpty ? '' : sno}</span>
              <button onClick={() => onInsert(index)} style={iconBtnStyle} title="Insert Row Below"><Plus size={12} /></button>
            </div>
          )}
          {col.key === 'description' && (
            <div style={{ position: 'relative' }}>
              <input type="text" defaultValue={row.description || ''} key={`${row.id}-desc`}
                onFocus={(e) => { setLocalSearch(e.target.value); setShowDropdown(true); onFocus(index); e.target.select(); }}
                onChange={(e) => { setLocalSearch(e.target.value); setShowDropdown(true); }}
                onBlur={(e) => {
                  setTimeout(() => {
                    setShowDropdown(false);
                    const value = e.target.value.trim();
                    onUpdate(index, 'description', value);
                    if (!row.itemId && value) {
                      const match = materials.find((m: any) => m.name?.toLowerCase() === value.toLowerCase());
                      if (match) onMaterialPick(index, match);
                    }
                  }, 200);
                }}
                style={cellInputStyle}
                ref={(el) => { inputRefs.current[`${sheetId}-${index}-itemId`] = el; }}
                onKeyDown={(e) => handleKeyDown(e, 'itemId')} />
              {showDropdown && filteredMats.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 4px 8px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto', zIndex: 1000 }}>
                  {filteredMats.map((m: any) => (
                    <div key={m.id} onMouseDown={() => { onMaterialPick(index, m); setShowDropdown(false); setLocalSearch(''); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }}>{m.name}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {col.key === 'hsn_sac' && <input type="text" defaultValue={row.hsn_sac || ''} key={`${row.id}-hsn`} onBlur={(e) => onUpdate(index, 'hsn_sac', e.target.value)} onFocus={() => onFocus(index)} style={cellInputStyle} />}
          {col.key === 'variant' && (
            <select value={row.variantId || defaultVariantId || ''}
              onChange={(e) => { const v = variants.find((vv: any) => vv.id === e.target.value); onUpdate(index, 'variantId', e.target.value); onUpdate(index, 'variantName', v?.variant_name || ''); onUpdate(index, 'discountPercent', getVariantDiscount(e.target.value)); }}
              style={cellInputStyle} ref={(el) => { inputRefs.current[`${sheetId}-${index}-variantId`] = el; }} onKeyDown={(e: any) => handleKeyDown(e, 'variantId')} onFocus={() => onFocus(index)}>
              <option value="">Select</option>
              {variants.map((v: any) => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
            </select>
          )}
          {col.key === 'make' && (
            <select value={row.make || ''} onChange={(e) => onUpdate(index, 'make', e.target.value)}
              style={cellInputStyle} ref={(el) => { inputRefs.current[`${sheetId}-${index}-make`] = el; }} onKeyDown={(e: any) => handleKeyDown(e, 'make')} onFocus={() => onFocus(index)}>
              <option value="">Select</option>
              {makes.map((m) => m && <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {col.key === 'quantity' && <input type="number" defaultValue={row.quantity || ''} key={`${row.id}-qty`} onBlur={(e) => onUpdate(index, 'quantity', e.target.value)} style={cellInputStyle} ref={(el) => { inputRefs.current[`${sheetId}-${index}-quantity`] = el; }} onKeyDown={(e) => handleKeyDown(e, 'quantity')} onFocus={() => onFocus(index)} />}
          {col.key === 'unit' && <input type="text" defaultValue={row.unit || ''} key={`${row.id}-unit`} onBlur={(e) => onUpdate(index, 'unit', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />}
          {col.key === 'rate' && <input type="number" defaultValue={row.rate || ''} key={`${row.id}-rate`} onBlur={(e) => onUpdate(index, 'rate', e.target.value)} style={cellInputStyle} ref={(el) => { inputRefs.current[`${sheetId}-${index}-rate`] = el; }} onKeyDown={(e) => handleKeyDown(e, 'rate')} onFocus={() => onFocus(index)} />}
          {col.key === 'discountPercent' && (
            <div style={{ position: 'relative' }}>
              <input type="number" defaultValue={row.discountPercent || ''} key={`${row.id}-disc`} onBlur={(e) => onUpdate(index, 'discountPercent', e.target.value)}
                style={{ ...cellInputStyle, background: isOverride ? '#fff7cc' : '#fff', borderColor: isOverride ? '#f59e0b' : '#e2e8f0' }}
                ref={(el) => { inputRefs.current[`${sheetId}-${index}-discountPercent`] = el; }} onKeyDown={(e) => handleKeyDown(e, 'discountPercent')} title={isOverride ? `Override (default ${base}%)` : `Default ${base}%`} onFocus={() => onFocus(index)} />
              {isOverride && <span style={{ position: 'absolute', top: '-9px', right: '4px', background: '#f59e0b', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '3px' }}>OVR</span>}
            </div>
          )}
          {col.key === 'rateAfterDiscount' && <span style={{ display: 'block', padding: '6px', color: '#333' }}>{rateAfterDiscount ? `₹${rateAfterDiscount}` : '-'}</span>}
          {col.key === 'totalAmount' && <span style={{ display: 'block', padding: '6px', fontWeight: '500', color: '#1976d2' }}>{totalAmount ? `₹${totalAmount.toLocaleString()}` : '-'}</span>}
          {col.key === 'specification' && <input type="text" defaultValue={row.specification || ''} key={`${row.id}-spec`} onBlur={(e) => onUpdate(index, 'specification', e.target.value)} style={cellInputStyle} ref={(el) => { inputRefs.current[`${sheetId}-${index}-specification`] = el; }} onKeyDown={(e) => handleKeyDown(e, 'specification')} onFocus={() => onFocus(index)} />}
          {col.key === 'remarks' && <input type="text" defaultValue={row.remarks || ''} key={`${row.id}-rmk`} onBlur={(e) => onUpdate(index, 'remarks', e.target.value)} style={cellInputStyle} ref={(el) => { inputRefs.current[`${sheetId}-${index}-remarks`] = el; }} onKeyDown={(e) => handleKeyDown(e, 'remarks')} onFocus={() => onFocus(index)} />}
          {col.key === 'pressure' && <input type="text" defaultValue={row.pressure || ''} key={`${row.id}-pres`} onBlur={(e) => onUpdate(index, 'pressure', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />}
          {col.key === 'thickness' && <input type="text" defaultValue={row.thickness || ''} key={`${row.id}-thk`} onBlur={(e) => onUpdate(index, 'thickness', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />}
          {col.key === 'schedule' && <input type="text" defaultValue={row.schedule || ''} key={`${row.id}-sch`} onBlur={(e) => onUpdate(index, 'schedule', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />}
          {col.key === 'material' && <input type="text" defaultValue={row.material || ''} key={`${row.id}-mat`} onBlur={(e) => onUpdate(index, 'material', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />}
        </td>
      ))}
    </tr>
  );
}

export default React.memo(BoqRowComponent);