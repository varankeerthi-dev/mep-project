import type { AdjustmentRow } from '../../model/aggregates';

interface AdjustmentsTabProps {
  rows: AdjustmentRow[];
  loading: boolean;
}

export function AdjustmentsTab({ rows, loading }: AdjustmentsTabProps) {
  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading...</div>;

  if (rows.length === 0) {
    return <div className="p-6 text-sm text-zinc-400">No stock adjustments found.</div>;
  }

  return (
    <div className="p-4">
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Date</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Type</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Source</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Doc No</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Party</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-zinc-500">Qty</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Unit</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2 text-xs text-zinc-500">{row.txn_date ? new Date(row.txn_date).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    row.type === 'Inward'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-zinc-600">{row.source}</td>
                <td className="px-4 py-2 text-xs text-zinc-600 font-mono">{row.doc_no}</td>
                <td className="px-4 py-2 text-xs text-zinc-600">{row.party}</td>
                <td className="px-4 py-2 text-xs text-right font-medium">{row.qty}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">{row.unit}</td>
                <td className="px-4 py-2 text-xs text-zinc-400 max-w-[200px] truncate">{row.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
