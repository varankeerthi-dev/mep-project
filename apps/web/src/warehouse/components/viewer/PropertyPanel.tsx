import { Button } from '../../../components/ui/button';
// src/warehouse/components/viewer/PropertyPanel.tsx
// Selection detail panel (PRD Phase 2 "Property Panel"). Shows capacity
// per PRD §6.8 (Current / Maximum / Remaining / Occupancy %) plus
// identity, physical and operational properties for the selected entity.

import { MapPin, Box, Building2, Layers, Info, X } from 'lucide-react';
import type { ViewerModel } from '../../viewer/geometry';
import { computeBinOccupancy, aggregateCapacity } from '../../viewer/occupancy';
import type { Selection } from '../../viewer/viewerTypes';
import { STORAGE_ROLES } from '../../types';
import type { ResolvedBinItem, AssignableItem } from '../../inventory';
import CapacityBar from './CapacityBar';
import OccupancyLegend from './OccupancyLegend';
import BinInventory from './BinInventory';

interface PropertyPanelProps {
  model: ViewerModel;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  /** Phase 3 — resolved bin items for the selected bin (search + panel). */
  itemsByBin?: Map<string, ResolvedBinItem[]>;
  assignableItems?: AssignableItem[];
  onAssignItem?: (binId: string, itemId: string, quantity: number) => void;
  onAdjustQty?: (binId: string, rowId: string, delta: number) => void;
  onRemoveItem?: (binId: string, rowId: string) => void;
  onSetPrimary?: (binId: string, rowId: string, primary: boolean) => void;
  busy?: boolean;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
      <span className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</span>
      <span className="text-[11px] font-medium text-zinc-700 text-right">{value ?? '—'}</span>
    </div>
  );
}

