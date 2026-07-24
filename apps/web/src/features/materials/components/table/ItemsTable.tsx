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
      <table className="w-full" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}>
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-10 px-2 text-left align-middle text-sm font-medium text-black whitespace-nowrap"
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
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.original.id)}
              className={`${i < table.getRowModel().rows.length - 1 ? 'border-b border-[#E5E5E5]' : ''} transition-colors cursor-pointer ${
                selectedMaterialId === row.original.id
                  ? 'bg-indigo-50 hover:bg-indigo-100'
                  : 'hover:bg-[#F5F5F5]'
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2 align-middle text-sm text-black">
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
