import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Copy, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../../../../lib/utils';

const GST_RATES = [
  { value: 0, label: '0%' },
  { value: 0.5, label: '0.5%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

export interface MultiItemRow {
  id: number;
  category: string;
  name: string;
  unit: string;
  uses_variant: boolean;
  variant_id: string;
  sale_price: string;
  purchase_price: string;
  gst_rate: number;
  hsn_code: string;
  inventory: number;
}

interface MultiItemDialogProps {
  open: boolean;
  onClose: () => void;
  rows: MultiItemRow[];
  onRowsChange: (rows: MultiItemRow[]) => void;
  onSave: () => void;
  onReview: () => void;
  isSaving: boolean;
  saveProgress: { current: number; total: number };
  categoryOptions: string[];
  variantOptions: { id: string; variant_name: string }[];
  unitOptions: { unit_code: string }[];
}

export function createEmptyRow(): MultiItemRow {
  return {
    id: Date.now() + Math.random(),
    category: '',
    name: '',
    unit: 'nos',
    uses_variant: false,
    variant_id: '',
    sale_price: '',
    purchase_price: '',
    gst_rate: 18,
    hsn_code: '',
    inventory: 0,
  };
}

export function MultiItemDialog({
  open, onClose, rows, onRowsChange, onSave, onReview, isSaving, saveProgress,
  categoryOptions, variantOptions, unitOptions,
}: MultiItemDialogProps) {
  const [validationError, setValidationError] = useState('');

  if (!open) return null;

  const addRow = (cloneFrom?: MultiItemRow) => {
    const newId = Date.now() + Math.random();
    if (cloneFrom) {
      const idx = rows.findIndex(r => r.id === cloneFrom.id);
      const newRows = [...rows];
      newRows.splice(idx + 1, 0, {
        ...cloneFrom,
        id: newId,
        inventory: 0,
        variant_id: '',
        sale_price: '',
        purchase_price: '',
        uses_variant: true,
      });
      onRowsChange(newRows);
    } else {
      onRowsChange([...rows, createEmptyRow()]);
    }
  };

  const updateRow = (index: number, field: string, value: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    onRowsChange(updated);
  };

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index));
  };

  const validate = () => {
    const invalid = rows.some(r => {
      const basicInvalid = !r.name.trim() || !r.unit;
      const variantInvalid = r.uses_variant && (!r.variant_id || !r.sale_price);
      return basicInvalid || variantInvalid;
    });
    if (invalid) {
      setValidationError('Please fill all mandatory fields. If Variant is checked, Variant type and Sale Price are required.');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleReview = () => {
    if (validate()) onReview();
  };

  return (
    <div className="modal-overlay open" onClick={() => !isSaving && onClose()}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '95vw', width: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header border-b">
          <div className="flex justify-between items-center w-full">
            <h3 className="text-lg font-bold">Bulk Item Addition</h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addRow()}>+ Add Row</Button>
              <button type="button" onClick={onClose} className="text-2xl">&times;</button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-50">
          {validationError && (
            <div className="flex items-center gap-2 p-2 mb-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {validationError}
            </div>
          )}

          <table className="w-full border-collapse bg-white shadow-sm border border-zinc-200" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-zinc-100 sticky top-0 z-20">
              <tr>
                <th className="px-1 py-2 border border-zinc-200 text-[10px] font-semibold text-zinc-600 w-[25px]">#</th>
                <th className="px-1 py-2 border border-zinc-200 text-[10px] font-semibold text-zinc-600 w-[50px]">Cat</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[200px]">Item Name *</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[80px]">Unit *</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[40px]">V?</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[120px]">Variant Type</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[90px]">Sale Rate</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[90px]">Pur. Rate</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[60px]">GST %</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[100px]">HSN</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[80px]">Inventory</th>
                <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[40px]">Del</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const prevRow = idx > 0 ? rows[idx - 1] : null;
                const isDuplicate = prevRow &&
                  prevRow.name.trim().toLowerCase() === row.name.trim().toLowerCase() &&
                  prevRow.category === row.category &&
                  prevRow.unit === row.unit;

                return (
                  <tr key={row.id} className={isDuplicate ? 'bg-zinc-50/30' : ''}>
                    <td className="px-1 py-1 border border-zinc-200 text-center text-[10px] text-zinc-400">{idx + 1}</td>
                    <td className="px-0 py-1 border border-zinc-200">
                      <select
                        className={cn(
                          'w-full h-8 text-[10px] border-none focus:ring-0 p-0 appearance-none bg-transparent text-center',
                          isDuplicate && 'opacity-20'
                        )}
                        value={row.category}
                        onChange={(e) => updateRow(idx, 'category', e.target.value)}
                      >
                        <option value="">-</option>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <input
                        type="text"
                        className={cn(
                          'w-full h-8 text-xs border-none focus:ring-0 font-medium',
                          isDuplicate ? 'text-zinc-300' : 'text-zinc-900'
                        )}
                        value={row.name}
                        onChange={(e) => updateRow(idx, 'name', e.target.value)}
                        placeholder={isDuplicate ? '(Same as above)' : 'Enter item name...'}
                      />
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <select
                        className={cn(
                          'w-full h-8 text-xs border-none focus:ring-0',
                          isDuplicate && 'opacity-20'
                        )}
                        value={row.unit}
                        onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                      >
                        {unitOptions.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_code}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 border border-zinc-200 text-center">
                      <input
                        type="checkbox"
                        checked={row.uses_variant}
                        onChange={(e) => updateRow(idx, 'uses_variant', e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      {row.uses_variant && (
                        <select
                          className="w-full h-8 text-xs border-none focus:ring-0 bg-blue-50/30"
                          value={row.variant_id}
                          onChange={(e) => updateRow(idx, 'variant_id', e.target.value)}
                        >
                          <option value="">Select Variant</option>
                          {variantOptions.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <input
                        type="number"
                        className={cn('w-full h-8 text-xs border-none focus:ring-0 text-right', row.uses_variant && 'bg-blue-50/30')}
                        value={row.sale_price}
                        onChange={(e) => updateRow(idx, 'sale_price', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <input
                        type="number"
                        className={cn('w-full h-8 text-xs border-none focus:ring-0 text-right', row.uses_variant && 'bg-blue-50/30')}
                        value={row.purchase_price}
                        onChange={(e) => updateRow(idx, 'purchase_price', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <select
                        className="w-full h-8 text-xs border-none focus:ring-0"
                        value={row.gst_rate}
                        onChange={(e) => updateRow(idx, 'gst_rate', parseFloat(e.target.value))}
                      >
                        {GST_RATES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <input
                        type="text"
                        className="w-full h-8 text-xs border-none focus:ring-0"
                        value={row.hsn_code}
                        onChange={(e) => updateRow(idx, 'hsn_code', e.target.value)}
                        placeholder="HSN..."
                      />
                    </td>
                    <td className="px-2 py-1 border border-zinc-200">
                      <input
                        type="number"
                        className="w-full h-8 text-xs border-none focus:ring-0 text-center font-semibold"
                        value={row.inventory}
                        onChange={(e) => updateRow(idx, 'inventory', parseInt(e.target.value) || 0)}
                        min="0"
                      />
                    </td>
                    <td className="px-2 py-1 border border-zinc-200 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => addRow(row)} className="text-blue-500 hover:text-blue-700" title="Clone row">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeRow(idx)} className="text-zinc-400 hover:text-red-600" title="Remove row">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => addRow()} className="text-indigo-600 hover:bg-indigo-50">
              + Add Another Row
            </Button>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 border-t bg-white flex justify-end gap-3 sticky bottom-0 z-30">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleReview} disabled={isSaving || rows.length === 0}>
            {isSaving ? `Saving ${saveProgress.current}/${saveProgress.total}...` : `Review & Save (${rows.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReviewModal({
  open, onClose, rows, onConfirm, isSaving, saveProgress,
}: {
  open: boolean;
  onClose: () => void;
  rows: MultiItemRow[];
  onConfirm: () => void;
  isSaving: boolean;
  saveProgress: { current: number; total: number };
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }} onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <h3 className="text-lg font-bold mb-2">Review Items</h3>
        <p className="text-sm text-zinc-600 mb-4">You are about to save {rows.length} item(s). Please verify the details before proceeding.</p>
        <div className="max-h-[300px] overflow-auto border border-zinc-200 rounded-lg mb-6">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-zinc-50 border-b">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Item Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Sale</th>
                <th className="px-3 py-2 text-right">GST</th>
                <th className="px-3 py-2 text-center">Stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.name || '(Empty)'}</td>
                  <td className="px-3 py-2">{r.category || '-'}</td>
                  <td className="px-3 py-2">{r.unit}</td>
                  <td className="px-3 py-2 text-right">{r.sale_price || '-'}</td>
                  <td className="px-3 py-2 text-right">{r.gst_rate}%</td>
                  <td className="px-3 py-2 text-center">{r.inventory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving ? `Saving ${saveProgress.current}/${saveProgress.total}...` : `Confirm Save (${rows.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
