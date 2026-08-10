import { Button } from '../../components/ui/Button';
// src/warehouse/pages/WarehouseViewerPage.tsx
// Phase 2 — Warehouse Viewer. A read-only 2D floor plan of a saved
// warehouse with visual navigation (PRD Phase 2): tree, mini map,
// occupancy colours, property panel, zoom/pan/fit, layer controls.
//
// The page owns viewport + selection state; rendering lives in
// components/viewer/* and pure model building in viewer/geometry.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Warehouse, Eye, Boxes, Loader2, ChevronDown, Search, X, Crosshair } from 'lucide-react';
import {
  useWarehouseViewer,
  useWarehouses,
  useAssignableItems,
  useAssignBinItem,
  useAdjustBinItemQty,
  useDeleteBinItem,
  useSetBinItemFlags,
} from '../hooks/useWarehouseData';
import { buildViewerModel, fitBBox, DEFAULT_VIEWPORT, type Viewport } from '../viewer/geometry';
import { sumQuantitiesByBin } from '../viewer/occupancy';
import { searchBins, type BinSearchContext } from '../inventory';
import type { Selection, ViewMode } from '../viewer/viewerTypes';
import ViewerCanvas from '../components/viewer/ViewerCanvas';
import WarehouseTree from '../components/viewer/WarehouseTree';
import MiniMap from '../components/viewer/MiniMap';
import PropertyPanel from '../components/viewer/PropertyPanel';
import OccupancyLegend from '../components/viewer/OccupancyLegend';
import CapacityBar from '../components/viewer/CapacityBar';

interface Props {
  onNavigate?: (path: string) => void;
}

/** Parse /warehouse/viewer/<id> from the plain-switch router pathname. */
export function warehouseIdFromPath(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean);
  const idx = parts.findIndex(p => p === 'viewer');
  return idx >= 0 ? parts[idx + 1] : undefined;
}

