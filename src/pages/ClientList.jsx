import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useQueries, useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

const pushPath = (path) => {
  const nextPath = path || '/';
  if (`${window.location.pathname}${window.location.search}` !== nextPath || window.location.hash) {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new Event('locationchange'));
  }
};

function TransactionsTable({ rows, loading, onOpen, emptyMessage }) {
  const columns = useMemo(() => [
    { header: 'Type', accessorKey: 'label' },
    { header: 'Number', accessorKey: 'number', cell: (info) => <span style={{ fontWeight: 600 }}>{info.getValue()}</span> },
    { header: 'Date', accessorKey: 'date', cell: (info) => info.getValue() ? new Date(info.getValue()).toLocaleDateString() : '-' },
    { header: 'Details', accessorKey: 'details', cell: (info) => info.getValue() || '-' },
    { header: 'Amount', accessorKey: 'amount', cell: (info) => <span style={{ textAlign: 'right', display: 'inline-block', width: '100%' }}>Rs {(info.getValue() || 0).toFixed(2)}</span> },
    { header: 'Status', accessorKey: 'status' },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <button className="btn btn-sm btn-secondary" onClick={() => onOpen(row.original)}>Open</button>
      )
    }
  ], [onOpen]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
      <table className="table" style={{ margin: 0 }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} style={{ padding: '6px 8px', fontSize: '12px' }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} style={{ padding: '8px' }}>Loading...</td></tr>
          ) : table.getRowModel().rows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: '8px' }}>{emptyMessage}</td></tr>
          ) : (
            table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={{ padding: '6px 8px', fontSize: '12px' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ClientList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [reportsSubTab, setReportsSubTab] = useState('ledger');
  const [txFilter, setTxFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_id, contact, email, gstin, state, city, category, address1, address2, pincode')
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  const clients = clientsQuery.data || [];

  useEffect(() => {
    if (!activeClientId && clients.length > 0) setActiveClientId(clients[0].id);
    if (activeClientId && clients.length > 0 && !clients.some(c => c.id === activeClientId)) {
      setActiveClientId(clients[0].id);
    }
  }, [clients, activeClientId]);

  const activeClient = useMemo(
    () => clients.find(c => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  const withTimeout = (promise, ms, label) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} request timed out`)), ms);
      })
    ]).finally(() => clearTimeout(timer));
  };

  const txQueries = useQueries({
    queries: activeClient ? [
      {
        queryKey: ['clientTx', 'quotation', activeClientId],
        queryFn: async () => {
          const { data, error } = await withTimeout(
            supabase.from('quotation_header').select('id, quotation_no, date, grand_total, status, created_at').eq('client_id', activeClient.id),
            15000,
            'Quotation'
          );
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000
      },
      {
        queryKey: ['clientTx', 'client_po', activeClientId],
        queryFn: async () => {
          const { data, error } = await withTimeout(
            supabase.from('client_purchase_orders').select('id, po_number, po_date, po_total_value, status, created_at').eq('client_id', activeClient.id),
            15000,
            'Client PO'
          );
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000
      },
      {
        queryKey: ['clientTx', 'project', activeClientId],
        queryFn: async () => {
          const { data, error } = await withTimeout(
            supabase.from('projects').select('id, project_code, project_name, status, created_at').eq('client_id', activeClient.id),
            15000,
            'Projects'
          );
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000
      },
      {
        queryKey: ['clientTx', 'site_visit', activeClientId],
        queryFn: async () => {
          const { data, error } = await withTimeout(
            supabase.from('site_visits').select('id, visit_date, purpose, status, created_at').eq('client_id', activeClient.id),
            15000,
            'Site Visits'
          );
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000
      },
      {
        queryKey: ['clientTx', 'delivery_challan', activeClientId],
        queryFn: async () => {
          const { data, error } = await withTimeout(
            supabase.from('delivery_challans').select('id, dc_number, dc_date, status, created_at').eq('client_name', activeClient.client_name),
            15000,
            'Delivery Challans'
          );
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000
      },
      {
        queryKey: ['clientTx', 'meeting', activeClientId],
        queryFn: async () => {
          const { data, error } = await withTimeout(
            supabase.from('meetings').select('id, meeting_date, agenda, status, created_at').eq('client_id', activeClient.id),
            15000,
            'Meetings'
          );
          if (error) throw error;
          return data || [];
        },
        staleTime: 5 * 60 * 1000
      }
    ] : []
  });

  const [
    quotationTx,
    clientPoTx,
    projectTx,
    siteVisitTx,
    dcTx,
    meetingTx
  ] = txQueries;

  const transactions = useMemo(() => {
    const merged = [];
    const safePush = (rows, mapFn) => {
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

  const loadingTx = txQueries.length > 0 && txQueries.some((q) => q.isFetching);

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

  const getTransactionsByType = (type) => filteredTransactions.filter((t) => t.type === type);

  const txCounts = useMemo(() => {
    const counts = {
      quotation: 0,
      client_po: 0,
      project: 0,
      site_visit: 0,
      delivery_challan: 0,
      meeting: 0
    };
    transactions.forEach((t) => {
      if (counts[t.type] !== undefined) counts[t.type] += 1;
    });
    return counts;
  }, [transactions]);

  const openTransaction = (t) => {
    if (!t) return;
    if (t.type === 'quotation') {
      pushPath(`/quotation/view?id=${t.ref_id}`);
      return;
    }
    if (t.type === 'client_po') {
      pushPath(`/client-po/details?id=${t.ref_id}`);
      return;
    }
    if (t.type === 'project') {
      pushPath('/projects');
      return;
    }
    if (t.type === 'site_visit') {
      pushPath(`/site-visits/edit?id=${t.ref_id}`);
      return;
    }
    if (t.type === 'delivery_challan') {
      pushPath(`/dc/edit/${t.ref_id}`);
      return;
    }
    if (t.type === 'meeting') {
      pushPath(`/meetings/edit?id=${t.ref_id}`);
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
    const typeMap = {
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
          <button className="btn btn-sm btn-primary" onClick={() => pushPath('/clients/new')} style={{ marginLeft: 'auto' }}>+ New</button>
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
              <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => pushPath(`/clients/edit?id=${activeClient.id}`)}>Edit</button>
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
                    emptyMessage="No transactions"
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
                    emptyMessage="No records"
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
