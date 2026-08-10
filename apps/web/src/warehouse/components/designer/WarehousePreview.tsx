import { Button } from '../../../components/ui/Button';
// src/warehouse/components/designer/WarehousePreview.tsx
// Live 2D preview for the Warehouse Designer. Renders the draft hierarchy
// visually: floors → zones (coloured areas) → layouts (labeled blocks) →
// racks (grid) → bins. Pure SVG — renderer-independent model, so a future
// Three.js adapter can consume the same draft (per TAD §6.23).
//
// Since Phase 1.5 the draft supports MULTIPLE LAYOUTS PER ZONE (PRD §3.8,
// §5.9): every layout renders its own rack grid block, stacked vertically
// inside the zone, so all of a zone's layouts are visible at once.
//
// Rack drag-placement (PRD §5.18) uses HTML5 DnD on SVG <g> elements, which
// works in Chromium + Firefox; Safari does not support `draggable` on SVG, so
// the drop overlay still renders but drags are inert there.

import { useMemo, useState } from 'react';
import type { WarehouseDraft, LayoutDraft } from '../../types';
import { STORAGE_ROLES } from '../../types';
import { expandRacks, layoutGridCells, canPlaceRack } from '../../namingEngine';
import { ZoomIn, ZoomOut, Maximize2, Grid3X3 } from 'lucide-react';

interface WarehousePreviewProps {
  draft: WarehouseDraft;
  selectedFloorId?: string;
  selectedZoneId?: string;
  /** Drag-placement of a rack onto a grid cell (PRD §5.18, collision-checked). */
  onMoveRack?: (floorId: string, zoneId: string, layoutId: string, rackIndex: number, row: number, col: number) => void;
}

const CELL_W = 30;
const CELL_H = 22;
const RACK_PAD = 5;
const ZONE_PAD = 14;
const LAYOUT_HEADER = 20;
const LAYOUT_GAP = 12;

function occupancyColor(qty: number, max: number): string {
  if (!max || max <= 0) return '#e4e4e7';
  const pct = (qty / max) * 100;
  if (pct <= 0) return '#e4e4e7'; // grey — empty
  if (pct <= 50) return '#86efac';
  if (pct <= 75) return '#fde047';
  if (pct <= 90) return '#fdba74';
  if (pct <= 100) return '#fca5a5';
  return '#c084fc'; // purple — over capacity
}

interface LayoutBlock {
  layout: LayoutDraft;
  racks: ReturnType<typeof expandRacks>;
  rackW: number;
  rackH: number;
  width: number;
  height: number;
}

function layoutBlock(layout: LayoutDraft): LayoutBlock {
  const { columns } = layout.racks;
  const racks = expandRacks(layout.racks, layout.naming, layout.layoutType);
  const rackW = columns * CELL_W + RACK_PAD * 2;
  const rackH = layout.racks.levels * CELL_H + RACK_PAD * 2;
  const colsPerRow = Math.max(...racks.map(r => r.col), 1);
  const totalRows = Math.max(...racks.map(r => r.row), 1);
  const width = colsPerRow * rackW + (colsPerRow - 1) * 8;
  const height = LAYOUT_HEADER + totalRows * rackH + (totalRows - 1) * 8;
  return { layout, racks, rackW, rackH, width, height };
}

