import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus } from 'lucide-react';
import { useDispatchOrdersListQuery } from '../../../features/manufacturing';
import { Table, ColumnDef, RowAction } from '../../../components/table';
import { DispatchOrder } from '../../../features/manufacturing/model/types';

type DispatchListProps = {
  onNavigate?: (path: string) => void;
};

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'draft', label: 'Draft' },
  { id: 'picking', label: 'Picking' },
  { id: 'packed', label: 'Packed' },
  { id: 'verified', label: 'Verified' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function DispatchList({ onNavigate }: DispatchListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: rawOrders, isLoading } = useDispatchOrdersListQuery(organisation?.id, statusFilter === 'all' ? undefined : statusFilter);

  const orders = rawOrders ? rawOrders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.dispatch_no.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q);
  }) : [];

  const pagedData = orders?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const columns: ColumnDef<DispatchOrder>[] = [
    {
      header: 'DO Number',
      accessorKey: 'dispatch_no',
      id: 'dispatch_no',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {row.dispatch_no}
        </span>
      ),
    },
    {
      header: 'Customer Name',
      accessorKey: 'customer_name',
      id: 'customer_name',
      align: 'left',
    },
    {
      header: 'Planned Date',
      id: 'planned_dispatch_date',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#4b5563' }}>
          {row.planned_dispatch_date || '—'}
        </span>
      ),
    },
    {
      header: 'Actual Date',
      id: 'actual_dispatch_date',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#4b5563' }}>
          {row.actual_dispatch_date || '—'}
        </span>
      ),
    },
    {
      header: 'Freight Charge',
      id: 'freight_charges',
      align: 'left', // Keep left-aligned as per Table Alignment Rule in monorepo guidelines
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#374151' }}>
          ₹{row.freight_charges?.toLocaleString('en-IN') || '0'}
        </span>
      ),
    },
    {
      header: 'Status',
      id: 'status',
      align: 'left',
      type: 'status',
      statusType: (row) => {
        if (row.status === 'dispatched') return 'success';
        if (row.status === 'picking' || row.status === 'packed' || row.status === 'verified') return 'warning';
        if (row.status === 'cancelled') return 'danger';
        return 'neutral';
      },
    },
  ];

  const getRowActions = (row: DispatchOrder): RowAction[] => [
    {
      label: 'View Details',
      onClick: () => onNavigate?.(`/manufacturing/dispatch/${row.id}`),
    },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Dispatch Queue (P0)</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Manage finished goods picking, verification, and customer delivery challans</span>
        </div>
        <button
          onClick={() => onNavigate?.('/manufacturing/dispatch/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            background: '#185FA5',
            border: '1px solid #185FA5',
            color: '#fff',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
        >
          <Plus size={14} /> Create Dispatch Order
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Table<DispatchOrder>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          totalRows={orders.length}
          searchable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={statusFilter}
          onFilterSelect={(id) => { setStatusFilter(id); setPage(1); }}
          rowActions={getRowActions}
          onRowClick={(row) => onNavigate?.(`/manufacturing/dispatch/${row.id}`)}
          onView={(row) => onNavigate?.(`/manufacturing/dispatch/${row.id}`)}
          emptyTitle="No dispatch orders found"
          emptySubtitle="Create a new dispatch order from the button above to start picking."
        />
      </div>
    </div>
  );
}
