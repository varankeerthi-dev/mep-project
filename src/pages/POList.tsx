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
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Purchase Orders</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage client purchase orders and utilization tracking</p>
        </div>
        <button 
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-6 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
          onClick={() => navigate('/client-po/create')}
        >
          <Plus size={18} />
          Create New PO
        </button>
      </div>

      {/* Stats */}
      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        <div className="group flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total POs</div>
            <div className="text-2xl font-black text-slate-900">{filteredPOs.length}</div>
          </div>
        </div>
        <div className="group flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-110">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Active / Partial</div>
            <div className="text-2xl font-black text-slate-900">
              {filteredPOs.filter(p => ['Open', 'Partially Billed'].includes(p.status)).length}
            </div>
          </div>
        </div>
        <div className="group flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Value</div>
            <div className="text-2xl font-black text-emerald-700">
              ₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_total_value || 0), 0))}
            </div>
          </div>
        </div>
        <div className="group flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 transition-transform group-hover:scale-110">
            <Layers size={20} />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Balance Available</div>
            <div className="text-2xl font-black text-rose-700">
              ₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_available_value || 0), 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/30 p-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={16} />
              <input
                type="text"
                placeholder="Search POs or Clients..."
                className="h-12 w-full min-w-[320px] rounded-2xl border border-slate-100 bg-white pl-12 pr-4 text-[13px] font-medium shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 group-hover:border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="h-10 w-px bg-slate-200/60 mx-2 hidden lg:block" />
            
            <div className="flex items-center gap-2">
              <select
                className="h-12 min-w-[160px] rounded-2xl border border-slate-100 bg-white px-4 text-[13px] font-medium shadow-sm outline-none transition-all hover:border-slate-200 focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Partially Billed">Partially Billed</option>
                <option value="Closed">Closed</option>
              </select>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
                <input
                  type="date"
                  className="h-10 rounded-xl border-none bg-transparent px-3 text-[13px] font-medium outline-none focus:ring-0"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <div className="text-slate-300 font-bold">→</div>
                <input
                  type="date"
                  className="h-10 rounded-xl border-none bg-transparent px-3 text-[13px] font-medium outline-none focus:ring-0"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={loadPOs}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-95"
              title="Refresh Data"
            >
              <RefreshCcw size={18} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="p-2">
          {loading ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-slate-300">
              <RefreshCcw size={40} className="animate-spin opacity-20" />
              <div className="text-sm font-bold uppercase tracking-widest opacity-50">Synchronizing...</div>
            </div>
          ) : (
            <AppTable
              data={filteredPOs}
              columns={tableColumns}
              enableSorting={true}
              enablePagination={true}
              defaultPageSize={10}
              emptyMessage="No matching purchase orders found"
            />
          )}
        </div>
      </div>
    </div>
  );
}
