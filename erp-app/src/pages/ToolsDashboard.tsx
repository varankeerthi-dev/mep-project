import React, { useState, useEffect, useRef } from 'react';
import { Package, TrendingUp, AlertCircle, RotateCw, ArrowRight, Trash2, Download, Eye, X, Search, Filter } from 'lucide-react';
import { toolsApi, toolTransactionsApi, siteTransfersApi } from '../tools/api';
import { useAuth } from '../App';
import { supabase } from '../supabase';
import { toast } from '../lib/logger';
import EditToolTransactionModal from '../components/tools/EditToolTransactionModal';

interface DashboardMetrics {
  total_tools: number;
  tools_at_clients: number;
  tools_at_warehouse: number;
  tools_in_transit: number;
  overdue_returns: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  date: string;
  status: string;
  reference_id?: string;
}

interface ToolTransactionRow {
  id: string;
  transaction_id: string;
  reference_id: string;
  tool_id: string;
  tool_name: string;
  make?: string;
  category?: string;
  client_name?: string;
  from_client_name?: string;
  to_client_name?: string;
  from_project_name?: string;
  to_project_name?: string;
  quantity: number;
  returned_quantity?: number;
  status: string;
  transaction_date: string;
  transaction_type: string;
  taken_by?: string;
  received_by?: string;
  remarks?: string;
}

interface ViewModalData {
  transaction: any;
  items: any[];
}

const sectionHeadStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: '11px', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
};

const sectionBgStyle: React.CSSProperties = {
  background: '#f8f9fa', padding: '12px', borderRadius: '6px'
};

const primaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', background: '#185FA5',
  border: '1px solid #185FA5', color: '#fff',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

const secondaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', background: '#fff',
  border: '1px solid #d1d5db', color: '#374151',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

const destructiveBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '6px 12px', border: '1px solid #d1d5db',
  background: '#fff', color: '#000',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s'
};

const MetricCard = ({ title, value, icon: Icon, color = '#185FA5' }: {
  title: string; value: number; icon: any; color?: string;
}) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#18181b', marginTop: '4px' }}>{value.toLocaleString()}</div>
    </div>
    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} style={{ color }} />
    </div>
  </div>
);

