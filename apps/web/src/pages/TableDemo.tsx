import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Table, ColumnDef, StatusType, RowAction, BulkAction } from '../components/table';
import { Eye, Pencil, Copy, Truck, RotateCcw, Trash2, PackageCheck, Send, RefreshCcw, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { RangeCalendar } from '../components/ui';

// ── Demo data types ────────────────────────────────────────────────────────────

interface Order {
  id: string;
  orderId: string;
  date: string;
  customer: string;
  items: number;
  total: number;
  paymentStatus: string;
  fulfillment: string;
  shippingStatus: string;
}

// ── Seed data (matches the reference screenshot) ───────────────────────────────

const DEMO_ORDERS: Order[] = [
  { id: '1',  orderId: '#10428', date: 'Jul 23, 2026', customer: 'Olivia Johnson',    items: 1, total: 128.50, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '2',  orderId: '#10427', date: 'Jul 23, 2026', customer: 'Ethan Carter',      items: 2, total: 64.90,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'In transit' },
  { id: '3',  orderId: '#10426', date: 'Jul 23, 2026', customer: 'Sophia Martinez',   items: 2, total: 212.30, paymentStatus: 'Pending',  fulfillment: 'Unfulfilled', shippingStatus: 'Label created' },
  { id: '4',  orderId: '#10425', date: 'Jul 23, 2026', customer: 'Alex Mercer',       items: 3, total: 89.99,  paymentStatus: 'Paid',     fulfillment: 'Unfulfilled', shippingStatus: '-' },
  { id: '5',  orderId: '#10424', date: 'Jul 23, 2026', customer: 'Jordan Lee',        items: 3, total: 45.00,  paymentStatus: 'Refunded', fulfillment: 'Cancelled',   shippingStatus: 'Cancelled' },
  { id: '6',  orderId: '#10423', date: 'Jul 23, 2026', customer: 'Taylor Smith',      items: 3, total: 356.75, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '7',  orderId: '#10422', date: 'Jul 23, 2026', customer: 'Jamie Parker',      items: 3, total: 73.20,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '8',  orderId: '#10421', date: 'Jul 23, 2026', customer: 'Morgan Reed',       items: 3, total: 159.95, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '9',  orderId: '#10420', date: 'Jul 23, 2026', customer: 'Casey Taylor',      items: 3, total: 29.99,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '10', orderId: '#10419', date: 'Jul 23, 2026', customer: 'Riley Johnson',     items: 3, total: 92.15,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Departed transi…' },
  { id: '11', orderId: '#10418', date: 'Jul 23, 2026', customer: 'Cameron Brown',     items: 3, total: 73.20,  paymentStatus: 'Paid',     fulfillment: 'Unfulfilled', shippingStatus: '-' },
  { id: '12', orderId: '#10417', date: 'Jul 23, 2026', customer: 'Drew Wilson',       items: 3, total: 64.90,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '13', orderId: '#10416', date: 'Jul 22, 2026', customer: 'Avery Thomas',      items: 1, total: 199.00, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '14', orderId: '#10415', date: 'Jul 22, 2026', customer: 'Quinn Davis',       items: 4, total: 420.00, paymentStatus: 'Pending',  fulfillment: 'Unfulfilled', shippingStatus: '-' },
  { id: '15', orderId: '#10414', date: 'Jul 22, 2026', customer: 'Blake Anderson',    items: 2, total: 87.50,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'In transit' },
  { id: '16', orderId: '#10413', date: 'Jul 22, 2026', customer: 'Reese Garcia',      items: 1, total: 34.99,  paymentStatus: 'Refunded', fulfillment: 'Cancelled',   shippingStatus: 'Cancelled' },
  { id: '17', orderId: '#10412', date: 'Jul 22, 2026', customer: 'Harper White',      items: 5, total: 512.75, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '18', orderId: '#10411', date: 'Jul 22, 2026', customer: 'Finley Clark',      items: 2, total: 145.60, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '19', orderId: '#10410', date: 'Jul 21, 2026', customer: 'Skyler Hall',       items: 3, total: 78.30,  paymentStatus: 'Pending',  fulfillment: 'Unfulfilled', shippingStatus: 'Label created' },
  { id: '20', orderId: '#10409', date: 'Jul 21, 2026', customer: 'Emerson Young',     items: 1, total: 250.00, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '21', orderId: '#10408', date: 'Jul 21, 2026', customer: 'Rowan King',        items: 2, total: 116.40, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'In transit' },
  { id: '22', orderId: '#10407', date: 'Jul 21, 2026', customer: 'Phoenix Wright',    items: 4, total: 340.00, paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
  { id: '23', orderId: '#10406', date: 'Jul 20, 2026', customer: 'Sage Robinson',     items: 1, total: 55.00,  paymentStatus: 'Paid',     fulfillment: 'Unfulfilled', shippingStatus: '-' },
  { id: '24', orderId: '#10405', date: 'Jul 20, 2026', customer: 'Dakota Lee',        items: 3, total: 189.90, paymentStatus: 'Pending',  fulfillment: 'Unfulfilled', shippingStatus: '-' },
  { id: '25', orderId: '#10404', date: 'Jul 20, 2026', customer: 'River Scott',       items: 2, total: 72.00,  paymentStatus: 'Paid',     fulfillment: 'Fulfilled',   shippingStatus: 'Delivered' },
];

// ── Status → StatusType mapping ────────────────────────────────────────────────

const paymentStatusMap: Record<string, StatusType> = {
  Paid:     'success',
  Pending:  'warning',
  Refunded: 'error',
};

const fulfillmentStatusMap: Record<string, StatusType> = {
  Fulfilled:   'success',
  Unfulfilled: 'neutral',
  Cancelled:   'error',
};

const shippingStatusMap: Record<string, StatusType> = {
  'Delivered':       'success',
  'In transit':      'blue',
  'Label created':   'blue',
  'Departed transi…':'blue',
  'Cancelled':       'error',
  '-':               'neutral',
};

// ── Filter options ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { id: 'all',         label: 'All' },
  { id: 'unfulfilled', label: 'Unfulfilled' },
  { id: 'unpaid',      label: 'Unpaid' },
  { id: 'delivered',   label: 'Delivered' },
];

// ── Columns ────────────────────────────────────────────────────────────────────

const columns: ColumnDef<Order>[] = [
  {
    header: 'Order ID',
    accessorKey: 'orderId',
    id: 'orderId',
    type: 'id',
    align: 'left',
  },
  {
    header: 'Date',
    accessorKey: 'date',
    id: 'date',
    type: 'date',
    align: 'left',
  },
  {
    header: 'Customer',
    accessorKey: 'customer',
    id: 'customer',
    type: 'text',
    align: 'left',
  },
  {
    header: 'Items',
    accessorKey: 'items',
    id: 'items',
    type: 'number',
    align: 'center',
  },
  {
    header: 'Total',
    accessorKey: 'total',
    id: 'total',
    type: 'money',
    align: 'left',
    cell: ({ getValue }) => `$${(getValue() as number).toFixed(2)}`,
  },
  {
    header: 'Payment status',
    accessorKey: 'paymentStatus',
    id: 'paymentStatus',
    type: 'status',
    align: 'center',
    statusType: (row) => paymentStatusMap[row.paymentStatus] ?? 'neutral',
  },
  {
    header: 'Fulfillment',
    accessorKey: 'fulfillment',
    id: 'fulfillment',
    type: 'status',
    align: 'center',
    statusType: (row) => fulfillmentStatusMap[row.fulfillment] ?? 'neutral',
  },
  {
    header: 'Shipping status',
    accessorKey: 'shippingStatus',
    id: 'shippingStatus',
    type: 'status',
    align: 'center',
    statusType: (row) => shippingStatusMap[row.shippingStatus] ?? 'neutral',
  },
];

// ── Row-level actions (per-row ⋯ dropdown, dynamic to module) ──────────────────

const getRowActions = (row: Order): RowAction[] => {
  const actions: RowAction[] = [
    { label: 'View details', icon: <Eye size={14} />, onClick: () => alert(`View ${row.orderId}`) },
    { label: 'Edit order',   icon: <Pencil size={14} />, onClick: () => alert(`Edit ${row.orderId}`) },
    { label: 'Duplicate',    icon: <Copy size={14} />, onClick: () => alert(`Duplicate ${row.orderId}`) },
  ];

  // Dynamic actions based on row state
  if (row.fulfillment === 'Unfulfilled') {
    actions.push({ label: 'Mark as fulfilled', icon: <PackageCheck size={14} />, onClick: () => alert(`Fulfill ${row.orderId}`) });
  }
  if (row.shippingStatus === '-' || row.shippingStatus === 'Label created') {
    actions.push({ label: 'Create shipment', icon: <Truck size={14} />, onClick: () => alert(`Ship ${row.orderId}`) });
  }
  if (row.paymentStatus === 'Paid') {
    actions.push({ label: 'Issue refund', icon: <RotateCcw size={14} />, variant: 'danger', onClick: () => alert(`Refund ${row.orderId}`) });
  }

  actions.push({ label: 'Delete order', icon: <Trash2 size={14} />, variant: 'danger', onClick: () => alert(`Delete ${row.orderId}`) });
  return actions;
};

// ── Bulk actions (shown when rows are selected, dynamic to module) ─────────────

const bulkActions: BulkAction<Order>[] = [
  {
    label: 'Bulk Fulfill',
    icon: <PackageCheck size={14} />,
    variant: 'default',
    onClick: (rows) => alert(`Fulfilling ${rows.length} orders:\n${rows.map(r => r.orderId).join(', ')}`),
  },
  {
    label: 'Bulk Ship',
    icon: <Send size={14} />,
    variant: 'default',
    onClick: (rows) => alert(`Creating shipments for ${rows.length} orders:\n${rows.map(r => r.orderId).join(', ')}`),
  },
  {
    label: 'Bulk Refund',
    icon: <RefreshCcw size={14} />,
    variant: 'danger',
    onClick: (rows) => alert(`Refunding ${rows.length} orders:\n${rows.map(r => r.orderId).join(', ')}`),
  },
  {
    label: 'Delete',
    icon: <Trash2 size={14} />,
    variant: 'danger',
    onClick: (rows) => alert(`Deleting ${rows.length} orders:\n${rows.map(r => r.orderId).join(', ')}`),
  },
];

// ── Demo Page Component ────────────────────────────────────────────────────────

export default function TableDemo() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterId, setFilterId] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);

  // Collapse filter panel states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');

  // Popover calendar states
  const [showCalPopover, setShowCalPopover] = useState(false);
  const calPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calPopoverRef.current && !calPopoverRef.current.contains(e.target as Node)) {
        setShowCalPopover(false);
      }
    };
    if (showCalPopover) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalPopover]);

  const dateRangeLabel = useMemo(() => {
    if (!startDate) return 'Select date range';
    const startFmt = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!endDate) return `${startFmt} - ...`;
    const endFmt = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startFmt} - ${endFmt}`;
  }, [startDate, endDate]);

  // Filter logic
  const filtered = useMemo(() => {
    let list = DEMO_ORDERS;

    if (filterId === 'unfulfilled') list = list.filter((o) => o.fulfillment === 'Unfulfilled');
    if (filterId === 'unpaid') list = list.filter((o) => o.paymentStatus === 'Pending');
    if (filterId === 'delivered') list = list.filter((o) => o.shippingStatus === 'Delivered');

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderId.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q)
      );
    }

    //Collapsible panel filters
    if (startDate) {
      const start = new Date(startDate);
      list = list.filter((o) => new Date(o.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      list = list.filter((o) => new Date(o.date) <= end);
    }
    if (selectedMonth !== 'all') {
      list = list.filter((o) => o.date.includes(selectedMonth));
    }
    if (selectedCustomer !== 'all') {
      list = list.filter((o) => o.customer === selectedCustomer);
    }

    return list;
  }, [filterId, search, startDate, endDate, selectedMonth, selectedCustomer]);

  // Paginate
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Selection handlers
  const handleRowSelect = (row: Order, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(row.id);
      else next.delete(row.id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pagedData.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const filterPanel = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
      {/* Month Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Month</span>
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
          style={{
            padding: '4px 10px',
            fontSize: '13px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            outline: 'none',
            minWidth: '120px',
            height: '32px',
            boxSizing: 'border-box',
          }}
        >
          <option value="all">All Months</option>
          <option value="Jul">July 2026</option>
          <option value="Jun">June 2026</option>
        </select>
      </div>

      {/* Customer Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</span>
        <select
          value={selectedCustomer}
          onChange={(e) => { setSelectedCustomer(e.target.value); setPage(1); }}
          style={{
            padding: '4px 10px',
            fontSize: '13px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            outline: 'none',
            minWidth: '160px',
            height: '32px',
            boxSizing: 'border-box',
          }}
        >
          <option value="all">All Customers</option>
          {Array.from(new Set(DEMO_ORDERS.map(o => o.customer))).map(cust => (
            <option key={cust} value={cust}>{cust}</option>
          ))}
        </select>
      </div>

      {/* Date Range Popover */}
      <div ref={calPopoverRef} style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Range</span>
        <button
          onClick={() => setShowCalPopover(!showCalPopover)}
          style={{
            height: '32px',
            paddingInline: '10px',
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            backgroundColor: showCalPopover ? '#F9FAFB' : '#FFFFFF',
            color: '#374151',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'all 150ms ease',
          }}
          className="col-customizer-trigger"
        >
          <CalendarIcon size={14} style={{ color: '#6B7280' }} />
          <span>{dateRangeLabel}</span>
          <ChevronDown size={14} style={{ color: '#9CA3AF' }} />
        </button>

        {showCalPopover && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '100%',
              marginTop: '6px',
              zIndex: 100,
              backgroundColor: '#FFFFFF',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              borderRadius: '12px',
              border: '1px solid #EAEAEA',
              animation: 'colDropIn 150ms ease',
            }}
          >
            <RangeCalendar
              value={{
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
              }}
              onChange={(range) => {
                setStartDate(range.startDate ? range.startDate.toISOString().split('T')[0] : '');
                setEndDate(range.endDate ? range.endDate.toISOString().split('T')[0] : '');
                setPage(1);
                if (range.startDate && range.endDate) {
                  setShowCalPopover(false);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Clear/Reset Button */}
      {(startDate || endDate || selectedMonth !== 'all' || selectedCustomer !== 'all') && (
        <button
          onClick={() => {
            setStartDate('');
            setEndDate('');
            setSelectedMonth('all');
            setSelectedCustomer('all');
            setPage(1);
          }}
          style={{
            alignSelf: 'flex-end',
            height: '32px',
            paddingInline: '12px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#DC2626',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            transition: 'background-color 150ms ease',
          }}
          className="col-show-all-btn"
        >
          Reset Filters
        </button>
      )}
    </div>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F5F5',
        padding: '40px',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Page heading */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 4px 0' }}>
            Enterprise Data Table — Demo
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            Preview the reusable table component. Select rows to see bulk actions. Click ⋯ on any row for per-row actions.
          </p>
        </div>

        {/* Table component */}
        <Table<Order>
          data={pagedData}
          columns={columns}
          loading={false}
          page={page}
          pageSize={pageSize}
          totalRows={filtered.length}
          searchable
          selectable
          sortable
          pagination
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={filterId}
          onFilterSelect={(id) => { setFilterId(id); setPage(1); }}
          selectedRowIds={selectedIds}
          onRowSelectChange={handleRowSelect}
          onSelectAllChange={handleSelectAll}
          onView={(row) => alert(`Quick View: ${row.orderId} - Customer: ${row.customer} - Total: $${row.total.toFixed(2)}`)}
          rowActions={getRowActions}
          bulkActions={bulkActions}
          hiddenColumnIds={hiddenColumnIds}
          onColumnVisibilityChange={setHiddenColumnIds}
          mandatoryColumnIds={['orderId', 'customer', 'total']}
          filterPanel={filterPanel}
          emptyTitle="No orders found"
          emptySubtitle="Try adjusting your filters or search query."
        />
      </div>
    </div>
  );
}
