import { Button } from '../../../components/ui/button';
// src/warehouse/components/designer/VersionHistoryDialog.tsx
// Layout version history (G10 — TAD §4.9). Lists every archived layout
// version for the warehouse (immutable history), newest first, with its
// zone/floor context and generated counts. Restore loads a version back
// into the designer draft so the user can re-publish it.

import { History, X, RotateCcw, Loader2, Rows3, Boxes } from 'lucide-react';
import { useLayoutHistory } from '../../hooks/useWarehouseData';
import type { LayoutVersionRow } from '../../types';

interface Props {
  warehouseId: string;
  onClose: () => void;
  onRestore: (version: LayoutVersionRow) => void;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function VersionHistoryDialog({ warehouseId, onClose, onRestore }: Props) {
  const { data: versions, isLoading } = useLayoutHistory(warehouseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-zinc-900 m-0">Layout Version History</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"><X size={15} /></Button>
        </div>

        <div className="text-[11px] text-zinc-500 mb-3">
          Published layouts are immutable — every save archives the previous version. Restore any version to re-publish it as a new one.
        </div>

        <div className="space-y-2 overflow-auto flex-1">
          {isLoading && <div className="flex items-center gap-2 text-xs text-zinc-400 py-3"><Loader2 size={13} className="animate-spin" /> Loading history…</div>}
          {!isLoading && versions?.length === 0 && (
            <div className="text-xs text-zinc-400 italic py-3">
              No archived versions yet. Save the warehouse twice to see the previous version here.
            </div>
          )}
          {versions?.map(v => (
            <div key={v.layout.id} className="rounded-lg border border-zinc-200 p-3 hover:border-zinc-300 transition-all">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-800 truncate">
                    {v.layout.name}
                    <span className="ml-1.5 text-[10px] font-semibold text-zinc-400">v{v.layout.version ?? '?'}</span>
                  </div>
                  <div className="text-[10.5px] text-zinc-500 truncate">
                    {v.floor.name} → {v.zone.name} · archived {fmtDate(v.layout.archived_on)}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRestore(v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 hover:bg-blue-100 transition-all shrink-0">
                  <RotateCcw size={11} /> Restore
                </Button>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10.5px] text-zinc-500">
                <span className="flex items-center gap-1"><Rows3 size={11} /> {v.rackCount} racks</span>
                <span className="flex items-center gap-1"><Boxes size={11} /> {v.bins.length} cols / rack</span>
                <span className="text-zinc-400">{v.layout.layout_type.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
