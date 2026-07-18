import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AuditTxnRow } from '../../model/aggregates';

interface AuditTabProps {
  rows: AuditTxnRow[];
  loading: boolean;
}

export function AuditTab({ rows, loading }: AuditTabProps) {
  if (loading) return <div className="p-6 text-sm text-zinc-400">Loading...</div>;

  if (rows.length === 0) {
    return <div className="p-6 text-sm text-zinc-400">No audit trail entries found.</div>;
  }

  return (
    <div className="p-4 space-y-2">
      {rows.map((row) => (
        <AuditEntry key={row.id} entry={row} />
      ))}
    </div>
  );
}

function AuditEntry({ entry }: { entry: AuditTxnRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            entry.action === 'CREATED' ? 'bg-green-50 text-green-700' :
            entry.action === 'BULK_PRICE_UPDATE' ? 'bg-blue-50 text-blue-700' :
            'bg-zinc-100 text-zinc-600'
          }`}>
            {entry.action}
          </span>
          <span className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 truncate max-w-[300px]">{entry.notes}</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
        </div>
      </button>
      {expanded && entry.changes.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {entry.changes.map((change, i) => (
            <div key={i} className="text-xs text-zinc-600 py-1 px-2 bg-zinc-50 rounded">
              {change}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
