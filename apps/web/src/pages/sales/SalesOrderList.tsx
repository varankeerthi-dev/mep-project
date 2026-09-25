import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { PermissionGuard } from '../../rbac';
import { Eye as EyeIcon, PackageCheck, AlertTriangle, FolderSync, Edit as EditIcon, Copy as CopyIcon, Trash2 as Trash2Icon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../lib/logger';
import { DocumentListShell, type ShellColumn } from '../../components/document/DocumentListShell';

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

const SO_COLUMNS: ShellColumn[] = [
  { id: 'soNumber', label: 'SO Number', width: '140px', mandatory: true },
  { id: 'client', label: 'Client', width: '200px', mandatory: true },
  { id: 'project', label: 'Project', width: '180px' },
  { id: 'quotation', label: 'Quotation', width: '140px' },
  { id: 'date', label: 'Date', width: '120px' },
  { id: 'converted', label: 'Converted', width: '120px' },
  { id: 'total', label: 'Total Amount', width: '140px', align: 'right', mandatory: true },
  { id: 'approval', label: 'Approval Status', width: '160px' },
  { id: 'inventory', label: 'Inventory Status', width: '170px' },
];

const DEFAULT_VISIBLE = SO_COLUMNS.map((c) => c.id);

export default function SalesOrderList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleIds, setVisibleIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('so-list-columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* keep defaults */ }
    return DEFAULT_VISIBLE;
  });

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
    const q = searchTerm.toLowerCase();
    return salesOrders.filter((so: any) => {
      const matchesSearch =
        so.sales_order_no?.toLowerCase().includes(q) ||
        so.client?.client_name?.toLowerCase().includes(q) ||
        so.project?.name?.toLowerCase().includes(q) ||
        so.quotation_no?.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'All' || so.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [salesOrders, searchTerm, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === filteredOrders.length && filteredOrders.length > 0
        ? new Set()
        : new Set(filteredOrders.map((so: any) => so.id))
    );
  };

  const deleteOrders = async (ids: string[]) => {
    if (ids.length === 0) return false;
    if (!confirm(`Are you sure you want to delete ${ids.length} sales order(s)? Reservations on their lines will be released.`)) return false;
    try {
      const { data: lineIds } = await supabase
        .from('sales_order_items')
        .select('id')
        .in('sales_order_id', ids);
      const itemIds = (lineIds || []).map((r: any) => r.id);
      if (itemIds.length > 0) {
        await supabase.from('sales_order_reservations').delete().in('sales_order_item_id', itemIds);
        await supabase.from('sales_order_items').delete().in('id', itemIds);
      }
      const { error } = await supabase.from('sales_orders').delete().in('id', ids).eq('organisation_id', orgId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setSelectedIds(new Set());
      toast.success('Deleted successfully');
      return true;
    } catch (e: any) {
      toast.error('Delete failed: ' + (e.message || e));
      return false;
    }
  };

  const duplicateOrder = async (so: any) => {
    if (!orgId) return;
    try {
      const { data: soNo, error: noErr } = await supabase.rpc('generate_sales_order_no', { p_org_id: orgId });
      if (noErr || !soNo) throw noErr || new Error('Could not generate SO number');
      const { data: header, error: headErr } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', so.id)
        .single();
      if (headErr || !header) throw headErr || new Error('Order not found');
      const { data: lines } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', so.id);
      const { id: _drop, sales_order_no: _no, quotation_id: _q, quotation_no: _qn, converted_at: _c, created_at: _ca, updated_at: _ua, cancelled_at: _x, closed_at: _cl, ...rest } = header as any;
      const { data: created, error: createErr } = await supabase
        .from('sales_orders')
        .insert({ ...rest, organisation_id: orgId, sales_order_no: soNo, status: 'draft' })
        .select()
        .single();
      if (createErr || !created) throw createErr || new Error('Duplicate failed');
      if (lines && lines.length > 0) {
        const { error: linesErr } = await supabase.from('sales_order_items').insert(
          lines.map((l: any) => {
            const { id: _lid, sales_order_id: _lso, created_at: _lca, ...lrest } = l;
            return { ...lrest, sales_order_id: created.id };
          })
        );
        if (linesErr) throw linesErr;
      }
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(`Duplicated as ${soNo}`);
    } catch (e: any) {
      toast.error('Duplicate failed: ' + (e.message || e));
    }
  };

  const soRowMenuItems = (so: any) => [
    { label: 'View Details', icon: EyeIcon, onClick: () => navigate(`/sales-orders/view?id=${so.id}`) },
    { label: 'Edit', icon: EditIcon, onClick: () => navigate(`/sales-orders/edit?id=${so.id}`) },
    {
      label: 'Convert',
      dividerBefore: true,
      children: [
        { label: 'Tax Invoice', onClick: () => navigate(`/invoices/create?convertFrom=sales-order-to-invoice&sourceId=${so.id}`) },
        { label: 'Delivery Challan', onClick: () => navigate(`/dc/create?convertFrom=sales-order-to-challan&sourceId=${so.id}`) },
      ],
    },
    { label: 'Duplicate', icon: CopyIcon, dividerBefore: true, onClick: () => duplicateOrder(so) },
    { label: 'Delete', icon: Trash2Icon, danger: true, dividerBefore: true, onClick: () => deleteOrders([so.id]) },
  ];

  const renderCell = (col: ShellColumn, so: any) => {
    if (col.id === 'soNumber') return <span className="font-medium text-zinc-900">{so.sales_order_no}</span>;
    if (col.id === 'client') {
      return (
        <div className="max-w-[180px] truncate" title={so.client?.client_name || '-'}>
          {so.client?.client_name || '-'}
        </div>
      );
    }
    if (col.id === 'project') {
      return (
        <div className="max-w-[160px] truncate" title={so.project?.name || '-'}>
          {so.project?.name || '-'}
        </div>
      );
    }
    if (col.id === 'quotation') return <span>{so.quotation_no || '-'}</span>;
    if (col.id === 'date') return <span className="whitespace-nowrap">{formatDate(so.order_date)}</span>;
    if (col.id === 'converted') return <span className="whitespace-nowrap">{so.converted_at ? formatDate(so.converted_at) : '-'}</span>;
    if (col.id === 'total') return <span className="font-semibold text-zinc-900">{formatCurrency(so.grand_total)}</span>;
    if (col.id === 'approval') {
      const meta = STATUS_COLORS[so.status] || { bg: 'bg-zinc-100', color: 'text-zinc-700', label: so.status };
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
      );
    }
    if (col.id === 'inventory') {
      const meta = STOCK_STATUS_COLORS[so.stock_status || 'shortfall'];
      const StockIcon = meta.icon;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.bg} ${meta.text}`}>
          <StockIcon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      );
    }
    return null;
  };

  return (
    <PermissionGuard permissions={['sales.view']}>
      <DocumentListShell
        title="Sales Orders"
        count={filteredOrders.length}
        subtitle="Manage client orders, warehouse stock checks, and MRP calculations."
        search={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search by SO no, client, project, quotation..."
        statusOptions={SO_STATUSES}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        statusLabel={(s) => (STATUS_COLORS[s]?.label || s)}
        statusFilterStyle="pills"
        onCreate={() => navigate('/sales-orders/create')}
        createLabel="Create Sales Order"
        columns={SO_COLUMNS}
        visibleIds={visibleIds}
        onVisibleChange={setVisibleIds}
        columnStorageKey="so-list-columns"
        rows={filteredOrders}
        getRowId={(so: any) => so.id}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onRowClick={(so: any) => navigate(`/sales-orders/view?id=${so.id}`)}
        renderCell={renderCell}
        rowActions={(so: any) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sales-orders/view?id=${so.id}`)}
            className="text-zinc-600 hover:text-zinc-950 font-medium text-xs px-2.5 py-1.5 border border-zinc-200 bg-white rounded-lg shadow-sm"
          >
            <EyeIcon className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
        )}
        rowMenuItems={soRowMenuItems}
        bulkBar={{
          render: (ids, clear) => (
            <button
              onClick={async () => { if (await deleteOrders(Array.from(ids))) clear(); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all active:scale-[0.98]"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
              Delete All
            </button>
          ),
        }}
        loading={isLoading}
        loadingText="Loading Sales Orders..."
        emptyTitle="No Sales Orders found"
        emptyHint="Try adjusting your search terms, filter by status, or create a new sales order."
      />
    </PermissionGuard>
  );
}
