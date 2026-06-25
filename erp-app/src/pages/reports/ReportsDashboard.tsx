import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  FolderIcon, 
  CubeIcon, 
  ShieldCheckIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface ReportCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  path: string;
  color: string;
  stats: {
    total: number;
    thisMonth: number;
    trend: 'up' | 'down' | 'stable';
  };
}

const ReportsDashboard = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('this-month');

  const reportCategories: ReportCategory[] = useMemo(() => [
    {
      id: 'financial',
      title: 'Financial Reports',
      description: 'Cost analysis, invoicing, and profitability metrics',
      icon: CurrencyDollarIcon,
      path: '/reports/financial',
      color: 'bg-emerald-500',
      stats: {
        total: 156,
        thisMonth: 23,
        trend: 'up'
      }
    },
    {
      id: 'projects',
      title: 'Project Reports',
      description: 'Portfolio status, progress tracking, and resource utilization',
      icon: FolderIcon,
      path: '/reports/projects',
      color: 'bg-blue-500',
      stats: {
        total: 89,
        thisMonth: 12,
        trend: 'up'
      }
    },
    {
      id: 'inventory',
      title: 'Inventory Reports',
      description: 'Stock movement, material consumption, and supplier performance',
      icon: CubeIcon,
      path: '/reports/inventory',
      color: 'bg-purple-500',
      stats: {
        total: 234,
        thisMonth: 45,
        trend: 'stable'
      }
    },
    {
      id: 'compliance',
      title: 'Compliance Reports',
      description: 'Audit trails, safety metrics, and regulatory compliance',
      icon: ShieldCheckIcon,
      path: '/reports/compliance',
      color: 'bg-red-500',
      stats: {
        total: 67,
        thisMonth: 8,
        trend: 'down'
      }
    }
  ], []);

  const recentReports = useMemo(() => [
    { id: 1, name: 'Q1 Financial Summary', type: 'Financial', date: '2024-05-03', status: 'Completed' },
    { id: 2, name: 'Project Portfolio Review', type: 'Projects', date: '2024-05-02', status: 'Completed' },
    { id: 3, name: 'Stock Movement Analysis', type: 'Inventory', date: '2024-05-01', status: 'In Progress' },
    { id: 4, name: 'Safety Compliance Audit', type: 'Compliance', date: '2024-04-30', status: 'Completed' },
    { id: 5, name: 'Monthly Cost Analysis', type: 'Financial', date: '2024-04-29', status: 'Scheduled' }
  ], []);

  const quickStats = useMemo(() => [
    { label: 'Total Reports', value: '1,247', change: '+12%', trend: 'up' },
    { label: 'Generated This Month', value: '88', change: '+5%', trend: 'up' },
    { label: 'Scheduled Reports', value: '23', change: '+2', trend: 'stable' },
    { label: 'Avg. Generation Time', value: '2.3s', change: '-0.5s', trend: 'up' }
  ], []);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-600">↑</span>;
      case 'down':
        return <span className="text-red-600">↓</span>;
      default:
        return <span className="text-zinc-600">→</span>;
    }
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Reports Dashboard</h1>
            <p className="text-zinc-600 mt-1">Generate and manage comprehensive business reports</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-zinc-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <CalendarDaysIcon className="w-4 h-4" />
              Schedule Report
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickStats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl border border-zinc-200 border-12" style={{ height: '34px' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-600">{stat.label}</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {getTrendIcon(stat.trend)}
                  <span className={`text-sm ${
                    stat.trend === 'up' ? 'text-green-600' : 
                    stat.trend === 'down' ? 'text-red-600' : 'text-zinc-600'
                  }`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Report Categories */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-900 mb-4">Report Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reportCategories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => navigate(category.path)}
                className="bg-white p-6 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:shadow-lg transition-all text-left group"
              >
                <div className={`w-12 h-12 ${category.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2">{category.title}</h3>
                <p className="text-sm text-zinc-600 mb-4">{category.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{category.stats.total} total</span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-500">{category.stats.thisMonth} this month</span>
                  </div>
                  {getTrendIcon(category.stats.trend)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-zinc-200">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-zinc-900">Recent Reports</h2>
                <button className="text-sm text-blue-600 hover:text-blue-700">View All</button>
              </div>
            </div>
            <div className="divide-y divide-zinc-200">
              {recentReports.map((report) => (
                <div key={report.id} className="p-4 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                        <DocumentTextIcon className="w-5 h-5 text-zinc-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-zinc-900">{report.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <span>{report.type}</span>
                          <span>•</span>
                          <span>{report.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        report.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        report.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>
                        {report.status}
                      </span>
                      <button className="p-1 hover:bg-zinc-100 rounded">
                        <ArrowDownTrayIcon className="w-4 h-4 text-zinc-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-50 rounded-lg transition-colors">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FunnelIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-zinc-900">Create Custom Report</div>
                  <div className="text-sm text-zinc-500">Build with custom filters</div>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-50 rounded-lg transition-colors">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <CalendarDaysIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-zinc-900">Schedule Reports</div>
                  <div className="text-sm text-zinc-500">Set up automated generation</div>
                </div>
              </button>
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-50 rounded-lg transition-colors">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <ArrowDownTrayIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-zinc-900">Export All Reports</div>
                  <div className="text-sm text-zinc-500">Download as ZIP archive</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;
