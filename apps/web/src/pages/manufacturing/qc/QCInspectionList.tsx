import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus } from 'lucide-react';
import { useQCInspectionsListQuery } from '../../../features/manufacturing';
import { Table, ColumnDef, RowAction } from '../../../components/table';
import { QCInspection } from '../../../features/manufacturing/model/types';

type QCInspectionListProps = {
  onNavigate?: (path: string) => void;
};

const PAGE_SIZE = 10;

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Results' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'partially_accepted', label: 'Partially Accepted' },
  { id: 'rejected', label: 'Rejected' },
];

export default function QCInspectionList({ onNavigate }: QCInspectionListProps) {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: rawInspections, isLoading } = useQCInspectionsListQuery(
    organisation?.id,
    resultFilter === 'all' ? undefined : resultFilter
  );

  const inspections = rawInspections ? rawInspections.filter(ins => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ins.inspection_no.toLowerCase().includes(q) ||
      ins.materials?.name?.toLowerCase().includes(q) ||
      ins.batch_no.toLowerCase().includes(q)
    );
  }) : [];

  const pagedData = inspections?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const columns: ColumnDef<QCInspection>[] = [
    {
      header: 'Inspection No',
      accessorKey: 'inspection_no',
      id: 'inspection_no',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {row.inspection_no}
        </span>
      ),
    },
    {
      header: 'Product',
      id: 'product_name',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#374151' }}>
          {row.materials?.name || '—'}
        </span>
      ),
    },
    {
      header: 'Batch No',
      accessorKey: 'batch_no',
      id: 'batch_no',
      align: 'left',
    },
    {
      header: 'Presented Qty',
      id: 'produced_qty',
      align: 'left',
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#4b5563' }}>
          {row.produced_qty} {row.materials?.unit}
        </span>
      ),
    },
    {
      header: 'Accepted Qty',
      id: 'accepted_qty',
      align: 'left', // Keep left-aligned as per Table Alignment Rule in monorepo guidelines
      cell: ({ row }) => (
        <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
          {row.accepted_qty} {row.materials?.unit}
        </span>
      ),
    },
    {
      header: 'Result',
      id: 'inspection_result',
      align: 'left',
      type: 'status',
      statusType: (row) => {
        if (row.inspection_result === 'accepted') return 'success';
        if (row.inspection_result === 'partially_accepted') return 'warning';
        if (row.inspection_result === 'rejected') return 'danger';
        return 'neutral';
      },
    },
  ];

  const getRowActions = (row: QCInspection): RowAction[] => [
    {
      label: 'View Details',
      onClick: () => onNavigate?.(`/manufacturing/qc/${row.id}`),
    },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', position: 'sticky', top: 0, zIndex: 40 }} className="flex justify-between">
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Finished Goods QC Inspections</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Define product test specifications and log quality control outcomes</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onNavigate?.('/manufacturing/qc/ipqc')}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              color: '#374151',
              background: '#fff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            In-Process QC (IPQC)
          </button>
          <button
            onClick={() => onNavigate?.('/manufacturing/qc/parameters')}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              color: '#374151',
              background: '#fff',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Manage Parameters
          </button>
          <button
            onClick={() => onNavigate?.('/manufacturing/qc/create')}
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
            <Plus size={14} /> New Inspection
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Table<QCInspection>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={PAGE_SIZE}
          totalRows={inspections.length}
          searchable
          pagination
          onPageChange={setPage}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          filterOptions={FILTER_OPTIONS}
          selectedFilterId={resultFilter}
          onFilterSelect={(id) => { setResultFilter(id); setPage(1); }}
          rowActions={getRowActions}
          onRowClick={(row) => onNavigate?.(`/manufacturing/qc/${row.id}`)}
          onView={(row) => onNavigate?.(`/manufacturing/qc/${row.id}`)}
          emptyTitle="No inspections found"
          emptySubtitle="Perform a production entry and initiate quality control inspection logs."
        />
      </div>
    </div>
  );
}
