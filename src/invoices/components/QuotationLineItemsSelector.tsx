import { useState } from 'react';
import { X, Check, FilePlus } from 'lucide-react';

interface QuotationItem {
  id: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  hsn_code?: string;
  line_total?: number;
}

interface QuotationHeader {
  quotation_no: string;
  grand_total: number;
  status: string;
}

interface SelectedItem {
  id: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  hsn_code?: string;
  line_total: number;
  original_qty: number;
}

interface QuotationLineItemsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  quotationHeader: QuotationHeader;
  items: QuotationItem[];
  onApply: (selectedItems: SelectedItem[]) => void;
}

export default function QuotationLineItemsSelector({
  isOpen,
  onClose,
  quotationHeader,
  items,
  onApply
}: QuotationLineItemsSelectorProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editableQuantities, setEditableQuantities] = useState<Record<string, number>>({});
  const [editableRates, setEditableRates] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const calculateLineTotal = (item: QuotationItem, quantity?: number, rateValue?: number) => {
    const qty = quantity ?? item.qty;
    const itemRate = rateValue ?? item.rate;
    const basic = qty * itemRate;
    const discount = basic * (item.discount_percent / 100);
    const afterDiscount = basic - discount;
    const gst = afterDiscount * (item.tax_percent / 100);
    return afterDiscount + gst;
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      const newQuantities = { ...editableQuantities };
      const newRates = { ...editableRates };
      delete newQuantities[itemId];
      delete newRates[itemId];
      setEditableQuantities(newQuantities);
      setEditableRates(newRates);
    } else {
      newSelected.add(itemId);
      setEditableQuantities(prev => ({
        ...prev,
        [itemId]: items.find(item => item.id === itemId)?.qty || 0
      }));
      setEditableRates(prev => ({
        ...prev,
        [itemId]: items.find(item => item.id === itemId)?.rate || 0
      }));
    }
    setSelectedItems(newSelected);
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    setEditableQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  const handleRateChange = (itemId: string, value: number) => {
    setEditableRates(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
      setEditableQuantities({});
      setEditableRates({});
    } else {
      const allIds = new Set(items.map(item => item.id));
      setSelectedItems(allIds);
      const quantities: Record<string, number> = {};
      const rates: Record<string, number> = {};
      items.forEach(item => {
        quantities[item.id] = item.qty;
        rates[item.id] = item.rate;
      });
      setEditableQuantities(quantities);
      setEditableRates(rates);
    }
  };

  const handleApply = () => {
    const selected = items.filter(item => selectedItems.has(item.id)).map(item => {
      const qty = editableQuantities[item.id] ?? item.qty;
      const rate = editableRates[item.id] ?? item.rate;
      return {
        id: item.id,
        description: item.description,
        qty: qty,
        uom: item.uom,
        rate: rate,
        discount_percent: item.discount_percent,
        tax_percent: item.tax_percent,
        hsn_code: item.hsn_code,
        line_total: calculateLineTotal(item, qty, rate),
        original_qty: item.qty,
      };
    });
    onApply(selected);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Select Quotation Items</h2>
            <p className="text-sm text-zinc-500">
              {quotationHeader.quotation_no} • Total: {formatCurrency(quotationHeader.grand_total)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="w-10 pb-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === items.length && items.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-zinc-300"
                  />
                </th>
                <th className="pb-3 text-left text-sm font-medium text-zinc-700">Description</th>
                <th className="pb-3 text-right text-sm font-medium text-zinc-700 w-24">Original Qty</th>
                <th className="pb-3 text-right text-sm font-medium text-zinc-700 w-24">Qty to Bill</th>
                <th className="pb-3 text-right text-sm font-medium text-zinc-700 w-28">Rate (₹)</th>
                <th className="pb-3 text-right text-sm font-medium text-zinc-700 w-32">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const qty = editableQuantities[item.id] ?? item.qty;
                const rate = editableRates[item.id] ?? item.rate;
                const amount = calculateLineTotal(item, qty, rate);

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleItemToggle(item.id)}
                        className="rounded border-zinc-300"
                      />
                    </td>
                    <td className="py-3 text-sm text-zinc-900">
                      <div className="font-medium">{item.description}</div>
                      {item.hsn_code && (
                        <div className="text-xs text-zinc-500">HSN: {item.hsn_code}</div>
                      )}
                    </td>
                    <td className="py-3 text-right text-sm text-zinc-600">
                      {item.qty} {item.uom}
                    </td>
                    <td className="py-3">
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                        disabled={!isSelected}
                        className={`w-full text-right text-sm rounded border ${
                          isSelected
                            ? 'border-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            : 'border-transparent bg-transparent'
                        } px-2 py-1`}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="number"
                        value={rate}
                        onChange={(e) => handleRateChange(item.id, Number(e.target.value))}
                        disabled={!isSelected}
                        className={`w-full text-right text-sm rounded border ${
                          isSelected
                            ? 'border-zinc-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            : 'border-transparent bg-transparent'
                        } px-2 py-1`}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-zinc-900">
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50">
          <div className="text-sm text-zinc-600">
            {selectedItems.size} of {items.length} items selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedItems.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FilePlus className="w-4 h-4" />
              Apply Selected Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
