import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, AlertCircle, RotateCw, ArrowRight } from 'lucide-react';
import { toolsApi, toolTransactionsApi, siteTransfersApi } from '../tools/api';
import { useAuth } from '../App';

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
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_tools: 0,
    tools_at_clients: 0,
    tools_at_warehouse: 0,
    tools_in_transit: 0,
    overdue_returns: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organisation?.id) return;
    loadDashboardData();
  }, [organisation]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const orgId = organisation.id;

      // Get all tools
      const tools = await toolsApi.getTools(orgId);
      const totalTools = tools.length;

      // Get recent transactions
      const transactions = await toolTransactionsApi.getTransactions(orgId, {
        date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      // Get site transfers
      const siteTransfers = await siteTransfersApi.getSiteTransfers(orgId, {
        date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      // Calculate metrics
      let toolsAtClients = 0;
      let toolsAtWarehouse = 0;
      let toolsInTransit = 0;

      // Calculate from tools catalog
      tools.forEach(tool => {
        if (tool.current_stock && tool.current_stock > 0) {
          toolsAtWarehouse += tool.current_stock;
        }
      });

      // Calculate from transactions
      transactions.forEach(transaction => {
        if (transaction.status === 'ACTIVE' || transaction.status === 'IN_TRANSIT') {
          toolsInTransit += 1;
        }
      });

      siteTransfers.forEach(transfer => {
        if (transfer.status === 'IN_TRANSIT') {
          toolsInTransit += 1;
        }
      });

      // Calculate tools at clients (simplified)
      toolsAtClients = totalTools - toolsAtWarehouse - toolsInTransit;

      setMetrics({
        total_tools: totalTools,
        tools_at_clients: toolsAtClients,
        tools_at_warehouse: toolsAtWarehouse,
        tools_in_transit: toolsInTransit,
        overdue_returns: 0, // TODO: Calculate based on due dates
      });

      // Prepare recent activity
      const allActivity: RecentActivity[] = [];

      // Add recent transactions
      transactions.slice(0, 5).forEach(transaction => {
        allActivity.push({
          id: transaction.id,
          type: transaction.transaction_type,
          description: `${transaction.transaction_type} - ${transaction.reference_id}`,
          date: transaction.transaction_date,
          status: transaction.status,
        });
      });

      // Add recent site transfers
      siteTransfers.slice(0, 3).forEach(transfer => {
        allActivity.push({
          id: transfer.id,
          type: 'SITE_TRANSFER',
          description: `Site Transfer - ${transfer.reference_id}`,
          date: transfer.transfer_date,
          status: transfer.status,
        });
      });

      // Sort by date and take latest
      setRecentActivity(
        allActivity
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)
      );

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
          <icon className="h-8 w-8" />
        </div>
      </div>
    );
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tools Dashboard</h1>
        <p className="text-gray-600">Real-time overview of your tools inventory and movements</p>
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
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      activity.type === 'ISSUE' ? 'bg-blue-500' :
                      activity.type === 'RECEIVE' ? 'bg-green-500' :
                      activity.type === 'TRANSFER' ? 'bg-orange-500' :
                      activity.type === 'SITE_TRANSFER' ? 'bg-purple-500' : 'bg-gray-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.description}</p>
                      <p className="text-sm text-gray-500">{activity.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      activity.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      activity.status === 'IN_TRANSIT' ? 'bg-orange-100 text-orange-800' :
                      activity.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
