import { Search, Plus, Upload, Table as TableIcon, Download, Settings, Package } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';

interface ItemsToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onAddItem: () => void;
  onBulkImport: () => void;
  onBulkPrice: () => void;
  onColumnSettings: () => void;
  onExport: () => void;
  categoryFilter: string;
  categoryOptions: string[];
  onCategoryChange: (category: string) => void;
  showCategoryDropdown: boolean;
  onToggleCategoryDropdown: () => void;
  hideInactive: boolean;
  onToggleHideInactive: () => void;
}

export function ItemsToolbar({
  searchTerm,
  onSearchChange,
  onAddItem,
  onBulkImport,
  onBulkPrice,
  onColumnSettings,
  onExport,
  categoryFilter,
  categoryOptions,
  onCategoryChange,
  showCategoryDropdown,
  onToggleCategoryDropdown,
  hideInactive,
  onToggleHideInactive,
}: ItemsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-zinc-200 p-3 shadow-sm">
      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Category filter */}
        <div className="relative" data-dropdown="category">
          <button
            onClick={onToggleCategoryDropdown}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-sm text-zinc-700 transition-colors"
          >
            <Package className="w-4 h-4" />
            <span>{categoryFilter === 'All' ? 'All Categories' : categoryFilter}</span>
          </button>
          {showCategoryDropdown && (
            <div className="absolute top-full left-0 mt-1 z-20 w-56 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <button
                onClick={() => { onCategoryChange('All'); onToggleCategoryDropdown(); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 ${categoryFilter === 'All' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-zinc-700'}`}
              >
                All Categories
              </button>
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { onCategoryChange(cat); onToggleCategoryDropdown(); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 ${categoryFilter === cat ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-zinc-700'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer hover:text-zinc-700 select-none">
          <input
            type="checkbox"
            checked={hideInactive}
            onChange={onToggleHideInactive}
            className="rounded border-zinc-300"
          />
          Hide inactive
        </label>

        <div className="w-px h-6 bg-zinc-200" />

        <Button variant="secondary" size="sm" onClick={onAddItem} className="h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Item
        </Button>
        <Button variant="secondary" size="sm" onClick={onBulkImport} className="h-8 text-xs gap-1.5">
          <Upload className="w-3.5 h-3.5" /> Import
        </Button>
        <Button variant="secondary" size="sm" onClick={onBulkPrice} className="h-8 text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" /> Update Prices
        </Button>
        <Button variant="secondary" size="sm" onClick={onExport} className="h-8 text-xs gap-1.5">
          <TableIcon className="w-3.5 h-3.5" /> Export
        </Button>
        <Button variant="secondary" size="sm" onClick={onColumnSettings} className="h-8 text-xs gap-1.5">
          <Settings className="w-3.5 h-3.5" /> Columns
        </Button>
      </div>
    </div>
  );
}
