import type { ColumnDef } from '../../constants/materialColumns';

interface ColumnSettingsDropdownProps {
  columns: ColumnDef[];
  visibleColumns: string[];
  onToggleColumn: (key: string) => void;
}

export function ColumnSettingsDropdown({ columns, visibleColumns, onToggleColumn }: ColumnSettingsDropdownProps) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-20 w-64 bg-white border border-zinc-200 rounded-lg shadow-lg p-2"
      data-dropdown="columns"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        Toggle Columns
      </div>
      <div className="space-y-0.5">
        {columns.map((col) => (
          <label
            key={col.key}
            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
              col.locked
                ? 'opacity-50 cursor-not-allowed bg-zinc-50'
                : 'hover:bg-zinc-50'
            }`}
          >
            <input
              type="checkbox"
              checked={visibleColumns.includes(col.key)}
              onChange={() => !col.locked && onToggleColumn(col.key)}
              disabled={col.locked}
              className="rounded border-zinc-300"
            />
            <span className="text-zinc-700">{col.label}</span>
            {col.locked && <span className="ml-auto text-[10px] text-zinc-400">Required</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
