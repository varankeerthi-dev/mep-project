import type { WarehouseStockRow } from '../../model/aggregates';

interface WarehouseTabProps {
  rows: WarehouseStockRow[];
  loading: boolean;
}

export function WarehouseTab({ rows, loading }: WarehouseTabProps) {
  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading...</div>;

  if (rows.length === 0) {
    return <div className="p-6 text-sm text-zinc-400">No warehouse stock records found.</div>;
  }

  return (
    <div className="p-4">
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Warehouse</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Variant</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-500">Current Stock</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-500">Low Stock Level</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-500">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2 text-xs font-medium text-zinc-700">{row.warehouse}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{row.variant}</td>
                <td className="px-4 py-2 text-xs text-right font-medium text-zinc-700">{row.current_stock}</td>
                <td className="px-4 py-2 text-xs text-right text-zinc-500">{row.low_stock_level || '-'}</td>
                <td className="px-4 py-2 text-xs text-right text-zinc-400">
                  {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
