// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { Table, ColumnDef, NestedHeaderDef } from '../Custometable';
import { Button } from '../components/ui/button';
import { Eye, Trash2, Pencil, RefreshCw, Send, CheckCircle } from 'lucide-react';

interface MockItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  gstPercent: number;
  status: string;
}

const SAMPLE_DATA: MockItem[] = [
  { id: '1', itemCode: 'M-101', itemName: 'GI Pipe 2"', unit: 'Mtr', qty: 150, unitPrice: 420.00, totalPrice: 63000.00, gstPercent: 18, status: 'approved' },
  { id: '2', itemCode: 'M-102', itemName: 'PVC Conduit 25mm', unit: 'Mtr', qty: 450, unitPrice: 35.50, totalPrice: 15975.00, gstPercent: 18, status: 'approved' },
  { id: '3', itemCode: 'M-103', itemName: 'Copper Wire 1.5 sqmm', unit: 'Coil', qty: 30, unitPrice: 1250.00, totalPrice: 37500.00, gstPercent: 18, status: 'pending' },
  { id: '4', itemCode: 'M-104', itemName: 'Slab Junction Box', unit: 'Nos', qty: 120, unitPrice: 48.00, totalPrice: 5760.00, gstPercent: 12, status: 'rejected' },
  { id: '5', itemCode: 'M-105', itemName: 'LED Panel Light 15W', unit: 'Nos', qty: 80, unitPrice: 380.00, totalPrice: 30400.00, gstPercent: 12, status: 'approved' },
  { id: '6', itemCode: 'M-106', itemName: 'Flexible Pipe 20mm', unit: 'Bundle', qty: 15, unitPrice: 280.00, totalPrice: 4200.00, gstPercent: 18, status: 'pending' },
  { id: '7', itemCode: 'M-107', itemName: 'Distribution Board 12Way', unit: 'Nos', qty: 4, unitPrice: 2450.00, totalPrice: 9800.00, gstPercent: 18, status: 'approved' },
];

export default function CustomTableDemo() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredData = useMemo(() => {
    return SAMPLE_DATA.filter((item) => {
      const matchesSearch = 
        item.itemName.toLowerCase().includes(search.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' || 
        item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const columns: ColumnDef<MockItem>[] = [
    {
      header: 'Item Code',
      accessorKey: 'itemCode',
      id: 'itemCode',
      type: 'text',
      align: 'left',
      cellStyle: { fontFamily: 'monospace', fontSize: '12px' }
    },
    {
      header: 'Item Name',
      accessorKey: 'itemName',
      id: 'itemName',
      type: 'text',
      align: 'left',
      cellStyle: { fontWeight: 600, color: '#1F2937' }
    },
    {
      header: 'Unit',
      accessorKey: 'unit',
      id: 'unit',
      type: 'text',
      align: 'center',
    },
    {
      header: 'Qty',
      accessorKey: 'qty',
      id: 'qty',
      type: 'number',
      align: 'right',
    },
    {
      header: 'Unit Price',
      accessorKey: 'unitPrice',
      id: 'unitPrice',
      type: 'money',
      align: 'right',
      cell: ({ row }) => `₹${row.unitPrice.toLocaleString('en-IN')}`,
    },
    {
      header: 'Total Cost',
      accessorKey: 'totalPrice',
      id: 'totalPrice',
      type: 'money',
      align: 'right',
      cellStyle: { fontWeight: 700, color: '#0F172A' },
      cell: ({ row }) => `₹${row.totalPrice.toLocaleString('en-IN')}`,
    },
    {
      header: 'GST %',
      accessorKey: 'gstPercent',
      id: 'gstPercent',
      type: 'number',
      align: 'center',
      cell: ({ row }) => `${row.gstPercent}%`
    },
    {
      header: 'Status',
      accessorKey: 'status',
      id: 'status',
      type: 'status',
      align: 'center',
      statusType: (row) => {
        if (row.status === 'approved') return 'success';
        if (row.status === 'pending') return 'warning';
        return 'error';
      },
      cell: ({ row }) => row.status.toUpperCase()
    }
  ];



  const handleRowSelect = (row: MockItem, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(row.id);
      else next.delete(row.id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pagedData.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const rowActions = (row: MockItem) => [
    { label: 'Quick View', icon: <Eye size={14} />, onClick: () => alert(`Viewing item: ${row.itemName}`) },
    { label: 'Edit specs', icon: <Pencil size={14} />, onClick: () => alert(`Editing item: ${row.itemName}`) },
    { label: 'Delete item', icon: <Trash2 size={14} />, variant: 'danger', onClick: () => alert(`Deleted ${row.itemName}`) },
  ];

  const bulkActions = [
    {
      label: 'Approve Selected',
      icon: <CheckCircle size={14} />,
      variant: 'default',
      onClick: (rows) => alert(`Approved items: ${rows.map(r => r.itemName).join(', ')}`),
    },
    {
      label: 'Bulk Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger',
      onClick: (rows) => alert(`Deleted items: ${rows.map(r => r.itemName).join(', ')}`),
    }
  ];

  const filterOptions = [
    { id: 'all', label: 'All Items' },
    { id: 'approved', label: 'Approved Only' },
    { id: 'pending', label: 'Pending Review' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', padding: '40px', fontFamily: '"Inter", system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>
            Custom Table Demo (Flat)
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            Demonstrates custom column styling, cell styling, filters, page limits, sorting, row checks, and context menus.
          </p>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', overflow: 'hidden' }}>
          <Table<MockItem>
            data={pagedData}
            columns={columns}
            loading={false}
            page={page}
            pageSize={pageSize}
            totalRows={filteredData.length}
            searchable={true}
            selectable={true}
            sortable={true}
            pagination={true}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            onSearch={(val) => { setSearch(val); setPage(1); }}
            filterOptions={filterOptions}
            selectedFilterId={statusFilter}
            onFilterSelect={(id) => { setStatusFilter(id); setPage(1); }}
            selectedRowIds={selectedIds}
            onRowSelectChange={handleRowSelect}
            onSelectAllChange={handleSelectAll}
            rowActions={rowActions}
            bulkActions={bulkActions}
            hiddenColumnIds={hiddenColumns}
            onColumnVisibilityChange={setHiddenColumns}
            mandatoryColumnIds={['itemName', 'totalPrice']}
            emptyTitle="No items found"
            emptySubtitle="Check your filters or try a different search phrase."
          />
        </div>
      </div>
    </div>
  );
}
