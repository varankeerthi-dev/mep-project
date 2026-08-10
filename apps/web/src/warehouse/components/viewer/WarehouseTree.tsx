import { Button } from '../../../components/ui/button';
// src/warehouse/components/viewer/WarehouseTree.tsx
// Warehouse hierarchy navigator (PRD Phase 2 "Warehouse Tree").
// Floors → zones → racks. Clicking a node selects it and (via the page)
// focuses the viewport on it.

import { useMemo, useState } from 'react';
import { ChevronRight, Building2, Layers, Warehouse as WarehouseIcon } from 'lucide-react';
import type { ViewerModel } from '../../viewer/geometry';
import { aggregateCapacity } from '../../viewer/occupancy';
import type { Selection } from '../../viewer/viewerTypes';
import { STORAGE_ROLES } from '../../types';

interface WarehouseTreeProps {
  model: ViewerModel;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}

export default function WarehouseTree({ model, selection, onSelect }: WarehouseTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const isSearching = search.trim().length > 0;

  const filteredModel = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return model;
    return {
      ...model,
      floors: model.floors
        .map(f => ({
          ...f,
          zones: f.zones
            .map(z => ({
              ...z,
              racks: z.racks.filter(
                r =>
                  r.rack.name.toLowerCase().includes(q) ||
                  z.zone.name.toLowerCase().includes(q)
              ),
            }))
            .filter(z => z.zone.name.toLowerCase().includes(q) || z.racks.length > 0),
        }))
        .filter(f => f.floor.name.toLowerCase().includes(q) || f.zones.length > 0),
    };
  }, [model, search]);

  const selCls = (id: string, kind: string) =>
    selection?.kind === kind && selection.id === id;

  return (
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded-lg overflow-hidden min-w-[240px] w-[260px]">
      <div className="px-3 py-2.5 border-b border-zinc-100 flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5">
          <WarehouseIcon size={13} className="text-blue-600" /> Warehouse
        </span>
        <span className="text-[10px] text-zinc-400">{model.floors.length} floors</span>
      </div>
      <div className="px-2 pt-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search rack or zone…"
          className="w-full h-7 px-2 rounded-md border border-zinc-200 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {filteredModel.floors.length === 0 && (
          <div className="text-[11px] text-zinc-400 text-center py-6">No floors found</div>
        )}
        {filteredModel.floors.map(floor => {
          const isOpen = expanded[floor.floor.id] ?? true;
          const selected = selCls(floor.floor.id, 'floor');
          return (
            <div key={floor.floor.id}>
              <Button variant="ghost" size="sm"
                onClick={() => {
                  onSelect({ kind: 'floor', id: floor.floor.id });
                  toggle(floor.floor.id);
                }}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-[11px] font-semibold transition-colors ${
                  selected ? 'bg-blue-50 text-blue-700' : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <ChevronRight size={12} className={`transition-transform ${isOpen ? 'rotate-90' : ''} text-zinc-400 shrink-0`} />
                <Layers size={12} className="text-zinc-400 shrink-0" />
                <span className="truncate flex-1">{floor.floor.name}</span>
                <span className="text-[9px] text-zinc-400 tabular-nums">{floor.zones.length}</span>
              </Button>
              {isOpen &&
                floor.zones.map(zone => {
                  const role = STORAGE_ROLES.find(r => r.code === zone.zone.storage_role) ?? STORAGE_ROLES[STORAGE_ROLES.length - 1];
                  // Force zones open during search so matching racks are visible.
                  const zOpen = isSearching || (expanded[zone.zone.id] ?? false);
                  const zSelected = selCls(zone.zone.id, 'zone');
                  return (
                    <div key={zone.zone.id} className="ml-3">
                      <Button variant="ghost" size="sm"
                        onClick={() => {
                          onSelect({ kind: 'zone', id: zone.zone.id });
                          toggle(zone.zone.id);
                        }}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-[11px] transition-colors ${
                          zSelected ? 'bg-blue-50 text-blue-700' : 'text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        <ChevronRight size={11} className={`transition-transform ${zOpen ? 'rotate-90' : ''} text-zinc-400 shrink-0`} />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: role.color }} />
                        <span className="truncate flex-1">{zone.zone.name}</span>
                        <span className="text-[9px] text-zinc-400 tabular-nums">{zone.racks.length}</span>
                      </Button>
                      {zOpen &&
                        zone.racks.map(p => {
                          const rSelected = selCls(p.rack.id, 'rack');
                          const rackBins = zone.bins.filter(b => b.bin.rack_id === p.rack.id);
                          const stats = aggregateCapacity(rackBins.map(b => b.bin), new Map(rackBins.map(b => [b.bin.id, b.currentQty])));
                          return (
                            <Button variant="ghost" size="sm"
                              key={p.rack.id}
                              onClick={() => onSelect({ kind: 'rack', id: p.rack.id })}
                              className={`w-full flex items-center gap-1.5 pl-5 pr-2 py-1 rounded-md text-left text-[10.5px] transition-colors ${
                                rSelected ? 'bg-blue-50 text-blue-700' : 'text-zinc-500 hover:bg-zinc-50'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stats.color }} />
                              <Building2 size={11} className="text-zinc-400 shrink-0" />
                              <span className="font-mono truncate flex-1">{p.rack.name}</span>
                              <span className="text-[9px] text-zinc-400 tabular-nums">{p.binCount}</span>
                            </Button>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
