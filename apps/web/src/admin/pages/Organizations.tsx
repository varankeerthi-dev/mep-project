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
import { useAdminOrgs } from '../lib/adminQueries';
import { formatHours, formatMoney, formatDate, daysUntil } from '../lib/format';
import KpiCard from '../components/KpiCard';
import { OrgStatusBadge } from '../components/badges';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const STATUS_OPTIONS = ['all', 'active', 'trial', 'suspended', 'banned', 'churned'];

export default function Organizations() {
  const { data, isLoading, isError } = useAdminOrgs();
  const rows = useMemo(() => data?.rows || [], [data]);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const planOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.plan_name).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && String(r.status).toLowerCase() !== status) return false;
      if (plan !== 'all' && r.plan_name !== plan) return false;
      if (!q) return true;
      return [r.name, r.org_code, r.slug || '', r.tenant || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, plan, status]);

  const kpis = useMemo(() => {
    const mrr = filtered.reduce((s, r) => s + (r.mrr || 0), 0);
    const users = filtered.reduce((s, r) => s + (r.user_count || r.active_users || 0), 0);
    const mins = filtered.reduce((s, r) => s + (r.minutes_30d || 0), 0);
    return [
      { label: 'Organizations', value: String(filtered.length), sub: `${rows.length} total` },
      { label: 'MRR (filtered)', value: formatMoney(mrr), sub: 'plan base' },
      { label: 'Users', value: String(users), sub: 'active seats' },
      { label: 'Time spent (30d)', value: formatHours(mins), sub: 'across orgs' },
    ];
  }, [filtered, rows.length]);

  const table = useReactTable({
    data: filtered,
    columns: useMemo(
      () => [
        {
          accessorKey: 'name',
          header: ({ column }: any) => (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Organization <ArrowUpDown size={12} />
            </button>
          ),
          cell: ({ row }: any) => {
            const r = row.original;
            return (
              <div>
                <a href={`/admin/organizations/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                  {r.name}
                </a>
                <div className="font-mono text-xs text-muted-foreground">{r.org_code}</div>
              </div>
            );
          },
        },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ getValue }: any) => <OrgStatusBadge status={String(getValue())} />,
        },
        {
          accessorKey: 'plan_name',
          header: 'Plan',
          cell: ({ row }: any) => (
            <div>
              <div className="text-sm">{row.original.plan_name}</div>
              <div className="text-xs text-muted-foreground">{formatMoney(row.original.plan_price)}/mo</div>
            </div>
          ),
        },
        {
          accessorKey: 'seats',
          header: 'Active / Seats',
          cell: ({ row }: any) => (
            <span className="tabular-nums">
              {row.original.active_users}/{row.original.seats || row.original.user_count || '—'}
            </span>
          ),
        },
        {
          accessorKey: 'minutes_30d',
          header: 'Time (30d)',
          cell: ({ getValue }: any) => <span className="tabular-nums">{formatHours(Number(getValue() || 0))}</span>,
        },
        {
          accessorKey: 'modules_count',
          header: 'Modules',
          cell: ({ row }: any) => (
            <span className="tabular-nums">
              {row.original.modules_count}
              {row.original.paid_modules ? ` (+${row.original.paid_modules} paid)` : ''}
            </span>
          ),
        },
        {
          accessorKey: 'plan_ends_at',
          header: 'Plan ends',
          cell: ({ getValue }: any) => {
            const v = getValue() as string | null;
            if (!v) return <span className="text-xs text-muted-foreground">—</span>;
            const d = daysUntil(v);
            const urgent = d !== null && d <= 14 && d >= 0;
            return (
              <div className={urgent ? 'text-amber-600' : ''}>
                <div className="text-sm">{formatDate(v)}</div>
                <div className="text-xs">
                  {d === null ? '' : d < 0 ? `Expired ${Math.abs(d)}d ago` : `${d}d left`}
                </div>
              </div>
            );
          },
        },
        {
          accessorKey: 'mrr',
          header: ({ column }: any) => (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              MRR <ArrowUpDown size={12} />
            </button>
          ),
          cell: ({ getValue }: any) => <span className="font-semibold tabular-nums">{formatMoney(Number(getValue() || 0))}</span>,
        },
      ],
      [],
    ),
    state: { sorting, pagination: { pageIndex: 0, pageSize: 15 } as any },
    onSortingChange: setSorting as any,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search by org, tenant, code or slug. Click a row to open detail.</p>

      {data?.migrationPending ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Target schema (<code className="font-mono">organizations / plans</code>) not migrated yet — showing live{' '}
          <code className="font-mono">organisations</code> names. Run <code className="font-mono">Admin/schema.sql</code>{' '}
          to unlock plan, MRR and expiry columns.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search org / tenant / ORG-1004 / slug"
          className="w-72 rounded-md border bg-card px-3 py-1.5 text-sm"
        />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-md border bg-card px-2 py-1.5 text-sm">
          {planOptions.map((p) => (
            <option key={p} value={p}>{p === 'all' ? 'All plans' : p}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-card px-2 py-1.5 text-sm">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded-xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading organizations…</div>
        ) : isError ? (
          <div className="p-6 text-sm text-red-600">Failed to load organizations.</div>
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
                  <TableCell colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                    No organizations match these filters.
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