export default function WarehouseViewerPage({ onNavigate }: Props) {
  const routerNavigate = useNavigate();
  const navigate = onNavigate ?? routerNavigate;
  const location = useLocation();
  const warehouseId = warehouseIdFromPath(location.pathname);

  const { data: warehouses = [], isLoading: loadingWarehouses } = useWarehouses();
  const { data, isLoading } = useWarehouseViewer(warehouseId);

  const [selection, setSelection] = useState<Selection>(null);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [mode, setMode] = useState<ViewMode>('occupancy');
  const [layers, setLayers] = useState({ grid: true, labels: true, bins: true });
  const [viewSize, setViewSize] = useState({ w: 800, h: 560 });
  // Search is seeded from the URL (?q=) so the Dashboard's Quick Search
  // (PRD §2.9) can hand off a query straight into the visual highlight loop.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  // Quick-search handoff: when a ?q= arrives with no warehouse chosen, open
  // the first warehouse so the highlight loop actually renders (review fix).
  const qParam = searchParams.get('q');
  useEffect(() => {
    if (warehouseId || !qParam || warehouses.length === 0) return;
    navigate(`/warehouse/viewer/${warehouses[0].id}?q=${encodeURIComponent(qParam)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, qParam, warehouses.length]);

  // Phase 3 — inventory mutation hooks (wired to the property panel).
  const assignItem = useAssignBinItem();
  const adjustQty = useAdjustBinItemQty();
  const removeItem = useDeleteBinItem();
  const setPrimary = useSetBinItemFlags();
  const { data: assignableItems = [] } = useAssignableItems();

  // Measure the canvas container so fit-to-selection is accurate.
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setViewSize({ w: Math.max(r.width, 300), h: Math.max(r.height, 300) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const quantitiesByBin = useMemo(
    () => (data ? sumQuantitiesByBin(data.binItems) : new Map<string, number>()),
    [data]
  );

  const model = useMemo(
    () => (data?.structure ? buildViewerModel(data.structure, quantitiesByBin) : null),
    [data, quantitiesByBin]
  );

  // Phase 3 — search engine. Builds a per-bin haystack from the model
  // (bin/rack/zone names + QR/barcode) and the resolved items (name/code/
  // batch/lot), then highlights every matching bin in the canvas.
  const binContexts = useMemo<BinSearchContext[]>(() => {
    if (!model || !data) return [];
    const ctx: BinSearchContext[] = [];
    for (const f of model.floors) {
      for (const z of f.zones) {
        for (const b of z.bins) {
          ctx.push({
            binId: b.bin.id,
            binName: b.bin.name,
            binCode: b.bin.code,
            qrCode: b.bin.qr_code,
            barcode: b.bin.barcode,
            rackName: z.racks.find(r => r.rack.id === b.bin.rack_id)?.rack.name,
            zoneName: z.zone.name,
            items: data.itemsByBin.get(b.bin.id),
          });
        }
      }
    }
    return ctx;
  }, [model, data]);

  const highlightIds = useMemo(() => new Set(searchBins(query, binContexts)), [query, binContexts]);
  const matches = highlightIds.size;

  const focusFirstMatch = useCallback(() => {
    if (!model || matches === 0) return;
    const firstId = searchBins(query, binContexts)[0];
    const z = model.floors.flatMap(f => f.zones).find(x => x.bins.some(b => b.bin.id === firstId));
    const b = z?.bins.find(x => x.bin.id === firstId);
    if (b) {
      setViewport(fitBBox({ x: b.x - 8, y: b.y - 8, w: b.width + 16, h: b.height + 16 }, viewSize.w, viewSize.h));
      setSelection({ kind: 'bin', id: firstId });
    }
  }, [model, matches, query, binContexts, viewSize]);

  // Focus the viewport on an entity's bounding box (tree navigation).
  const focusOn = useCallback(
    (sel: Selection) => {
      if (!model) return;
      let bbox: { x: number; y: number; w: number; h: number } | null = null;
      if (!sel) {
        bbox = { x: 0, y: 0, w: model.totalWidth, h: model.totalHeight };
      } else if (sel.kind === 'floor') {
        const f = model.floors.find(x => x.floor.id === sel.id);
        if (f) bbox = { x: f.x, y: f.y, w: f.width, h: f.height };
      } else if (sel.kind === 'zone') {
        const z = model.floors.flatMap(f => f.zones).find(x => x.zone.id === sel.id);
        if (z) bbox = { x: z.x, y: z.y, w: z.width, h: z.height };
      } else if (sel.kind === 'rack') {
        const z = model.floors.flatMap(f => f.zones).find(x => x.racks.some(r => r.rack.id === sel.id));
        const r = z?.racks.find(x => x.rack.id === sel.id);
        if (r) bbox = { x: r.x - 12, y: r.y - 12, w: r.width + 24, h: r.height + 24 };
      } else if (sel.kind === 'bin') {
        const z = model.floors.flatMap(f => f.zones).find(x => x.bins.some(b => b.bin.id === sel.id));
        const b = z?.bins.find(x => x.bin.id === sel.id);
        if (b) bbox = { x: b.x - 6, y: b.y - 6, w: b.width + 12, h: b.height + 12 };
      }
      if (bbox) setViewport(fitBBox(bbox, viewSize.w, viewSize.h));
    },
    [model, viewSize]
  );

  // Tree navigation: select + focus.
  const handleTreeSelect = (sel: Selection) => {
    setSelection(sel);
    focusOn(sel);
  };

  const pickWarehouse = (id: string) => {
    setSelection(null);
    setViewport(DEFAULT_VIEWPORT);
    navigate(`/warehouse/viewer/${id}`);
  };

  // ── No warehouse chosen yet: picker ─────────────────────────────
  if (!warehouseId) {
    return (
      <div className="min-h-screen bg-[#f8f9fb]">
        <div className="max-w-xl mx-auto pt-16 px-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Eye size={22} />
            </div>
            <h1 className="text-base font-bold text-zinc-900 m-0">Warehouse Viewer</h1>
            <p className="text-xs text-zinc-500 mt-1 mb-6">
              Select a warehouse to explore its floor plan, racks and bin occupancy.
            </p>
            {loadingWarehouses ? (
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 py-4">
                <Loader2 size={14} className="animate-spin" /> Loading warehouses…
              </div>
            ) : warehouses.length === 0 ? (
              <div className="text-xs text-zinc-400 py-4">
                No warehouses yet. Design one first, then come back to view it.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 text-left">
                {warehouses.map(w => (
                  <Button variant="ghost" size="sm"
                    key={w.id}
                    onClick={() => pickWarehouse(w.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Warehouse size={15} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-zinc-800 truncate">{w.warehouse_name ?? w.name}</span>
                      <span className="block text-[10px] text-zinc-400 font-mono">{w.warehouse_code ?? '—'}</span>
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !model) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 size={16} className="animate-spin text-blue-600" /> Loading warehouse…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1400px] mx-auto px-4 pt-3 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Warehouse size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-zinc-900 m-0 truncate">{model.warehouseName}</h1>
              <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                <span>{model.floors.length} floors · {model.floors.reduce((n, f) => n + f.zones.length, 0)} zones · {model.stats.binCount} bins</span>
              </div>
            </div>
          </div>

          {/* Warehouse switcher */}
          <div className="relative">
            <select
              value={warehouseId}
              onChange={e => pickWarehouse(e.target.value)}
              className="appearance-none h-8 pl-3 pr-8 rounded-lg border border-zinc-200 bg-white text-[11px] font-semibold text-zinc-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.warehouse_name ?? w.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Phase 3 search — visual highlight loop */}
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') focusFirstMatch(); }}
              placeholder="Search item, bin, rack, batch, lot…"
              className="w-full h-8 pl-8 pr-8 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {query && (
              <Button variant="ghost" size="sm" onClick={() => setQuery('')} title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100">
                <X size={12} />
              </Button>
            )}
          </div>
          {query && (
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${matches > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-50 text-zinc-400 border-zinc-200'}`}>
              {matches > 0 ? `${matches} bin${matches !== 1 ? 's' : ''} match` : 'No matches'}
            </span>
          )}
          {matches > 0 && (
            <Button variant="ghost" size="sm" onClick={focusFirstMatch}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all">
              <Crosshair size={12} /> Focus first match
            </Button>
          )}
          <span className="text-[10px] text-zinc-400 hidden sm:inline">Occupancy colours are live — assign stock to bins to see them fill.</span>
        </div>

        {/* Overall occupancy strip */}
        <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Boxes size={12} className="text-blue-600" /> Capacity
          </span>
          <div className="flex-1 min-w-[180px] max-w-xs">
            <CapacityBar
              currentQty={model.stats.currentQty}
              maxQty={model.stats.maxQty}
              remaining={model.stats.remaining}
              pct={model.stats.pct}
              color={model.stats.color}
              label="Warehouse"
              compact
            />
          </div>
          <span className="text-[11px] tabular-nums text-zinc-600">
            <b className="text-zinc-900">{model.stats.currentQty}</b> / {model.stats.maxQty} units · {model.stats.pct}%
          </span>
          <OccupancyLegend compact />
        </div>

        {/* Three-pane workspace */}
        <div className="flex gap-3 items-stretch" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
          <WarehouseTree model={model} selection={selection} onSelect={handleTreeSelect} />
          <div ref={canvasWrapRef} className="flex-1 relative min-w-0">
            <ViewerCanvas
              model={model}
              viewport={viewport}
              viewSize={viewSize}
              onViewportChange={setViewport}
              selection={selection}
              onSelect={setSelection}
              layers={layers}
              onToggleLayer={key => setLayers(prev => ({ ...prev, [key]: !prev[key] }))}
              mode={mode}
              onModeChange={setMode}
              highlightBins={highlightIds}
            />
            <div className="absolute bottom-3 right-3">
              <MiniMap model={model} viewport={viewport} viewSize={viewSize} onViewportChange={setViewport} />
            </div>
          </div>
          <PropertyPanel
            model={model}
            selection={selection}
            onSelect={setSelection}
            itemsByBin={data.itemsByBin}
            assignableItems={assignableItems}
            onAssignItem={(binId, itemId, quantity) => assignItem.mutate({ warehouseId, assignment: { binId, itemId, quantity } })}
            onAdjustQty={(binId, rowId, delta) => adjustQty.mutate({ warehouseId, rowId, delta })}
            onRemoveItem={(binId, rowId) => removeItem.mutate({ warehouseId, rowId })}
            onSetPrimary={(binId, rowId, primary) => setPrimary.mutate({ warehouseId, rowId, flags: { isPrimary: primary } })}
            busy={assignItem.isPending || adjustQty.isPending || removeItem.isPending || setPrimary.isPending}
          />
        </div>
      </div>
    </div>
  );
}
