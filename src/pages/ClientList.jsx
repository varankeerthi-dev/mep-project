import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';

const pushPath = (path) => {
  const nextPath = path || '/';
  if (`${window.location.pathname}${window.location.search}` !== nextPath || window.location.hash) {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new Event('locationchange'));
  }
};

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [txFilter, setTxFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const [loadingTx, setLoadingTx] = useState(false);
  const txCacheRef = useRef(new Map());

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, client_name, client_id, contact, email, gstin, state, city, category, address1, address2, pincode')
      .order('client_name');
    const rows = data || [];
    setClients(rows);
    if (!activeClientId && rows.length > 0) setActiveClientId(rows[0].id);
  };

  useEffect(() => { loadClients(); }, []);
  useEffect(() => { txCacheRef.current.clear(); }, [clients.length]);

  const activeClient = useMemo(
    () => clients.find(c => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  const loadClientTransactions = async (client) => {
    if (!client) return;
    const cached = txCacheRef.current.get(client.id);
    if (cached) {
      setTransactions(cached);
      return;
    }

    setLoadingTx(true);
    const merged = [];

    const safePush = (rows, mapFn) => {
      (rows || []).forEach((r) => merged.push(mapFn(r)));
    };

    try {
      const [quo, po, prj, visit, dc, meet] = await Promise.allSettled([
        supabase.from('quotation_header').select('id, quotation_no, date, grand_total, status, created_at').eq('client_id', client.id),
        supabase.from('client_purchase_orders').select('id, po_number, po_date, po_total_value, status, created_at').eq('client_id', client.id),
        supabase.from('projects').select('id, project_code, project_name, status, created_at').eq('client_id', client.id),
        supabase.from('site_visits').select('id, visit_date, purpose, status, created_at').eq('client_id', client.id),
        supabase.from('delivery_challans').select('id, dc_number, dc_date, status, created_at').eq('client_name', client.client_name),
        supabase.from('meetings').select('id, meeting_date, agenda, status, created_at').eq('client_id', client.id)
      ]);

      const rowsFrom = (result) => {
        if (result.status !== 'fulfilled') return [];
        if (result.value?.error) {
          console.log('Transaction source warning:', result.value.error.message);
          return [];
        }
        return result.value?.data || [];
      };

      safePush(rowsFrom(quo), (r) => ({
        type: 'quotation',
        label: 'Quotation',
        number: r.quotation_no || '-',
        date: r.date || r.created_at,
        date_ms: new Date(r.date || r.created_at || 0).getTime(),
        amount: parseFloat(r.grand_total) || 0,
        status: r.status || '-',
        ref_id: r.id
      }));

      safePush(rowsFrom(po), (r) => ({
        type: 'client_po',
        label: 'Client PO',
        number: r.po_number || '-',
        date: r.po_date || r.created_at,
        date_ms: new Date(r.po_date || r.created_at || 0).getTime(),
        amount: parseFloat(r.po_total_value) || 0,
        status: r.status || '-',
        ref_id: r.id
      }));

      safePush(rowsFrom(prj), (r) => ({
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

      safePush(rowsFrom(visit), (r) => ({
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

      safePush(rowsFrom(dc), (r) => ({
        type: 'delivery_challan',
        label: 'Delivery Challan',
        number: r.dc_number || '-',
        date: r.dc_date || r.created_at,
        date_ms: new Date(r.dc_date || r.created_at || 0).getTime(),
        amount: 0,
        status: r.status || '-',
        ref_id: r.id
      }));

      safePush(rowsFrom(meet), (r) => ({
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
    } catch (err) {
      console.log('Transaction load warning:', err.message);
    } finally {
      merged.sort((a, b) => (b.date_ms || 0) - (a.date_ms || 0));
      txCacheRef.current.set(client.id, merged);
      setTransactions(merged);
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    if (activeClient) loadClientTransactions(activeClient);
  }, [activeClientId, clients]);

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
          {filteredClients.map((c) => (
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
              <button className={`btn btn-sm ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('ledger')}>Ledger Statement</button>
              <button className={`btn btn-sm ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('transactions')}>Transactions</button>
              <button className={`btn btn-sm ${activeTab === 'tab-quotation' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tab-quotation')}>Quotations ({txCounts.quotation})</button>
              <button className={`btn btn-sm ${activeTab === 'tab-client-po' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tab-client-po')}>Client PO ({txCounts.client_po})</button>
              <button className={`btn btn-sm ${activeTab === 'tab-project' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tab-project')}>Projects ({txCounts.project})</button>
              <button className={`btn btn-sm ${activeTab === 'tab-site-visit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tab-site-visit')}>Site Visits ({txCounts.site_visit})</button>
              <button className={`btn btn-sm ${activeTab === 'tab-delivery-challan' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tab-delivery-challan')}>Delivery Challans ({txCounts.delivery_challan})</button>
              <button className={`btn btn-sm ${activeTab === 'tab-meeting' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('tab-meeting')}>Meetings ({txCounts.meeting})</button>
            </div>

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

              {activeTab === 'ledger' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}><div style={{ fontSize: '11px', color: '#6b7280' }}>Debit (Quotations)</div><div style={{ fontSize: '16px', fontWeight: 700 }}>Rs {ledgerTotals.debit.toFixed(2)}</div></div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}><div style={{ fontSize: '11px', color: '#6b7280' }}>Credit (Client PO)</div><div style={{ fontSize: '16px', fontWeight: 700 }}>Rs {ledgerTotals.credit.toFixed(2)}</div></div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}><div style={{ fontSize: '11px', color: '#6b7280' }}>Balance</div><div style={{ fontSize: '16px', fontWeight: 700 }}>Rs {ledgerTotals.balance.toFixed(2)}</div></div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Ledger uses quotation amount as debit and client PO value as credit.</div>
                </div>
              )}

              {activeTab === 'transactions' && (
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

                  <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Type</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Number</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Date</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Details</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Status</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingTx ? (
                          <tr><td colSpan={7} style={{ padding: '8px' }}>Loading...</td></tr>
                        ) : filteredTransactions.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: '8px' }}>No transactions</td></tr>
                        ) : filteredTransactions.map((t, idx) => (
                          <tr key={`${t.type}-${t.ref_id}-${idx}`}>
                            <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.label}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 600 }}>{t.number}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.date ? new Date(t.date).toLocaleDateString() : '-'}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.details || '-'}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>Rs {(t.amount || 0).toFixed(2)}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.status}</td>
                            <td style={{ padding: '6px 8px', fontSize: '12px' }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => openTransaction(t)}>Open</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(activeTab === 'tab-quotation' ||
                activeTab === 'tab-client-po' ||
                activeTab === 'tab-project' ||
                activeTab === 'tab-site-visit' ||
                activeTab === 'tab-delivery-challan' ||
                activeTab === 'tab-meeting') && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: '6px', marginBottom: '8px' }}>
                    <input className="form-input" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search no/type/details..." style={{ padding: '6px 8px', fontSize: '12px' }} />
                    <input type="date" className="form-input" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }} />
                    <input type="date" className="form-input" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} style={{ padding: '6px 8px', fontSize: '12px' }} />
                  </div>

                  <div style={{ overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Type</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Number</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Date</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Details</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Status</th>
                          <th style={{ padding: '6px 8px', fontSize: '12px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const typeMap = {
                            'tab-quotation': 'quotation',
                            'tab-client-po': 'client_po',
                            'tab-project': 'project',
                            'tab-site-visit': 'site_visit',
                            'tab-delivery-challan': 'delivery_challan',
                            'tab-meeting': 'meeting'
                          };
                          const scoped = getTransactionsByType(typeMap[activeTab]);
                          if (loadingTx) return <tr><td colSpan={7} style={{ padding: '8px' }}>Loading...</td></tr>;
                          if (scoped.length === 0) return <tr><td colSpan={7} style={{ padding: '8px' }}>No records</td></tr>;
                          return scoped.map((t, idx) => (
                            <tr key={`${activeTab}-${t.ref_id}-${idx}`}>
                              <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.label}</td>
                              <td style={{ padding: '6px 8px', fontSize: '12px', fontWeight: 600 }}>{t.number}</td>
                              <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.date ? new Date(t.date).toLocaleDateString() : '-'}</td>
                              <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.details || '-'}</td>
                              <td style={{ padding: '6px 8px', fontSize: '12px', textAlign: 'right' }}>Rs {(t.amount || 0).toFixed(2)}</td>
                              <td style={{ padding: '6px 8px', fontSize: '12px' }}>{t.status}</td>
                              <td style={{ padding: '6px 8px', fontSize: '12px' }}>
                                <button className="btn btn-sm btn-secondary" onClick={() => openTransaction(t)}>Open</button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