export default function WarehousePreview({ draft, selectedFloorId, selectedZoneId, onMoveRack }: WarehousePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const [hoveredRack, setHoveredRack] = useState<string | null>(null);
  const [dragRack, setDragRack] = useState<{ zoneId: string; layoutId: string; rackIndex: number } | null>(null);

  // Compute per-floor layout geometry so the SVG can be sized up front.
  // Racks come from expandRacks (shared with the save generator), so U/L
  // shapes render exactly the racks that will be generated.
  const floors = useMemo(() => {
    return draft.floors.map((floor) => {
      const zones = floor.zones.map((zone) => {
        const blocks = zone.layouts.map(layoutBlock);
        const width = Math.max(...blocks.map(b => b.width), 120) + ZONE_PAD * 2;
        const height =
          (blocks.length ? blocks.reduce((s, b) => s + b.height + LAYOUT_GAP, 0) - LAYOUT_GAP : 36) + ZONE_PAD * 2;
        return { zone, blocks, width, height };
      });
      const width = Math.max(...zones.map(z => z.width), 300);
      const height = zones.reduce((sum, z) => sum + z.height + 16, 16);
      return { floor, zones, width, height };
    });
  }, [draft]);

  const totalWidth = Math.max(...floors.map(f => f.width), 480);
  const totalHeight = floors.reduce((sum, f) => sum + f.height + 28, 24);

  return (
    <div className="flex flex-col h-full bg-[#0f172a] rounded-lg overflow-hidden" style={{ minHeight: 420 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/60">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          Live Preview
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">
            {draft.floors.length} floor{draft.floors.length !== 1 ? 's' : ''} ·{' '}
            {draft.floors.reduce((n, f) => n + f.zones.length, 0)} zones ·{' '}
            {draft.floors.reduce((n, f) => n + f.zones.reduce((z, zo) => z + zo.layouts.length, 0), 0)} layouts
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" title="Grid" onClick={() => setShowGrid(v => !v)}
            className={`p-1.5 rounded ${showGrid ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            <Grid3X3 size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Zoom out" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.15).toFixed(2)))}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <ZoomOut size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Zoom in" onClick={() => setZoom(z => Math.min(2, +(z + 0.15).toFixed(2)))}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <ZoomIn size={14} />
          </Button>
          <Button variant="ghost" size="sm" title="Fit view" onClick={() => setZoom(1)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <Maximize2 size={14} />
          </Button>
          <span className="ml-1 text-[11px] tabular-nums text-slate-500 w-10 text-right">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: totalWidth * zoom, minHeight: totalHeight * zoom, padding: 16 }}>
          <svg
            width={totalWidth * zoom}
            height={totalHeight * zoom}
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
            style={{ display: 'block' }}
          >
            {showGrid && (
              <defs>
                <pattern id="design-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
              </defs>
            )}
            {showGrid && <rect x={0} y={0} width={totalWidth} height={totalHeight} fill="url(#design-grid)" />}

            {floors.map(({ floor, zones, width, height }, fi) => {
              const fY = floors.slice(0, fi).reduce((s, f) => s + f.height + 28, 0) + 8;
              const isFloorActive = !selectedFloorId || selectedFloorId === floor.id;
              let zY = fY + 34;
              return (
                <g key={floor.id} opacity={isFloorActive ? 1 : 0.45}>
                  {/* Floor band */}
                  <rect x={4} y={fY} width={width} height={28} rx={6} fill="#1e293b" stroke="#334155" />
                  <text x={16} y={fY + 19} fontSize={13} fontWeight={700} fill="#e2e8f0">
                    {floor.name}
                    <tspan fill="#64748b" fontSize={11} fontWeight={500}>  ·  {zones.length} zone{zones.length !== 1 ? 's' : ''}</tspan>
                  </text>

                  {zones.map(({ zone, blocks, width: zW, height: zH }) => {
                    const role = STORAGE_ROLES.find(r => r.code === zone.storageRole) ?? STORAGE_ROLES[STORAGE_ROLES.length - 1];
                    const isZoneActive = !selectedZoneId || selectedZoneId === zone.id;
                    const isHoverZone = hoveredRack?.startsWith(zone.id) ?? false;
                    const zoneX = 4;
                    const zoneY = zY;
                    zY += zH + 16;
                    return (
                      <g key={zone.id} opacity={isZoneActive ? 1 : 0.55}>
                        {/* Zone container */}
                        <rect
                          x={zoneX} y={zoneY - 26}
                          width={zW} height={zH}
                          rx={8}
                          fill={isHoverZone ? `${role.color}14` : `${role.color}0d`}
                          stroke={role.color}
                          strokeOpacity={isZoneActive ? 0.55 : 0.25}
                          strokeWidth={1.2}
                          strokeDasharray={zone.layouts.length === 0 || zone.layouts.some(l => l.layoutType === 'custom') ? '4 3' : 'none'}
                        />
                        {/* Zone header chip */}
                        <g>
                          <rect x={zoneX + ZONE_PAD} y={zoneY} width={Math.min(zW - ZONE_PAD * 2, 300)} height={20} rx={4} fill={role.color} fillOpacity={0.16} />
                          <text x={zoneX + ZONE_PAD + 8} y={zoneY + 14} fontSize={11} fontWeight={600} fill="#e2e8f0">
                            {zone.name}
                          </text>
                          <text x={zoneX + ZONE_PAD + Math.min(zW - ZONE_PAD * 2, 300) - 8} y={zoneY + 14} fontSize={10} textAnchor="end" fill={role.color}>
                            {role.name} · {zone.layouts.length} layout{zone.layouts.length !== 1 ? 's' : ''}
                          </text>
                        </g>

                        {blocks.length === 0 && (
                          <text x={zoneX + ZONE_PAD} y={zoneY + 44} fontSize={11} fill="#64748b" fontStyle="italic">
                            No layouts yet — add one on the Zones &amp; Layout step
                          </text>
                        )}

                        {/* Layout blocks (identical set to what the save generator emits) */}
                        {blocks.map((block, bi) => {
                          const { layout, racks, rackW, rackH } = block;
                          const bY = zoneY + 30 + blocks.slice(0, bi).reduce((s, b) => s + b.height + LAYOUT_GAP, 0);
                          const bX = zoneX + ZONE_PAD;
                          return (
                            <g key={layout.id}>
                              {/* Layout header */}
                              <rect x={bX} y={bY} width={Math.min(block.width, 300)} height={LAYOUT_HEADER - 2} rx={3} fill="#1e293b" stroke="#334155" />
                              <text x={bX + 8} y={bY + 13} fontSize={10} fontWeight={600} fill="#94a3b8">
                                {layout.name}
                                <tspan fill="#475569"> · {layout.layoutType.replace('_', ' ')}</tspan>
                              </text>

                              {/* Racks (draggable — PRD §5.18) */}
                              {racks.map(({ row, col, rackIndex, name }) => {
                                const x = bX + (col - 1) * (rackW + 8);
                                const y = bY + LAYOUT_HEADER + (row - 1) * (rackH + 8);
                                const rackId = `${zone.id}-${layout.id}-${rackIndex}`;
                                const isRackHover = hoveredRack === rackId;
                                const isDragging = dragRack !== null && dragRack.zoneId === zone.id && dragRack.layoutId === layout.id && dragRack.rackIndex === rackIndex;
                                return (
                                  <g
                                    key={rackId}
                                    onMouseEnter={() => setHoveredRack(rackId)}
                                    onMouseLeave={() => setHoveredRack(null)}
                                    {...({ draggable: true } as Record<string, boolean>)}
                                    opacity={isDragging ? 0.35 : 1}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/x-rack', String(rackIndex));
                                      e.dataTransfer.effectAllowed = 'move';
                                      setDragRack({ zoneId: zone.id, layoutId: layout.id, rackIndex });
                                    }}
                                    onDragEnd={() => setDragRack(null)}
                                    style={{ cursor: 'grab' }}
                                  >
                                    <rect
                                      x={x} y={y} width={rackW} height={rackH} rx={4}
                                      fill={isRackHover ? '#334155' : '#243244'}
                                      stroke={isDragging ? '#60a5fa' : isRackHover ? '#60a5fa' : '#475569'}
                                      strokeWidth={isDragging || isRackHover ? 1.6 : 1}
                                    />
                                    {/* Bins per level (drawn top-down) */}
                                    {Array.from({ length: layout.racks.levels }, (_, l) => l + 1).map(lvl => {
                                      const bY2 = y + RACK_PAD + (lvl - 1) * CELL_H;
                                      return Array.from({ length: layout.racks.columns }, (_, col) => col + 1).map(col => {
                                        const bX2 = x + RACK_PAD + (col - 1) * CELL_W;
                                        const binId = `${rackId}-L${lvl}C${col}`;
                                        const isHover = hoveredBin === binId;
                                        return (
                                          <g
                                            key={binId}
                                            onMouseEnter={() => setHoveredBin(binId)}
                                            onMouseLeave={() => setHoveredBin(null)}
                                          >
                                            <rect
                                              x={bX2 + 1} y={bY2 + 1} width={CELL_W - 2} height={CELL_H - 2} rx={2}
                                              fill={occupancyColor(0, 0)}
                                              stroke={isHover ? '#93c5fd' : '#47556955'}
                                              strokeWidth={isHover ? 1.4 : 0.8}
                                            />
                                          </g>
                                        );
                                      });
                                    })}
                                    {/* Rack label */}
                                    <text
                                      x={x + rackW / 2} y={y - 5}
                                      fontSize={9.5} fontWeight={600} textAnchor="middle" fill={isRackHover ? '#93c5fd' : '#94a3b8'}
                                    >
                                      {name}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Drop-target overlay (only while dragging this layout's rack) */}
                              {dragRack && dragRack.zoneId === zone.id && dragRack.layoutId === layout.id && onMoveRack && (
                                layoutGridCells(layout.racks, layout.layoutType).map(cell => {
                                  const check = canPlaceRack(
                                    layout.racks, racks, layout.rackOverrides ?? [], layout.layoutType,
                                    dragRack.rackIndex, cell.row, cell.col
                                  );
                                  const isSwap = check.ok && check.swapWith != null;
                                  const cx = bX + (cell.col - 1) * (rackW + 8);
                                  const cy = bY + LAYOUT_HEADER + (cell.row - 1) * (rackH + 8);
                                  return (
                                    <rect
                                      key={`drop-${layout.id}-${cell.row}-${cell.col}`}
                                      x={cx} y={cy} width={rackW} height={rackH} rx={4}
                                      fill={isSwap ? '#f59e0b26' : check.ok ? '#22c55e26' : '#ef444426'}
                                      stroke={isSwap ? '#f59e0b' : check.ok ? '#22c55e' : '#ef4444'}
                                      strokeWidth={1.4}
                                      strokeDasharray="4 3"
                                      style={{ cursor: check.ok ? 'copy' : 'not-allowed' }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!check.ok) return;
                                        onMoveRack(floor.id, zone.id, layout.id, dragRack.rackIndex, cell.row, cell.col);
                                        setDragRack(null);
                                      }}
                                    />
                                  );
                                })
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
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-2 bg-slate-900/80 border-t border-slate-700/60 text-[10px] text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#e4e4e7] inline-block" /> Empty</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#86efac] inline-block" /> 0–50%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#fde047] inline-block" /> 51–75%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#fdba74] inline-block" /> 76–90%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#fca5a5] inline-block" /> 91–100%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#c084fc] inline-block" /> Over</span>
        <span className="ml-auto">{draft.name ? draft.name : 'Untitled Warehouse'}</span>
      </div>
    </div>
  );
}
