import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Save as SaveIcon,
  X as CancelIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  CheckCircle2 as CheckIcon,
  Info as InfoIcon,
  AlertTriangle as WarningIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ChangeAuditEntry {
  itemId: string;
  itemCode: string;
  itemName: string;
  field: string;
  dbField: string;
  oldValue: any;
  newValue: any;
  changedAt: string;
  changedBy?: string;
}

interface ExcelEditRow {
  id: string;
  item_code: string;
  name: string;
  [key: string]: any;
}

interface ExcelEditorProps {
  materials: any[];
  warehouses: any[];
  selectedFields: string[];
  onSave: (changes: ChangeAuditEntry[]) => void;
  onCancel: () => void;
}

const EDITABLE_COLUMNS: { key: string; label: string; width: number; editable: boolean; type?: string; warehouseId?: string }[] = [
  { key: 'item_code', label: 'Item Code', width: 120, editable: false },
  { key: 'name', label: 'Item Name', width: 200, editable: false },
  { key: 'display_name', label: 'Display Name', width: 200, editable: true },
  { key: 'main_category', label: 'Category', width: 120, editable: true },
  { key: 'sub_category', label: 'Sub Category', width: 120, editable: true },
  { key: 'size', label: 'Size', width: 100, editable: true },
  { key: 'size_lwh', label: 'L×W×H', width: 100, editable: true },
  { key: 'pressure_class', label: 'Pressure', width: 100, editable: true },
  { key: 'make', label: 'Make', width: 120, editable: true },
  { key: 'material', label: 'Material', width: 120, editable: true },
  { key: 'end_connection', label: 'Connection', width: 120, editable: true },
  { key: 'unit', label: 'Unit', width: 80, editable: true },
  { key: 'sale_price', label: 'Sale Price', width: 100, editable: true, type: 'number' },
  { key: 'purchase_price', label: 'Purchase Price', width: 120, editable: true, type: 'number' },
  { key: 'hsn_code', label: 'HSN', width: 100, editable: true },
  { key: 'gst_rate', label: 'GST%', width: 80, editable: true, type: 'number' },
  { key: 'part_number', label: 'Part #', width: 120, editable: true },
  { key: 'taxable', label: 'Taxable', width: 100, editable: true },
  { key: 'weight', label: 'Weight', width: 80, editable: true, type: 'number' },
  { key: 'upc', label: 'UPC', width: 120, editable: true },
  { key: 'mpn', label: 'MPN', width: 120, editable: true },
  { key: 'ean', label: 'EAN', width: 120, editable: true },
  { key: 'inventory_account', label: 'Inv Account', width: 130, editable: true },
  { key: 'is_active', label: 'Active', width: 80, editable: true, type: 'boolean' },
  { key: 'uses_variant', label: 'Uses Variant', width: 100, editable: true, type: 'boolean' },
  { key: 'low_stock_level', label: 'Low Stock', width: 100, editable: true, type: 'number' },
];

