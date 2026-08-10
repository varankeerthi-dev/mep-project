import { Button } from '../../components/ui/button';
import { PageSkeleton } from '../../components/ui/skeleton';
// src/warehouse/pages/WarehouseDashboardPage.tsx
// Phase 5 — Dashboard & Operations Workspace (PRD §2.4–2.10, TAD §2.15 + §3.16).
// The UI consumes the Dashboard Engine ViewModel and NEVER calculates
// business logic itself (TAD §3.16). Sections:
//   Top:      Warehouse Summary · Quick Search · Today's Tasks · Quick Actions · AI Recommendations
//   Operations: Replenishment / Transfers / Dispatch / Picking / Quality / Cycle-Count queues
//   Warehouse: Heat Map · Storage Utilization · Zone Utilization · Activity
//   Insights: Fast/Slow Moving · Frequently Picked · Unused Storage · Efficiency

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Search, Zap, AlertTriangle, Boxes, ArrowLeftRight, Truck, ClipboardCheck,
  RefreshCcw, ShieldAlert, FileClock, ThermometerSun, Activity, TrendingUp, TrendingDown,
  PackageOpen, Gauge, Sparkles, ChevronRight, Loader2, Layers, Warehouse as WarehouseIcon,
  ListChecks, CheckCircle2, Bell, Table2, X,
} from 'lucide-react';
import { useDashboard } from '../hooks/useWarehouseData';
import type { DashboardViewModel, TaskItem, QueueSection, StockAlert } from '../dashboard';
import WarehouseTableView from '../components/dashboard/WarehouseTableView';

const TASK_ICONS: Record<TaskItem['icon'], React.ReactNode> = {
  replenish: <RefreshCcw size={12} />,
  approve: <CheckCircle2 size={12} />,
  dispatch: <Truck size={12} />,
  pick: <ListChecks size={12} />,
  quality: <ShieldAlert size={12} />,
  overflow: <AlertTriangle size={12} />,
  consolidate: <Boxes size={12} />,
};

const TASK_COLORS: Record<TaskItem['severity'], string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
};

const QUEUE_ICONS: Record<string, React.ReactNode> = {
  replenishment: <RefreshCcw size={13} />,
  transfers: <ArrowLeftRight size={13} />,
  dispatch: <Truck size={13} />,
  picking: <ClipboardCheck size={13} />,
  quality: <ShieldAlert size={13} />,
  'cycle-count': <FileClock size={13} />,
};

const ALERT_STYLE: Record<StockAlert['severity'], { chip: string; row: string }> = {
  critical: { chip: 'bg-red-50 text-red-600 border-red-200', row: 'border-l-red-400 hover:bg-red-50/40' },
  warning: { chip: 'bg-amber-50 text-amber-700 border-amber-200', row: 'border-l-amber-400 hover:bg-amber-50/40' },
  info: { chip: 'bg-zinc-50 text-zinc-500 border-zinc-200', row: 'border-l-zinc-300 hover:bg-zinc-50/60' },
};

const ALERT_LABELS: Record<StockAlert['kind'], string> = {
  low_picking: 'Low Picking', bin_full: 'Bin Full', bin_blocked: 'Bin Blocked',
  no_movement: 'No Movement', quality_hold: 'Quality Hold', cycle_due: 'Cycle Count Due',
  over_capacity: 'Over Capacity',
};

const QUICK_ACTIONS = [
  { id: 'receive', label: 'Receive Material', desc: 'Put-away with suggestions', path: '/warehouse/operations', icon: <PackageOpen size={15} /> },
  { id: 'transfer', label: 'Internal Transfer', desc: 'Move stock between bins', path: '/warehouse/operations', icon: <ArrowLeftRight size={15} /> },
  { id: 'search', label: 'Search Warehouse', desc: 'Visual viewer + locate', path: '/warehouse/viewer', icon: <Search size={15} /> },
  { id: 'locate', label: 'Locate Item', desc: 'Find item in bins', path: '/warehouse/inventory', icon: <Boxes size={15} /> },
  { id: 'pick', label: 'Create Pick List', desc: 'From outbound orders', path: '/warehouse/operations', icon: <ClipboardCheck size={15} /> },
  { id: 'create', label: 'Create Warehouse', desc: 'Designer with templates', path: '/warehouse/designer', icon: <WarehouseIcon size={15} /> },
];

