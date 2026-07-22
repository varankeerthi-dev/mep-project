import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Table as TableIcon, Download, Settings, Package, MoreHorizontal, Tag, Upload, FileSpreadsheet } from 'lucide-react';
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
  onExcelEdit: () => void;
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
  onExcelEdit,
  categoryFilter,
  categoryOptions,
  onCategoryChange,
  showCategoryDropdown,
  onToggleCategoryDropdown,
  hideInactive,
  onToggleHideInactive,
}: ItemsToolbarProps) {
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <TableIcon className="w-3.5 h-3.5" /> Multi-Item
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

        {/* Three-dot More menu */}
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex items-center h-8 px-2 rounded-lg border text-xs transition-colors ${
              showMore
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMore && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[180px]">
              <button
                onClick={() => { onBulkPrice(); setShowMore(false); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
              >
                <Tag className="w-3.5 h-3.5" /> Bulk Price Update
              </button>
              <button
                onClick={() => { onBulkImport(); setShowMore(false); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" /> Bulk Import
              </button>
              <button
                onClick={() => { onExcelEdit(); setShowMore(false); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