export function ExcelEditor({ materials, warehouses, selectedFields, onSave, onCancel }: ExcelEditorProps) {
  const [rows, setRows] = useState<ExcelEditRow[]>([]);
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [cellValues, setCellValues] = useState<Record<string, any>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getColumnConfig = useMemo(() => {
    const baseCols = EDITABLE_COLUMNS.filter(col => selectedFields.includes(col.key));
    const stockCols = warehouses
      .filter(wh => selectedFields.includes(`stock_${wh.id}`))
      .map(wh => ({
        key: `stock_${wh.id}`,
        label: `Stock: ${wh.warehouse_name || wh.name || 'Warehouse'}`,
        width: 120,
        editable: true,
        type: 'number',
        warehouseId: wh.id,
      }));
    const idCols = EDITABLE_COLUMNS.filter(col => col.key === 'item_code' || col.key === 'name');
    return [...idCols, ...baseCols, ...stockCols];
  }, [selectedFields, warehouses]);

  useEffect(() => {
    const initialRows = materials.map(m => {
      const row: ExcelEditRow = {
        id: m.id,
        item_code: m.item_code || '',
        name: m.name || '',
      };
      getColumnConfig.forEach(col => {
        if (col.key.startsWith('stock_')) {
          const stockValue = m.stock?.[col.warehouseId] || m.current_stock || 0;
          row[col.key] = stockValue;
        } else {
          row[col.key] = m[col.key] ?? '';
        }
      });
      return row;
    });
    setRows(initialRows);
    const origValues: Record<string, any> = {};
    initialRows.forEach(row => {
      getColumnConfig.forEach(col => {
        if (col.editable) {
          origValues[`${row.id}_${col.key}`] = row[col.key];
        }
      });
    });
    setOriginalValues(origValues);
  }, [materials, getColumnConfig]);

  const handleCellClick = (rowId: string, colKey: string, col: any) => {
    if (!col.editable) return;
    const currentValue = cellValues[`${rowId}_${colKey}`] ?? rows.find(r => r.id === rowId)?.[colKey] ?? '';
    setActiveCell({ rowId, colKey });
    setEditValue(String(currentValue));
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleCellBlur = () => {
    if (!activeCell) return;
    const { rowId, colKey } = activeCell;
    const cellKey = `${rowId}_${colKey}`;
    const originalValue = originalValues[cellKey];
    let parsedValue: any = editValue;
    const col = getColumnConfig.find(c => c.key === colKey);
    if (col?.type === 'number') {
      parsedValue = parseFloat(editValue) || 0;
    } else if (col?.type === 'boolean') {
      parsedValue = ['true', 'yes', '1', 'active'].includes(editValue.toLowerCase());
    }
    setCellValues(prev => ({ ...prev, [cellKey]: parsedValue }));
    const newDirty = new Set(dirtyCells);
    if (String(parsedValue) !== String(originalValue)) {
      newDirty.add(cellKey);
    } else {
      newDirty.delete(cellKey);
    }
    setDirtyCells(newDirty);
    setActiveCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!activeCell) return;
    const { rowId, colKey } = activeCell;
    const colIndex = getColumnConfig.findIndex(c => c.key === colKey);
    const rowIndex = rows.findIndex(r => r.id === rowId);
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleCellBlur();
        if (rowIndex < rows.length - 1) {
          const nextCol = getColumnConfig[colIndex];
          if (nextCol?.editable) {
            handleCellClick(rows[rowIndex + 1].id, colKey, nextCol);
          }
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleCellBlur();
        const direction = e.shiftKey ? -1 : 1;
        let nextColIndex = colIndex + direction;
        while (nextColIndex >= 0 && nextColIndex < getColumnConfig.length) {
          const nextCol = getColumnConfig[nextColIndex];
          if (nextCol?.editable) {
            handleCellClick(rowId, nextCol.key, nextCol);
            break;
          }
          nextColIndex += direction;
        }
        break;
      case 'Escape':
        setActiveCell(null);
        break;
    }
  };

  const generateChangeLog = (): ChangeAuditEntry[] => {
    const changes: ChangeAuditEntry[] = [];
    const now = new Date().toISOString();
    dirtyCells.forEach(cellKey => {
      const [rowId, colKey] = cellKey.split('_');
      const row = rows.find(r => r.id === rowId);
      if (!row) return;
      const col = getColumnConfig.find(c => c.key === colKey);
      const oldValue = originalValues[cellKey];
      const newValue = cellValues[cellKey];
      changes.push({
        itemId: rowId,
        itemCode: row.item_code,
        itemName: row.name,
        field: col?.label || colKey,
        dbField: colKey,
        oldValue,
        newValue,
        changedAt: now,
      });
    });
    return changes;
  };

  const handleSave = () => {
    if (dirtyCells.size === 0) {
      onCancel();
      return;
    }
    setShowPreview(true);
  };

  const confirmSave = async () => {
    setIsSaving(true);
    const changes = generateChangeLog();
    try {
      await onSave(changes);
      setIsSaving(false);
      setShowPreview(false);
      onCancel();
    } catch (error) {
      setIsSaving(false);
      alert('Save failed: ' + (error as Error).message);
    }
  };

  const dirtyCount = dirtyCells.size;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-4 mb-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">Excel Edit Mode</h2>
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider",
            dirtyCount > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
          )}>
            {dirtyCount} changes
          </span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <CancelIcon className="w-4 h-4" /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={dirtyCount === 0 || isSaving}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <SaveIcon className="w-4 h-4" /> {isSaving ? 'Saving...' : `Save ${dirtyCount} Changes`}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
        <InfoIcon className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p><strong>Navigation:</strong> Click any cell to edit. Use Tab to move right, Shift+Tab to move left, Enter to move down.</p>
          <p><strong>Saving:</strong> Click "Save Changes" when done. All changes will be logged for audit.</p>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-auto relative">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-2 border-r border-slate-200 w-12 text-center font-bold text-slate-500 bg-slate-50">#</th>
              {getColumnConfig.map(col => (
                <th 
                  key={col.key} 
                  className={cn(
                    "p-3 border-r border-slate-200 font-bold text-slate-700",
                    col.editable ? "bg-blue-50/50" : "bg-slate-50"
                  )}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.label}
                  {col.editable && <span className="text-blue-600 ml-1">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="p-2 border-r border-slate-200 text-center text-slate-400 bg-slate-50/50">{rowIndex + 1}</td>
                {getColumnConfig.map(col => {
                  const cellKey = `${row.id}_${col.key}`;
                  const isDirty = dirtyCells.has(cellKey);
                  const isActive = activeCell?.rowId === row.id && activeCell?.colKey === col.key;
                  const displayValue = isActive ? editValue : (cellValues[cellKey] ?? row[col.key] ?? '');
                  
                  return (
                    <td 
                      key={col.key}
                      onClick={() => handleCellClick(row.id, col.key, col)}
                      className={cn(
                        "p-0 border-r border-slate-200 relative group",
                        col.editable ? "cursor-cell" : "cursor-default",
                        isActive ? "bg-amber-50" : isDirty ? "bg-amber-50/50" : "bg-transparent"
                      )}
                    >
                      {isActive ? (
                        <input
                          ref={inputRef}
                          type={col.type === 'number' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          className="w-full h-full p-2.5 border-2 border-blue-500 outline-none text-[13px] bg-white shadow-sm"
                        />
                      ) : (
                        <div className="p-2.5 truncate h-full min-h-[36px]">
                          {displayValue}
                          {isDirty && (
                            <div className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-t-amber-500 border-l-[8px] border-l-transparent" />
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3">
              <HistoryIcon className="w-6 h-6 text-indigo-600" />
              <h3 className="text-xl font-black text-slate-900">Review Changes</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 text-amber-800 text-sm">
                <WarningIcon className="w-5 h-5 flex-shrink-0" />
                <p>You are about to save <strong>{dirtyCount} changes</strong>. These modifications will be logged for audit purposes.</p>
              </div>
              
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Item Code</th>
                      <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Item Name</th>
                      <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Field</th>
                      <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">Old Value</th>
                      <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[13px]">
                    {generateChangeLog().map((change, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4 font-mono text-slate-500 uppercase">{change.itemCode}</td>
                        <td className="p-4 font-bold text-slate-700">{change.itemName}</td>
                        <td className="p-4 text-slate-600">{change.field}</td>
                        <td className="p-4 text-slate-400 line-through decoration-slate-300 font-mono italic">{String(change.oldValue)}</td>
                        <td className="p-4 text-blue-600 font-black font-mono">{String(change.newValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button 
                onClick={() => setShowPreview(false)} 
                disabled={isSaving}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-white border border-slate-200 transition-all font-bold"
              >
                Back to Editing
              </button>
              <button 
                onClick={confirmSave}
                disabled={isSaving}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
              >
                {isSaving ? 'Processing...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Field Selection Component
interface FieldSelectorProps {
  warehouses: any[];
  selectedFields: string[];
  onChange: (fields: string[]) => void;
}

export function FieldSelector({ warehouses, selectedFields, onChange }: FieldSelectorProps) {
  const handleToggle = (key: string) => {
    const newSelection = selectedFields.includes(key)
      ? selectedFields.filter(f => f !== key)
      : [...selectedFields, key];
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    const allFields = [
      ...EDITABLE_COLUMNS.filter(c => c.editable).map(c => c.key),
      ...warehouses.map(wh => `stock_${wh.id}`),
    ];
    onChange(allFields);
  };

  const fieldGroups = [
    {
      title: 'Basic Information',
      fields: EDITABLE_COLUMNS.filter(c => ['display_name', 'main_category', 'sub_category', 'size', 'size_lwh', 'pressure_class'].includes(c.key)),
    },
    {
      title: 'Product Details',
      fields: EDITABLE_COLUMNS.filter(c => ['make', 'material', 'end_connection', 'unit', 'part_number'].includes(c.key)),
    },
    {
      title: 'Pricing & Tax',
      fields: EDITABLE_COLUMNS.filter(c => ['sale_price', 'purchase_price', 'hsn_code', 'gst_rate', 'taxable'].includes(c.key)),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-4">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Select Fields to Edit</h3>
        <button onClick={handleSelectAll} className="text-xs font-bold text-blue-600 hover:underline">Select All</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fieldGroups.map(group => (
          <div key={group.title} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">{group.title}</h4>
            <div className="grid grid-cols-1 gap-3">
              {group.fields.map(field => (
                <label key={field.key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.key)}
                    onChange={() => handleToggle(field.key)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{field.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {warehouses.length > 0 && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Stock by Warehouse</h4>
            <div className="grid grid-cols-1 gap-3">
              {warehouses.map(wh => (
                <label key={wh.id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(`stock_${wh.id}`)}
                    onChange={() => handleToggle(`stock_${wh.id}`)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Stock: {wh.warehouse_name || wh.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExcelEditor;
