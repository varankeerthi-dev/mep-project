import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAdminUsers } from '../lib/adminQueries';
import { formatHours, formatDate } from '../lib/format';
import KpiCard from '../components/KpiCard';
import { UserStatusBadge } from '../components/badges';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const STATUS_CHIPS = ['all', 'active', 'inactive', 'onboarding', 'left'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekKey(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export default function Users() {
  const { data, isLoading, isError } = useAdminUsers();
  const rows = useMemo(() => data?.rows || [], [data]);
  const modules = useMemo(() => data?.modules || [], [data]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'full_name', desc: false }]);

  const moduleNames = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of modules as any[]) map[Number(m.id)] = m.name || `#${m.id}`;
    return map;
  }, [modules]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status.toLowerCase() !== status) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.org_name].join(' ').toLowerCase().includes(q);
    });
  }, [rows, search, status]);

  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const is = (s: string) => (x: (typeof rows)[number]) => x.status.toLowerCase() === s;
    const totalMins = rows.reduce((s, r) => s + r.minutes_30d, 0);
    const onboardedYesterday = rows.filter(
      (r) => r.created_at && new Date(r.created_at) >= yesterday,
    ).length;
    const onboardedWeek = rows.filter(
      (r) => r.created_at && new Date(r.created_at) >= weekAgo,
    ).length;
    return {
      total: rows.length,
      active: rows.filter(is('active')).length,
      inactive: rows.filter(is('inactive')).length,
      onboarding: rows.filter(is('onboarding')).length,
      left: rows.filter(is('left')).length,
      onboardedYesterday,
      onboardedWeek,
      avgMins: rows.length ? Math.round(totalMins / rows.length) : 0,
      totalMins,
    };
  }, [rows]);

  const cohorts = useMemo(() => {
    const weeks: string[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      weeks.push(weekKey(d));
    }
    return weeks.map((w) => {
      const inWeek = rows.filter((r) => r.created_at && weekKey(new Date(r.created_at)) === w);
      return {
        week: w.slice(5),
        onboarded: inWeek.length,
        active: inWeek.filter((r) => r.status.toLowerCase() === 'active').length,
      };
    });
  }, [rows]);

  const timeByModule = useMemo(() => {
    const acc: Record<number, number> = {};
    for (const r of rows) {
      if (!r.module_ids.length) continue;
      const share = r.minutes_30d / r.module_ids.length;
      for (const id of r.module_ids) acc[id] = (acc[id] || 0) + share;
    }
    return Object.entries(acc)
      .map(([id, mins]) => ({ name: moduleNames[Number(id)] || `#${id}`, hours: Math.round((mins / 60) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8);
  }, [rows, moduleNames]);

  const table = useReactTable({
    data: filtered,
    columns: useMemo(
      () => [
        {
          accessorKey: 'full_name',
          header: ({ column }: any) => (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              User <ArrowUpDown size={12} />
            </button>
          ),
          cell: ({ row }: any) => (
            <div>
              <div className="font-medium">{row.original.full_name}</div>
              <div className="text-xs text-muted-foreground">{row.original.email}</div>
            </div>
          ),
        },
        {
          accessorKey: 'org_name',
          header: 'Organization',
          cell: ({ row }: any) => (
            <div>
              <div className="text-sm">{row.original.org_name}</div>
              <div className="text-xs text-muted-foreground">{row.original.plan_name}</div>
            </div>
          ),
        },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ getValue }: any) => <UserStatusBadge status={String(getValue())} />,
        },
        {
          accessorKey: 'minutes_30d',
          header: 'Time (30d)',
          cell: ({ getValue }: any) => <span className="tabular-nums">{formatHours(Number(getValue() || 0))}</span>,
        },
        {
          accessorKey: 'created_at',
          header: 'Onboarded',
          cell: ({ getValue }: any) => <span className="text-sm">{formatDate(getValue())}</span>,
        },
        {
          accessorKey: 'last_active_at',
          header: 'Last active',
          cell: ({ getValue }: any) => <span className="text-sm">{formatDate(getValue())}</span>,
        },
        {
          accessorKey: 'module_ids',
          header: 'Modules used',
          cell: ({ row }: any) => {
            const ids: number[] = row.original.module_ids || [];
            if (!ids.length) return <span className="text-xs text-muted-foreground">—</span>;
            const shown = ids.slice(0, 3).map((id) => moduleNames[id] || `#${id}`);
            return (
              <div className="flex max-w-56 flex-wrap gap-1">
                {shown.map((n) => (
                  <span key={n} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{n}</span>
                ))}
                {ids.length > 3 ? <span className="text-[11px] text-muted-foreground">+{ids.length - 3}</span> : null}
              </div>
            );
          },
        },
      ],
      [moduleNames],
    ),
    state: { sorting, pagination: { pageIndex: 0, pageSize: 15 } as any },
    onSortingChange: setSorting as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">Engagement and onboarding across all console orgs.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total" value={String(stats.total)} sub="all users" />
        <KpiCard label="Active" value={String(stats.active)} sub={`${stats.inactive} inactive`} />
        <KpiCard label="Onboarding" value={String(stats.onboarding)} sub={`${stats.left} left`} />
        <KpiCard label="Avg time (30d)" value={formatHours(stats.avgMins)} sub={`total ${formatHours(stats.totalMins)}`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Inactive" value={String(stats.inactive)} sub="dormant" />
        <KpiCard label="Left" value={String(stats.left)} sub="churned users" />
        <KpiCard label="Onboarded yesterday" value={String(stats.onboardedYesterday)} sub={`${stats.onboardedWeek} this week`} />
        <KpiCard label="Cohorts" value="8w" sub="onboarded vs active" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="font-medium">Onboarding cohorts</div>
          <div className="text-xs text-muted-foreground">Last 8 weeks · onboarded vs still active</div>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohorts}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="onboarded" fill="#6366f1" name="Onboarded" />
                <Bar dataKey="active" fill="#22c55e" name="Still active" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="font-medium">Time spent by module</div>
          <div className="text-xs text-muted-foreground">Hours (30d), attributed across touched modules</div>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeByModule} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip />
                <Bar dataKey="hours" fill="#0ea5e9" name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name / email / org"
          className="w-64 rounded-md border bg-card px-3 py-1.5 text-sm"
        />
        <div className="flex gap-1">
          {STATUS_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={
                status === s
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted'
              }
            >
              {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading users…</div>
        ) : isError ? (
          <div className="p-6 text-sm text-red-600">Failed to load users.</div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                    No users yet — rows appear once console orgs have users.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>{filtered.length} rows</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border px-2 py-1 disabled:opacity-40"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 disabled:opacity-40"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
