import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCreateMeasurementSheet, MeasurementLineItem } from '../hooks/useMeasurementSheets';
import { formatCurrency } from '../utils/formatters';
import { X, Plus, Save, Calculator, AlertTriangle } from 'lucide-react';

interface MeasurementSheetModalProps {
  workOrderId: string;
  workOrderNo: string;
  currentContractValue: number;
  existingSheetsCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function MeasurementSheetModal({
  workOrderId,
  workOrderNo,
  currentContractValue,
  existingSheetsCount,
  onClose,
  onSuccess
}: MeasurementSheetModalProps) {
  const [measurementDate, setMeasurementDate] = useState(new Date().toISOString().split('T')[0]);
  const [measuredBy, setMeasuredBy] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<MeasurementLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const createMeasurementSheet = useCreateMeasurementSheet();

  const sheetNo = `MS/${String(existingSheetsCount + 1).padStart(3, '0')}`;

  const addLineItem = () => {
    const newItem: MeasurementLineItem = {
      id: uuidv4(),
      description: '',
      unit: 'sq.ft',
      contract_qty: 0,
      actual_qty: 0,
      rate: 0,
      amount: 0,
      difference: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: keyof MeasurementLineItem, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;

      const updatedItem = { ...item, [field]: value };

      // Recalculate amount and difference
      if (field === 'actual_qty' || field === 'rate' || field === 'contract_qty') {
        updatedItem.amount = updatedItem.actual_qty * updatedItem.rate;
        updatedItem.difference = updatedItem.amount - (updatedItem.contract_qty * updatedItem.rate);
      }

      return updatedItem;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const totals = lineItems.reduce((acc, item) => ({
    contractValue: acc.contractValue + (item.contract_qty * item.rate),
    actualValue: acc.actualValue + item.amount,
    difference: acc.difference + item.difference
  }), { contractValue: 0, actualValue: 0, difference: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineItems.length === 0) {
      setError('Add at least one line item');
      return;
    }

    if (lineItems.some(item => !item.description.trim())) {
      setError('All line items must have a description');
      return;
    }

    if (!measuredBy.trim()) {
      setError('Measured By is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createMeasurementSheet.mutateAsync({
        workOrderId,
        sheetNo,
        measurementDate,
        measuredBy,
        description,
        lineItems,
        notes
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create measurement sheet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-black m-4 max-w-4xl w-full"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: 'Courier New, monospace' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-black">
          <div>
            <h3 className="text-lg font-bold">MEASUREMENT SHEET</h3>
            <p className="text-sm">{workOrderNo} | Sheet No: {sheetNo}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold mb-1">Measurement Date *</label>
              <input
                type="date"
                value={measurementDate}
                onChange={(e) => setMeasurementDate(e.target.value)}
                className="w-full border border-black p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Measured By *</label>
              <input
                type="text"
                value={measuredBy}
                onChange={(e) => setMeasuredBy(e.target.value)}
                placeholder="Engineer/Supervisor name"
                className="w-full border border-black p-2"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Phase 1 - Foundation and Plastering work"
              className="w-full border border-black p-2"
            />
          </div>

          {/* Line Items Table */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold">LINE ITEMS</label>
              <button
                type="button"
                onClick={addLineItem}
                className="px-3 py-1 border border-black text-sm hover:bg-zinc-100 flex items-center gap-1"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            <table className="w-full border border-black text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="border border-black p-2 text-left">Description</th>
                  <th className="border border-black p-2 text-center">Unit</th>
                  <th className="border border-black p-2 text-right">Contract Qty</th>
                  <th className="border border-black p-2 text-right">Actual Qty</th>
                  <th className="border border-black p-2 text-right">Rate</th>
                  <th className="border border-black p-2 text-right">Amount</th>
                  <th className="border border-black p-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Work description"
                        className="w-full border-0 p-1 focus:outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                        className="w-full border-0 p-1 text-center focus:outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="number"
                        value={item.contract_qty}
                        onChange={(e) => updateLineItem(item.id, 'contract_qty', parseFloat(e.target.value) || 0)}
                        className="w-full border-0 p-1 text-right focus:outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="number"
                        value={item.actual_qty}
                        onChange={(e) => updateLineItem(item.id, 'actual_qty', parseFloat(e.target.value) || 0)}
                        className="w-full border-0 p-1 text-right focus:outline-none"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full border-0 p-1 text-right focus:outline-none"
                      />
                    </td>
                    <td className="border border-black p-1 text-right font-bold">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="border border-black p-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {lineItems.length === 0 && (
              <div className="text-center py-4 border border-t-0 border-black text-zinc-500">
                No line items. Click "Add Item" to start.
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="border border-black p-4 mb-4 bg-zinc-50">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-1">Contract Value</div>
                <div className="text-lg font-bold">{formatCurrency(totals.contractValue)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-1">Actual Value</div>
                <div className="text-lg font-bold">{formatCurrency(totals.actualValue)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider mb-1">Difference</div>
                <div className={`text-lg font-bold ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-green-600' : ''}`}>
                  {totals.difference > 0 ? '+' : ''}{formatCurrency(totals.difference)}
                </div>
              </div>
            </div>

            {totals.difference > 0 && (
              <div className="mt-4 p-3 border border-red-500 bg-red-50 flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-600" />
                <div className="text-sm text-red-700">
                  <strong>Warning:</strong> Actual work exceeds contract by {formatCurrency(totals.difference)}. 
                  An amendment will be auto-created when approved.
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes or observations"
              className="w-full border border-black p-2"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-2 border border-red-500 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-black hover:bg-zinc-100"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || lineItems.length === 0}
              className="px-4 py-2 border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? 'Saving...' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
