import { useMemo, useState } from 'react';
import {
  Activity, BarChart3, Download, FileBarChart2, Gauge, Loader2, RefreshCw,
  TrendingDown, TrendingUp, Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useDashboard } from '../hooks/useWarehouseData';
import type { DashboardViewModel } from '../dashboard';
import { rowsToCsv, type CsvValue } from '../reports';
import { Button } from '../../components/ui/button';
import { PageSkeleton } from '../../components/ui/skeleton';

type ReportKey = 'overview' | 'utilization' | 'movements' | 'velocity' | 'dead-stock';

const REPORTS: Array<{ id: ReportKey; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Warehouse totals and operational health' },
  { id: 'utilization', label: 'Utilization', description: 'Zone capacity and occupancy' },
  { id: 'movements', label: 'Movement history', description: 'Recent stock movements and audit activity' },
  { id: 'velocity', label: 'Stock velocity', description: 'Fast and slow moving inventory' },
  { id: 'dead-stock', label: 'Dead stock', description: 'Stocked items with no movement in the reporting window' },
];

function quantity(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

function percent(value: number): string {
  return `${Math.round(value)}%`;
}

function dateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function reportRows(vm: DashboardViewModel, report: ReportKey): { headers: string[]; rows: CsvValue[][]; filename: string } {
  if (report === 'utilization') {
    return {
      headers: ['Zone', 'Storage role', 'Bins', 'Configured bins', 'Current quantity', 'Maximum quantity', 'Occupancy', 'Status'],
      rows: vm.zoneUtilization.map(zone => [zone.zoneName, zone.storageRole ?? '', zone.binCount, zone.configuredBinCount, zone.currentQty, zone.maxQty, percent(zone.pct), zone.congested ? 'Congested' : 'Normal']),
      filename: 'warehouse-utilization.csv',
    };
  }
  if (report === 'movements') {
    return {
      headers: ['Timestamp', 'Type', 'Item', 'Bin', 'Quantity', 'Remarks'],
      rows: vm.movementHistory.map(item => [item.at ?? '', item.typeLabel, item.itemName ?? '', item.binName ?? '', item.quantity, item.remarks ?? '']),
      filename: 'warehouse-movement-history.csv',
    };
  }
  if (report === 'dead-stock') {
    return {
      headers: ['Category', 'Item or bin', 'Movement count', 'Net quantity', 'Zone'],
      rows: [
        ...vm.slowMoving.map(item => ['Dead stock', item.itemName ?? item.itemId ?? 'Unknown', item.movementCount, item.netQty, '']),
        ...vm.unusedStorage.map(bin => ['Unused storage', bin.binName, '', '', bin.zoneName ?? '']),
      ],
      filename: 'warehouse-dead-stock.csv',
    };
  }
  if (report === 'velocity') {
    return {
      headers: ['Classification', 'Item', 'Movement count', 'Net quantity'],
      rows: [
        ...vm.fastMoving.map(item => ['Fast moving', item.itemName ?? item.itemId ?? 'Unknown', item.movementCount, item.netQty]),
        ...vm.slowMoving.map(item => ['Slow moving', item.itemName ?? item.itemId ?? 'Unknown', item.movementCount, item.netQty]),
      ],
      filename: 'warehouse-stock-velocity.csv',
    };
  }
  return {
    headers: ['Metric', 'Value'],
    rows: [
      ['Warehouses', vm.summary.warehouseCount], ['Bins', vm.summary.binCount], ['Configured bins', vm.summary.configuredBinCount],
      ['Total units', vm.summary.totalUnits], ['Distinct items', vm.summary.distinctItems], ['Occupancy', percent(vm.summary.occupancyPct)],
      ['Open transfers', vm.summary.openTransfers], ['Open dispatches', vm.summary.openDispatches], ['Queued pick lists', vm.summary.queuedPickLists],
      ['Replenishment needs', vm.summary.replenishmentNeeds],
    ],
    filename: 'warehouse-overview.csv',
  };
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-4"><div className="flex items-center justify-between text-zinc-500"><span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>{icon}</div><div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{value}</div></div>;
}

function Table({ headers, rows }: { headers: string[]; rows: CsvValue[][] }) {
  return <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white"><table className="min-w-full text-left text-xs"><thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500"><tr>{headers.map(header => <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{rows.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-zinc-500">No report data available.</td></tr> : rows.map((row, index) => <tr key={index} className="hover:bg-zinc-50/70">{row.map((value, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-zinc-700">{value == null || value === '' ? '—' : String(value)}</td>)}</tr>)}</tbody></table></div>;
}

