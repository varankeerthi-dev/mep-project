// src/warehouse/components/viewer/MiniMap.tsx
// Overview minimap (PRD Phase 2 "Mini Map"): a scaled-down view of the
// whole floor plan with a viewport rectangle. Clicking or dragging moves
// the main viewport.

import { useRef } from 'react';
import type { ViewerModel, Viewport } from '../../viewer/geometry';
import { STORAGE_ROLES } from '../../types';

interface MiniMapProps {
  model: ViewerModel;
  viewport: Viewport;
  viewSize: { w: number; h: number };
  onViewportChange: (v: Viewport) => void;
}

export default function MiniMap({ model, viewport, viewSize, onViewportChange }: MiniMapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Model → minimap scaling (with a little padding).
  const PAD = 6;
  const mmW = 168;
  const mmH = Math.max(90, Math.min(200, (model.totalHeight / model.totalWidth) * mmW));

  const scale = Math.min((mmW - PAD * 2) / model.totalWidth, (mmH - PAD * 2) / model.totalHeight);
  const offsetX = (mmW - model.totalWidth * scale) / 2;
  const offsetY = (mmH - model.totalHeight * scale) / 2;

  // Visible area in model coords.
  const z = viewport.zoom || 1;
  const visX = -viewport.tx / z;
  const visY = -viewport.ty / z;
  const visW = viewSize.w / z;
  const visH = viewSize.h / z;

  const jumpTo = (clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ((clientX - rect.left) - offsetX) / scale;
    const my = ((clientY - rect.top) - offsetY) / scale;
    onViewportChange({
      ...viewport,
      tx: viewSize.w / 2 - mx * viewport.zoom,
      ty: viewSize.h / 2 - my * viewport.zoom,
    });
  };

  return (
    <div
      ref={ref}
      className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-2 shadow-xl"
      style={{ cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={e => {
        draggingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        jumpTo(e.clientX, e.clientY);
      }}
      onPointerMove={e => {
        if (draggingRef.current) jumpTo(e.clientX, e.clientY);
      }}
      onPointerUp={e => {
        draggingRef.current = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }}
    >
      <div className="text-[9px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Mini map</div>
      <div className="relative" style={{ width: mmW, height: mmH }}>
        <svg width={mmW} height={mmH}>
          {model.floors.map(floor =>
            floor.zones.map(zone => {
              const role = STORAGE_ROLES.find(r => r.code === zone.zone.storage_role) ?? STORAGE_ROLES[STORAGE_ROLES.length - 1];
              return (
                <rect
                  key={zone.zone.id}
                  x={offsetX + zone.x * scale}
                  y={offsetY + zone.y * scale}
                  width={Math.max(zone.width * scale, 3)}
                  height={Math.max(zone.height * scale, 3)}
                  rx={1.5}
                  fill={role.color}
                  fillOpacity={0.28}
                  stroke={role.color}
                  strokeOpacity={0.5}
                  strokeWidth={0.5}
                />
              );
            })
          )}
        </svg>
        {/* Viewport rectangle (clamped to minimap bounds) */}
        <div
          className="absolute border border-sky-400/90 rounded-sm pointer-events-none"
          style={{
            left: Math.max(0, Math.min(mmW - 6, offsetX + visX * scale)),
            top: Math.max(0, Math.min(mmH - 6, offsetY + visY * scale)),
            width: Math.max(visW * scale, 6),
            height: Math.max(visH * scale, 6),
          }}
        />
      </div>
    </div>
  );
}
