import { useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import type { ColumnDef } from '../../constants/materialColumns';

interface ColumnSettingsDropdownProps {
  columns: ColumnDef[];
  visibleColumns: string[];
  onToggleColumn: (key: string) => void;
  onSaveDefault?: () => void;
  onClose?: () => void;
}

export function ColumnSettingsDropdown({ columns, visibleColumns, onToggleColumn, onSaveDefault, onClose }: ColumnSettingsDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-zinc-200 rounded-lg shadow-lg p-3 min-w-[320px]"
      data-dropdown="columns"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Columns</span>
        {onSaveDefault && (
          <button
            onClick={onSaveDefault}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-zinc-600 border border-zinc-200 rounded hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors"
          >
            <Save className="w-3 h-3" /> Save as Default
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-0.5">
        {columns.map((col) => (
          <label
            key={col.key}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs transition-colors ${
              col.locked
                ? 'opacity-50 cursor-not-allowed bg-zinc-50'
                : 'cursor-pointer hover:bg-zinc-50'
            }`}
          >
            <input
              type="checkbox"
              checked={visibleColumns.includes(col.key)}
              onChange={() => !col.locked && onToggleColumn(col.key)}
              disabled={col.locked}
              className="rounded border-zinc-300 accent-indigo-600"
            />
            <span className="text-zinc-700">{col.label}{col.locked ? ' *' : ''}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
