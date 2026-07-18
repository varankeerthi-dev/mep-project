import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';

interface MultiItemDialogProps {
  open: boolean;
  onClose: () => void;
  rows: any[];
  onRowsChange: (rows: any[]) => void;
  onSave: () => void;
  isSaving: boolean;
  saveProgress: { current: number; total: number };
}

export function MultiItemDialog({
  open, onClose, rows, onRowsChange, onSave, isSaving, saveProgress,
}: MultiItemDialogProps) {
  const addRow = () => {
    onRowsChange([...rows, { name: '', unit: 'nos', sale_price: '', purchase_price: '', gst_rate: 18 }]);
  };

  const updateRow = (index: number, field: string, value: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    onRowsChange(updated);
  };

  const removeRow = (index: number) => {
    onRowsChange(rows.filter((_, i) => i !== index));
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Quick Add Multiple Items"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving} className="text-xs">Cancel</Button>
          <Button variant="default" onClick={onSave} disabled={isSaving || rows.length === 0} className="text-xs">
            {isSaving ? `Saving ${saveProgress.current}/${saveProgress.total}...` : `Save ${rows.length} Item(s)`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Add multiple items quickly with basic fields</span>
          <Button variant="secondary" size="sm" onClick={addRow} className="text-xs h-7">
            + Add Row
          </Button>
        </div>

        <div className="overflow-x-auto max-h-64 overflow-y-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-zinc-500">Item Name</th>
                <th className="text-left px-3 py-2 font-semibold text-zinc-500">Unit</th>
                <th className="text-right px-3 py-2 font-semibold text-zinc-500">Sale Price</th>
                <th className="text-right px-3 py-2 font-semibold text-zinc-500">Purchase Price</th>
                <th className="text-center px-3 py-2 font-semibold text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-zinc-100">
                  <td className="px-3 py-1.5">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(i, 'name', e.target.value)}
                      className="w-full h-7 rounded border border-zinc-300 px-2 text-xs"
                      placeholder="Item name"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={row.unit}
                      onChange={(e) => updateRow(i, 'unit', e.target.value)}
                      className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs"
                    >
                      <option value="nos">Nos</option>
                      <option value="kg">Kg</option>
                      <option value="m">Meter</option>
                      <option value="pcs">Pcs</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={row.sale_price}
                      onChange={(e) => updateRow(i, 'sale_price', e.target.value)}
                      className="w-full h-7 rounded border border-zinc-300 px-2 text-xs text-right"
                      type="number"
                      step="0.01"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={row.purchase_price}
                      onChange={(e) => updateRow(i, 'purchase_price', e.target.value)}
                      className="w-full h-7 rounded border border-zinc-300 px-2 text-xs text-right"
                      type="number"
                      step="0.01"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="text-xs text-zinc-400 italic text-center py-4">
            No rows yet. Click "Add Row" to start adding items.
          </p>
        )}
      </div>
    </Modal>
  );
}
