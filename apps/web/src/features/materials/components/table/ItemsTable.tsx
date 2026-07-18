import { memo } from 'react';
import { flexRender, type Table as TableType } from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ItemsTableProps {
  table: TableType<any>;
  onRowClick: (materialId: string) => void;
  selectedMaterialId: string | null;
}

export const ItemsTable = memo(function ItemsTable({ table, onRowClick, selectedMaterialId }: ItemsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-zinc-50 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500 whitespace-nowrap"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.original.id)}
              className={`border-b border-zinc-100 transition-colors cursor-pointer ${
                selectedMaterialId === row.original.id
                  ? 'bg-indigo-50 hover:bg-indigo-100'
                  : 'hover:bg-zinc-50'
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2.5 align-middle text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <div className="text-center py-12 text-zinc-400 text-sm">
          No items found
        </div>
      )}
    </div>
  );
});