export default function PropertyPanel({
  model,
  selection,
  onSelect,
  itemsByBin,
  assignableItems = [],
  onAssignItem,
  onAdjustQty,
  onRemoveItem,
  onSetPrimary,
  busy,
}: PropertyPanelProps) {
  // Resolve the selected entity from the model.
  let title = 'Warehouse';
  let subtitle = model.warehouseName;
  let body: React.ReactNode = null;

  if (!selection) {
    const stats = model.stats;
    body = (
      <div className="space-y-3">
        <CapacityBar currentQty={stats.currentQty} maxQty={stats.maxQty} remaining={stats.remaining} pct={stats.pct} label="Overall" />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <MiniStat label="Floors" value={model.floors.length} />
          <MiniStat label="Zones" value={model.floors.reduce((n, f) => n + f.zones.length, 0)} />
          <MiniStat label="Racks" value={model.floors.reduce((n, f) => n + f.zones.reduce((m, z) => m + z.racks.length, 0), 0)} />
          <MiniStat label="Bins" value={stats.binCount} />
        </div>
        <div className="text-[10px] text-zinc-400 leading-relaxed pt-1">
          Click any bin, rack, zone or floor to inspect it. Use the tree or mini map to navigate.
        </div>
      </div>
    );
  } else if (selection.kind === 'floor') {
    const floor = model.floors.find(f => f.floor.id === selection.id);
    if (floor) {
      title = 'Floor';
      subtitle = floor.floor.name;
      body = (
        <div className="space-y-3">
          <CapacityBar currentQty={floor.stats.currentQty} maxQty={floor.stats.maxQty} remaining={floor.stats.remaining} pct={floor.stats.pct} label="Floor" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <MiniStat label="Zones" value={floor.zones.length} />
            <MiniStat label="Racks" value={floor.zones.reduce((n, z) => n + z.racks.length, 0)} />
            <MiniStat label="Bins" value={floor.stats.binCount} />
            <MiniStat label="Order" value={floor.floor.display_order} />
          </div>
        </div>
      );
    }
  } else if (selection.kind === 'zone') {
    const zone = model.floors.flatMap(f => f.zones).find(z => z.zone.id === selection.id);
    if (zone) {
      const role = STORAGE_ROLES.find(r => r.code === zone.zone.storage_role) ?? STORAGE_ROLES[STORAGE_ROLES.length - 1];
      title = 'Zone';
      subtitle = zone.zone.name;
      body = (
        <div className="space-y-3">
          <CapacityBar currentQty={zone.stats.currentQty} maxQty={zone.stats.maxQty} remaining={zone.stats.remaining} pct={zone.stats.pct} label="Zone" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <MiniStat label="Racks" value={zone.racks.length} />
            <MiniStat label="Bins" value={zone.stats.binCount} />
            <MiniStat label="Layout" value={zone.layout?.layout_type?.replace('_', ' ') ?? '—'} />
          </div>
          <div className="pt-1">
            <Field label="Storage role" value={<span className="flex items-center gap-1 justify-end"><span className="w-2 h-2 rounded-full inline-block" style={{ background: role.color }} />{role.name}</span>} />
            <Field label="Code" value={zone.zone.code} />
          </div>
        </div>
      );
    }
  } else if (selection.kind === 'rack') {
    const zone = model.floors.flatMap(f => f.zones).find(z => z.racks.some(r => r.rack.id === selection.id));
    const placed = zone?.racks.find(r => r.rack.id === selection.id);
    if (zone && placed) {
      const rackBins = zone.bins.filter(b => b.bin.rack_id === placed.rack.id);
      const stats = aggregateCapacity(rackBins.map(b => b.bin), new Map(rackBins.map(b => [b.bin.id, b.currentQty])));
      title = 'Rack';
      subtitle = placed.rack.name;
      body = (
        <div className="space-y-3">
          <CapacityBar currentQty={stats.currentQty} maxQty={stats.maxQty} remaining={stats.remaining} pct={stats.pct} label="Rack" />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <MiniStat label="Columns" value={placed.rack.columns_count} />
            <MiniStat label="Levels" value={placed.rack.levels_count} />
            <MiniStat label="Bins" value={stats.binCount} />
            <MiniStat label="Status" value={placed.rack.status ?? 'available'} />
          </div>
          <div className="pt-1">
            <Field label="Type" value={placed.rack.rack_type?.replace('_', ' ') ?? '—'} />
            <Field label="Code" value={placed.rack.code} />
            {placed.rack.max_weight_kg != null && <Field label="Max weight" value={`${placed.rack.max_weight_kg} kg`} />}
          </div>
        </div>
      );
    }
  } else if (selection.kind === 'bin') {
    const zone = model.floors.flatMap(f => f.zones).find(z => z.bins.some(b => b.bin.id === selection.id));
    const pb = zone?.bins.find(b => b.bin.id === selection.id);
    if (zone && pb) {
      const occ = computeBinOccupancy(pb.currentQty, pb.bin.max_quantity);
      const role = STORAGE_ROLES.find(r => r.code === zone.zone.storage_role) ?? STORAGE_ROLES[STORAGE_ROLES.length - 1];
      title = 'Bin';
      subtitle = pb.bin.name;
      body = (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: occ.color }}>{occ.label}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 uppercase tracking-wide">{pb.bin.status ?? 'available'}</span>
          </div>
          <CapacityBar currentQty={occ.currentQty} maxQty={occ.maxQty} remaining={occ.remaining} pct={occ.pct} color={occ.color} label="Bin" />
          <div className="pt-1">
            <Field label="Storage role" value={role.name} />
            <Field label="Rack" value={zone.racks.find(r => r.rack.id === pb.bin.rack_id)?.rack.name ?? '—'} />
            <Field label="Level · column" value={`L${pb.tierNumber} · C${pb.column}`} />
            {pb.bin.width_m != null && <Field label="Dimensions" value={`${pb.bin.width_m}×${pb.bin.depth_m ?? '—'}×${pb.bin.height_m ?? '—'} m`} />}
            {pb.bin.max_weight_kg != null && <Field label="Max weight" value={`${pb.bin.max_weight_kg} kg`} />}
            {pb.bin.max_volume_m3 != null && <Field label="Max volume" value={`${pb.bin.max_volume_m3} m³`} />}
            {pb.bin.max_pallets != null && <Field label="Max pallets" value={pb.bin.max_pallets} />}
            <Field label="Reserved" value={pb.bin.reserved_quantity ?? 0} />
            {pb.bin.qr_code && <Field label="QR" value={<span className="font-mono text-[9px]">{pb.bin.qr_code}</span>} />}
          </div>
          {onAssignItem && onAdjustQty && onRemoveItem && onSetPrimary && (
            <BinInventory
              binId={pb.bin.id}
              binName={pb.bin.name}
              maxQty={pb.bin.max_quantity}
              items={itemsByBin?.get(pb.bin.id) ?? []}
              assignableItems={assignableItems}
              onAssignItem={(itemId, quantity) => onAssignItem(pb.bin.id, itemId, quantity)}
              onAdjustQty={(rowId, delta) => onAdjustQty(pb.bin.id, rowId, delta)}
              onRemoveItem={rowId => onRemoveItem(pb.bin.id, rowId)}
              onSetPrimary={(rowId, primary) => onSetPrimary(pb.bin.id, rowId, primary)}
              busy={busy}
            />
          )}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col bg-white border border-zinc-200 rounded-lg overflow-hidden min-w-[240px] w-[280px]">
      <div className="px-3 py-2.5 border-b border-zinc-100 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <IconFor kind={selection?.kind} /> {title}
          </div>
          <div className="text-[12px] font-bold text-zinc-800 truncate">{subtitle}</div>
        </div>
        {selection && (
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)} title="Clear selection" className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
            <X size={13} />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">{body}</div>
      <div className="px-3 py-2 border-t border-zinc-100 bg-zinc-50/60">
        <OccupancyLegend compact />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded-md px-2 py-1.5">
      <div className="text-sm font-bold text-zinc-800 leading-none tabular-nums">{value}</div>
      <div className="text-[9px] text-zinc-400 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function IconFor({ kind }: { kind?: string }) {
  const size = 11;
  switch (kind) {
    case 'floor':
      return <Layers size={size} className="text-blue-500" />;
    case 'zone':
      return <MapPin size={size} className="text-blue-500" />;
    case 'rack':
      return <Building2 size={size} className="text-blue-500" />;
    case 'bin':
      return <Box size={size} className="text-blue-500" />;
    default:
      return <Info size={size} className="text-blue-500" />;
  }
}
