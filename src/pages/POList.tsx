import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { 
  Plus, 
  Search, 
  FileText, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  ChevronRight, 
  Edit2, 
  Trash2,
  Layers,
  FileCheck,
  RefreshCcw,
  Download,
  Columns,
  Square,
  CheckSquare,
  Copy,
  Eye
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    client: true,
    poNumber: true,
    date: true,
    amount: true,
    utilised: true,
    balance: true,
    status: true,
  });

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

  const deleteSelectedPOs = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected PO(s)?`)) return;
    
    const { error } = await supabase
      .from('client_purchase_orders')
      .delete()
      .in('id', Array.from(selectedIds));
    
    if (error) {
      alert('Error deleting POs: ' + error.message);
    } else {
      setSelectedIds(new Set());
      loadPOs();
    }
  };

  const exportToCSV = useCallback(() => {
    const headers = ['Client', 'PO Number', 'Date', 'Amount', 'Utilised', 'Balance', 'Status'];
    const rows = filteredPOs.map(po => [
      po.clients?.client_name || '',
      po.po_number || '',
      formatDate(po.po_date),
      po.po_total_value || 0,
      po.po_utilized_value || 0,
      po.po_available_value || 0,
      po.status || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [filteredPOs]);

  const duplicatePO = async (po: any) => {
    const { data, error } = await supabase
      .from('client_purchase_orders')
      .insert([{
        client_id: po.client_id,
        po_number: `${po.po_number}-COPY`,
        po_date: new Date().toISOString().split('T')[0],
        po_total_value: po.po_total_value,
        po_utilized_value: 0,
        po_available_value: po.po_total_value,
        status: 'Open',
        items: po.items
      }])
      .select()
      .single();
    
    if (error) {
      alert('Error duplicating PO: ' + error.message);
    } else {
      navigate(`/client-po/create?id=${data.id}`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPOs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPOs.map(po => po.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tableColumns = useMemo(() => {
    // Dynamic width for Client column based on longest name
    const maxClientNameLength = Math.max(
      ...filteredPOs.map(po => po.clients?.client_name?.length || 0),
      8 // min width
    );
    const clientColWidth = Math.min(maxClientNameLength * 8, 280); // max 280px
    
    const cols = [
    {
      id: 'select',
      header: () => (
        <button
          onClick={toggleSelectAll}
          className="flex h-4 w-4 items-center justify-center text-zinc-400 hover:text-blue-600"
        >
          {selectedIds.size === filteredPOs.length && filteredPOs.length > 0 ? (
            <CheckSquare size={14} className="text-blue-600" />
          ) : (
            <Square size={14} />
          )}
        </button>
      ),
      cell: ({ row }: any) => (
        <button
          onClick={() => toggleSelect(row.original.id)}
          className="flex h-4 w-4 items-center justify-center text-zinc-400 hover:text-blue-600"
        >
          {selectedIds.has(row.original.id) ? (
            <CheckSquare size={14} className="text-blue-600" />
          ) : (
            <Square size={14} />
          )}
        </button>
      ),
      size: 40
    },
    {
      id: 'client',
      header: 'Client',
      accessorKey: 'clients.client_name',
      cell: (info: any) => (
        <div className="font-medium text-zinc-700" style={{ minWidth: clientColWidth }}>
          {info.getValue() || '-'}
        </div>
      )
    },
    {
      id: 'poNumber',
      header: 'PO Number',
      accessorKey: 'po_number',
      cell: (info: any) => (
        <span className="font-semibold text-blue-600">{info.getValue()}</span>
      )
    },
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'po_date',
      cell: (info: any) => (
        <span className="text-zinc-500">{formatDate(info.getValue())}</span>
      )
    },
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'po_total_value',
      cell: (info: any) => (
        <div className="flex flex-col items-center">
          <span className="font-medium text-zinc-700">₹{formatCurrency(info.getValue())}</span>
        </div>
      )
    },
    {
      id: 'utilised',
      header: 'Utilised',
      accessorKey: 'po_utilized_value',
      cell: (info: any) => (
        <span className="text-zinc-500">₹{formatCurrency(info.getValue())}</span>
      )
    },
    {
      id: 'balance',
      header: 'Balance',
      accessorKey: 'po_available_value',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={cn("font-medium", val > 0 ? "text-emerald-600" : "text-rose-600")}>
            ₹{formatCurrency(val)}
          </span>
        );
      }
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (info: any) => getStatusBadge(info.getValue())
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            className="flex h-6 w-6 items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600"
            onClick={() => navigate(`/client-po/create?id=${row.original.id}`)}
            title="Edit"
          >
            <Edit2 size={12} />
          </button>
          <button
            className="flex h-6 w-6 items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:text-rose-600"
            onClick={() => deletePO(row.original.id)}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
          <button
            className="flex h-6 w-6 items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600"
            onClick={() => duplicatePO(row.original)}
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          <button
            className="flex h-6 w-6 items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600"
            onClick={() => navigate(`/client-po/details?id=${row.original.id}`)}
            title="View"
          >
            <Eye size={12} />
          </button>
        </div>
      )
    }
    ];
    
    // Filter columns based on visibility
    return cols.filter(col => {
      if (col.id === 'select' || col.id === 'actions') return true;
      return visibleColumns[col.id as keyof typeof visibleColumns] !== false;
    });
  }, [navigate, filteredPOs, selectedIds, visibleColumns, toggleSelectAll]);

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
        {selectedIds.size > 0 && (
          <div className="ml-4 flex items-center gap-2 rounded bg-blue-50 px-3 py-1.5">
            <span className="text-xs font-medium text-blue-700">{selectedIds.size} selected</span>
            <button
              onClick={deleteSelectedPOs}
              className="text-xs font-medium text-rose-600 hover:text-rose-700"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
            >
              Clear
            </button>
          </div>
        )}
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
              onClick={exportToCSV}
              className="flex h-7 items-center gap-1.5 border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-500 hover:text-emerald-600"
              title="Export to CSV"
            >
              <Download size={12} />
              <span>Export</span>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="flex h-7 w-7 items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600"
                title="Column Visibility"
              >
                <Columns size={12} />
              </button>
              
              {showColumnPicker && (
                <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded border border-zinc-200 bg-white py-1 shadow-lg">
                  {Object.entries(visibleColumns).map(([key, visible]) => (
                    <button
                      key={key}
                      onClick={() => toggleColumn(key)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      {visible ? <CheckSquare size={12} className="text-blue-600" /> : <Square size={12} />}
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={loadPOs}
              className="flex h-7 w-7 items-center justify-center border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600"
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
