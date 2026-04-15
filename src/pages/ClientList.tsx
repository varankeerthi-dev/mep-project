import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClients } from '../hooks/useClients';
import { flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CLIENT_QUERY_KEYS = {
  list: () => ['clients'] as const,
  transactions: (clientId: string | null) => ['clientTx', 'all', clientId] as const,
  quotation: (clientId: string) => ['clientTx', 'quotation', clientId] as const,
  clientPO: (clientId: string) => ['clientTx', 'client_po', clientId] as const,
  project: (clientId: string) => ['clientTx', 'project', clientId] as const,
  siteVisit: (clientId: string) => ['clientTx', 'site_visit', clientId] as const,
  deliveryChallan: (clientId: string) => ['clientTx', 'delivery_challan', clientId] as const,
  meeting: (clientId: string) => ['clientTx', 'meeting', clientId] as const,
  all: () => ['clients', 'clientTx'] as const,
} as const;

export function invalidateClientData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['clientTx'] });
  queryClient.invalidateQueries({ queryKey: ['clients'] });
}

type TransactionsTableProps = {
  rows: any[]
  loading: boolean
  onOpen: (row: any) => void
  emptyMessage?: string
}

function TransactionsTable({ rows, loading, onOpen, emptyMessage }: TransactionsTableProps) {
  const [sorting, setSorting] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState<string>('');

  const columns = useMemo(() => [
    {
      header: 'Type',
      accessorKey: 'label',
      cell: (info: any) => info.getValue(),
      enableSorting: true
    },
    {
      header: 'Number',
      accessorKey: 'number',
      cell: (info: any) => <span style={{ fontWeight: 600 }}>{info.getValue()}</span>,
      enableSorting: true
    },
    {
      header: 'Date',
      accessorKey: 'date',
      cell: (info: any) => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : '-',
      enableSorting: true
    },
    {
      header: 'Details',
      accessorKey: 'details',
      cell: (info: any) => info.getValue() || '-',
      enableSorting: false
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: (info: any) => <span style={{ textAlign: 'right', display: 'inline-block', width: '100%' }}>Rs {(info.getValue() || 0).toFixed(2)}</span>,
      enableSorting: true
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info: any) => info.getValue() || '-',
      enableSorting: true
    },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }: any) => (
        <button className="btn btn-sm btn-secondary" onClick={() => onOpen(row.original)}>Open</button>
      ),
      enableSorting: false
    }
  ], [onOpen]);

  const table = useReactTable<any>({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 }
    }
  });

  const SortIcon = ({ column }: { column: any }) => {
    const sorted = column.getIsSorted();
    if (!column.getCanSort()) return null;
    if (sorted === 'asc') return <ChevronUp size={12} style={{ display: 'inline', marginLeft: 4 }} />;
    if (sorted === 'desc') return <ChevronDown size={12} style={{ display: 'inline', marginLeft: 4 }} />;
    return <ChevronsUpDown size={12} style={{ display: 'inline', marginLeft: 4, opacity: 0.4 }} />;
  };

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <input
          className="h-9 w-[280px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
          placeholder="Search all columns..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <span className="text-sm text-slate-500">
          {table.getFilteredRowModel().rows.length} record{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            {table.getHeaderGroups().map(headerGroup => (
              <>
                <tr key={`${headerGroup.id}-sort`} className="border-b transition-colors hover:bg-slate-50/50">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0"
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon column={header.column} />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
                {headerGroup.headers.some(header => header.column.getCanFilter() && header.id !== 'action' && header.id !== 'number') && (
                  <tr key={`${headerGroup.id}-filter`} className="border-b bg-slate-50/50">
                    {headerGroup.headers.map(header => (
                      <th key={`${header.id}-filter`} className="h-10 px-4">
                        {header.column.getCanFilter() && header.id !== 'action' && header.id !== 'number' ? (
                          <input
                            className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
                            placeholder={`Filter ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}...`}
                            value={(header.column.getFilterValue() as string) ?? ''}
                            onChange={(e) => header.column.setFilterValue(e.target.value)}
                          />
                        ) : null}
                      </th>
                    ))}
                  </tr>
                )}
              </>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <span className="text-sm text-slate-500">
          Page {currentPage + 1} of {pageCount || 1}
        </span>
        <button
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </button>
        {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
          let pageIdx;
          if (pageCount <= 5) pageIdx = i;
          else if (currentPage < 3) pageIdx = i;
          else if (currentPage > pageCount - 4) pageIdx = pageCount - 5 + i;
          else pageIdx = currentPage - 2 + i;
          return (
            <button
              key={pageIdx}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                currentPage === pageIdx
                  ? 'bg-slate-900 text-white hover:bg-slate-900/90'
                  : 'border border-slate-200 bg-white hover:bg-slate-100'
              }`}
              onClick={() => table.setPageIndex(pageIdx)}
            >
              {pageIdx + 1}
            </button>
          );
        })}
        <button
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function ClientList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [reportsSubTab, setReportsSubTab] = useState('ledger');
  const [txFilter, setTxFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  // Use shared hook instead of inline query
  const clientsQuery = useClients();
  const clients = clientsQuery.data || [];

 useEffect(() => {
    if (clientsQuery.isLoading) return; // Don't run while loading
    if (clients.length === 0) return;
    setActiveClientId(prev => {
      if (!prev) return clients[0].id;
      if (!clients.some(c => c.id === prev)) return clients[0].id;
      return prev; // no change, won't trigger re-render
    });
}, [clients, clientsQuery.isLoading]); // Add isLoading to deps

  const activeClient = useMemo(
    () => clients.find(c => c.id === activeClientId) || null,
    [clients, activeClientId]
  );
// Only load transaction data when Reports tab is active
const txQueries = useQueries({
  queries: (activeClient && activeTab === 'reports' ? [
    {
      queryKey: CLIENT_QUERY_KEYS.quotation(activeClientId!),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('quotation_header')
          .select('id, quotation_no, date, grand_total, status, created_at')
          .eq('client_id', activeClient.id)
          .limit(100);
        if (error) throw error;
        return data || [];
      },
      // No overrides! Use global defaults from queryClient.ts
      enabled: activeTab === 'reports'
    },
    {
      queryKey: CLIENT_QUERY_KEYS.clientPO(activeClientId!),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('client_purchase_orders')
          .select('id, po_number, po_date, po_total_value, status, created_at')
          .eq('client_id', activeClient.id)
          .limit(100);
        if (error) throw error;
        return data || [];
      },
      // No overrides! Use global defaults from queryClient.ts
      enabled: activeTab === 'reports'
    },
    {
      queryKey: CLIENT_QUERY_KEYS.project(activeClientId!),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('id, project_code, project_name, status, created_at')
          .eq('client_id', activeClient.id)
          .limit(100);
        if (error) throw error;
        return data || [];
      },
      // No overrides! Use global defaults from queryClient.ts
      enabled: activeTab === 'reports'
    },
    {
      queryKey: CLIENT_QUERY_KEYS.siteVisit(activeClientId!),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('site_visits')
          .select('id, visit_date, purpose, status, created_at')
          .eq('client_id', activeClient.id)
          .limit(100);
        if (error) throw error;
        return data || [];
      },
      // No overrides! Use global defaults from queryClient.ts
      enabled: activeTab === 'reports'
    },
    {
      queryKey: CLIENT_QUERY_KEYS.deliveryChallan(activeClientId!),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('delivery_challans')
          .select('id, dc_number, dc_date, status, created_at')
          .eq('client_name', activeClient.client_name)
          .limit(100);
        if (error) throw error;
        return data || [];
      },
      // No overrides! Use global defaults from queryClient.ts
      enabled: activeTab === 'reports'
    },
    {
      queryKey: CLIENT_QUERY_KEYS.meeting(activeClientId!),
      queryFn: async () => {
        const { data, error } = await supabase
          .from('meetings')
          .select('id, meeting_date, agenda, status, created_at')
          .eq('client_id', activeClient.id)
          .limit(100);
        if (error) throw error;
        return data || [];
      },
      // No overrides! Use global defaults from queryClient.ts
      enabled: activeTab === 'reports'
    }
  ] : []) as any
}) as any[];

  const [
    quotationTx,
    clientPoTx,
    projectTx,
    siteVisitTx,
    dcTx,
    meetingTx
  ] = txQueries;

  const transactions = useMemo(() => {
    const merged: any[] = [];
    const safePush = (rows: any[], mapFn: (row: any) => any) => {
      (rows || []).forEach((r) => merged.push(mapFn(r)));
    };

    safePush(quotationTx?.data, (r) => ({
      type: 'quotation',
      label: 'Quotation',
      number: r.quotation_no || '-',
      date: r.date || r.created_at,
      date_ms: new Date(r.date || r.created_at || 0).getTime(),
      amount: parseFloat(r.grand_total) || 0,
      status: r.status || '-',
      ref_id: r.id
    }));

    safePush(clientPoTx?.data, (r) => ({
      type: 'client_po',
      label: 'Client PO',
      number: r.po_number || '-',
      date: r.po_date || r.created_at,
      date_ms: new Date(r.po_date || r.created_at || 0).getTime(),
      amount: parseFloat(r.po_total_value) || 0,
      status: r.status || '-',
      ref_id: r.id
    }));

    safePush(projectTx?.data, (r) => ({
      type: 'project',
      label: 'Project',
      number: r.project_code || '-',
      date: r.created_at,
      date_ms: new Date(r.created_at || 0).getTime(),
      amount: 0,
      status: r.status || '-',
      details: r.project_name || '-',
      ref_id: r.id
    }));

    safePush(siteVisitTx?.data, (r) => ({
      type: 'site_visit',
      label: 'Site Visit',
      number: `SV-${String(r.id).slice(0, 6)}`,
      date: r.visit_date || r.created_at,
      date_ms: new Date(r.visit_date || r.created_at || 0).getTime(),
      amount: 0,
      status: r.status || '-',
      details: r.purpose || '-',
      ref_id: r.id
    }));

    safePush(dcTx?.data, (r) => ({
      type: 'delivery_challan',
      label: 'Delivery Challan',
      number: r.dc_number || '-',
      date: r.dc_date || r.created_at,
      date_ms: new Date(r.dc_date || r.created_at || 0).getTime(),
      amount: 0,
      status: r.status || '-',
      ref_id: r.id
    }));

    safePush(meetingTx?.data, (r) => ({
      type: 'meeting',
      label: 'Meeting',
      number: `MT-${String(r.id).slice(0, 6)}`,
      date: r.meeting_date || r.created_at,
      date_ms: new Date(r.meeting_date || r.created_at || 0).getTime(),
      amount: 0,
      status: r.status || '-',
      details: r.agenda || '-',
      ref_id: r.id
    }));

    merged.sort((a, b) => (b.date_ms || 0) - (a.date_ms || 0));
    return merged;
  }, [quotationTx?.data, clientPoTx?.data, projectTx?.data, siteVisitTx?.data, dcTx?.data, meetingTx?.data]);

  const loadingTx = txQueries.length > 0 && txQueries.some((q) => q.isPending && !q.data);
  const transactionsError = txQueries.find((q) => q.isError)?.error;

  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return clients.filter((c) =>
      c.client_name?.toLowerCase().includes(q) ||
      c.client_id?.toLowerCase().includes(q)
    );
  }, [clients, searchTerm]);

  const filteredTransactions = useMemo(() => {
    const fromMs = txDateFrom ? new Date(txDateFrom).getTime() : null;
    const toMs = txDateTo ? new Date(txDateTo).getTime() : null;
    const q = txSearch.toLowerCase();
    return transactions.filter((t) => {
      if (txFilter !== 'all' && t.type !== txFilter) return false;
      if (fromMs && (t.date_ms || 0) < fromMs) return false;
      if (toMs && (t.date_ms || 0) > toMs + (24 * 60 * 60 * 1000 - 1)) return false;
      if (q) {
        if (
          !(t.number || '').toLowerCase().includes(q) &&
          !(t.label || '').toLowerCase().includes(q) &&
          !(t.details || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [transactions, txFilter, txDateFrom, txDateTo, txSearch]);

  const getTransactionsByType = (type: string) => filteredTransactions.filter((t: any) => t.type === type);

  const txCounts = useMemo(() => {
    const counts: Record<string, number> = {
      quotation: 0,
      client_po: 0,
      project: 0,
      site_visit: 0,
      delivery_challan: 0,
      meeting: 0
    };
    transactions.forEach((t: any) => {
      if (counts[t.type] !== undefined) counts[t.type] += 1;
    });
    return counts;
  }, [transactions]);

  const openTransaction = (t: any) => {
    if (!t) return;
    if (t.type === 'quotation') {
      navigate(`/quotation/view?id=${t.ref_id}`);
      return;
    }
    if (t.type === 'client_po') {
      navigate(`/client-po/details?id=${t.ref_id}`);
      return;
    }
    if (t.type === 'project') {
      navigate('/projects');
      return;
    }
    if (t.type === 'site_visit') {
      navigate(`/site-visits/edit?id=${t.ref_id}`);
      return;
    }
    if (t.type === 'delivery_challan') {
      navigate(`/dc/edit/${t.ref_id}`);
      return;
    }
    if (t.type === 'meeting') {
      navigate(`/meetings/edit?id=${t.ref_id}`);
    }
  };

  const ledgerTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    transactions.forEach((t) => {
      if (t.type === 'quotation') debit += t.amount || 0;
      if (t.type === 'client_po') credit += t.amount || 0;
    });
    return { debit, credit, balance: debit - credit };
  }, [transactions]);

  const scopedTransactions = useMemo(() => {
    const typeMap: Record<string, string> = {
      'quotation': 'quotation',
      'client_po': 'client_po',
      'project': 'project',
      'site_visit': 'site_visit',
      'delivery_challan': 'delivery_challan',
      'meeting': 'meeting'
    };
    const type = typeMap[reportsSubTab];
    if (!type) return [];
    return getTransactionsByType(type);
  }, [reportsSubTab, filteredTransactions]);

  return (
    <div style={{ height: 'calc(100vh - 120px)', minHeight: '560px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '10px' }}>
      <div className="card" style={{ padding: '8px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Clients</h3>
          <button className="btn btn-sm btn-primary" onClick={() => navigate('/clients/new')} style={{ marginLeft: 'auto' }}>+ New</button>
        </div>
        <input
          type="text"
          className="form-input"
          placeholder="Search client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: '8px', padding: '6px 8px', fontSize: '12px' }}
        />
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          {clientsQuery.isLoading ? (
            <div style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Loading...</div>
          ) : clientsQuery.isError ? (
            <div style={{ padding: '8px', fontSize: '12px', color: '#dc2626' }}>
              {(clientsQuery.error as Error)?.message || 'Unable to load clients.'}
            </div>
          ) : filteredClients.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveClientId(c.id)}
              style={{
                padding: '8px',
                borderRadius: '6px',
                marginBottom: '6px',
                border: activeClientId === c.id ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                background: activeClientId === c.id ? '#eff6ff' : '#fff',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>{c.client_name}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{c.client_id || '-'} | {c.contact || '-'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '10px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!activeClient ? (
          <div className="empty-state"><h3>Select a client</h3></div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '28px', lineHeight: 1.1 }}>{activeClient.client_name}</h2>
              <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/clients/edit?id=${activeClient.id}`)}>Edit</button>
            </div>

            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e5e7eb', marginBottom: '8px', flexWrap: 'wrap' }}>
              <button className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('overview')}>Overview</button>
              <button className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('reports')}>Reports</button>
            </div>

            {activeTab === 'reports' && (
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e5e7eb', marginBottom: '8px', flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${reportsSubTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('ledger')}>Ledger Statement</button>
                <button className={`btn btn-sm ${reportsSubTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('transactions')}>Transactions</button>
                <button className={`btn btn-sm ${reportsSubTab === 'quotation' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('quotation')}>Quotations ({txCounts.quotation})</button>
                <button className={`btn btn-sm ${reportsSubTab === 'client_po' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('client_po')}>Client PO ({txCounts.client_po})</button>
                <button className={`btn btn-sm ${reportsSubTab === 'project' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('project')}>Projects ({txCounts.project})</button>
                <button className={`btn btn-sm ${reportsSubTab === 'site_visit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('site_visit')}>Site Visits ({txCounts.site_visit})</button>
                <button className={`btn btn-sm ${reportsSubTab === 'delivery_challan' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('delivery_challan')}>Delivery Challans ({txCounts.delivery_challan})</button>
                <button className={`btn btn-sm ${reportsSubTab === 'meeting' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('meeting')}>Meetings ({txCounts.meeting})</button>
              </div>
            )}

            <div style={{ minHeight: 0, overflow: 'auto' }}>
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {[
                    ['Client ID', activeClient.client_id || '-'],
                    ['Contact', activeClient.contact || '-'],
                    ['Email', activeClient.email || '-'],
                    ['GSTIN', activeClient.gstin || '-'],
                    ['State', activeClient.state || '-'],
                    ['City', activeClient.city || '-'],
                    ['Category', activeClient.category || 'Active'],
                    ['Address', [activeClient.address1, activeClient.address2, activeClient.pincode].filter(Boolean).join(', ') || '-']
                  ].map(([k, v]) => (
                    <div key={k} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{k}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'reports' && reportsSubTab === 'ledger' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}><div style={{ fontSize: '11px', color: '#6b7280' }}>Debit (Quotations)</div><div style={{ fontSize: '16px', fontWeight: 700 }}>Rs {ledgerTotals.debit.toFixed(2)}</div></div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}><div style={{ fontSize: '11px', color: '#6b7280' }}>Credit (Client PO)</div><div style={{ fontSize: '16px', fontWeight: 700 }}>Rs {ledgerTotals.credit.toFixed(2)}</div></div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}><div style={{ fontSize: '11px', color: '#6b7280' }}>Balance</div><div style={{ fontSize: '16px', fontWeight: 700 }}>Rs {ledgerTotals.balance.toFixed(2)}</div></div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Ledger uses quotation amount as debit and client PO value as credit.</div>
                </div>
              )}

              {activeTab === 'reports' && reportsSubTab === 'transactions' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 140px 140px', gap: '6px', marginBottom: '8px' }}>
                    <select className="form-select" value={txFilter} onChange={(e) => setTxFilter(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }}>
                      <option value="all">All Types</option>
                      <option value="quotation">Quotation</option>
                      <option value="client_po">Client PO</option>
                      <option value="project">Project</option>
                      <option value="site_visit">Site Visit</option>
                      <option value="delivery_challan">Delivery Challan</option>
                      <option value="meeting">Meeting</option>
                    </select>
                    <input className="form-input" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search no/type/details..." style={{ padding: '6px 8px', fontSize: '12px' }} />
                    <input type="date" className="form-input" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }} />
                    <input type="date" className="form-input" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }} />
                  </div>

                  <TransactionsTable
                    rows={filteredTransactions}
                    loading={loadingTx}
                    onOpen={openTransaction}
                    emptyMessage={transactionsError ? ((transactionsError as Error)?.message || 'Unable to load transactions.') : 'No transactions'}
                  />
                </div>
              )}

              {activeTab === 'reports' && (reportsSubTab === 'quotation' || reportsSubTab === 'client_po' || reportsSubTab === 'project' || reportsSubTab === 'site_visit' || reportsSubTab === 'delivery_challan' || reportsSubTab === 'meeting') && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: '6px', marginBottom: '8px' }}>
                    <input className="form-input" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search no/type/details..." style={{ padding: '6px 8px', fontSize: '12px' }} />
                    <input type="date" className="form-input" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }} />
                    <input type="date" className="form-input" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }} />
                  </div>

                  <TransactionsTable
                    rows={scopedTransactions}
                    loading={loadingTx}
                    onOpen={openTransaction}
                    emptyMessage={transactionsError ? ((transactionsError as Error)?.message || 'Unable to load records.') : 'No records'}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
