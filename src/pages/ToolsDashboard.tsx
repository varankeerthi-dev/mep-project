import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertCircle, RotateCw, ArrowRight } from 'lucide-react';
import { toolsApi, toolTransactionsApi, siteTransfersApi } from '../tools/api';
import { useAuth } from '../App';
import ToolTransactionStorage from '../tools/storage';

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
}

export default function ToolsDashboard() {
  const { organisation } = useAuth();
  const [storage] = useState(() => ToolTransactionStorage.getInstance());
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
  const [allTools, setAllTools] = useState<any[]>([]);

  useEffect(() => {
    if (!organisation?.id) return;
    loadDashboardData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, [organisation, storage]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get data from storage system
      const storageMetrics = storage.getDashboardMetrics();
      const recentActivityData = storage.getRecentActivity(10);
      const allTransactions = storage.getTransactions();

      // Update metrics
      setMetrics({
        total_tools: storageMetrics.total_tools,
        tools_at_clients: storageMetrics.tools_at_clients,
        tools_at_warehouse: storageMetrics.tools_at_warehouse,
        tools_in_transit: storageMetrics.tools_in_transit,
        overdue_returns: 0, // TODO: Calculate based on due dates
      });

      // Update recent activity
      setRecentActivity(recentActivityData.map(activity => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        date: activity.date,
        status: activity.status,
      })));

      // Update all tools data for table
      let filteredTools = allTransactions;
      if (filterType === 'issued') {
        filteredTools = storage.getIssuedTools();
      } else if (filterType === 'intransit') {
        filteredTools = storage.getInTransitTools();
      } else if (filterType === 'returned') {
        filteredTools = storage.getTransactionsByType('RECEIVE');
      }

      // Flatten tools for display
      const flattenedTools = filteredTools.flatMap(transaction => 
        transaction.tools.map(tool => ({
          id: transaction.id + '-' + tool.id,
          reference_id: transaction.reference_id,
          tool_name: tool.tool_name,
          client_id: transaction.client_id || transaction.from_project || transaction.to_project,
          quantity: tool.quantity,
          status: transaction.status,
          transaction_date: transaction.transaction_date,
          transaction_type: transaction.transaction_type,
        }))
      );

      setAllTools(flattenedTools);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
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
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewTool = (tool: any) => {
    console.log('View tool:', tool);
    // TODO: Open tool details modal or navigate to details page
    alert(`Viewing tool details for: ${tool.tool_name} (Ref: ${tool.reference_id})`);
  };

  const handleEditTool = (tool: any) => {
    console.log('Edit tool:', tool);
    // TODO: Open edit modal or navigate to edit page
    alert(`Editing tool: ${tool.tool_name} (Ref: ${tool.reference_id})`);
  };

  const handleDeleteTool = (tool: any) => {
    if (window.confirm(`Are you sure you want to delete this tool transaction?\n\nTool: ${tool.tool_name}\nReference: ${tool.reference_id}`)) {
      console.log('Delete tool:', tool);
      // TODO: Delete from storage system
      alert(`Tool transaction deleted: ${tool.reference_id}`);
      // Refresh data after deletion
      loadDashboardData();
    }
  };

  const handleDownloadTool = (tool: any) => {
    console.log('Download tool:', tool);
    // TODO: Generate and download PDF/Excel report
    const reportData = {
      reference_id: tool.reference_id,
      tool_name: tool.tool_name,
      quantity: tool.quantity,
      client_site: tool.client_id,
      status: tool.status,
      transaction_type: tool.transaction_type,
      date: tool.transaction_date,
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `tool_transaction_${tool.reference_id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

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
                          {tool.client_id || 'Unknown'}
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
    </div>
  );
}
