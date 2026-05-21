import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

function formatCurrency(n: number): string {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface ArcPricingItem {
  id: string;
  description: string;
  currentRate: number;
  arcRate: number | null;
  hasArcRate: boolean;
  variantId?: string | null;
  materialId?: string;
}

interface ArcConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onApplyAll: () => void;
  onApplySelected: (itemIds: string[]) => void;
  items: ArcPricingItem[];
}

export function ArcConfirmationDialog({
  open,
  onClose,
  onApplyAll,
  onApplySelected,
  items,
}: ArcConfirmationDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState<'all' | 'individual'>('all');

  // Group items by ARC availability
  const groupedItems = useMemo(() => {
    const withArc = items.filter(i => i.hasArcRate && i.arcRate !== null);
    const withoutArc = items.filter(i => !i.hasArcRate || i.arcRate === null);
    return { withArc, withoutArc };
  }, [items]);

  // Filter items by search
  const filteredWithArc = useMemo(() => {
    if (!searchTerm) return groupedItems.withArc;
    const term = searchTerm.toLowerCase();
    return groupedItems.withArc.filter(i => 
      i.description.toLowerCase().includes(term)
    );
  }, [groupedItems.withArc, searchTerm]);

  const filteredWithoutArc = useMemo(() => {
    if (!searchTerm) return groupedItems.withoutArc;
    const term = searchTerm.toLowerCase();
    return groupedItems.withoutArc.filter(i => 
      i.description.toLowerCase().includes(term)
    );
  }, [groupedItems.withoutArc, searchTerm]);

  // Calculate totals
  const willChangeCount = useMemo(() => {
    return items.filter(i => i.hasArcRate && i.arcRate !== null && i.arcRate !== i.currentRate).length;
  }, [items]);

  const totalChangeAmount = useMemo(() => {
    let amount = 0;
    items.forEach(item => {
      if (item.hasArcRate && item.arcRate !== null && item.arcRate !== item.currentRate) {
        amount += item.arcRate - item.currentRate;
      }
    });
    return amount;
  }, [items]);

  const handleSelectAllWithArc = () => {
    const newSelected = new Set(selectedIds);
    filteredWithArc.forEach(item => {
      if (item.hasArcRate && item.arcRate !== null && item.arcRate !== item.currentRate) {
        newSelected.add(item.id);
      }
    });
    setSelectedIds(newSelected);
  };

  const handleDeselectAllWithArc = () => {
    const newSelected = new Set(selectedIds);
    filteredWithArc.forEach(item => newSelected.delete(item.id));
    setSelectedIds(newSelected);
  };

  const handleToggleItem = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectedCount = selectedIds.size;

  const selectedChangeAmount = useMemo(() => {
    let amount = 0;
    filteredWithArc.forEach(item => {
      if (selectedIds.has(item.id) && item.arcRate !== null) {
        amount += item.arcRate - item.currentRate;
      }
    });
    return amount;
  }, [selectedIds, filteredWithArc]);

  const handleApply = () => {
    if (selectMode === 'all') {
      onApplyAll();
    } else {
      onApplySelected(Array.from(selectedIds));
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="text-amber-500">⚠</span>
            Apply ARC Pricing
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {/* Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 mx-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-amber-800 font-semibold">{willChangeCount}</span>
                <span className="text-amber-700"> items will use ARC pricing</span>
              </div>
              <div className="text-right">
                <span className="text-amber-600 text-sm">Total rate change: </span>
                <span className={`font-semibold ${totalChangeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalChangeAmount >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalChangeAmount))}
                </span>
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="flex gap-2 mb-4 mx-4">
            <button
              onClick={() => setSelectMode('all')}
              className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                selectMode === 'all'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Apply to All</div>
              <div className="text-xs opacity-75">Update all {willChangeCount} items at once</div>
            </button>
            <button
              onClick={() => setSelectMode('individual')}
              className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                selectMode === 'individual'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">Select Individual</div>
              <div className="text-xs opacity-75">Choose which items to update</div>
            </button>
          </div>

          {/* Individual Selection Mode */}
          {selectMode === 'individual' && (
            <>
              {/* Search */}
              <div className="mb-4 mx-4">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Will Change Section */}
              {filteredWithArc.length > 0 && (
                <div className="mb-4 mx-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Will use ARC pricing ({filteredWithArc.length})
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAllWithArc}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={handleDeselectAllWithArc}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          <th className="w-8 px-3 py-2"></th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Current</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">ARC</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-600">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredWithArc.map((item) => {
                          const change = item.arcRate !== null ? item.arcRate - item.currentRate : 0;
                          const willChange = change !== 0;
                          return (
                            <tr 
                              key={item.id} 
                              className={`hover:bg-gray-50 ${willChange ? '' : 'opacity-50'}`}
                            >
                              <td className="px-3 py-2">
                                {willChange && (
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(item.id)}
                                    onChange={() => handleToggleItem(item.id)}
                                    className="rounded border-gray-300"
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-900 truncate max-w-[200px]">
                                  {item.description}
                                </div>
                                {item.variantId && (
                                  <div className="text-xs text-gray-500">Variant: {item.variantId}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600">
                                {formatCurrency(item.currentRate)}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-green-600">
                                {item.arcRate !== null ? formatCurrency(item.arcRate) : '-'}
                              </td>
                              <td className={`px-3 py-2 text-right ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {willChange ? (
                                  <span>{change >= 0 ? '+' : ''}{formatCurrency(change)}</span>
                                ) : (
                                  <span className="text-gray-400">No change</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No ARC Section */}
              {filteredWithoutArc.length > 0 && (
                <div className="mb-4 mx-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-500">
                      No ARC rate available ({filteredWithoutArc.length})
                    </span>
                  </div>
                  <div className="border rounded-lg overflow-hidden bg-gray-50 max-h-[150px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b sticky top-0 bg-gray-50">
                        <tr>
                          <th className="w-8 px-3 py-2"></th>
                          <th className="text-left px-3 py-2 font-medium text-gray-500">Item</th>
                          <th className="text-right px-3 py-2 font-medium text-gray-500">Current Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredWithoutArc.map((item) => (
                          <tr key={item.id} className="opacity-60">
                            <td className="px-3 py-2">
                              <span className="text-xs text-gray-400">—</span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">
                              {item.description}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">
                              {formatCurrency(item.currentRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Selection Summary */}
              <div className="bg-gray-50 border rounded-lg p-3 mx-4">
                <div className="flex justify-between text-sm">
                  <span>Selected: <strong>{selectedCount}</strong> items</span>
                  <span>
                    Rate change:{' '}
                    <span className={`font-semibold ${selectedChangeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedChangeAmount >= 0 ? '+' : ''}{formatCurrency(Math.abs(selectedChangeAmount))}
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* All Mode Summary */}
          {selectMode === 'all' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mx-4">
              <div className="text-center">
                <div className="text-blue-800 font-medium">
                  All {willChangeCount} items with ARC rates will be updated
                </div>
                <div className="text-blue-600 text-sm mt-1">
                  Items without ARC rates will keep their current pricing
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="primary"
            onClick={handleApply}
            disabled={selectMode === 'individual' && selectedCount === 0}
          >
            {selectMode === 'all' 
              ? `Apply to All ${willChangeCount} Items` 
              : `Apply ${selectedCount} Selected Items`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}