export default function WarehouseDashboardPage() {
  const { data: vm, isLoading, isError, refetch, isFetching } = useDashboard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickQuery, setQuickQuery] = useState('');
  // PRD §2.4: Dashboard has two sub-tabs — Dashboard and Table View.
  const [view, setView] = useState<'dashboard' | 'table'>('dashboard');
  const [notifOpen, setNotifOpen] = useState(false);

  // Quick search: jump straight to the viewer/inventory with the term — the
  // 8-way search (item/rack/bin/warehouse/QR/barcode/batch/lot) lives there.
  const goToViewer = () => navigate(quickQuery.trim() ? `/warehouse/viewer?q=${encodeURIComponent(quickQuery.trim())}` : '/warehouse/viewer');

  const filteredTasks = useMemo(() => vm?.tasks ?? [], [vm]);
  const recommended = useMemo(() => vm?.recommendations ?? [], [vm]);

  // PRD §4.22: manual refresh button — never interrupts (background refetch).
  const manualRefresh = () => {
    void refetch();
    queryClient.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
  };

  if (isLoading) return <PageSkeleton variant="page" />;

  if (isError || !vm) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-xs text-red-500">
        Could not load the dashboard. Check your organisation's warehouse data.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-10">
      <div className="max-w-[1400px] mx-auto px-4 pt-3">
        {/* Header (PRD §4.22 manual refresh) */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <LayoutDashboard size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 m-0">Warehouse Dashboard</h1>
              <div className="text-[10px] text-zinc-400">Operational control center · live aggregation (TAD §2.15)</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Sub-tabs (PRD §2.4 Dashboard + Table View) */}
            <div className="flex items-center gap-0.5 bg-white border border-zinc-200 rounded-lg p-0.5">
              <Button variant="ghost" size="sm"
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-[10.5px] font-bold transition-all ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'}`}
              >
                <LayoutDashboard size={12} /> Dashboard
              </Button>
              <Button variant="ghost" size="sm"
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-[10.5px] font-bold transition-all ${view === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'}`}
              >
                <Table2 size={12} /> Table View
              </Button>
            </div>
            <Button variant="ghost" size="sm"
              onClick={() => setNotifOpen(true)}
              title="Notification center (PRD §2.11)"
              className="relative w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 flex items-center justify-center transition-all"
            >
              <Bell size={15} />
              {(vm?.alerts.length ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[8.5px] font-bold flex items-center justify-center">
                  {vm!.alerts.length > 9 ? '9+' : vm!.alerts.length}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm"
              onClick={manualRefresh}
              title="Refresh dashboard (PRD §4.22)"
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 bg-white text-[10.5px] font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
            >
              {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              Refresh
            </Button>
            {/* Quick Search (PRD §2.9) */}
            <div className="relative w-full max-w-[220px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                value={quickQuery}
                onChange={e => setQuickQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') goToViewer(); }}
                placeholder="Search item, rack, bin…"
                className="w-full h-9 pl-9 pr-12 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <Button variant="ghost" size="sm"
                onClick={goToViewer}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 px-2 rounded-md bg-blue-600 text-white text-[9.5px] font-bold hover:bg-blue-700 transition-all"
              >
                Locate
              </Button>
            </div>
          </div>
        </div>

        {view === 'table' ? (
          <WarehouseTableView />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* ── LEFT COLUMN: summary + tasks + actions ─────────────────────── */}
          <div className="space-y-4">
            {/* Warehouse Summary (PRD §2.5) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <Boxes size={12} className="text-blue-600" /> Warehouse Summary
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <SummaryCard label="Warehouses" value={vm.summary.warehouseCount} icon={<WarehouseIcon size={14} className="text-blue-600" />} />
                <SummaryCard label="Bins" value={vm.summary.binCount} icon={<Layers size={14} className="text-indigo-500" />} />
                <SummaryCard label="Units stored" value={vm.summary.totalUnits} icon={<Boxes size={14} className="text-emerald-600" />} />
                <SummaryCard label="Items" value={vm.summary.distinctItems} icon={<PackageOpen size={14} className="text-amber-600" />} />
              </div>
              {/* Storage utilization bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[9.5px] font-semibold text-zinc-500 mb-1">
                  <span>Storage utilization</span>
                  <span className="tabular-nums">{vm.storageUtilization.pct}% · {vm.storageUtilization.currentQty}/{vm.storageUtilization.maxQty}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, vm.storageUtilization.pct)}%`, background: vm.storageUtilization.color }}
                  />
                </div>
              </div>
            </div>

            {/* Today's Tasks (PRD §2.10 — derived, auto-disappear) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <ListChecks size={12} className="text-blue-600" /> Today's Tasks
                <span className="ml-auto normal-case text-[9px] text-zinc-400">auto-generated · clears on completion</span>
              </div>
              {filteredTasks.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic py-2 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" /> All caught up — no operational tasks pending.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredTasks.map(t => (
                    <div key={t.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${TASK_COLORS[t.severity]}`}>
                      <span className="shrink-0">{TASK_ICONS[t.icon]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10.5px] font-bold truncate">{t.title}</div>
                        <div className="text-[9px] opacity-70 truncate">{t.detail}</div>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold tabular-nums">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions (PRD §2.9 — launch workflows directly) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <Zap size={12} className="text-amber-500" /> Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map(a => (
                  <Button variant="ghost" size="sm"
                    key={a.id}
                    onClick={() => navigate(a.path)}
                    className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50/60 hover:bg-blue-50/70 hover:border-blue-200 px-2.5 py-2 text-left transition-all group"
                  >
                    <span className="w-7 h-7 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-blue-600 group-hover:border-blue-300 transition-all">
                      {a.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-bold text-zinc-800 truncate">{a.label}</span>
                      <span className="block text-[8.5px] text-zinc-400 truncate">{a.desc}</span>
                    </span>
                    <ChevronRight size={12} className="ml-auto shrink-0 text-zinc-300 group-hover:text-blue-500 transition-all" />
                  </Button>
                ))}
              </div>
            </div>

            {/* Stock Alerts (PRD §4.16 — one-click navigation) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <AlertTriangle size={12} className="text-red-500" /> Stock Alerts
                <span className="ml-auto normal-case text-[9px] text-zinc-400">{vm.alerts.length} alert{vm.alerts.length !== 1 ? 's' : ''}</span>
              </div>
              {vm.alerts.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic py-2 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" /> No stock alerts — everything healthy.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {vm.alerts.slice(0, 6).map(a => (
                    <Button variant="ghost" size="sm"
                      key={a.id}
                      onClick={() => navigate(a.target)}
                      title="Open related record (PRD §4.16)"
                      className={`w-full text-left rounded-md border-l-2 border border-zinc-100 bg-zinc-50/50 px-2.5 py-1.5 transition-all ${ALERT_STYLE[a.severity].row}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block px-1 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-wide ${ALERT_STYLE[a.severity].chip}`}>
                          {ALERT_LABELS[a.kind]}
                        </span>
                        <span className="ml-auto shrink-0 text-[9px] text-zinc-400">→</span>
                      </div>
                      <div className="text-[10px] font-bold text-zinc-800 mt-0.5 truncate">{a.title}</div>
                      <div className="text-[8.5px] text-zinc-400 truncate">{a.detail}</div>
                    </Button>
                  ))}
                  {vm.alerts.length > 6 && (
                    <div className="text-[9px] text-zinc-400 text-center pt-1">+{vm.alerts.length - 6} more in the notification center</div>
                  )}
                </div>
              )}
            </div>

            {/* AI Recommendations (PRD §2.5 — rule-based) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <Sparkles size={12} className="text-violet-500" /> AI Recommendations
                <span className="ml-auto normal-case text-[9px] text-zinc-400">rule-based</span>
              </div>
              <div className="space-y-1.5">
                {recommended.map(r => (
                  <div
                    key={r.id}
                    className={`rounded-lg border px-2.5 py-2 ${
                      r.kind === 'alert'
                        ? 'bg-red-50/70 border-red-200 text-red-700'
                        : r.kind === 'action'
                          ? 'bg-blue-50/70 border-blue-200 text-blue-700'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                    }`}
                  >
                    <div className="text-[10.5px] font-bold flex items-center gap-1.5">
                      {r.kind === 'alert' ? <AlertTriangle size={11} /> : r.kind === 'action' ? <Zap size={11} /> : <Sparkles size={11} />}
                      {r.title}
                    </div>
                    <div className="text-[9px] opacity-80 mt-0.5">{r.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── MIDDLE COLUMN: operations queues ───────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <Activity size={12} className="text-blue-600" /> Operations
            </div>
            {vm.queues.map(q => <QueueCard key={q.id} queue={q} />)}
          </div>

          {/* ── RIGHT COLUMN: warehouse + insights ─────────────────────────── */}
          <div className="space-y-4">
            {/* Heat Map (PRD §2.5 / §6.9 palette) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <ThermometerSun size={12} className="text-orange-500" /> Heat Map
                <span className="ml-auto normal-case text-[9px] text-zinc-400">
                  {vm.heatCells.length} bin{vm.heatCells.length !== 1 ? 's' : ''}{vm.summary.binCount > 200 ? ' (first 200 shown)' : ''} · occupancy
                </span>
              </div>
              {vm.heatCells.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic py-2">No bins to map yet — design a warehouse first.</div>
              ) : (
                <div className="grid grid-cols-10 gap-1">
                  {vm.heatCells.map(c => (
                    <div
                      key={c.binId}
                      title={`${c.binName} — ${c.pct}% (${c.label})`}
                      className="aspect-square rounded-[3px] cursor-pointer hover:ring-2 hover:ring-zinc-400 transition-all"
                      style={{ background: c.color }}
                    />
                  ))}
                </div>
              )}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {[
                  ['#e4e4e7', 'Empty'], ['#86efac', '0–50%'], ['#fde047', '51–75%'],
                  ['#fdba74', '76–90%'], ['#fca5a5', '91–100%'], ['#c084fc', 'Over'],
                ].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-1 text-[8.5px] font-semibold text-zinc-500">
                    <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: color }} /> {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Zone utilization + congested zones (PRD §2.5) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <Gauge size={12} className="text-indigo-500" /> Zone Utilization
                {vm.congestedZones.length > 0 && (
                  <span className="ml-auto normal-case flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                    <AlertTriangle size={9} /> {vm.congestedZones.length} congested
                  </span>
                )}
              </div>
              {vm.zoneUtilization.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic py-2">No zones yet.</div>
              ) : (
                <div className="space-y-2">
                  {vm.zoneUtilization.map(z => (
                    <div key={z.zoneName}>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-600 mb-0.5">
                        <span className="truncate">{z.zoneName}<span className="text-zinc-400 font-normal"> · {z.binCount} bins</span></span>
                        <span className="tabular-nums">{z.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, z.pct)}%`, background: z.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warehouse Activity (PRD §2.5) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <Activity size={12} className="text-emerald-500" /> Warehouse Activity
              </div>
              {vm.activity.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic py-2">No movements recorded yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {vm.activity.map(a => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5">
                      <span className={`text-[9.5px] font-bold tabular-nums ${a.sign === '-' ? 'text-red-600' : 'text-emerald-700'}`}>
                        {a.sign}{a.quantity}
                      </span>
                      <span className="text-[9.5px] font-bold text-zinc-700 uppercase tracking-wide">{a.typeLabel}</span>
                      <span className="text-[9px] text-zinc-400 truncate flex-1">
                        {a.itemName ?? 'item'} {a.remarks ? `· ${a.remarks}` : ''}
                      </span>
                      <span className="text-[8.5px] text-zinc-400 shrink-0">{fmtTime(a.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Efficiency KPI (Insights) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <Gauge size={12} className="text-blue-600" /> Warehouse Efficiency
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-[15px] font-bold text-white shrink-0"
                  style={{ background: vm.efficiency.score >= 75 ? '#059669' : vm.efficiency.score >= 45 ? '#d97706' : '#dc2626' }}
                >
                  {vm.efficiency.score}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-zinc-800">{vm.efficiency.label}</div>
                  <div className="text-[9.5px] text-zinc-400 mt-0.5">{vm.efficiency.note}</div>
                  <div className="text-[9.5px] text-zinc-500 mt-0.5">
                    {vm.efficiency.closedDocs} completed · {vm.efficiency.openDocs} open documents
                  </div>
                </div>
              </div>
            </div>

            {/* Insights: fast / slow / frequent movers (PRD §2.5) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <TrendingUp size={12} className="text-emerald-500" /> Insights · 14-day movers
              </div>
              <InsightList title="Fast moving" icon={<TrendingUp size={11} className="text-emerald-600" />} items={vm.fastMoving} metric="movements" />
              <div className="border-t border-zinc-100 my-2.5" />
              <InsightList title="Frequently picked" icon={<ClipboardCheck size={11} className="text-blue-600" />} items={vm.frequentlyPicked} metric="picked" />
              <div className="border-t border-zinc-100 my-2.5" />
              <InsightList title="Slow moving" icon={<TrendingDown size={11} className="text-red-500" />} items={vm.slowMoving} metric="no movement" empty="No slow movers" />
            </div>

            {/* Unused storage (PRD §2.5 Insights) */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
                <PackageOpen size={12} className="text-amber-500" /> Unused Storage
              </div>
              {vm.unusedStorage.length === 0 ? (
                <div className="text-[11px] text-zinc-400 italic py-1">No empty configured bins — storage is being used.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {vm.unusedStorage.map(u => (
                    <span key={u.binId} className="px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-[9.5px] font-semibold text-zinc-600 font-mono">
                      {u.binName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Notification Center drawer (PRD §2.11 — direct navigation) */}
      {notifOpen && vm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setNotifOpen(false)}>
          <div
            className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="text-[12px] font-bold text-zinc-900 flex items-center gap-1.5">
                  <Bell size={13} className="text-blue-600" /> Notification Center
                </div>
                <div className="text-[9.5px] text-zinc-400">{vm.alerts.length} operational alert{vm.alerts.length !== 1 ? 's' : ''}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNotifOpen(false)} className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
                <X size={14} />
              </Button>
            </div>
            <div className="p-4 space-y-1.5">
              {vm.alerts.length === 0 && (
                <div className="text-[11px] text-zinc-400 italic py-4 text-center">No notifications right now.</div>
              )}
              {vm.alerts.map(a => (
                <Button variant="ghost" size="sm"
                  key={a.id}
                  onClick={() => { setNotifOpen(false); navigate(a.target); }}
                  className={`w-full text-left rounded-md border-l-2 border border-zinc-100 bg-zinc-50/50 px-3 py-2 transition-all ${ALERT_STYLE[a.severity].row}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full border text-[8.5px] font-bold uppercase tracking-wide ${ALERT_STYLE[a.severity].chip}`}>
                      {ALERT_LABELS[a.kind]}
                    </span>
                    <span className="text-[9px] text-zinc-400 ml-auto">open →</span>
                  </div>
                  <div className="text-[10.5px] font-bold text-zinc-800 mt-1">{a.title}</div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{a.detail}</div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">{icon}{label}</div>
      <div className="text-[16px] font-bold text-zinc-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function QueueCard({ queue }: { queue: QueueSection }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50/60 flex items-center gap-1.5">
        <span className="text-blue-600">{QUEUE_ICONS[queue.id]}</span>
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{queue.label}</span>
        <span className="text-[9.5px] text-zinc-400 ml-auto">{queue.items.length}</span>
      </div>
      {queue.items.length === 0 ? (
        <div className="px-3 py-3 text-[10.5px] text-zinc-400 italic">{queue.emptyText ?? 'Nothing pending.'}</div>
      ) : (
        <div className="divide-y divide-zinc-50">
          {queue.items.map(item => (
            <div key={item.id} className="px-3 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] font-bold text-zinc-800 truncate">{item.title}</div>
                <div className="text-[9px] text-zinc-400 truncate">{item.subtitle}</div>
              </div>
              {item.badge && (
                <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded-full border text-[8.5px] font-bold ${item.badgeClass ?? 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
                  {item.badge}
                </span>
              )}
              {item.meta && <span className="shrink-0 text-[9px] tabular-nums font-semibold text-zinc-500">{item.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightList({ title, icon, items, metric, empty }: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ itemId: string | null; itemName?: string | null; movementCount: number; netQty: number }>;
  metric: string;
  empty?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9.5px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">{icon}{title}</div>
      {items.length === 0 ? (
        <div className="text-[10px] text-zinc-400 italic">{empty ?? 'No data in window.'}</div>
      ) : (
        <div className="space-y-1">
          {items.map(it => (
            <div key={it.itemId ?? 'x'} className="flex items-center gap-2 text-[10.5px]">
              <span className="flex-1 truncate font-medium text-zinc-700">{it.itemName ?? it.itemId ?? 'Item'}</span>
              <span className="tabular-nums font-bold text-zinc-500">{it.movementCount}</span>
              <span className="text-[8.5px] text-zinc-400 w-14 text-right">{metric}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtTime(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