const FilterDropdown = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const options = [
    { value: 'all', label: 'All Tools' },
    { value: 'issued', label: 'Issued Tools' },
    { value: 'intransit', label: 'In Transit' },
    { value: 'returned', label: 'Returned Tools' },
    { value: 'transfer', label: 'Transfers' },
    { value: 'site_transfer', label: 'Site Transfers' },
  ];
  const selected = options.find(o => o.value === value);
  return (
    <div className="dropdown-container" style={{ position: 'relative' }}>
      <button
        type="button"
        style={{ ...secondaryBtn, gap: '6px', padding: '4px 10px', fontSize: '11px' }}
        onClick={() => setOpen(!open)}
      >
        <Filter size={12} />
        {selected?.label || 'Filter'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '160px', marginTop: '4px', overflow: 'hidden' }}>
          {options.map(o => (
            <div
              key={o.value}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', background: value === o.value ? '#eff6ff' : '#fff', color: value === o.value ? '#185FA5' : '#374151', fontWeight: value === o.value ? 600 : 400 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = value === o.value ? '#eff6ff' : '#fff'}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ToolsDashboard() {
  const { organisation } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_tools: 0, tools_at_clients: 0, tools_at_warehouse: 0, tools_in_transit: 0, overdue_returns: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [allTools, setAllTools] = useState<ToolTransactionRow[]>([]);
  const [viewModal, setViewModal] = useState<ViewModalData | null>(null);
  const [editModal, setEditModal] = useState<ToolTransactionRow | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const orgId = organisation?.id;
      if (!orgId) return;

      let query = supabase
        .from('tool_transactions')
        .select(`
          *,
          client:clients!tool_transactions_client_id_fkey(client_name),
          from_client:clients!tool_transactions_from_client_id_fkey(client_name),
          to_client:clients!tool_transactions_to_client_id_fkey(client_name)
        `)
        .eq('organisation_id', orgId)
        .order('transaction_date', { ascending: false });

      if (filterType === 'issued') query = query.eq('transaction_type', 'ISSUE').eq('status', 'ACTIVE');
      else if (filterType === 'intransit') query = query.eq('status', 'IN_TRANSIT');
      else if (filterType === 'returned') query = query.eq('transaction_type', 'RECEIVE');
      else if (filterType === 'transfer') query = query.eq('transaction_type', 'TRANSFER');
      else if (filterType === 'site_transfer') query = query.eq('transaction_type', 'SITE_TRANSFER');

      const { data: transactions, error: txError } = await query;
      if (txError) throw txError;

      const txIds = (transactions || []).map((t: any) => t.id);
      let items: any[] = [];
      if (txIds.length > 0) {
        const { data: fetchedItems } = await supabase
          .from('tool_transaction_items')
          .select(`*, tool:tools_catalog(tool_name, make, category)`)
          .in('transaction_id', txIds);
        items = fetchedItems || [];
      }

      const flattened: ToolTransactionRow[] = [];
      for (const tx of transactions || []) {
        const txItems = items.filter(i => i.transaction_id === tx.id);
        if (txItems.length === 0) {
          flattened.push({
            id: tx.id, transaction_id: tx.id, reference_id: tx.reference_id,
            tool_id: '', tool_name: 'No items',
            client_name: tx.client?.client_name || tx.from_client?.client_name || tx.to_client?.client_name || '',
            from_client_name: tx.from_client?.client_name, to_client_name: tx.to_client?.client_name,
            quantity: 0, status: tx.status, transaction_date: tx.transaction_date,
            transaction_type: tx.transaction_type, taken_by: tx.taken_by, received_by: tx.received_by, remarks: tx.remarks,
          });
        } else {
          for (const item of txItems) {
            flattened.push({
              id: item.id, transaction_id: tx.id, reference_id: tx.reference_id,
              tool_id: item.tool_id, tool_name: item.tool?.tool_name || 'Unknown',
              make: item.tool?.make, category: item.tool?.category,
              client_name: tx.client?.client_name || tx.from_client?.client_name || tx.to_client?.client_name || '',
              from_client_name: tx.from_client?.client_name, to_client_name: tx.to_client?.client_name,
              from_project_name: (tx as any).from_project?.project_name, to_project_name: (tx as any).to_project?.project_name,
              quantity: item.quantity, returned_quantity: item.returned_quantity,
              status: tx.status, transaction_date: tx.transaction_date,
              transaction_type: tx.transaction_type, taken_by: tx.taken_by, received_by: tx.received_by, remarks: tx.remarks,
            });
          }
        }
      }

      setAllTools(flattened);

      const activities: RecentActivity[] = (transactions || []).slice(0, 10).map((t: any) => ({
        id: t.id, type: t.transaction_type,
        description: `${t.transaction_type} — ${t.reference_id}`,
        date: t.transaction_date, status: t.status, reference_id: t.reference_id,
      }));
      setRecentActivity(activities);

      const allTx = transactions || [];
      const issued = allTx.filter((t: any) => t.transaction_type === 'ISSUE' && t.status === 'ACTIVE');
      const inTransit = allTx.filter((t: any) => t.status === 'IN_TRANSIT');
      const received = allTx.filter((t: any) => t.transaction_type === 'RECEIVE');
      const totalQty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);

      setMetrics({
        total_tools: totalQty,
        tools_at_clients: issued.reduce((s: number, i: any) => {
          const qty = items.filter((it: any) => it.transaction_id === i.id).reduce((qs: number, it: any) => qs + (it.quantity || 0), 0);
          return s + qty;
        }, 0),
        tools_at_warehouse: received.reduce((s: number, i: any) => {
          const qty = items.filter((it: any) => it.transaction_id === i.id).reduce((qs: number, it: any) => qs + (it.returned_quantity || 0), 0);
          return s + qty;
        }, 0),
        tools_in_transit: inTransit.reduce((s: number, i: any) => {
          const qty = items.filter((it: any) => it.transaction_id === i.id).reduce((qs: number, it: any) => qs + (it.quantity || 0), 0);
          return s + qty;
        }, 0),
        overdue_returns: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error(`Failed to load: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      ISSUE: { bg: '#dbeafe', color: '#1e40af' },
      RECEIVE: { bg: '#d1fae5', color: '#065f46' },
      TRANSFER: { bg: '#ffedd5', color: '#9a3412' },
      SITE_TRANSFER: { bg: '#e9d5ff', color: '#6b21a8' },
    };
    const s = map[type] || { bg: '#f3f4f6', color: '#374151' };
    return <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{type.replace('_', ' ')}</span>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      ACTIVE: { bg: '#d1fae5', color: '#065f46' },
      IN_TRANSIT: { bg: '#ffedd5', color: '#9a3412' },
      COMPLETED: { bg: '#dbeafe', color: '#1e40af' },
      RETURNED: { bg: '#d1fae5', color: '#065f46' },
      PARTIAL: { bg: '#fef9c3', color: '#854d0e' },
    };
    const s = map[status] || { bg: '#f3f4f6', color: '#374151' };
    return <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: s.bg, color: s.color }}>{status}</span>;
  };

  const handleViewTool = async (tool: any) => {
    try {
      const { data: tx } = await supabase
        .from('tool_transactions')
        .select(`*, client:clients!tool_transactions_client_id_fkey(client_name), from_client:clients!tool_transactions_from_client_id_fkey(client_name), to_client:clients!tool_transactions_to_client_id_fkey(client_name)`)
        .eq('id', tool.transaction_id)
        .single();
      const { data: items } = await supabase
        .from('tool_transaction_items')
        .select(`*, tool:tools_catalog(tool_name, make, category, hsn_code)`)
        .eq('transaction_id', tool.transaction_id);
      setViewModal({ transaction: tx, items: items || [] });
    } catch (err) {
      toast.error(`Failed to load details: ${(err as Error).message}`);
    }
  };

  const handleEditTool = async (tool: any) => {
    try {
      const { data: tx } = await supabase
        .from('tool_transactions')
        .select(`*, client:clients!tool_transactions_client_id_fkey(client_name)`)
        .eq('id', tool.transaction_id)
        .single();
      const { data: items } = await supabase
        .from('tool_transaction_items')
        .select(`*, tool:tools_catalog(tool_name, make, category)`)
        .eq('transaction_id', tool.transaction_id);
      setEditModal(prev => ({ ...prev, ...tool, transaction: tx, items: items || [] }));
    } catch (err) {
      toast.error(`Failed to load for edit: ${(err as Error).message}`);
    }
  };

  const handleDeleteTool = async (tool: any) => {
    if (!window.confirm(`Delete transaction ${tool.reference_id}?\nTool: ${tool.tool_name}\nQty: ${tool.quantity}`)) return;
    try {
      await supabase.from('tool_transaction_items').delete().eq('id', tool.id);
      const { data: remaining } = await supabase
        .from('tool_transaction_items')
        .select('id')
        .eq('transaction_id', tool.transaction_id);
      if (!remaining || remaining.length === 0) {
        await supabase.from('tool_transactions').delete().eq('id', tool.transaction_id);
      }
      toast.success('Transaction deleted');
      loadDashboardData();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const handleDownloadTool = async (tool: any) => {
    try {
      const { data: tx } = await supabase
        .from('tool_transactions')
        .select(`*, client:clients!tool_transactions_client_id_fkey(client_name)`)
        .eq('id', tool.transaction_id)
        .single();
      const { data: items } = await supabase
        .from('tool_transaction_items')
        .select(`*, tool:tools_catalog(tool_name, make, category, hsn_code)`)
        .eq('transaction_id', tool.transaction_id);
      const content = [
        'TOOL TRANSACTION REPORT',
        '=================================',
        `Reference ID   : ${tx?.reference_id}`,
        `Date           : ${tx?.transaction_date}`,
        `Type           : ${tx?.transaction_type}`,
        `Status         : ${tx?.status}`,
        `Client         : ${tx?.client?.client_name || '—'}`,
        `Taken By       : ${tx?.taken_by || '—'}`,
        `Received By    : ${tx?.received_by || '—'}`,
        `Remarks        : ${tx?.remarks || '—'}`,
        '',
        'ITEMS',
        '---------------------------------',
        ...(items || []).map((i: any) =>
          `  ${i.tool?.tool_name || '—'} | ${i.tool?.make || '—'} | Qty: ${i.quantity} | Returned: ${i.returned_quantity || 0}`
        ),
        '',
        `Generated: ${new Date().toLocaleString()}`,
      ].join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tool_transaction_${tool.reference_id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(`Download failed: ${(err as Error).message}`);
    }
  };

  const loadDataRef = useRef(loadDashboardData);
  useEffect(() => { loadDataRef.current = loadDashboardData; });

  useEffect(() => {
    if (!organisation?.id) return;
    loadDashboardData();
    const interval = setInterval(() => loadDataRef.current(), 30000);
    return () => clearInterval(interval);
  }, [organisation, filterType]);

  useEffect(() => {
    const handleStorageChange = () => { loadDataRef.current(); };
    window.addEventListener('storage-changed', handleStorageChange);
    return () => window.removeEventListener('storage-changed', handleStorageChange);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-zinc-100 rounded-md" />)}
      </div>
    );
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Geist Variable', 'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#18181b', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Tools Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>Real-time overview of your tools inventory and movements</p>
        </div>
        <button
          type="button"
          style={primaryBtn}
          onClick={loadDashboardData}
          onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
        >
          <RotateCw size={13} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <MetricCard title="Total Tools" value={metrics.total_tools} icon={Package} />
        <MetricCard title="At Clients" value={metrics.tools_at_clients} icon={TrendingUp} color="#d97706" />
        <MetricCard title="In Warehouse" value={metrics.tools_at_warehouse} icon={Package} color="#059669" />
        <MetricCard title="In Transit" value={metrics.tools_in_transit} icon={AlertCircle} color="#dc2626" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionHeadStyle}>Recent Activity</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
              <Package size={36} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              <p style={{ fontSize: '13px', margin: 0 }}>No recent activity</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentActivity.map((activity) => (
                <div key={activity.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #f3f4f6', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getTypeBadge(activity.type)}
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 500, color: '#18181b', margin: 0 }}>{activity.description}</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{activity.date}</p>
                    </div>
                  </div>
                  {getStatusBadge(activity.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={sectionHeadStyle}>Tools Management</div>
          <FilterDropdown value={filterType} onChange={setFilterType} />
        </div>
        <div style={{ padding: '16px 20px' }}>
          {allTools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <Package size={48} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 4px' }}>No tools found</p>
              <p style={{ fontSize: '12px', margin: 0 }}>Try adjusting your filter</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#1e3a8a' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Type</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Client/Site</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Ref ID</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Tool Details</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allTools.map((tool, idx) => (
                    <tr key={tool.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 12px', color: '#52525b', fontSize: '11px', whiteSpace: 'nowrap' }}>{tool.transaction_date}</td>
                      <td style={{ padding: '8px 12px' }}>{getTypeBadge(tool.transaction_type)}</td>
                      <td style={{ padding: '8px 12px', color: '#18181b', fontWeight: 500, whiteSpace: 'nowrap' }}>{tool.client_name || tool.from_client_name || tool.to_client_name || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#18181b', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>{tool.reference_id}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 500, color: '#18181b', fontSize: '12px' }}>{tool.tool_name}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Qty: {tool.quantity}</div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{getStatusBadge(tool.status)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button type="button" title="View" style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#185FA5', borderRadius: '4px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleViewTool(tool)}><Eye size={14} /></button>
                          <button type="button" title="Edit" style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151', borderRadius: '4px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleEditTool(tool)}><ArrowRight size={14} /></button>
                          <button type="button" title="Download" style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#059669', borderRadius: '4px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#ecfdf5'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleDownloadTool(tool)}><Download size={14} /></button>
                          <button type="button" title="Delete" style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#000', borderRadius: '4px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleDeleteTool(tool)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {viewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '600px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', margin: 0 }}>Transaction Details</h2>
              <button type="button" onClick={() => setViewModal(null)} style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              ><X size={16} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Reference ID</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.reference_id}</p></div>
                <div><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Date</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.transaction_date}</p></div>
                <div><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Type</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.transaction_type}</p></div>
                <div><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Status</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.status}</p></div>
                <div><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Client</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.client?.client_name || '—'}</p></div>
                <div><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Taken By</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.taken_by || '—'}</p></div>
                <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Remarks</div><p style={{ margin: 0, fontWeight: 500, fontSize: '13px' }}>{viewModal.transaction?.remarks || '—'}</p></div>
              </div>
              <div style={sectionHeadStyle}>Items</div>
              <div style={sectionBgStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#1e3a8a' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px' }}>Tool</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '11px' }}>Make</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: '11px' }}>Qty</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: '11px' }}>Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModal.items.map((item: any, i: number) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '6px 10px', color: '#18181b' }}>{item.tool?.tool_name}</td>
                        <td style={{ padding: '6px 10px', color: '#71717a' }}>{item.tool?.make || '—'}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#18181b', fontWeight: 500 }}>{item.quantity}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#71717a' }}>{item.returned_quantity || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <EditToolTransactionModal
          data={editModal}
          onClose={() => setEditModal(null)}
          onSave={async (updated: any) => {
            try {
              await supabase.from('tool_transactions').update({ status: updated.status, remarks: updated.remarks }).eq('id', updated.transaction_id);
              toast.success('Transaction updated');
              setEditModal(null);
              loadDashboardData();
            } catch (err) {
              toast.error(`Update failed: ${(err as Error).message}`);
            }
          }}
        />
      )}
    </div>
  );
}
