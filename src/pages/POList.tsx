import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  XCircle, 
  ChevronRight, 
  Edit2, 
  Trash2,
  Calendar,
  Layers,
  FileCheck,
  RefreshCcw
} from 'lucide-react';
import { AppTable } from '../components/ui/AppTable';
import { cn } from '../lib/utils';

export default function POList() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadPOs();
  }, [statusFilter, dateFrom, dateTo]);

  const loadPOs = async () => {
    setLoading(true);
    let query = supabase
      .from('client_purchase_orders')
      .select(`
        *,
        clients!inner(client_name)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (dateFrom) {
      query = query.gte('po_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('po_date', dateTo);
    }

    const { data } = await query;
    setPos(data || []);
    setLoading(false);
  };

  const filteredPOs = pos.filter(po => {
    const searchLower = searchTerm.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(searchLower) ||
      po.clients?.client_name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string, text: string, icon: any }> = {
      'Open': { bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckCircle },
      'Partially Billed': { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
      'Closed': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: FileCheck }
    };
    const cfg = config[status] || config['Open'];
    const Icon = cfg.icon;
    
    return (
      <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider", cfg.bg, cfg.text)}>
        <Icon size={12} />
        {status}
      </div>
    );
  };

  const deletePO = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PO?')) return;
    
    const { error } = await supabase
      .from('client_purchase_orders')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert('Error deleting PO: ' + error.message);
    } else {
      loadPOs();
    }
  };

  const tableColumns = useMemo(() => [
    {
      header: 'Client',
      accessorKey: 'clients.client_name',
      cell: (info: any) => (
        <div className="font-semibold text-slate-900">{info.getValue() || '-'}</div>
      )
    },
    {
      header: 'PO Number',
      accessorKey: 'po_number',
      cell: (info: any) => (
        <span className="font-black tracking-tight text-blue-600">{info.getValue()}</span>
      )
    },
    {
      header: 'Date',
      accessorKey: 'po_date',
      cell: (info: any) => (
        <div className="flex items-center gap-1.5 text-slate-500">
          <Calendar size={12} />
          {formatDate(info.getValue())}
        </div>
      )
    },
    {
      header: 'Total Value',
      accessorKey: 'po_total_value',
      cell: (info: any) => (
        <div className="text-right font-bold text-slate-900">₹{formatCurrency(info.getValue())}</div>
      )
    },
    {
      header: 'Utilised',
      accessorKey: 'po_utilized_value',
      cell: (info: any) => (
        <div className="text-right font-medium text-slate-400">₹{formatCurrency(info.getValue())}</div>
      )
    },
    {
      header: 'Balance',
      accessorKey: 'po_available_value',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <div className={cn(
            "text-right font-black",
            val > 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            ₹{formatCurrency(val)}
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info: any) => getStatusBadge(info.getValue())
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
            onClick={() => navigate(`/client-po/create?id=${row.original.id}`)}
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:border-rose-200 hover:text-rose-600 hover:shadow-md"
            onClick={() => deletePO(row.original.id)}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="flex h-8 w-12 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md"
            onClick={() => navigate(`/client-po/details?id=${row.original.id}`)}
            title="View Details"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )
    }
  ], [navigate]);

  return (
    <div className="min-h-screen bg-zinc-50 p-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-500" />
          <h1 className="text-sm font-semibold text-zinc-800">Purchase Orders</h1>
        </div>
        <button 
          className="inline-flex h-7 items-center gap-1.5 bg-blue-600 px-3 text-xs font-semibold text-white"
          onClick={() => navigate('/client-po/create')}
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Compact Metrics Strip */}
      <div className="flex items-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-blue-500" />
          <span className="text-zinc-400">Total:</span>
          <span className="font-semibold text-zinc-700">{filteredPOs.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-amber-500" />
          <span className="text-zinc-400">Active:</span>
          <span className="font-semibold text-zinc-700">{filteredPOs.filter(p => p.status === 'Open').length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          <span className="text-zinc-400">Value:</span>
          <span className="font-semibold text-emerald-700">₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_total_value || 0), 0))}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-rose-500" />
          <span className="text-zinc-400">Balance:</span>
          <span className="font-semibold text-rose-700">₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_available_value || 0), 0))}</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="border border-zinc-200 bg-white">
        {/* Compact Filter Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input
                type="text"
                placeholder="Search..."
                className="h-7 w-48 pl-7 text-xs border border-zinc-200 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select
                className="h-7 text-xs border border-zinc-200 bg-white px-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Partially Billed">Partial</option>
                <option value="Closed">Closed</option>
              </select>

              <div className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1 py-0.5">
                <input
                  type="date"
                  className="h-6 text-xs border-none bg-transparent px-1"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-zinc-300">→</span>
                <input
                  type="date"
                  className="h-6 text-xs border-none bg-transparent px-1"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={loadPOs}
              className="flex h-7 w-7 items-center justify-center border border-zinc-200 bg-white text-zinc-400"
              title="Refresh Data"
            >
              <RefreshCcw size={12} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="p-0.5">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-zinc-300">
              <RefreshCcw size={20} className="animate-spin" />
            </div>
          ) : (
            <AppTable
              data={filteredPOs}
              columns={tableColumns}
              enableSorting={true}
              enablePagination={true}
              defaultPageSize={15}
              emptyMessage="No matching purchase orders found"
            />
          )}
        </div>
      </div>
    </div>
  );
}
