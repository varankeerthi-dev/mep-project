import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { PermissionGuard } from '../../rbac';
import {
  Search as SearchIcon,
  Plus as PlusIcon,
  Eye as EyeIcon,
  MoreHorizontal as MoreHorizontalIcon,
  ChevronDown as ChevronDownIcon,
  ArrowUpDown as ArrowUpDownIcon,
  Loader2,
  PackageCheck,
  AlertTriangle,
  FolderSync
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const SO_STATUSES = ['All', 'draft', 'waiting_approval', 'open', 'in_production', 'partially_shipped', 'completed', 'cancelled'];

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  draft:            { bg: 'bg-zinc-100', color: 'text-zinc-700', label: 'Draft' },
  waiting_approval: { bg: 'bg-amber-100', color: 'text-amber-700', label: 'Waiting Approval' },
  open:             { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Open / Approved' },
  in_production:    { bg: 'bg-purple-100', color: 'text-purple-700', label: 'In Production' },
  partially_shipped:{ bg: 'bg-orange-100', color: 'text-orange-700', label: 'Partially Shipped' },
  completed:        { bg: 'bg-emerald-100', color: 'text-emerald-700', label: 'Completed' },
  cancelled:        { bg: 'bg-red-100', color: 'text-red-700', label: 'Cancelled' }
};

const STOCK_STATUS_COLORS: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  fully_reserved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: PackageCheck, label: 'Fully Reserved' },
  partially_reserved: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: FolderSync, label: 'Partially Reserved' },
  shortfall: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: AlertTriangle, label: 'Stock Shortfall' }
};

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fetch Sales Orders
  const { data: salesOrders = [], isLoading } = useQuery({
    queryKey: ['sales-orders', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          client:clients(client_name),
          project:projects(name)
        `)
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId
  });

  const filteredOrders = useMemo(() => {
    return salesOrders.filter((so: any) => {
      const matchesSearch = 
        so.sales_order_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        so.client?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        so.project?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'All' || so.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [salesOrders, searchTerm, statusFilter]);

  return (
    <PermissionGuard permissions={['sales.view']}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sales Orders</h1>
            <p className="text-sm text-zinc-500">
              Manage client orders, warehouse stock checks, and MRP calculations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate('/sales-orders/create')}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Sales Order
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <div className="relative w-full md:w-80">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SO no, client, project..."
              className="pl-9 bg-zinc-50 border-zinc-200 text-sm focus-visible:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-zinc-500 shrink-0">Status:</span>
            <div className="flex flex-wrap gap-1">
              {SO_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    statusFilter === status
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {status === 'All' ? 'All' : STATUS_COLORS[status]?.label || status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table/List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-200 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="text-sm text-zinc-500 mt-2">Loading Sales Orders...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-200 shadow-sm text-center">
            <div className="p-3 bg-zinc-100 rounded-full text-zinc-400 mb-3">
              <PackageCheck className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">No Sales Orders found</h3>
            <p className="text-sm text-zinc-500 max-w-sm mt-1">
              Try adjusting your search terms, filter by status, or create a new sales order.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="py-3 px-4">SO Number</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Approval Status</th>
                    <th className="py-3 px-4">Inventory Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredOrders.map((so: any) => {
                    const statusMeta = STATUS_COLORS[so.status] || { bg: 'bg-zinc-100', color: 'text-zinc-700', label: so.status };
                    const stockMeta = STOCK_STATUS_COLORS[so.stock_status || 'shortfall'];
                    const StockIcon = stockMeta.icon;

                    return (
                      <tr key={so.id} className="hover:bg-zinc-50/50 transition-colors text-sm text-zinc-700">
                        <td className="py-3.5 px-4 font-medium text-zinc-900">{so.sales_order_no}</td>
                        <td className="py-3.5 px-4">{so.client?.client_name || '-'}</td>
                        <td className="py-3.5 px-4">{so.project?.name || '-'}</td>
                        <td className="py-3.5 px-4">{formatDate(so.order_date)}</td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-900">{formatCurrency(so.grand_total)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusMeta.bg} ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${stockMeta.bg} ${stockMeta.text}`}>
                            <StockIcon className="h-3.5 w-3.5" />
                            {stockMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="relative inline-block text-left">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/sales-orders/view?id=${so.id}`)}
                              className="text-zinc-600 hover:text-zinc-950 font-medium text-xs px-2.5 py-1.5 border border-zinc-200 bg-white rounded-lg shadow-sm"
                            >
                              <EyeIcon className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