function Overview({ vm }: { vm: DashboardViewModel }) {
  return <><div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric label="Warehouses" value={vm.summary.warehouseCount} icon={<WarehouseIcon size={16} />} /><Metric label="Total units" value={quantity(vm.summary.totalUnits)} icon={<BarChart3 size={16} />} /><Metric label="Occupancy" value={percent(vm.summary.occupancyPct)} icon={<Gauge size={16} />} /><Metric label="Open transfers" value={vm.summary.openTransfers} icon={<Activity size={16} />} /><Metric label="Replenishment" value={vm.summary.replenishmentNeeds} icon={<RefreshCw size={16} />} /></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Table headers={['Metric', 'Value']} rows={reportRows(vm, 'overview').rows} /><div className="rounded-xl border border-zinc-200 bg-white p-4"><h3 className="text-sm font-semibold text-zinc-900">Recommendations</h3><div className="mt-3 space-y-2">{vm.recommendations.length === 0 ? <p className="text-xs text-zinc-500">No recommendations right now.</p> : vm.recommendations.slice(0, 6).map(item => <div key={item.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3"><div className="text-xs font-semibold text-zinc-800">{item.title}</div><div className="mt-1 text-[11px] leading-4 text-zinc-500">{item.detail}</div></div>)}</div></div></div></>;
}

function Velocity({ vm }: { vm: DashboardViewModel }) {
  const rows = (items: DashboardViewModel['fastMoving']) => items.map(item => [item.itemName ?? item.itemId ?? 'Unknown', quantity(item.movementCount), quantity(item.netQty)]);
  return <div className="grid gap-4 lg:grid-cols-2"><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900"><TrendingUp size={15} className="text-emerald-600" /> Fast moving</div><Table headers={['Item', 'Movements', 'Net quantity']} rows={rows(vm.fastMoving)} /></div><div><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900"><TrendingDown size={15} className="text-amber-600" /> Slow moving</div><Table headers={['Item', 'Movements', 'Net quantity']} rows={rows(vm.slowMoving)} /></div></div>;
}

export default function WarehouseReportsPage() {
  const { data: vm, isLoading, isError, isFetching, refetch } = useDashboard();
  const [report, setReport] = useState<ReportKey>('overview');
  const activeReport = REPORTS.find(item => item.id === report) ?? REPORTS[0];
  const exportData = useMemo(() => vm ? reportRows(vm, report) : null, [vm, report]);

  if (isLoading) return <PageSkeleton variant="page" />;
  if (isError || !vm) return <div className="flex min-h-[50vh] items-center justify-center text-sm text-red-600">Unable to load warehouse reports.</div>;

  return <div className="pb-8"><div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-zinc-900"><FileBarChart2 size={18} className="text-blue-600" /><h1 className="text-lg font-semibold">Warehouse Reports</h1></div><p className="mt-1 text-xs text-zinc-500">Operational reports generated from live warehouse data.</p></div><div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={() => refetch()} loading={isFetching} leftIcon={<RefreshCw size={13} />}>Refresh</Button><Button variant="default" size="sm" disabled={!exportData} onClick={() => exportData && downloadCsv(exportData.filename, rowsToCsv(exportData.headers, exportData.rows))} leftIcon={<Download size={13} />}>Export CSV</Button></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{REPORTS.map(item => <Button key={item.id} type="button" variant={report === item.id ? 'outline' : 'ghost'} size="sm" onClick={() => setReport(item.id)}>{item.label}</Button>)}</div><div className="mt-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-zinc-900">{activeReport.label}</h2><p className="mt-1 text-xs text-zinc-500">{activeReport.description}</p></div><span className="text-[11px] text-zinc-500">Generated {dateTime(vm.generatedAt)}</span></div><div className="mt-4">{report === 'overview' && <Overview vm={vm} />}{report === 'utilization' && <Table headers={reportRows(vm, report).headers} rows={reportRows(vm, report).rows} />}{report === 'movements' && <Table headers={reportRows(vm, report).headers} rows={reportRows(vm, report).rows} />}{report === 'velocity' && <Velocity vm={vm} />}{report === 'dead-stock' && <Table headers={reportRows(vm, report).headers} rows={reportRows(vm, report).rows} />}</div><p className="mt-4 text-[11px] text-zinc-500">Movement history reflects the latest activity returned by the dashboard query.</p></div>;
}
