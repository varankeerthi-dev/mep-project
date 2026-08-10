import { Button } from '../../../components/ui/button';
// src/warehouse/components/viewer/ViewerCanvas.tsx
// The interactive 2D floor-plan canvas for the Warehouse Viewer.
// Renders the positioned model from viewer/geometry.ts. Pure SVG —
// occupancy colours come from viewer/occupancy.ts, so a future 3D
// adapter can consume the same model (TAD §6.23 renderer independence).
//
// Interactions (PRD Phase 2): wheel/button zoom, drag to pan, double-click
// fit, click bin/rack/zone to select, layer toggles (grid/labels/bins),
// occupancy vs storage-role colour mode.

import { useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Grid3X3, Tag, Box, Flame } from 'lucide-react';
import type { ViewerModel, PositionedBin, Viewport } from '../../viewer/geometry';
import { ZONE_HEADER } from '../../viewer/geometry';
import { computeBinOccupancy, OCCUPANCY_COLORS } from '../../viewer/occupancy';
import type { Selection, ViewMode } from '../../viewer/viewerTypes';
import { STORAGE_ROLES } from '../../types';

interface ViewerCanvasProps {
  model: ViewerModel;
  viewport: Viewport;
  viewSize: { w: number; h: number };
  onViewportChange: (v: Viewport) => void;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  layers: { grid: boolean; labels: boolean; bins: boolean };
  onToggleLayer: (key: 'grid' | 'labels' | 'bins') => void;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Bin ids to visually highlight (Phase 3 search). Empty/absent = off. */
  highlightBins?: Set<string>;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3;

export default function ViewerCanvas({
  model,
  viewport,
  viewSize,
  onViewportChange,
  selection,
  onSelect,
  layers,
  onToggleLayer,
  mode,
  onModeChange,
  highlightBins,
}: ViewerCanvasProps) {
  const highlightActive = !!highlightBins && highlightBins.size > 0;
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origTx: number; origTy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const zoomAt = (px: number, py: number, factor: number) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * factor));
    if (zoom === viewport.zoom) return;
    onViewportChange({
      zoom,
      tx: px - (px - viewport.tx) * (zoom / viewport.zoom),
      ty: py - (py - viewport.ty) * (zoom / viewport.zoom),
    });
  };

  const fitAll = () => {
    const w = viewSize.w || 800;
    const h = viewSize.h || 600;
    const zoom = Math.min(w / model.totalWidth, h / model.totalHeight, 1.25);
    onViewportChange({
      zoom: Math.max(zoom, MIN_ZOOM),
      tx: (w - model.totalWidth * zoom) / 2,
      ty: (h - model.totalHeight * zoom) / 2,
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Don't start a pan when clicking an interactive element (bin/rack).
    if ((e.target as Element).closest('[data-selectable]')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origTx: viewport.tx, origTy: viewport.ty };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    onViewportChange({ ...viewport, tx: d.origTx + (e.clientX - d.startX), ty: d.origTy + (e.clientY - d.startY) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-selectable]')) return;
    fitAll();
  };

  const roleFor = (code: string) => STORAGE_ROLES.find(r => r.code === code) ?? STORAGE_ROLES[STORAGE_ROLES.length - 1];

  const selectBin = (bin: PositionedBin) => onSelect({ kind: 'bin', id: bin.bin.id });
  const selectRack = (zoneId: string, rackId: string) => onSelect({ kind: 'rack', id: rackId });
  const selectZone = (zoneId: string) => onSelect({ kind: 'zone', id: zoneId });

  const isSelected = (sel: Selection, id: string) => sel?.id === id;

  return (
    <div className="flex flex-col h-full bg-[#0f172a] rounded-lg overflow-hidden border border-slate-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-700/60 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm"
            title="Toggle occupancy heat map / storage-role colours"
            onClick={() => onModeChange(mode === 'occupancy' ? 'role' : 'occupancy')}
            className={`p-1.5 rounded ${mode === 'occupancy' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Flame size={14} />
          </Button>
          <span className="text-[10px] text-slate-500">Heat · {mode === 'occupancy' ? 'Occupancy' : 'Role'}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <LayerToggle active={layers.grid} title="Grid" onClick={() => onToggleLayer('grid')} icon={<Grid3X3 size={13} />} />
          <LayerToggle active={layers.labels} title="Labels" onClick={() => onToggleLayer('labels')} icon={<Tag size={13} />} />
          <LayerToggle active={layers.bins} title="Bins" onClick={() => onToggleLayer('bins')} icon={<Box size={13} />} />
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" title="Zoom out" onClick={() => zoomAt(viewSize.w / 2, viewSize.h / 2, 1 / 1.15)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <ZoomOut size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Zoom in" onClick={() => zoomAt(viewSize.w / 2, viewSize.h / 2, 1.15)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <ZoomIn size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Fit view" onClick={fitAll}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <Maximize2 size={14} />
          </Button>
          <span className="ml-1 text-[11px] tabular-nums text-slate-500 w-12 text-right">{Math.round(viewport.zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ touchAction: 'none' }}
      >
        <svg width={viewSize.w} height={viewSize.h} style={{ display: 'block' }}>
          <defs>
            {layers.grid && (
              <pattern id="viewer-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            )}
            <style>{`@keyframes wh-pulse { 0%, 100% { opacity: 1; stroke-width: 2 } 50% { opacity: 0.3; stroke-width: 3.5 } }`}</style>
          </defs>
          <g transform={`translate(${viewport.tx} ${viewport.ty}) scale(${viewport.zoom})`}>
            {layers.grid && <rect x={0} y={0} width={model.totalWidth} height={model.totalHeight} fill="url(#viewer-grid)" />}

            {model.floors.map(floor => {
              const fY = floor.y;
              return (
                <g key={floor.floor.id}>
                  {/* Floor band */}
                  <rect x={floor.x} y={fY} width={floor.width} height={28} rx={6} fill="#1e293b" stroke="#334155"
                    data-selectable onClick={() => onSelect({ kind: 'floor', id: floor.floor.id })}
                    style={{ cursor: 'pointer' }}
                    className={isSelected(selection, floor.floor.id) ? 'outline outline-1 outline-sky-400' : ''}
                  />
                  <text x={floor.x + 12} y={fY + 19} fontSize={12.5} fontWeight={700} fill="#e2e8f0">
                    {floor.floor.name}
                    <tspan fill="#64748b" fontSize={10.5} fontWeight={500}>
                      {'  ·  '}{floor.zones.length} zone{floor.zones.length !== 1 ? 's' : ''} · {floor.stats.binCount} bins
                    </tspan>
                  </text>

                  {floor.zones.map(zone => {
                    const role = roleFor(zone.zone.storage_role);
                    const zoneSelected = isSelected(selection, zone.zone.id);
                    const fill = mode === 'role'
                      ? `${role.color}${zoneSelected ? '2e' : '1a'}`
                      : `${role.color}${zoneSelected ? '24' : '0f'}`;
                    return (
                      <g key={zone.zone.id}>
                        {/* Zone container */}
                        <rect
                          x={zone.x} y={zone.y}
                          width={zone.width} height={zone.height}
                          rx={8}
                          fill={fill}
                          stroke={zoneSelected ? '#38bdf8' : role.color}
                          strokeOpacity={zoneSelected ? 0.9 : 0.4}
                          strokeWidth={zoneSelected ? 1.6 : 1}
                          strokeDasharray={zone.layout?.layout_type === 'custom' ? '4 3' : 'none'}
                          data-selectable
                          onClick={() => selectZone(zone.zone.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        {/* Zone chip */}
                        <rect x={zone.x + 18} y={zone.y} width={Math.min(zone.width - 36, 280)} height={ZONE_HEADER - 6} rx={4} fill={role.color} fillOpacity={0.16} />
                        <text x={zone.x + 26} y={zone.y + 14} fontSize={10.5} fontWeight={600} fill="#e2e8f0">
                          {zone.zone.name}
                        </text>
                        <text x={zone.x + Math.min(zone.width - 36, 280) - 2} y={zone.y + 14} fontSize={9.5} textAnchor="end" fill={role.color}>
                          {role.name} · {zone.racks.length} racks
                        </text>

                        {/* Racks */}
                        {zone.racks.map(p => {
                          const rackSelected = isSelected(selection, p.rack.id);
                          return (
                            <g key={p.rack.id}>
                              <rect
                                x={p.x} y={p.y} width={p.width} height={p.height} rx={5}
                                fill={rackSelected ? '#334155' : '#243244'}
                                stroke={rackSelected ? '#38bdf8' : '#475569'}
                                strokeWidth={rackSelected ? 1.6 : 1}
                                data-selectable
                                onClick={() => selectRack(zone.zone.id, p.rack.id)}
                                style={{ cursor: 'pointer' }}
                              />
                              {layers.bins && zone.bins
                                .filter(b => b.bin.rack_id === p.rack.id)
                                .map(bin => {
                                  const occ = computeBinOccupancy(bin.currentQty, bin.bin.max_quantity);
                                  const binSelected = isSelected(selection, bin.bin.id);
                                  const binHovered = hoveredBin === bin.bin.id;
                                  const highlighted = highlightBins?.has(bin.bin.id);
                                  const dimmed = highlightActive && !highlighted;
                                  const color = mode === 'role' ? '#334155' : occ.color;
                                  return (
                                    <g key={bin.bin.id} opacity={dimmed ? 0.3 : 1} style={{ transition: 'opacity 0.2s' }}>
                                      <rect
                                        x={bin.x + 0.75} y={bin.y + 0.75}
                                        width={bin.width - 1.5} height={bin.height - 1.5} rx={2.5}
                                        fill={color}
                                        fillOpacity={mode === 'role' ? 0.55 : 1}
                                        stroke={binSelected ? '#38bdf8' : highlighted ? '#fbbf24' : binHovered ? '#93c5fd' : '#47556955'}
                                        strokeWidth={binSelected ? 1.4 : highlighted ? 1.8 : binHovered ? 1.1 : 0.6}
                                        data-selectable
                                        onClick={e => { e.stopPropagation(); selectBin(bin); }}
                                        onMouseEnter={() => setHoveredBin(bin.bin.id)}
                                        onMouseLeave={() => setHoveredBin(null)}
                                        style={{ cursor: 'pointer' }}
                                      />
                                      {highlighted && (
                                        <rect
                                          x={bin.x - 1.75} y={bin.y - 1.75}
                                          width={bin.width + 3.5} height={bin.height + 3.5} rx={4}
                                          fill="none" stroke="#fbbf24" strokeWidth={2}
                                          style={{ animation: 'wh-pulse 1.1s ease-in-out infinite', pointerEvents: 'none' }}
                                        />
                                      )}
                                      {(binHovered || highlighted) && (
                                        <title>
                                          {binHovered
                                            ? `${bin.bin.name} · ${occ.currentQty}/${occ.maxQty} (${occ.pct}%)${highlighted ? ' — search match' : ''}`
                                            : `${bin.bin.name} — search match`}
                                        </title>
                                      )}
                                    </g>
                                  );
                                })}
                              {layers.labels && (
                                <text
                                  x={p.x + p.width / 2} y={p.y - 6}
                                  fontSize={10} fontWeight={600} textAnchor="middle"
                                  fill={rackSelected ? '#7dd3fc' : '#64748b'}
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {p.rack.name}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hint */}
        {model.floors.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            No floors — design a warehouse first.
          </div>
        )}
        {viewport.zoom < 0.3 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 bg-slate-900/90 px-2 py-0.5 rounded-full">
            Scroll to zoom · drag to pan
          </div>
        )}
      </div>
    </div>
  );
}

function LayerToggle({ active, title, onClick, icon }: { active: boolean; title: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded ${active ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}
    >
      {icon}
    </Button>
  );
}
