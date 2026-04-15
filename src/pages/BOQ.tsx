import React, {
  useState, useEffect, useCallback, useMemo, useRef, memo,
} from 'react';
import ReactDOM from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Save, FileDown, Plus, Trash2, Sheet, Table, X,
  Settings, FileSpreadsheet, Loader2, GripVertical,
} from 'lucide-react';
import { openSansRegular, openSansBold } from '../fonts/openSans';
import { saveBOQWithItems, fetchBOQById } from '../api';
import { timedSupabaseQuery, withTimeout } from '../utils/queryTimeout';
import { useMaterials } from '../hooks/useMaterials';
import { useClients } from '../hooks/useClients';
import { useProjects } from '../hooks/useProjects';
import { useVariants } from '../hooks/useVariants';

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateId = () => `temp-${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_TERMS = [
  'All prices are inclusive of applicable taxes unless specified otherwise.',
  'Delivery timeline will be confirmed after order acceptance.',
  'Payment terms: 50% advance, balance within 7 days of delivery.',
  'Warranty as per manufacturer standard terms.',
  'Any variation in quantities will be billed as per actuals.',
  'Freight and handling charges are extra unless specified.',
  'Offer valid for 15 days from the BOQ date.',
].map((t, i) => `${i + 1}. ${t}`).join('\n');

const getColumnLabel = (index: number) => {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

const calcRow = (rate: any, discountPercent: any, quantity: any) => {
  const r = parseFloat(rate) || 0;
  const d = parseFloat(discountPercent) || 0;
  const q = parseFloat(quantity) || 0;
  const rateAfterDiscount = Math.round(r - (r * d) / 100);
  const totalAmount = rateAfterDiscount * q;
  return { rateAfterDiscount, totalAmount };
};

// ─── Types ───────────────────────────────────────────────────────────────────

type BoqFormData = {
  id: string | null; boqNo: string; revisionNo: number; date: string;
  clientId: string; projectId: string; variantId: string;
  status: string; termsConditions: string; preface: string;
};
type ClientOption = { id: string; client_name: string; discount_profile_id?: string | null; custom_discounts?: Record<string, number | string> | null; };
type ProjectOption = { id: string; project_name?: string | null; name?: string | null; };
type VariantOption = { id: string; variant_name: string; };
type MaterialOption = { id: string; name: string; sale_price?: number | string | null; make?: string | null; hsn_code?: string | null; hsn?: string | null; hsn_sac?: string | null; unit?: string | null; };
type DiscountEntry = { discount: number; variantName: string; };
type DiscountMap = Record<string, DiscountEntry>;
type BoqSheet = { id: string; name: string; isDefault: boolean; };
type BoqRow = {
  id: string; isHeaderRow: boolean; headerText?: string;
  itemId?: string; variantId?: string; variantName?: string; make?: string;
  quantity?: string | number; rate?: string | number; discountPercent?: string | number;
  hsn_sac?: string; unit?: string; specification?: string; remarks?: string;
  pressure?: string; thickness?: string; schedule?: string; material?: string; description?: string;
};
type ItemsBySheet = Record<string, BoqRow[]>;
type ColumnSetting = { key: string; label: string; width: number; visible: boolean; };
type PendingDiscountChange = { variantId: string; discount: number; prevDiscount: number; } | null;
type LoadedBoqHeader = {
  id: string; boq_no?: string | null; revision_no?: number | null; boq_date?: string | null;
  client_id?: string | null; project_id?: string | null; variant_id?: string | null;
  status?: string | null; terms_conditions?: string | null; preface?: string | null;
  sheets?: Array<{
    id: string; sheet_name?: string | null; is_default?: boolean | null; sheet_order?: number | null;
    items?: Array<{
      id: string; is_header_row?: boolean | null; header_text?: string | null;
      item_id?: string | null; variant_id?: string | null; make?: string | null;
      quantity?: string | number | null; rate?: string | number | null;
      discount_percent?: string | number | null; specification?: string | null;
      remarks?: string | null; pressure?: string | null; thickness?: string | null;
      schedule?: string | null; material?: string | null; row_order?: number | null;
    }>;
  }>;
};
type BoqInitData = {
  clients: ClientOption[]; projects: ProjectOption[]; variants: VariantOption[];
  materials: MaterialOption[]; header: LoadedBoqHeader | null; newBoqNo: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnSetting[] = [
  { key: 'rowControl', label: '', width: 40, visible: true },
  { key: 'sno', label: 'S.No', width: 50, visible: true },
  { key: 'hsn_sac', label: 'HSN/SAC', width: 90, visible: true },
  { key: 'description', label: 'Description', width: 250, visible: true },
  { key: 'variant', label: 'Variant', width: 100, visible: true },
  { key: 'make', label: 'Make', width: 100, visible: true },
  { key: 'quantity', label: 'Qty', width: 70, visible: true },
  { key: 'unit', label: 'Unit', width: 70, visible: true },
  { key: 'rate', label: 'Price', width: 100, visible: true },
  { key: 'discountPercent', label: 'Disc %', width: 70, visible: true },
  { key: 'rateAfterDiscount', label: 'Rate/Unit', width: 110, visible: true },
  { key: 'totalAmount', label: 'Total Amount', width: 120, visible: true },
  { key: 'specification', label: 'Specification', width: 150, visible: true },
  { key: 'remarks', label: 'Remarks', width: 120, visible: true },
  { key: 'pressure', label: 'Pressure', width: 80, visible: false },
  { key: 'thickness', label: 'Thickness', width: 80, visible: false },
  { key: 'schedule', label: 'Schedule', width: 80, visible: false },
  { key: 'material', label: 'Material', width: 100, visible: false },
];

const DEFAULT_SHEETS: BoqSheet[] = [
  { id: generateId(), name: 'BOQ Sheet 1', isDefault: true },
  { id: generateId(), name: 'Terms', isDefault: false },
  { id: generateId(), name: 'Preface', isDefault: false },
];

const FIELD_ORDER = ['itemId', 'variantId', 'make', 'quantity', 'rate', 'discountPercent', 'specification', 'remarks'];

// ─── Memoized Row Component ───────────────────────────────────────────────────
// This is the KEY performance win: only the row that changed re-renders.

type BoqRowProps = {
  row: BoqRow;
  index: number;
  sno: number;
  visibleColumns: ColumnSetting[];
  columnWidths: Record<string, number>;
  sheetId: string;
  variants: VariantOption[];
  makes: (string | null | undefined)[];
  defaultVariantId: string;
  baseDiscount: number;
  priceMap: Map<string, number>;
  // callbacks
  onUpdate: (index: number, field: string, value: any) => void;
  onDelete: (index: number) => void;
  onInsert: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onFocus: (index: number) => void;
  onMaterialPick: (index: number, mat: MaterialOption) => void;
  onShowDropdown: (show: boolean, items: MaterialOption[], rect: { top: number; left: number; width: number }, rowIndex: number) => void;
  rowIndex: number;
  materials: MaterialOption[];
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>;
  materialSearchActive: { sheetId: string; index: number } | null;
  setMaterialSearchActive: (v: { sheetId: string; index: number } | null) => void;
  getVariantDiscount: (variantId: string) => number;
};

const BoqRowComponent = memo(({
  row, index, sno, visibleColumns, columnWidths, sheetId, variants, makes,
  defaultVariantId, baseDiscount, priceMap,
  onUpdate, onDelete, onInsert, onDragStart, onDrop, onFocus,
  onMaterialPick, onShowDropdown, rowIndex, materials, inputRefs,
  materialSearchActive, setMaterialSearchActive, getVariantDiscount,
}: BoqRowProps) => {
  // Local search state — lives inside this row only, no global re-render
  const [localSearch, setLocalSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredMats = useMemo(() => {
    if (!localSearch) return materials.slice(0, 10);
    const s = localSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(s)).slice(0, 10);
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
      <tr
        style={{ background: '#e8e8e8' }}
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop(index)}
      >
        <td colSpan={visibleColumns.length} style={{ padding: '6px 8px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ cursor: 'grab', color: '#9ca3af' }}><GripVertical size={14} /></span>
            <button onClick={() => onDelete(index)} style={iconBtnStyle} title="Delete Header Row">
              <Trash2 size={14} />
            </button>
            {/* Uncontrolled input — only flushes on blur */}
            <input
              type="text"
              defaultValue={row.headerText}
              onBlur={(e) => onUpdate(index, 'headerText', e.target.value)}
              style={{ border: 'none', background: 'transparent', fontWeight: 'bold', width: '100%', fontSize: '13px' }}
            />
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
    <tr
      style={{ background: '#fff' }}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(index)}
    >
      {visibleColumns.map(col => (
        <td key={col.key} style={{
          ...excelCellStyle,
          width: columnWidths[col.key] || col.width,
          minWidth: columnWidths[col.key] || col.width,
          maxWidth: columnWidths[col.key] || col.width,
          ...(col.key === 'rowControl' || col.key === 'sno' ? excelRowHeaderCellStyle : {}),
        }}>
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
            <div style={{ position: 'relative', overflow: 'visible' }}>
              <input
                type="text"
                defaultValue={row.description || ''}
                key={`${row.id}-desc`}
                onFocus={(e) => {
                  const rect = e.target.getBoundingClientRect();
                  onShowDropdown(true, filteredMats, { top: rect.bottom, left: rect.left, width: rect.width }, rowIndex);
                  onFocus(index);
                  e.target.select();
                }}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  const rect = e.target.getBoundingClientRect();
                  onShowDropdown(true, filteredMats, { top: rect.bottom, left: rect.left, width: rect.width }, rowIndex);
                }}
                onBlur={(e) => {
                  setTimeout(() => {
                    onShowDropdown(false, [], { top: 0, left: 0, width: 0 }, rowIndex);
                    const value = e.target.value.trim();
                    onUpdate(index, 'description', value);
                  }, 200);
                }}
                style={cellInputStyle}
                ref={(el) => { inputRefs.current[`${sheetId}-${index}-itemId`] = el; }}
                onKeyDown={(e) => handleKeyDown(e, 'itemId')}
              />
            </div>
          )}
          {col.key === 'hsn_sac' && (
            <input
              type="text"
              defaultValue={row.hsn_sac || ''}
              key={`${row.id}-hsn`}
              onBlur={(e) => onUpdate(index, 'hsn_sac', e.target.value)}
              onFocus={() => onFocus(index)}
              style={cellInputStyle}
            />
          )}
          {col.key === 'variant' && (
            <select
              value={row.variantId || defaultVariantId || ''}
              onChange={(e) => {
                const v = variants.find(vv => vv.id === e.target.value);
                onUpdate(index, 'variantId', e.target.value);
                onUpdate(index, 'variantName', v?.variant_name || '');
                onUpdate(index, 'discountPercent', getVariantDiscount(e.target.value));
              }}
              style={cellInputStyle}
              ref={(el) => { inputRefs.current[`${sheetId}-${index}-variantId`] = el; }}
              onKeyDown={(e: any) => handleKeyDown(e, 'variantId')}
              onFocus={() => onFocus(index)}
            >
              <option value="">Select</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
            </select>
          )}
          {col.key === 'make' && (
            <select
              value={row.make || ''}
              onChange={(e) => onUpdate(index, 'make', e.target.value)}
              style={cellInputStyle}
              ref={(el) => { inputRefs.current[`${sheetId}-${index}-make`] = el; }}
              onKeyDown={(e: any) => handleKeyDown(e, 'make')}
              onFocus={() => onFocus(index)}
            >
              <option value="">Select</option>
              {makes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {col.key === 'quantity' && (
            <input
              type="number"
              defaultValue={row.quantity || ''}
              key={`${row.id}-qty`}
              onBlur={(e) => onUpdate(index, 'quantity', e.target.value)}
              style={cellInputStyle}
              ref={(el) => { inputRefs.current[`${sheetId}-${index}-quantity`] = el; }}
              onKeyDown={(e) => handleKeyDown(e, 'quantity')}
              onFocus={() => onFocus(index)}
            />
          )}
          {col.key === 'unit' && (
            <input
              type="text"
              defaultValue={row.unit || ''}
              key={`${row.id}-unit`}
              onBlur={(e) => onUpdate(index, 'unit', e.target.value)}
              style={cellInputStyle}
              onFocus={() => onFocus(index)}
            />
          )}
          {col.key === 'rate' && (
            <input
              type="number"
              defaultValue={row.rate || ''}
              key={`${row.id}-rate`}
              onBlur={(e) => onUpdate(index, 'rate', e.target.value)}
              style={cellInputStyle}
              ref={(el) => { inputRefs.current[`${sheetId}-${index}-rate`] = el; }}
              onKeyDown={(e) => handleKeyDown(e, 'rate')}
              onFocus={() => onFocus(index)}
            />
          )}
          {col.key === 'discountPercent' && (
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                defaultValue={row.discountPercent || ''}
                key={`${row.id}-disc`}
                onBlur={(e) => onUpdate(index, 'discountPercent', e.target.value)}
                style={{
                  ...cellInputStyle,
                  background: isOverride ? '#fff7cc' : '#fff',
                  borderColor: isOverride ? '#f59e0b' : '#e2e8f0',
                }}
                ref={(el) => { inputRefs.current[`${sheetId}-${index}-discountPercent`] = el; }}
                onKeyDown={(e) => handleKeyDown(e, 'discountPercent')}
                title={isOverride ? `Override (default ${base}%)` : `Default ${base}%`}
                onFocus={() => onFocus(index)}
              />
              {isOverride && <span style={discountOverrideBadgeStyle}>OVR</span>}
            </div>
          )}
          {col.key === 'rateAfterDiscount' && (
            <span style={{ display: 'block', padding: '6px', color: '#333' }}>
              {rateAfterDiscount ? `₹${rateAfterDiscount}` : '-'}
            </span>
          )}
          {col.key === 'totalAmount' && (
            <span style={{ display: 'block', padding: '6px', fontWeight: '500', color: '#1976d2' }}>
              {totalAmount ? `₹${totalAmount.toLocaleString()}` : '-'}
            </span>
          )}
          {col.key === 'specification' && (
            <input
              type="text"
              defaultValue={row.specification || ''}
              key={`${row.id}-spec`}
              onBlur={(e) => onUpdate(index, 'specification', e.target.value)}
              style={cellInputStyle}
              ref={(el) => { inputRefs.current[`${sheetId}-${index}-specification`] = el; }}
              onKeyDown={(e) => handleKeyDown(e, 'specification')}
              onFocus={() => onFocus(index)}
            />
          )}
          {col.key === 'remarks' && (
            <input
              type="text"
              defaultValue={row.remarks || ''}
              key={`${row.id}-rmk`}
              onBlur={(e) => onUpdate(index, 'remarks', e.target.value)}
              style={cellInputStyle}
              ref={(el) => { inputRefs.current[`${sheetId}-${index}-remarks`] = el; }}
              onKeyDown={(e) => handleKeyDown(e, 'remarks')}
              onFocus={() => onFocus(index)}
            />
          )}
          {col.key === 'pressure' && (
            <input type="text" defaultValue={row.pressure || ''} key={`${row.id}-pres`}
              onBlur={(e) => onUpdate(index, 'pressure', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />
          )}
          {col.key === 'thickness' && (
            <input type="text" defaultValue={row.thickness || ''} key={`${row.id}-thk`}
              onBlur={(e) => onUpdate(index, 'thickness', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />
          )}
          {col.key === 'schedule' && (
            <input type="text" defaultValue={row.schedule || ''} key={`${row.id}-sch`}
              onBlur={(e) => onUpdate(index, 'schedule', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />
          )}
          {col.key === 'material' && (
            <input type="text" defaultValue={row.material || ''} key={`${row.id}-mat`}
              onBlur={(e) => onUpdate(index, 'material', e.target.value)} style={cellInputStyle} onFocus={() => onFocus(index)} />
          )}
        </td>
      ))}
    </tr>
  );
}, (prev, next) => {
  // Custom equality: only re-render if THIS row's data changed
  return (
    prev.row === next.row &&
    prev.sno === next.sno &&
    prev.visibleColumns === next.visibleColumns &&
    prev.columnWidths === next.columnWidths &&
    prev.defaultVariantId === next.defaultVariantId &&
    prev.materialSearchActive === next.materialSearchActive &&
    prev.baseDiscount === next.baseDiscount &&
    prev.materials === next.materials &&
    prev.makes === next.makes &&
    prev.onShowDropdown === next.onShowDropdown
  );
});

BoqRowComponent.displayName = 'BoqRowComponent';

// ─── Main Component ───────────────────────────────────────────────────────────

export function BOQ() {
  const { data: materials = [] } = useMaterials();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: variants = [] } = useVariants();
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const editId = searchParams.get('editId');

  const [boqData, setBoqData] = useState<BoqFormData>({
    id: null, boqNo: '', revisionNo: 1,
    date: new Date().toISOString().split('T')[0],
    clientId: '', projectId: '', variantId: '',
    status: 'Draft', termsConditions: '', preface: '',
  });

  const [boqVariantDiscounts, setBoqVariantDiscounts] = useState<Record<string, number>>({});
  const [sheets, setSheets] = useState<BoqSheet[]>(DEFAULT_SHEETS);
  const [activeSheetId, setActiveSheetId] = useState(DEFAULT_SHEETS[0].id);
  const [items, setItems] = useState<ItemsBySheet>({});
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(DEFAULT_COLUMNS);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({});
  const [exportSheets, setExportSheets] = useState<Record<string, boolean>>({});
  const [exportOrientation, setExportOrientation] = useState('landscape');
  const [saveError, setSaveError] = useState('');
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [showDiscountApplyModal, setShowDiscountApplyModal] = useState(false);
  const [pendingDiscountChange, setPendingDiscountChange] = useState<PendingDiscountChange>(null);
  const [discountApplyMode, setDiscountApplyMode] = useState('skip');
  const [showStockCheckModal, setShowStockCheckModal] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<Record<string, boolean>>({});
  const [launchingStockCheck, setLaunchingStockCheck] = useState(false);
  const [materialSearchActive, setMaterialSearchActive] = useState<{ sheetId: string; index: number } | null>(null);
  const [dropdownPortal, setDropdownPortal] = useState<{ sheetId: string; rowIndex: number; items: MaterialOption[]; position: { top: number; left: number; width: number } } | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>({});
  const prevDefaultVariantRef = useRef('');
  const undoStackRef = useRef<Record<string, BoqRow[][]>>({});
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedRowRef = useRef<BoqRow | null>(null);
  const hydratedKeyRef = useRef<string | null>(null);

  // ─── Virtualizer ───────────────────────────────────────────────────────────
  // This is the magic: only renders ~20 rows at a time regardless of sheet size

  const tableBodyRef = useRef<HTMLDivElement>(null);
  const currentItems = useMemo(() => items[activeSheetId] || [], [items, activeSheetId]);

  const virtualizer = useVirtualizer({
    count: currentItems.length,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => 28, // estimated row height in px
    overscan: 10,           // render 10 rows above/below viewport
  });

  // ─── Price Map: load ALL pricing upfront for selected variant ──────────────
  // Zero network calls during row editing — pure in-memory Map lookup

  const priceMapQuery = useQuery<Map<string, number>>({
    queryKey: ['boqPriceMap', boqData.variantId],
    queryFn: async () => {
      const [variantPrices, makePrices] = await Promise.all([
        boqData.variantId ? timedSupabaseQuery(
          supabase
            .from('item_variant_pricing')
            .select('item_id, sale_price, make')
            .eq('company_variant_id', boqData.variantId)
            .eq('is_active', true),
          'BOQ price map variant',
        ) : Promise.resolve(null),
        timedSupabaseQuery(
          supabase
            .from('item_variant_pricing')
            .select('item_id, sale_price, make, company_variant_id')
            .eq('is_active', true),
          'BOQ price map all',
        ),
      ]);

      const map = new Map<string, number>();
      // Key format: `${itemId}__${variantId}__${make}`
      (makePrices || []).forEach((p: any) => {
        map.set(`${p.item_id}__${p.company_variant_id}__${p.make || ''}`, parseFloat(p.sale_price) || 0);
      });
      return map;
    },
  });

  const priceMap = priceMapQuery.data || new Map();

  const getPriceFromMap = useCallback((itemId: string, variantId: string, make: string): number => {
    // 1. make-specific
    const withMake = priceMap.get(`${itemId}__${variantId}__${make}`);
    if (withMake) return withMake;
    // 2. variant only (empty make)
    const withVariant = priceMap.get(`${itemId}__${variantId}__`);
    if (withVariant) return withVariant;
    // 3. fallback to base material price
    return 0;
  }, [priceMap]);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const generateBoqNumber = useCallback(async () => {
    try {
      const result = await withTimeout(supabase.rpc('generate_boq_number'), 15000, 'BOQ number');
      if (result.error) throw new Error(result.error.message);
      if (result.data) return result.data;
    } catch (error) {
      console.warn('Falling back to BOQ number timestamp.', error);
    }
    return `BOQ-${String(Date.now()).slice(-4)}`;
  }, []);

  const hydrateFromHeader = useCallback((header: LoadedBoqHeader | null) => {
    if (!header) return;
    setBoqData((prev) => ({
      ...prev,
      id: header.id, boqNo: header.boq_no || '',
      revisionNo: header.revision_no || 1, date: header.boq_date || prev.date,
      clientId: header.client_id || '', projectId: header.project_id || '',
      variantId: header.variant_id || '', status: header.status || 'Draft',
      termsConditions: header.terms_conditions || prev.termsConditions,
      preface: header.preface || prev.preface,
    }));

    const loadedSheets = (header.sheets || [])
      .slice().sort((a, b) => (a.sheet_order || 0) - (b.sheet_order || 0))
      .map((s) => ({ id: s.id, name: s.sheet_name || 'BOQ Sheet', isDefault: !!s.is_default }));

    if (loadedSheets.length > 0) {
      setSheets(loadedSheets);
      setActiveSheetId(loadedSheets[0].id);
    }

    const itemsMap: ItemsBySheet = {};
    (header.sheets || []).forEach((sheet) => {
      itemsMap[sheet.id] = (sheet.items || [])
        .slice().sort((a, b) => (a.row_order || 0) - (b.row_order || 0))
        .map((item) => ({
          id: item.id, isHeaderRow: !!item.is_header_row,
          headerText: item.header_text || 'SECTION',
          itemId: item.item_id || '', variantId: item.variant_id || '',
          variantName: '', make: item.make || '',
          quantity: item.quantity || '', rate: item.rate || '',
          discountPercent: item.discount_percent || '', hsn_sac: '', unit: '',
          specification: item.specification || '', remarks: item.remarks || '',
          pressure: item.pressure || '', thickness: item.thickness || '',
          schedule: item.schedule || '', material: item.material || '',
          description: item.material || '',
        }));
    });
    setItems(itemsMap);
  }, []);

  const initQuery = useQuery<BoqInitData>({
    queryKey: ['boqInit', editId || 'new'],
    queryFn: async () => {
      const headerOrBoqNo = await Promise.resolve(
        editId ? withTimeout(fetchBOQById(editId), 15000, 'BOQ details') : generateBoqNumber()
      );
      return {
        clients: clients as ClientOption[],
        projects: projects as ProjectOption[],
        variants: variants as VariantOption[],
        materials: materials as MaterialOption[],
        header: editId ? (headerOrBoqNo as LoadedBoqHeader) : null,
        newBoqNo: editId ? null : String(headerOrBoqNo || ''),
      };
    },
  });
  const makes = useMemo(() => [...new Set(materials.map(m => m.make).filter(Boolean))], [materials]);

  const clientDiscountsQuery = useQuery<DiscountMap>({
    queryKey: ['boqClientDiscounts', boqData.clientId],
    enabled: !!boqData.clientId,
    queryFn: async () => {
      const client = await timedSupabaseQuery(
        supabase.from('clients').select('id, discount_profile_id, custom_discounts').eq('id', boqData.clientId).single(),
        'BOQ client discount profile',
      );
      if (!client) return {};
      if (client.discount_profile_id) {
        const settings = await timedSupabaseQuery(
          supabase.from('discount_variant_settings')
            .select('variant_id, max_discount, variant:company_variants(variant_name)')
            .eq('structure_id', client.discount_profile_id),
          'BOQ discount settings',
        );
        const map: DiscountMap = {};
        (settings || []).forEach((s: any) => {
          if (!s.variant_id) return;
          map[s.variant_id] = { discount: s.max_discount || 0, variantName: s.variant?.variant_name || '' };
        });
        return map;
      }
      if (client.custom_discounts && typeof client.custom_discounts === 'object') {
        const map: DiscountMap = {};
        Object.entries(client.custom_discounts).forEach(([variantId, discount]) => {
          const variantName = variants.find(v => v.id === variantId)?.variant_name || '';
          map[variantId] = { discount: typeof discount === 'number' ? discount : parseFloat(String(discount)) || 0, variantName };
        });
        return map;
      }
      return {};
    },
  });

  const clientDiscounts = clientDiscountsQuery.data || {};

  const getVariantDiscount = useCallback((variantId: string) => {
    if (boqVariantDiscounts[variantId] !== undefined) return boqVariantDiscounts[variantId];
    return clientDiscounts[variantId]?.discount || 0;
  }, [boqVariantDiscounts, clientDiscounts]);

  const getVariantNameById = useCallback((variantId: string) =>
    variants.find(v => v.id === variantId)?.variant_name || '', [variants]);

  // ─── Hydration ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const hydrationKey = editId || 'new';
    if (!initQuery.data || hydratedKeyRef.current === hydrationKey) return;
    if (initQuery.data.header) {
      hydrateFromHeader(initQuery.data.header);
    } else {
      setBoqData((prev) => ({
        ...prev,
        boqNo: prev.boqNo || initQuery.data!.newBoqNo || '',
        termsConditions: prev.termsConditions || DEFAULT_TERMS,
      }));
    }
    hydratedKeyRef.current = hydrationKey;
  }, [editId, hydrateFromHeader, initQuery.data]);

  // Auto-fill descriptions from materials after load
  useEffect(() => {
    if (!materials.length) return;
    let changed = false;
    const updated = { ...items };
    Object.keys(updated).forEach(sheetId => {
      updated[sheetId] = (updated[sheetId] || []).map(row => {
        if (!row.isHeaderRow && row.itemId && !row.description) {
          const mat = materials.find(m => m.id === row.itemId);
          if (mat?.name) { changed = true; return { ...row, description: mat.name }; }
        }
        return row;
      });
    });
    if (changed) setItems(updated);
  }, [materials]);

  // Export settings persistence
  useEffect(() => {
    const key = boqData.boqNo ? `boq_export_${boqData.boqNo}` : null;
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.columns) setExportColumns(parsed.columns);
        if (parsed?.sheets) setExportSheets(parsed.sheets);
        if (parsed?.orientation) setExportOrientation(parsed.orientation);
      } catch { }
    }
  }, [boqData.boqNo]);

  useEffect(() => {
    const sel: Record<string, boolean> = {};
    sheets.forEach(s => { sel[s.id] = true; });
    setExportSheets(sel);
  }, [sheets]);

  useEffect(() => {
    const sel: Record<string, boolean> = {};
    columnSettings.forEach(c => { sel[c.key] = c.visible; });
    setExportColumns(sel);
  }, [columnSettings]);

  useEffect(() => {
    if (!items[activeSheetId]) setItems(prev => ({ ...prev, [activeSheetId]: [] }));
  }, [activeSheetId]);

  useEffect(() => { prevDefaultVariantRef.current = boqData.variantId; }, []);

  // ─── Undo — debounced: only snapshot after 500ms of no edits ──────────────

  const pushUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      const sheetId = activeSheetId;
      const snapshot = JSON.parse(JSON.stringify(items[sheetId] || []));
      if (!undoStackRef.current[sheetId]) undoStackRef.current[sheetId] = [];
      undoStackRef.current[sheetId].push(snapshot);
      if (undoStackRef.current[sheetId].length > 30) undoStackRef.current[sheetId].shift();
    }, 500);
  }, [activeSheetId, items]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const sheetId = activeSheetId;
        const last = (undoStackRef.current[sheetId] || []).pop();
        if (last) setItems(prev => ({ ...prev, [sheetId]: last }));
      }
      if (e.key.toLowerCase() === 'c') {
        if (activeRowIndex == null) return;
        const row = (items[activeSheetId] || [])[activeRowIndex];
        if (!row || row.isHeaderRow) return;
        copiedRowRef.current = { ...row };
      }
      if (e.key.toLowerCase() === 'v') {
        if (activeRowIndex == null) return;
        const row = copiedRowRef.current;
        if (!row) return;
        const list = [...(items[activeSheetId] || [])];
        const target = list[activeRowIndex];
        if (!target || target.isHeaderRow) return;
        list[activeRowIndex] = { ...row, id: target.id };
        setItems(prev => ({ ...prev, [activeSheetId]: list }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSheetId, activeRowIndex, items]);

  // ─── Auto-pad to minimum 10 rows ──────────────────────────────────────────

  useEffect(() => {
    const list = items[activeSheetId] || [];
    if (list.length >= 10) return;
    const extra = Array.from({ length: 10 - list.length }).map(() => ({
      id: generateId(), isHeaderRow: false, itemId: '', variantId: boqData.variantId,
      variantName: getVariantNameById(boqData.variantId), make: '', quantity: '', rate: '',
      discountPercent: getVariantDiscount(boqData.variantId), hsn_sac: '',
      specification: '', remarks: '', pressure: '', thickness: '', schedule: '', material: '',
    }));
    setItems(prev => ({ ...prev, [activeSheetId]: [...list, ...extra] }));
  }, [activeSheetId]);

  // ─── Row Mutation Handlers ─────────────────────────────────────────────────

  const updateItem = useCallback((index: number, field: string, value: any) => {
    pushUndo();
    setItems(prev => {
      const list = [...(prev[activeSheetId] || [])];
      list[index] = { ...list[index], [field]: value };

      if (field === 'variantId' && value && list[index].itemId) {
        const price = getPriceFromMap(list[index].itemId!, value, list[index].make || '');
        if (price) list[index] = { ...list[index], rate: price };
        list[index] = { ...list[index], discountPercent: getVariantDiscount(value) };
      }

      if (field === 'make' && list[index].itemId) {
        const vid = list[index].variantId || boqData.variantId;
        const price = getPriceFromMap(list[index].itemId!, vid, value);
        if (price) list[index] = { ...list[index], rate: price };
      }

      return { ...prev, [activeSheetId]: list };
    });
  }, [activeSheetId, pushUndo, getPriceFromMap, getVariantDiscount, boqData.variantId]);

  const handleMaterialPick = useCallback((index: number, material: MaterialOption) => {
    pushUndo();
    setItems(prev => {
      const list = [...(prev[activeSheetId] || [])];
      const row = { ...list[index] };
      row.itemId = material.id;
      row.description = material.name || row.description;
      row.hsn_sac = material.hsn_code || material.hsn || material.hsn_sac || row.hsn_sac || '';
      row.unit = material.unit || row.unit || '';
      row.make = material.make || row.make || '';
      if (!row.variantId && boqData.variantId) {
        row.variantId = boqData.variantId;
        row.variantName = getVariantNameById(boqData.variantId);
        row.discountPercent = getVariantDiscount(boqData.variantId);
      }
      // Pure map lookup — zero network
      const price = getPriceFromMap(material.id, row.variantId || boqData.variantId, row.make || '');
      row.rate = price || material.sale_price || row.rate || '';
      list[index] = row;
      return { ...prev, [activeSheetId]: list };
    });
  }, [activeSheetId, boqData.variantId, getVariantDiscount, getVariantNameById, getPriceFromMap, pushUndo]);

  const handleShowDropdown = useCallback((show: boolean, items: MaterialOption[], rect: { top: number; left: number; width: number }, rowIndex: number) => {
    if (show) {
      setDropdownPortal({
        sheetId: activeSheetId,
        rowIndex,
        items,
        position: rect,
      });
    } else {
      setDropdownPortal(null);
    }
  }, [activeSheetId]);

  const handleDropdownItemClick = useCallback((material: MaterialOption) => {
    if (dropdownPortal) {
      const { sheetId, rowIndex } = dropdownPortal;
      if (sheetId === activeSheetId && rowIndex >= 0) {
        handleMaterialPick(rowIndex, material);
      }
    }
    setDropdownPortal(null);
  }, [dropdownPortal, activeSheetId, handleMaterialPick]);

  const insertRow = useCallback((afterIndex: number) => {
    const newRow: BoqRow = {
      id: generateId(), isHeaderRow: false, itemId: '',
      variantId: boqData.variantId, variantName: getVariantNameById(boqData.variantId),
      make: '', quantity: '', rate: '', discountPercent: getVariantDiscount(boqData.variantId),
      hsn_sac: '', unit: '', specification: '', remarks: '',
      pressure: '', thickness: '', schedule: '', material: '',
    };
    setItems(prev => {
      const list = [...(prev[activeSheetId] || [])];
      list.splice(afterIndex + 1, 0, newRow);
      return { ...prev, [activeSheetId]: list };
    });
    setTimeout(() => {
      inputRefs.current[`${activeSheetId}-${afterIndex + 1}-itemId`]?.focus();
    }, 50);
  }, [activeSheetId, boqData.variantId, getVariantDiscount, getVariantNameById]);

  const deleteRow = useCallback((index: number) => {
    setItems(prev => {
      const list = (prev[activeSheetId] || []).filter((_, i) => i !== index);
      return { ...prev, [activeSheetId]: list };
    });
  }, [activeSheetId]);

  const addHeaderRow = useCallback(() => {
    const newRow: BoqRow = { id: generateId(), isHeaderRow: true, headerText: 'NEW SECTION' };
    setItems(prev => ({
      ...prev,
      [activeSheetId]: [...(prev[activeSheetId] || []), newRow],
    }));
  }, [activeSheetId]);

  // Default variant change: update all rows that use the old default
  useEffect(() => {
    const prev = prevDefaultVariantRef.current;
    if (prev === boqData.variantId) return;
    prevDefaultVariantRef.current = boqData.variantId;

    setItems(prevItems => {
      const next: ItemsBySheet = { ...prevItems };
      Object.keys(next).forEach(sheetId => {
        next[sheetId] = (next[sheetId] || []).map(row => {
          if (row.isHeaderRow) return row;
          const usesHeader = !row.variantId || row.variantId === prev;
          if (!usesHeader) return row;
          const nextVId = boqData.variantId || row.variantId || '';
          const price = row.itemId ? getPriceFromMap(row.itemId, nextVId, row.make || '') : null;
          return {
            ...row,
            variantId: nextVId,
            variantName: getVariantNameById(nextVId),
            discountPercent: getVariantDiscount(nextVId),
            ...(price ? { rate: price } : {}),
          };
        });
      });
      return next;
    });
  }, [boqData.variantId, getVariantDiscount, getVariantNameById, getPriceFromMap]);

  // ─── Discount Apply Modal ──────────────────────────────────────────────────

  const handleVariantDiscountChange = (variantId: string, value: string) => {
    const discount = parseFloat(value) || 0;
    const maxDiscount = clientDiscounts[variantId]?.discount || 100;
    if (discount > maxDiscount) { alert(`Maximum allowed discount is ${maxDiscount}%`); return; }
    const prevDiscount = getVariantDiscount(variantId);
    setPendingDiscountChange({ variantId, discount, prevDiscount });
    setDiscountApplyMode('skip');
    setShowDiscountApplyModal(true);
  };

  const applyVariantDiscountToRows = useCallback((variantId: string, newDiscount: number, prevDiscount: number, mode: string) => {
    setItems(prevItems => {
      const next = { ...prevItems };
      Object.keys(next).forEach(sheetId => {
        next[sheetId] = (next[sheetId] || []).map(row => {
          if (row.isHeaderRow) return row;
          const isTarget = row.variantId ? row.variantId === variantId : boqData.variantId === variantId;
          if (!isTarget) return row;
          if (mode === 'skip') {
            const current = row.discountPercent;
            const isOverwritten = current !== '' && current !== null && parseFloat(String(current)) !== parseFloat(String(prevDiscount || 0));
            if (isOverwritten) return row;
          }
          return { ...row, discountPercent: newDiscount };
        });
      });
      return next;
    });
  }, [boqData.variantId]);

  // ─── Sheet Management ──────────────────────────────────────────────────────

  const addNewSheet = () => {
    const s: BoqSheet = { id: generateId(), name: `BOQ Sheet ${sheets.length + 1}`, isDefault: false };
    setSheets(prev => [...prev, s]);
    setActiveSheetId(s.id);
    setItems(prev => ({ ...prev, [s.id]: [] }));
  };

  const deleteSheet = (sheetId: string) => {
    if (sheets.length <= 1) return;
    const next = sheets.filter(s => s.id !== sheetId);
    setSheets(next);
    if (activeSheetId === sheetId) setActiveSheetId(next[0].id);
    setItems(prev => { const n = { ...prev }; delete n[sheetId]; return n; });
  };

  const handleRowDragStart = (e: React.DragEvent, index: number) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') { e.preventDefault(); return; }
    setDragRowIndex(index);
  };

  const handleRowDrop = (index: number) => {
    if (dragRowIndex === null || dragRowIndex === index) return;
    const list = [...(items[activeSheetId] || [])];
    const [moved] = list.splice(dragRowIndex, 1);
    list.splice(index, 0, moved);
    setItems(prev => ({ ...prev, [activeSheetId]: list }));
    setDragRowIndex(null);
  };

  const [dragSheetId, setDragSheetId] = useState<string | null>(null);

  const handleSheetDrop = (sheetId: string) => {
    if (!dragSheetId || dragSheetId === sheetId) return;
    const current = [...sheets];
    const from = current.findIndex(s => s.id === dragSheetId);
    const to = current.findIndex(s => s.id === sheetId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    setSheets(current);
    setDragSheetId(null);
  };

  const startSheetRename = (sheet: BoqSheet) => { setEditingSheetId(sheet.id); setEditingSheetName(sheet.name); };
  const commitSheetRename = (sheetId: string) => {
    const name = editingSheetName.trim();
    if (name) setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, name } : s));
    setEditingSheetId(null); setEditingSheetName('');
  };

  // ─── Totals ────────────────────────────────────────────────────────────────
  // Calculated once per render, not per-row in JSX

  const totals = useMemo(() => {
    const dataRows = currentItems.filter(r => !r.isHeaderRow);
    let totalQty = 0, totalAmount = 0;
    dataRows.forEach(item => {
      totalQty += parseFloat(String(item.quantity)) || 0;
      const { totalAmount: ta } = calcRow(item.rate, item.discountPercent, item.quantity);
      totalAmount += ta;
    });
    return { totalQty, totalAmount };
  }, [currentItems]);

  // S.No map: pre-computed, not re-calculated per row in render
  const snoMap = useMemo(() => {
    const map: Record<number, number> = {};
    let sno = 0;
    currentItems.forEach((item, i) => {
      if (!item.isHeaderRow && (item.description || item.itemId || item.quantity || item.rate)) {
        sno++;
        map[i] = sno;
      }
    });
    return map;
  }, [currentItems]);

  // ─── Column helpers ────────────────────────────────────────────────────────

  const visibleColumns = useMemo(() => columnSettings.filter(c => c.visible), [columnSettings]);
  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    visibleColumns.forEach(col => { widths[col.key] = col.width; });
    return widths;
  }, [visibleColumns]);
  const exportColumnList = useMemo(() => columnSettings.filter(c => exportColumns[c.key]), [columnSettings, exportColumns]);
  const exportSheetList = useMemo(() => sheets.filter(s => exportSheets[s.id]), [sheets, exportSheets]);
  const columnLetters = useMemo(() => visibleColumns.map((_, i) => getColumnLabel(i)), [visibleColumns]);

  const toggleColumnVisibility = (key: string) =>
    setColumnSettings(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));

  // ─── Export ────────────────────────────────────────────────────────────────

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF(exportOrientation as any, 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 10;
    if (openSansRegular && openSansBold) {
      try {
        doc.addFileToVFS('OpenSans-Regular.ttf', openSansRegular);
        doc.addFileToVFS('OpenSans-Bold.ttf', openSansBold);
        doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
        doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
        doc.setFont('OpenSans', 'normal');
      } catch { }
    }

    const orderedColumns = (exportColumnList.length ? exportColumnList : columnSettings).filter(c => c.key !== 'rowControl');
    const colWidths: Record<string, number> = {
      sno: 12, hsn_sac: 18, description: 80, variant: 20, make: 20,
      quantity: 15, unit: 18, rate: 20, discountPercent: 18, rateAfterDiscount: 22,
      totalAmount: 22, specification: 24, remarks: 24, pressure: 18, thickness: 18, schedule: 18, material: 22,
    };

    const columns = orderedColumns.map(col => ({
      key: col.key, title: col.label,
      width: colWidths[col.key] || col.width || 20,
      align: col.key === 'description' ? 'left' : 'center',
    }));

    const totalWidth = columns.reduce((s, c) => s + c.width, 0) || 1;
    const scale = (pageWidth - marginX * 2) / totalWidth;
    const columnStyles: Record<number, any> = {};
    columns.forEach((c, i) => { columnStyles[i] = { cellWidth: c.width * scale, halign: c.align }; });

    const renderHeader = (sheetName: string) => {
      doc.setFont('OpenSans', 'normal'); doc.setFontSize(12);
      doc.text('BILL OF QUANTITIES', marginX, 12);
      doc.setFont('OpenSans', 'bold');
      doc.text(sheetName, pageWidth / 2, 12, { align: 'center' });
      doc.setFont('OpenSans', 'normal');
      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);
      const labelW = 26, valueW = (pageWidth - marginX * 2 - labelW * 2) / 2;
      autoTable(doc, {
        startY: 16, theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 9, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        head: [],
        body: [
          ['Client:', client?.client_name || '', 'Project:', project?.project_name || ''],
          ['BoQ No:', boqData.boqNo || '', 'Date:', boqData.date || ''],
          ['Revision no:', String(boqData.revisionNo || ''), 'Date:', boqData.date || ''],
        ],
        columnStyles: {
          0: { cellWidth: labelW, halign: 'left', fontStyle: 'bold' },
          1: { cellWidth: valueW, halign: 'left' },
          2: { cellWidth: labelW, halign: 'left', fontStyle: 'bold' },
          3: { cellWidth: valueW, halign: 'left' },
        },
      });
    };

    const renderTable = (sheetItems: BoqRow[]) => {
      const rows: any[] = [];
      let sno = 0, sheetTotalQty = 0, sheetTotalAmount = 0;
      const dataRows = sheetItems.filter(i => !i.isHeaderRow);
      const targetRows = Math.max(20, dataRows.length);

      dataRows.forEach(item => {
        const empty = !item.description && !item.itemId && !item.quantity && !item.rate;
        if (!empty) sno++;
        const { rateAfterDiscount, totalAmount } = calcRow(item.rate, item.discountPercent, item.quantity);
        sheetTotalQty += parseFloat(String(item.quantity)) || 0;
        sheetTotalAmount += totalAmount;
        rows.push(columns.map(c => {
          switch (c.key) {
            case 'sno': return empty ? '' : sno;
            case 'description': return item.description || '';
            case 'hsn_sac': return item.hsn_sac || '';
            case 'variant': return item.variantName || '';
            case 'make': return item.make || '';
            case 'quantity': return item.quantity || '';
            case 'unit': return item.unit || '';
            case 'rate': return item.rate || '';
            case 'discountPercent': return item.discountPercent || '';
            case 'rateAfterDiscount': return rateAfterDiscount || '';
            case 'totalAmount': return totalAmount || '';
            case 'specification': return item.specification || '';
            case 'remarks': return item.remarks || '';
            case 'pressure': return item.pressure || '';
            case 'thickness': return item.thickness || '';
            case 'schedule': return item.schedule || '';
            case 'material': return item.material || '';
            default: return '';
          }
        }));
      });

      while (rows.length < targetRows) rows.push(columns.map(() => ''));
      rows.push(columns.map(c => {
        if (c.key === 'description') return 'Total';
        if (c.key === 'quantity') return sheetTotalQty || '';
        if (c.key === 'totalAmount') return sheetTotalAmount ? `${sheetTotalAmount.toLocaleString()}` : '';
        return '';
      }));

      autoTable(doc, {
        startY: 38, head: [columns.map(c => c.title)], body: rows, theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 8, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.2, halign: 'center' },
        columnStyles,
        didParseCell: (data) => {
          if (data.section === 'head' && columns[data.column.index]?.key === 'discountPercent') {
            data.cell.styles.fillColor = [255, 244, 194];
          }
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fillColor = [216, 232, 247];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    };

    exportSheetList.forEach((sheet, idx) => {
      if (idx > 0) doc.addPage();
      const name = sheet.name.toLowerCase();
      if (name.includes('terms') || name.includes('preface')) {
        doc.setFont('OpenSans', 'bold'); doc.setFontSize(14);
        doc.text(name.includes('terms') ? 'Terms' : 'Preface', marginX, 12);
        doc.setFont('OpenSans', 'normal'); doc.setFontSize(9);
        const content = name.includes('terms') ? (boqData.termsConditions || '') : (boqData.preface || '');
        doc.text(doc.splitTextToSize(content, pageWidth - marginX * 2), marginX, 20);
        return;
      }
      renderHeader(sheet.name);
      renderTable(items[sheet.id] || []);
    });

    doc.save(`${boqData.boqNo}.pdf`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, items, exportColumnList, exportSheetList, exportOrientation, columnSettings]);

  const exportToExcel = useCallback(async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    exportSheetList.forEach(sheet => {
      const lower = sheet.name.toLowerCase();
      if (lower.includes('terms') || lower.includes('preface')) return;
      const sheetData: any[][] = [];
      let sno = 0;
      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);
      sheetData.push(['BOQ No', boqData.boqNo, 'Revision', boqData.revisionNo]);
      sheetData.push(['Date', boqData.date]);
      sheetData.push(['Client', client?.client_name || '']);
      sheetData.push(['Project', project?.project_name || '']);
      sheetData.push([]);
      sheetData.push(exportColumnList.map(col => col.label));
      (items[sheet.id] || []).forEach(item => {
        if (item.isHeaderRow) { sheetData.push([item.headerText]); return; }
        sno++;
        const { rateAfterDiscount, totalAmount } = calcRow(item.rate, item.discountPercent, item.quantity);
        sheetData.push(exportColumnList.map(col => {
          switch (col.key) {
            case 'sno': return sno;
            case 'description': return item.description || '';
            case 'hsn_sac': return item.hsn_sac || '';
            case 'variant': return item.variantName || '';
            case 'make': return item.make || '';
            case 'quantity': return item.quantity || '';
            case 'unit': return item.unit || '';
            case 'rate': return item.rate || '';
            case 'discountPercent': return item.discountPercent || '';
            case 'rateAfterDiscount': return rateAfterDiscount;
            case 'totalAmount': return totalAmount;
            case 'specification': return item.specification || '';
            case 'remarks': return item.remarks || '';
            case 'pressure': return item.pressure || '';
            case 'thickness': return item.thickness || '';
            case 'schedule': return item.schedule || '';
            case 'material': return item.material || '';
            default: return '';
          }
        }));
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheet.name.substring(0, 31));
    });
    exportSheetList.forEach(sheet => {
      const name = sheet.name.toLowerCase();
      if (!name.includes('terms') && !name.includes('preface')) return;
      const title = name.includes('terms') ? 'Terms' : 'Preface';
      const content = name.includes('terms') ? (boqData.termsConditions || '') : (boqData.preface || '');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[title], ...content.split('\n').map(l => [l])]), sheet.name.substring(0, 31));
    });
    XLSX.writeFile(wb, `${boqData.boqNo}.xlsx`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, exportSheetList, items, exportColumnList]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const savedId = await withTimeout(
        saveBOQWithItems({
          id: boqData.id, boqNo: boqData.boqNo, revisionNo: boqData.revisionNo,
          date: boqData.date, clientId: boqData.clientId, projectId: boqData.projectId,
          variantId: boqData.variantId, status: boqData.status,
          termsConditions: boqData.termsConditions, preface: boqData.preface,
        }, sheets, items),
        60000, 'BOQ save',
      );
      return await withTimeout(fetchBOQById(savedId), 30000, 'BOQ refresh') as LoadedBoqHeader;
    },
    onSuccess: (savedHeader) => {
      setSaveError('');
      hydrateFromHeader(savedHeader);
      queryClient.invalidateQueries({ queryKey: ['boqInit'] });
      alert('BOQ saved successfully!');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSaveError(`Error saving BOQ: ${message}`);
    },
  });

  // ─── Stock Check ───────────────────────────────────────────────────────────

  const handleLaunchStockCheck = async () => {
    const sheetIds = Object.entries(selectedSheets).filter(([, v]) => v).map(([id]) => id);
    if (!sheetIds.length) { alert('Please select at least one sheet.'); return; }
    setLaunchingStockCheck(true);
    try {
      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);
      const { data: listData, error: listError } = await supabase.from('procurement_lists').insert({
        organisation_id: organisation?.id, title: `${boqData.boqNo} — Stock Check`,
        source: 'boq', boq_id: boqData.id || null, boq_no: boqData.boqNo || null,
        client_id: boqData.clientId || null, client_name: client?.client_name || null,
        project_id: boqData.projectId || null, project_name: project?.project_name || null, status: 'Active',
      }).select().single();
      if (listError) throw listError;

      let order = 0;
      const rows: any[] = [];
      sheetIds.forEach(sheetId => {
        (items[sheetId] || []).forEach(row => {
          if (row.isHeaderRow) {
            rows.push({ list_id: listData.id, organisation_id: organisation?.id, is_header_row: true, header_text: row.headerText || 'Section', item_name: '', display_order: order++ });
            return;
          }
          if (!row.description && !row.itemId && !row.quantity) return;
          rows.push({
            list_id: listData.id, organisation_id: organisation?.id,
            item_id: row.itemId || null, item_name: row.description || '',
            make: row.make || null, variant_name: row.variantName || null,
            uom: row.unit || null, boq_qty: parseFloat(String(row.quantity)) || 0,
            stock_qty: 0, local_qty: 0, vendor_id: null, notes: null,
            status: 'Pending', display_order: order++, is_header_row: false,
          });
        });
      });
      if (rows.length > 0) {
        const { error } = await supabase.from('procurement_items').insert(rows);
        if (error) throw error;
      }
      setShowStockCheckModal(false);
      navigate(`/procurement/detail?id=${listData.id}`);
    } catch (e: any) {
      alert('Error launching stock check: ' + e.message);
    } finally {
      setLaunchingStockCheck(false);
    }
  };

  // ─── Loading / Error states ────────────────────────────────────────────────

  const hydrationKey = editId || 'new';
  const isHydrated = hydratedKeyRef.current === hydrationKey;

  if ((initQuery.isPending && !initQuery.data) || (initQuery.data && !isHydrated)) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading BOQ...</div>;
  }
  if (initQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '12px' }}>
          {(initQuery.error instanceof Error && initQuery.error.message) || 'Unable to load BOQ data.'}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => initQuery.refetch()}>Retry</button>
      </div>
    );
  }

  const activeSheet = sheets.find(s => s.id === activeSheetId);
  const isTermsSheet = activeSheet?.name?.toLowerCase().includes('terms');
  const isPrefaceSheet = activeSheet?.name?.toLowerCase().includes('preface');

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container" style={{ padding: '18px', background: '#eef1f4', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#1a1a1a', margin: 0 }}>BOQ</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowColumnPanel(true)} style={btnStyle}>
            <Settings size={16} /> Columns
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} style={btnStyle}>
              <FileDown size={16} /> Export
            </button>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '160px' }}>
                <button onClick={exportToPDF} style={dropdownItemStyle}><FileSpreadsheet size={16} /> Export to PDF</button>
                <button onClick={exportToExcel} style={dropdownItemStyle}><Table size={16} /> Export to Excel</button>
                <button onClick={() => { setShowExportSettings(true); setShowExportMenu(false); }} style={dropdownItemStyle}><Settings size={16} /> Export Settings</button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const sel: Record<string, boolean> = {};
              sheets.forEach(s => { sel[s.id] = true; });
              setSelectedSheets(sel);
              setShowStockCheckModal(true);
            }}
            style={{ ...btnStyle, background: '#064e3b', color: '#fff', border: 'none' }}
          >
            📦 Stock Check
          </button>
          <button
            onClick={() => { setSaveError(''); saveMutation.mutate(); }}
            style={{ ...btnStyle, background: '#1976d2', color: 'white' }}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save BOQ
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {saveError}
        </div>
      )}

      <div style={cardStyle}>
        {/* BOQ Header Fields */}
        <div style={boqHeaderGridStyle}>
          <div style={boqHeaderCardStyle}>
            <div style={boqHeaderTitleStyle}>BOQ Info</div>
            <div style={boqHeaderFieldsStyle}>
              <div>
                <label style={labelStyle}>BOQ No</label>
                <input type="text" value={boqData.boqNo} onChange={e => setBoqData(p => ({ ...p, boqNo: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Revision No</label>
                <input type="number" value={boqData.revisionNo} onChange={e => setBoqData(p => ({ ...p, revisionNo: parseInt(e.target.value) || 1 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={boqData.date} onChange={e => setBoqData(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={boqHeaderCardStyle}>
            <div style={boqHeaderTitleStyle}>Client & Project</div>
            <div style={boqHeaderFieldsStyle}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={boqData.clientId} onChange={e => setBoqData(p => ({ ...p, clientId: e.target.value }))} style={inputStyle}>
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Project</label>
                <select value={boqData.projectId} onChange={e => setBoqData(p => ({ ...p, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={boqHeaderCardStyle}>
            <div style={boqHeaderTitleStyle}>Discount Profile</div>
            <div style={boqHeaderFieldsStyle}>
              <div>
                <label style={labelStyle}>Variant Default</label>
                <select value={boqData.variantId} onChange={e => setBoqData(p => ({ ...p, variantId: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
                  <option value="">Select Variant</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                </select>
              </div>
              {Object.keys(clientDiscounts).length > 0 && (
                <div style={boqHeaderDiscountWrapStyle}>
                  <span style={boqHeaderDiscountLabelStyle}>Variant Discounts</span>
                  <div style={boqHeaderDiscountListStyle}>
                    {Object.entries(clientDiscounts).map(([variantId, data]) => (
                      <div key={variantId} style={variantDiscountBoxStyle}>
                        <span style={{ fontSize: '12px' }}>{data.variantName || getVariantNameById(variantId) || '-'}</span>
                        <input
                          type="number"
                          value={boqVariantDiscounts[variantId] ?? data.discount}
                          onChange={e => handleVariantDiscountChange(variantId, e.target.value)}
                          style={{ ...inputStyle, width: '60px', padding: '4px' }}
                          step="0.5"
                        />
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sheet Tabs + Add Header Row */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          {!isTermsSheet && !isPrefaceSheet && (
            <button onClick={addHeaderRow} style={{ ...btnStyle, background: '#28a745', color: 'white' }}>
              <Plus size={16} /> Add Header Row
            </button>
          )}
          <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto', padding: '4px', background: '#e5e7eb', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            {sheets.map((sheet, idx) => (
              <div key={sheet.id} style={{ display: 'flex', alignItems: 'center' }}
                draggable onDragStart={() => setDragSheetId(sheet.id)}
                onDragOver={e => e.preventDefault()} onDrop={() => handleSheetDrop(sheet.id)}
              >
                {editingSheetId === sheet.id ? (
                  <input
                    value={editingSheetName}
                    onChange={e => setEditingSheetName(e.target.value)}
                    onBlur={() => commitSheetRename(sheet.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitSheetRename(sheet.id);
                      if (e.key === 'Escape') { setEditingSheetId(null); setEditingSheetName(''); }
                    }}
                    autoFocus style={{ ...inputStyle, width: '140px', height: '26px' }}
                  />
                ) : (
                  <button
                    onClick={() => activeSheetId === sheet.id ? startSheetRename(sheet) : setActiveSheetId(sheet.id)}
                    style={{ ...sheetTabStyle, background: activeSheetId === sheet.id ? '#1976d2' : '#f0f0f0', color: activeSheetId === sheet.id ? 'white' : '#333' }}
                    title="Click to rename"
                  >
                    <GripVertical size={12} /><Sheet size={14} /> {sheet.name}
                  </button>
                )}
                {sheets.length > 1 && idx > 0 && (
                  <button onClick={() => deleteSheet(sheet.id)} style={sheetCloseBtnStyle}><X size={12} /></button>
                )}
              </div>
            ))}
            <button onClick={addNewSheet} style={{ ...btnStyle, padding: '6px 12px' }}><Plus size={14} /></button>
          </div>
        </div>

        {/* Sheet Content */}
        {!isTermsSheet && !isPrefaceSheet ? (
          // ── Virtualized table container ──
          // Fixed height scroll container — virtualizer measures this
          <div ref={tableBodyRef} style={{ height: '60vh', overflowY: 'auto', overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Column letter row */}
                <tr style={{ background: '#e5e7eb' }}>
                  {visibleColumns.map((col, idx) => (
                    <th key={`${col.key}-letter`} style={{ ...excelColumnHeaderCellStyle, width: col.width, minWidth: col.width }}>
                      {col.key === 'rowControl' ? '' : columnLetters[idx]}
                    </th>
                  ))}
                </tr>
                {/* Column name row */}
                <tr style={{ background: '#f3f4f6' }}>
                  {visibleColumns.map(col => (
                    <th key={col.key} style={{ ...thStyle, width: col.width, minWidth: col.width, ...(col.key === 'discountPercent' ? discountHeaderCellStyle : {}) }}>
                      {col.key === 'rowControl' ? '' : col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Virtual tbody — only renders visible rows */}
              <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map(virtualRow => {
                  const item = currentItems[virtualRow.index];
                  if (!item) return null;
                  return (
                    <tr
                      key={item.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        display: 'table',
                        tableLayout: 'fixed',
                      }}
                    >
                      {/* We render a single <td> that contains the full row component */}
                      <td style={{ padding: 0, border: 'none' }} colSpan={visibleColumns.length}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <tbody>
                            <BoqRowComponent
                              row={item}
                              index={virtualRow.index}
                              sno={snoMap[virtualRow.index] || 0}
                              visibleColumns={visibleColumns}
                              columnWidths={columnWidths}
                              sheetId={activeSheetId}
                              variants={variants}
                              makes={makes}
                              defaultVariantId={boqData.variantId}
                              baseDiscount={getVariantDiscount(item.variantId || boqData.variantId)}
                              priceMap={priceMap}
                              onUpdate={updateItem}
                              onDelete={deleteRow}
                              onInsert={insertRow}
                              onDragStart={handleRowDragStart}
                              onDrop={handleRowDrop}
                              onFocus={setActiveRowIndex}
                              onMaterialPick={handleMaterialPick}
                              onShowDropdown={handleShowDropdown}
                              rowIndex={virtualRow.index}
                              materials={materials}
                              inputRefs={inputRefs}
                              materialSearchActive={materialSearchActive}
                              setMaterialSearchActive={setMaterialSearchActive}
                              getVariantDiscount={getVariantDiscount}
                            />
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr style={{ background: '#e8f4fc', fontWeight: '600' }}>
                  {visibleColumns.map(col => {
                    if (col.key === 'description') return <td key={col.key} style={{ padding: '6px', textAlign: 'right' }}>Total</td>;
                    if (col.key === 'quantity') return <td key={col.key} style={{ padding: '6px' }}>{totals.totalQty}</td>;
                    if (col.key === 'totalAmount') return <td key={col.key} style={{ padding: '6px', color: '#1976d2' }}>₹{totals.totalAmount.toLocaleString()}</td>;
                    return <td key={col.key} style={{ padding: '6px' }}></td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={a4SheetStyle}>
            <h2 style={{ marginTop: 0, fontSize: '16px' }}>{isTermsSheet ? 'Terms' : 'Preface'}</h2>
            <textarea
              value={isTermsSheet ? boqData.termsConditions : boqData.preface}
              onChange={e => setBoqData(p => ({ ...p, ...(isTermsSheet ? { termsConditions: e.target.value } : { preface: e.target.value }) }))}
              style={a4TextareaStyle}
            />
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {showColumnPanel && (
        <div style={modalOverlayStyle} onClick={() => setShowColumnPanel(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Adjust Columns</h3>
              <button onClick={() => setShowColumnPanel(false)} style={closeBtnStyle}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {columnSettings.filter(c => !['rowControl', 'sno', 'rateAfterDiscount', 'totalAmount'].includes(c.key)).map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.key)} style={{ width: '18px', height: '18px' }} />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {showExportSettings && (
        <div style={modalOverlayStyle} onClick={() => setShowExportSettings(false)}>
          <div style={{ ...modalStyle, width: '520px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Export Settings</h3>
              <button onClick={() => setShowExportSettings(false)} style={closeBtnStyle}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Columns</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {columnSettings.filter(c => c.key !== 'rowControl').map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <input type="checkbox" checked={!!exportColumns[col.key]} onChange={() => setExportColumns(p => ({ ...p, [col.key]: !p[col.key] }))} />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Sheets</div>
              {sheets.map(sheet => (
                <label key={sheet.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '6px' }}>
                  <input type="checkbox" checked={!!exportSheets[sheet.id]} onChange={() => setExportSheets(p => ({ ...p, [sheet.id]: !p[sheet.id] }))} />
                  <span>{sheet.name}</span>
                </label>
              ))}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Orientation</div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
                {['portrait', 'landscape'].map(o => (
                  <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="radio" name="boq-export-orientation" checked={exportOrientation === o} onChange={() => setExportOrientation(o)} />
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => {
                if (boqData.boqNo) localStorage.setItem(`boq_export_${boqData.boqNo}`, JSON.stringify({ columns: exportColumns, sheets: exportSheets, orientation: exportOrientation }));
                setShowExportSettings(false);
              }}>Save As Default</button>
              <button className="btn btn-secondary" onClick={() => setShowExportSettings(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showDiscountApplyModal && pendingDiscountChange && (
        <div style={modalOverlayStyle} onClick={() => setShowDiscountApplyModal(false)}>
          <div style={{ ...modalStyle, width: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Apply Discount to Rows</h3>
              <button onClick={() => setShowDiscountApplyModal(false)} style={closeBtnStyle}><X size={20} /></button>
            </div>
            <div style={{ fontSize: '13px', color: '#374151', marginBottom: '10px' }}>
              Copy this discount % to all rows for this variant?
            </div>
            {['all', 'skip'].map(mode => (
              <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '8px' }}>
                <input type="radio" name="discount-apply-mode" checked={discountApplyMode === mode} onChange={() => setDiscountApplyMode(mode)} />
                {mode === 'all' ? 'Copy to all rows of this variant' : 'Skip overwritten rows (only update non-overwritten)'}
              </label>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button className="btn btn-secondary" onClick={() => setShowDiscountApplyModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const { variantId, discount, prevDiscount } = pendingDiscountChange;
                setBoqVariantDiscounts(p => ({ ...p, [variantId]: discount }));
                applyVariantDiscountToRows(variantId, discount, prevDiscount, discountApplyMode);
                setShowDiscountApplyModal(false); setPendingDiscountChange(null);
              }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {showStockCheckModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={() => setShowStockCheckModal(false)}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '28px', width: '420px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>Launch Stock Check</h3>
            <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#6b7280' }}>Select BOQ sheets to include in the procurement tracker.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {sheets.map(sheet => {
                const isTC = sheet.name.toLowerCase().includes('terms') || sheet.name.toLowerCase().includes('preface');
                const itemCount = (items[sheet.id] || []).filter(r => !r.isHeaderRow && (r.description || r.itemId)).length;
                return (
                  <label key={sheet.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: `1px solid ${selectedSheets[sheet.id] ? '#1d4ed8' : '#e5e7eb'}`, borderRadius: '8px', cursor: isTC ? 'not-allowed' : 'pointer', background: selectedSheets[sheet.id] ? '#eff6ff' : '#fff', opacity: isTC ? 0.4 : 1 }}>
                    <input type="checkbox" checked={!!selectedSheets[sheet.id]} disabled={isTC}
                      onChange={e => setSelectedSheets(p => ({ ...p, [sheet.id]: e.target.checked }))}
                      style={{ width: '16px', height: '16px', accentColor: '#1d4ed8' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{sheet.name}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{isTC ? 'Not applicable' : `${itemCount} items`}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowStockCheckModal(false)} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleLaunchStockCheck} disabled={launchingStockCheck || Object.values(selectedSheets).every(v => !v)}
                style={{ padding: '8px 18px', border: 'none', borderRadius: '6px', background: '#064e3b', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: launchingStockCheck || Object.values(selectedSheets).every(v => !v) ? 0.5 : 1 }}>
                {launchingStockCheck ? 'Creating...' : '📦 Launch Stock Check'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dropdownPortal && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: dropdownPortal.position.top,
          left: dropdownPortal.position.left,
          width: dropdownPortal.position.width,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 9999,
        }}>
          {dropdownPortal.items.map(m => (
            <div
              key={m.id}
              onClick={() => handleDropdownItemClick(m)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              {m.name}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default BOQ;

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '4px', padding: '16px', border: '1px solid #d0d7de', boxShadow: '0 1px 2px rgba(16,24,40,0.06)' };
const btnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#f8fafc', cursor: 'pointer', fontSize: '12px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '10px', fontWeight: '600', color: '#4b5563', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '2px', fontSize: '11px', boxSizing: 'border-box', background: '#fff' };
const thStyle: React.CSSProperties = { padding: '4px', textAlign: 'center', fontWeight: '700', color: '#1f2937', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #d1d5db', fontSize: '11px', background: '#f3f4f6', textTransform: 'uppercase', letterSpacing: '0.02em' };
const cellInputStyle: React.CSSProperties = { width: '100%', padding: '2px 4px', border: '1px solid #e2e8f0', borderRadius: '0', fontSize: '11px', background: '#fff', boxSizing: 'border-box', height: '22px' };
const iconBtnStyle: React.CSSProperties = { padding: '2px', border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sheetTabStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', border: '1px solid #bfc7d1', borderRadius: '3px 3px 0 0', cursor: 'pointer', fontSize: '11px' };
const sheetCloseBtnStyle: React.CSSProperties = { marginLeft: '2px', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#999' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { background: 'white', borderRadius: '8px', padding: '20px', width: '300px', maxHeight: '80vh', overflow: 'auto' };
const closeBtnStyle: React.CSSProperties = { border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#666' };
const dropdownItemStyle: React.CSSProperties = { width: '100%', padding: '10px 15px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' };
const variantDiscountBoxStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', background: 'white', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ddd' };
const autocompleteStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 4px 8px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto', zIndex: 9999 };
const autocompleteItemStyle: React.CSSProperties = { padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f0f0f0' };
const excelColumnHeaderCellStyle: React.CSSProperties = { padding: '2px 4px', textAlign: 'center', fontWeight: '700', fontSize: '11px', color: '#374151', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #d1d5db', background: '#e5e7eb' };
const excelCellStyle: React.CSSProperties = { padding: '2px 4px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', background: '#fff' };
const excelRowHeaderCellStyle: React.CSSProperties = { background: '#f3f4f6', borderRight: '1px solid #cbd5e1' };
const discountHeaderCellStyle: React.CSSProperties = { background: '#fff4c2', borderBottom: '1px solid #f3d27c', color: '#8a5a00' };
const discountOverrideBadgeStyle: React.CSSProperties = { position: 'absolute', top: '-9px', right: '4px', background: '#f59e0b', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '3px' };
const boqHeaderGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' };
const boqHeaderCardStyle: React.CSSProperties = { padding: '10px', background: '#ffffff', borderRadius: '4px', border: '1px solid #d1d5db', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const boqHeaderTitleStyle: React.CSSProperties = { fontSize: '12px', fontWeight: '700', color: '#111827', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' };
const boqHeaderFieldsStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr', gap: '8px' };
const boqHeaderDiscountWrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' };
const boqHeaderDiscountLabelStyle: React.CSSProperties = { fontWeight: '600', color: '#4b5563', fontSize: '11px' };
const boqHeaderDiscountListStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px' };
const a4SheetStyle: React.CSSProperties = { width: '210mm', minHeight: '297mm', margin: '0 auto', background: '#fff', border: '1px solid #d1d5db', padding: '18mm 16mm', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' };
const a4TextareaStyle: React.CSSProperties = { flex: 1, width: '100%', minHeight: '220mm', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px', fontSize: '12px', lineHeight: 1.5, fontFamily: "'Inter', sans-serif", resize: 'vertical' };
