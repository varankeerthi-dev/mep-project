import { Button } from '../../components/ui/button';
// src/warehouse/components/GlobalSearchBar.tsx
// PRD §2.8 — Universal Quick Search. A module-level search bar on every
// warehouse screen: matches bins (name/zone/role), stocked items and zones,
// then hands the query to the Viewer's visual highlight loop (?q=) in one
// click or Enter. Pure consumer of the search-index hook — no business logic.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, CornerDownLeft, Layers, Package, Search, X } from 'lucide-react';
import { useSearchIndex } from '../hooks/useWarehouseData';

export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const { data: index, isLoading } = useSearchIndex();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return { bins: [], items: [], zones: [], racks: [], total: 0 };
    const bins = (index?.bins ?? [])
      .filter(b => b.name.toLowerCase().includes(q) || (b.zoneName ?? '').toLowerCase().includes(q) || (b.storageRole ?? '').toLowerCase().includes(q))
      .slice(0, 6);
    const items = (index?.items ?? [])
      .filter(i => i.name.toLowerCase().includes(q) || (i.code ?? '').toLowerCase().includes(q))
      .slice(0, 6);
    const zones = (index?.zones ?? []).filter(z => z.name.toLowerCase().includes(q)).slice(0, 3);
    const racks = (index?.racks ?? []).filter(r => r.name.toLowerCase().includes(q)).slice(0, 3);
    return { bins, items, zones, racks, total: bins.length + items.length + zones.length + racks.length };
  }, [q, index]);

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (search: string) => {
    navigate(`/warehouse/viewer?q=${encodeURIComponent(search)}`);
    setOpen(false);
    setQuery('');
  };

  const flat = useMemo(() => [...results.bins, ...results.items, ...results.zones, ...results.racks], [results]);
  // Enter selects the highlighted row when one is active, else runs the full query.
  const flatValues = useMemo(() => [
    ...results.bins.map(b => b.name),
    ...results.items.map(i => i.name),
    ...results.zones.map(z => z.name),
    ...results.racks.map(r => r.name),
  ], [results]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') { e.preventDefault(); const pick = flatValues[activeIdx]; if (pick) go(pick); else if (q) go(q); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, Math.max(flat.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
  };

  const rowCls = (i: number) =>
    `flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[11.5px] transition-colors ${i === activeIdx ? 'bg-blue-50 text-blue-800' : 'text-zinc-700 hover:bg-zinc-50'}`;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search bins, items, zones, racks across all warehouses…"
        className="w-full h-9 pl-8 pr-8 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      {query && (
        <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setOpen(false); }} title="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
          <X size={13} />
        </Button>
      )}
      {isLoading && !index && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 rounded-full border-2 border-zinc-200 border-t-blue-500 animate-spin" />
        </div>
      )}

      {open && q && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden">
          {results.total === 0 ? (
            <div className="px-3 py-4 text-[11px] text-zinc-400 italic">No matches for “{query.trim()}” — try a bin, item, zone or rack name.</div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto py-1">
              {results.bins.length > 0 && (
                <>
                  <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Boxes size={10} /> Bins
                  </div>
                  {results.bins.map((b, i) => (
                    <div key={b.id} className={rowCls(i)} onMouseEnter={() => setActiveIdx(i)} onClick={() => go(b.name)}>
                      <span className="font-semibold">{b.name}</span>
                      <span className="text-[10px] text-zinc-400">{b.zoneName ?? 'Unzoned'}{b.storageRole ? ` · ${b.storageRole.replace('_', ' ')}` : ''}</span>
                    </div>
                  ))}
                </>
              )}
              {results.items.length > 0 && (
                <>
                  <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Package size={10} /> Items in stock
                  </div>
                  {results.items.map((it, i) => (
                    <div key={it.id} className={rowCls(results.bins.length + i)} onMouseEnter={() => setActiveIdx(results.bins.length + i)} onClick={() => go(it.name)}>
                      <span className="font-semibold">{it.name}</span>
                      {it.code && <span className="text-[10px] text-zinc-400">{it.code}</span>}
                    </div>
                  ))}
                </>
              )}
              {results.zones.length > 0 && (
                <>
                  <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Layers size={10} /> Zones
                  </div>
                  {results.zones.map((z, i) => (
                    <div key={z.id} className={rowCls(results.bins.length + results.items.length + i)} onMouseEnter={() => setActiveIdx(results.bins.length + results.items.length + i)} onClick={() => go(z.name)}>
                      <span className="font-semibold">{z.name}</span>
                      <span className="text-[10px] text-zinc-400">zone</span>
                    </div>
                  ))}
                </>
              )}
              {results.racks.length > 0 && (
                <>
                  <div className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Layers size={10} /> Racks
                  </div>
                  {results.racks.map((r, i) => (
                    <div key={r.id} className={rowCls(results.bins.length + results.items.length + results.zones.length + i)} onMouseEnter={() => setActiveIdx(results.bins.length + results.items.length + results.zones.length + i)} onClick={() => go(r.name)}>
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-[10px] text-zinc-400">rack</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-zinc-100 bg-zinc-50/60 text-[10px] text-zinc-400">
            <CornerDownLeft size={11} /> Open “{query.trim()}” in the Viewer highlight
            {results.total > 0 && <span className="ml-auto tabular-nums">{results.total} match{results.total !== 1 ? 'es' : ''}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
