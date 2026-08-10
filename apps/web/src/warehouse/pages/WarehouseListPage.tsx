import { Button } from '../../components/ui/button';
import { PageSkeleton } from '../../components/ui/skeleton';
// src/warehouse/pages/WarehouseListPage.tsx
// Warehouse master list — the entry point for the module. Lists all
// warehouses for the organisation, shows quick stats, and opens the
// Designer (new or existing) and the Viewer (future).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, Plus, Search, MapPin, PencilRuler, Users, Building2, Layers, Boxes, Eye } from 'lucide-react';
import { useWarehouses, useWarehouseFloors } from '../hooks/useWarehouseData';

interface Props {
  onNavigate?: (path: string) => void;
}

export default function WarehouseListPage({ onNavigate }: Props) {
  const routerNavigate = useNavigate();
  const navigate = onNavigate ?? routerNavigate;
  const { data: warehouses = [], isLoading } = useWarehouses();
  const [search, setSearch] = useState('');

  // Fetch floor counts for stats (first warehouse only is enough for the strip,
  // but we fetch per-card lazily via the hook below for each open page).
  const firstWarehouseId = warehouses[0]?.id;
  const { data: firstFloorRows } = useWarehouseFloors(firstWarehouseId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter(w =>
      (w.warehouse_name ?? w.name ?? '').toLowerCase().includes(q) ||
      (w.warehouse_code ?? '').toLowerCase().includes(q) ||
      (w.location ?? '').toLowerCase().includes(q)
    );
  }, [warehouses, search]);

  const goDesigner = (warehouseId?: string) => {
    navigate(warehouseId ? `/warehouse/designer/${warehouseId}` : '/warehouse/designer');
  };

  const goViewer = (warehouseId: string) => {
    navigate(`/warehouse/viewer/${warehouseId}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1200px] mx-auto px-4 pt-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 m-0 flex items-center gap-2">
              <Warehouse size={18} className="text-blue-600" />
              Warehouses
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Design and manage your storage facilities</p>
          </div>
          <Button variant="ghost" size="sm"
            onClick={() => goDesigner()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus size={14} /> New Warehouse
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <StatCard icon={<Warehouse size={16} />} label="Warehouses" value={warehouses.length} color="bg-blue-50 text-blue-600" />
          <StatCard icon={<Building2 size={16} />} label="Active" value={warehouses.filter(w => w.is_active !== false).length} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={<MapPin size={16} />} label="Locations" value={new Set(warehouses.map(w => w.location).filter(Boolean)).size} color="bg-amber-50 text-amber-600" />
          <StatCard icon={<Boxes size={16} />} label="Defaults" value={warehouses.filter(w => w.is_default).length} color="bg-purple-50 text-purple-600" />
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code or location…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 bg-white text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {isLoading ? (
          <PageSkeleton variant="list" rows={6} />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
            <Warehouse size={40} className="mx-auto mb-3 text-zinc-300" />
            <div className="text-sm font-semibold text-zinc-700">No warehouses found</div>
            <div className="text-xs text-zinc-400 mt-1 mb-4">
              {search ? 'Try a different search term.' : 'Create your first warehouse to start designing.'}
            </div>
            {!search && (
              <Button variant="ghost" size="sm" onClick={() => goDesigner()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all">
                <Plus size={13} className="inline mr-1 -mt-0.5" /> Design a Warehouse
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(w => {
              const floorCount = w.id === firstWarehouseId ? (firstFloorRows?.length ?? 0) : 0;
              return (
                <div key={w.id} className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Warehouse size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-900 leading-tight">{w.warehouse_name ?? w.name}</div>
                        <div className="text-[10px] font-mono text-zinc-400">{w.warehouse_code ?? '—'}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${w.is_active !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                      {w.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-500 flex items-center gap-1 mb-3">
                    <MapPin size={11} className="text-zinc-400" />
                    {w.location || w.address || 'No location set'}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 mb-3">
                    <span className="flex items-center gap-1"><Layers size={11} /> {floorCount || '—'} floors</span>
                    {w.manager && <span className="flex items-center gap-1"><Users size={11} /> {w.manager}</span>}
                    {w.is_default && <span className="text-blue-600 font-semibold">DEFAULT</span>}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm"
                      onClick={() => goViewer(w.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-zinc-200 text-[11px] font-semibold text-zinc-600 group-hover:border-blue-300 group-hover:text-blue-600 hover:bg-blue-50 transition-all"
                    >
                      <Eye size={12} /> View
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={() => goDesigner(w.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-zinc-200 text-[11px] font-semibold text-zinc-600 group-hover:border-blue-300 group-hover:text-blue-600 hover:bg-blue-50 transition-all"
                    >
                      <PencilRuler size={12} /> Designer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div>
        <div className="text-lg font-bold text-zinc-900 leading-none">{value}</div>
        <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{label}</div>
      </div>
    </div>
  );
}
