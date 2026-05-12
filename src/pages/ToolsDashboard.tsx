import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertCircle, RotateCw, ArrowRight, Pencil, Trash2, Download, Eye } from 'lucide-react';
import { toolsApi, toolTransactionsApi, siteTransfersApi } from '../tools/api';
import { useAuth } from '../App';
import { supabase } from '../supabase';
import { toast } from '../lib/logger';

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

export default function ToolsDashboard() {
  const { organisation } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_tools: 0,
    tools_at_clients: 0,
    tools_at_warehouse: 0,
    tools_in_transit: 0,
    overdue_returns: 0,
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

      // Fetch all transactions with client/project info
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

      if (filterType === 'issued') {
        query = query.eq('transaction_type', 'ISSUE').eq('status', 'ACTIVE');
      } else if (filterType === 'intransit') {
        query = query.eq('status', 'IN_TRANSIT');
      } else if (filterType === 'returned') {
        query = query.eq('transaction_type', 'RECEIVE');
      } else if (filterType === 'transfer') {
        query = query.eq('transaction_type', 'TRANSFER');
      } else if (filterType === 'site_transfer') {
        query = query.eq('transaction_type', 'SITE_TRANSFER');
      }

      const { data: transactions, error: txError } = await query;
      if (txError) throw txError;

      // Fetch transaction items with tool details
      const txIds = (transactions || []).map((t: any) => t.id);
      let items: any[] = [];
      if (txIds.length > 0) {
        const { data: fetchedItems } = await supabase
          .from('tool_transaction_items')
          .select(`*, tool:tools_catalog(tool_name, make, category)`)
          .in('transaction_id', txIds);
        items = fetchedItems || [];
      }

      // Flatten for table
      const flattened: ToolTransactionRow[] = [];
      for (const tx of transactions || []) {
        const txItems = items.filter(i => i.transaction_id === tx.id);
        if (txItems.length === 0) {
          flattened.push({
            id: tx.id,
            transaction_id: tx.id,
            reference_id: tx.reference_id,
            tool_id: '',
            tool_name: 'No items',
            client_name: tx.client?.client_name || tx.from_client?.client_name || tx.to_client?.client_name || '',
            from_client_name: tx.from_client?.client_name,
            to_client_name: tx.to_client?.client_name,
            quantity: 0,
            status: tx.status,
            transaction_date: tx.transaction_date,
            transaction_type: tx.transaction_type,
            taken_by: tx.taken_by,
            received_by: tx.received_by,
            remarks: tx.remarks,
          });
        } else {
          for (const item of txItems) {
            flattened.push({
              id: item.id,
              transaction_id: tx.id,
              reference_id: tx.reference_id,
              tool_id: item.tool_id,
              tool_name: item.tool?.tool_name || 'Unknown',
              make: item.tool?.make,
              category: item.tool?.category,
              client_name: tx.client?.client_name || tx.from_client?.client_name || tx.to_client?.client_name || '',
              from_client_name: tx.from_client?.client_name,
              to_client_name: tx.to_client?.client_name,
              from_project_name: (tx as any).from_project?.project_name,
              to_project_name: (tx as any).to_project?.project_name,
              quantity: item.quantity,
              returned_quantity: item.returned_quantity,
              status: tx.status,
              transaction_date: tx.transaction_date,
              transaction_type: tx.transaction_type,
              taken_by: tx.taken_by,
              received_by: tx.received_by,
              remarks: tx.remarks,
            });
          }
        }
      }

      setAllTools(flattened);

      // Build recent activity from transactions
      const activities: RecentActivity[] = (transactions || []).slice(0, 10).map((t: any) => ({
        id: t.id,
        type: t.transaction_type,
        description: `${t.transaction_type} — ${t.reference_id}`,
        date: t.transaction_date,
        status: t.status,
        reference_id: t.reference_id,
      }));
      setRecentActivity(activities);

      // Metrics from tool_transactions
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

  const MetricCard = ({ title, value, icon: Icon, color = 'blue' }: {
    title: string;
    value: number;
    icon: any;
    color?: string;
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      green: 'bg-green-50 text-green-600 border-green-200',
      orange: 'bg-orange-50 text-orange-600 border-orange-200',
      red: 'bg-red-50 text-red-600 border-red-200',
    };

    return (
      <div className={`p-6 rounded-lg border ${colorClasses[color as keyof typeof colorClasses]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          </div>
          <Icon className="h-8 w-8" />
        </div>
      </div>
    );
  };

  const getActivityStatusColor = (type: string) => {
    switch (type) {
      case 'ISSUE': return 'bg-blue-500';
      case 'RECEIVE': return 'bg-green-500';
      case 'TRANSFER': return 'bg-orange-500';
      case 'SITE_TRANSFER': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getActivityBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'IN_TRANSIT': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getToolStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'IN_TRANSIT': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      case 'RETURNED': return 'bg-green-100 text-green-800';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

      setEditModal({ ...tool, transaction: tx, items: items || [] });
    } catch (err) {
      toast.error(`Failed to load for edit: ${(err as Error).message}`);
    }
  };

  const handleDeleteTool = async (tool: any) => {
    if (!window.confirm(`Delete transaction ${tool.reference_id}?\nTool: ${tool.tool_name}\nQty: ${tool.quantity}`)) return;
    try {
      await supabase.from('tool_transaction_items').delete().eq('id', tool.id);
      // Check if this was the last item in the transaction
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

  useEffect(() => {
    if (!organisation?.id) return;
    loadDashboardData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, [organisation, filterType]);

  // Listen for storage changes and refresh dashboard
  useEffect(() => {
    const handleStorageChange = () => {
      console.log('Storage changed, refreshing dashboard...');
      loadDashboardData();
    };

    // Add custom event listener for storage changes
    window.addEventListener('storage-changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage-changed', handleStorageChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tools Dashboard</h1>
          <p className="text-gray-600">Real-time overview of your tools inventory and movements</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RotateCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <MetricCard
          title="Total Tools"
          value={metrics.total_tools}
          icon={Package}
          color="blue"
        />
        <MetricCard
          title="Tools at Clients/Sites"
          value={metrics.tools_at_clients}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Tools in Warehouse"
          value={metrics.tools_at_warehouse}
          icon={Package}
          color="orange"
        />
        <MetricCard
          title="Tools in Transit"
          value={metrics.tools_in_transit}
          icon={RotateCw}
          color="orange"
        />
        <MetricCard
          title="Overdue Returns"
          value={metrics.overdue_returns}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <Package className="h-8 w-8 mb-2 text-blue-600" />
            <span className="text-sm font-medium">Issue Tools</span>
            <span className="text-xs text-gray-500">Warehouse → Site</span>
          </button>
          <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <Package className="h-8 w-8 mb-2 text-green-600" />
            <span className="text-sm font-medium">Receive Tools</span>
            <span className="text-xs text-gray-500">Site → Warehouse</span>
          </button>
          <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <ArrowRight className="h-8 w-8 mb-2 text-orange-600" />
            <span className="text-sm font-medium">Transfer Tools</span>
            <span className="text-xs text-gray-500">Client → Client</span>
          </button>
          <button className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <RotateCw className="h-8 w-8 mb-2 text-purple-600" />
            <span className="text-sm font-medium">Site Transfer</span>
            <span className="text-xs text-gray-500">Site → Site</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
        </div>
        <div className="p-6">
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const statusColor = getActivityStatusColor(activity.type);
                const badgeColor = getActivityBadgeColor(activity.status);
                
                return (
                  <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
                      <div>
                        <p className="font-medium text-gray-900">{activity.description}</p>
                        <p className="text-sm text-gray-500">{activity.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* All Tools Section */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tools Management</h2>
            <div className="flex gap-2">
              <select 
                className="px-3 py-1 border rounded-lg text-sm"
                onChange={(e) => {
                  const filter = e.target.value;
                  setFilterType(filter);
                }}
                value={filterType}
              >
                <option value="all">All Tools</option>
                <option value="issued">Issued Tools</option>
                <option value="intransit">In Transit</option>
                <option value="returned">Returned Tools</option>
                <option value="transfer">Transfers</option>
                <option value="site_transfer">Site Transfers</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-6">
          {allTools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No tools found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client/Site</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">View</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allTools.map((tool) => {
                    const statusBadgeColor = getToolStatusBadgeColor(tool.status);
                    const typeBadgeColor = tool.transaction_type === 'ISSUE' ? 'bg-blue-100 text-blue-800' :
                      tool.transaction_type === 'RECEIVE' ? 'bg-green-100 text-green-800' :
                      tool.transaction_type === 'TRANSFER' ? 'bg-orange-100 text-orange-800' :
                      tool.transaction_type === 'SITE_TRANSFER' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800';
                    
                    return (
                      <tr key={tool.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tool.transaction_date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeBadgeColor}`}>
                            {tool.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tool.client_name || tool.from_client_name || tool.to_client_name || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {tool.reference_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <p className="font-medium">{tool.tool_name}</p>
                            <p className="text-xs text-gray-500">Qty: {tool.quantity}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => handleViewTool(tool)}
                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                          >
                            <Package className="h-4 w-4" />
                            View
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditTool(tool)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            >
                              <ArrowRight className="h-4 w-4" />
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteTool(tool)}
                              className="text-red-600 hover:text-red-900 flex items-center gap-1"
                            >
                              <AlertCircle className="h-4 w-4" />
                              Delete
                            </button>
                            <button 
                              onClick={() => handleDownloadTool(tool)}
                              className="text-green-600 hover:text-green-900 flex items-center gap-1"
                            >
                              <RotateCw className="h-4 w-4" />
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            width: '600px', backgroundColor: '#fff', borderRadius: '6px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Transaction Details</h2>
              <button onClick={() => setViewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                ✕
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Reference ID</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.reference_id}</p></div>
                <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Date</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.transaction_date}</p></div>
                <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Type</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.transaction_type}</p></div>
                <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Status</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.status}</p></div>
                <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Client</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.client?.client_name || '—'}</p></div>
                <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Taken By</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.taken_by || '—'}</p></div>
                <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Remarks</span><p style={{ margin: '4px 0 0', fontWeight: 500 }}>{viewModal.transaction?.remarks || '—'}</p></div>
              </div>
              <div><span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280' }}>Items</span>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '13px' }}>
                  <thead><tr style={{ background: '#F8F9FA' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Tool</th><th style={{ padding: '8px', textAlign: 'left' }}>Make</th><th style={{ padding: '8px', textAlign: 'right' }}>Qty</th><th style={{ padding: '8px', textAlign: 'right' }}>Returned</th>
                  </tr></thead>
                  <tbody>
                    {viewModal.items.map((item: any) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td style={{ padding: '8px' }}>{item.tool?.tool_name}</td>
                        <td style={{ padding: '8px' }}>{item.tool?.make || '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{item.returned_quantity || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditToolTransactionModal
          data={editModal}
          onClose={() => setEditModal(null)}
          onSave={async (updated: any) => {
            try {
              await supabase
                .from('tool_transactions')
                .update({ status: updated.status, remarks: updated.remarks })
                .eq('id', updated.transaction_id);
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
